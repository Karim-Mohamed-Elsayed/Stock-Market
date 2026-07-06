from fastapi import APIRouter, Depends, HTTPException
import yfinance as yf
from cachetools import TTLCache
import requests

from app.services.s3_gold import S3GoldClient, S3GoldError, get_s3_gold_client
from app.schemas.quote import QuoteOut

router = APIRouter(prefix="/tickers", tags=["tickers"])

import asyncio
from datetime import datetime, time, timedelta
import pytz

_batch_quotes_cache = {}
_quotes_task = None


async def _fetch_quote_from_s3(client: S3GoldClient, s3, ticker: str) -> QuoteOut:
    key = f"daily/{ticker}.parquet"
    try:
        # Read the gold parquet file directly from S3
        df = await client._read_parquet(
            s3,
            client._gold_bucket,
            key,
            f"No daily history found for {ticker}"
        )
        if df.empty:
            return QuoteOut(
                ticker=ticker,
                price=None,
                previous_close=None,
                change=None,
                change_percent=None,
                currency=None,
                rsi=None,
                gics_sector=None,
                volatility=None
            )

        close_col = "Close" if "Close" in df.columns else "close"
        if close_col not in df.columns:
            return QuoteOut(
                ticker=ticker,
                price=None,
                previous_close=None,
                change=None,
                change_percent=None,
                currency=None,
                rsi=None,
                gics_sector=None,
                volatility=None
            )

        close_series = df[close_col].dropna()
        if len(close_series) >= 2:
            price = float(close_series.iloc[-1])
            prev_close = float(close_series.iloc[-2])
            change = price - prev_close
            change_percent = (change / prev_close) * 100
        elif len(close_series) == 1:
            price = float(close_series.iloc[-1])
            prev_close = None
            change = None
            change_percent = None
        else:
            price = None
            prev_close = None
            change = None
            change_percent = None

        rsi_col = "RSI" if "RSI" in df.columns else ("rsi" if "rsi" in df.columns else None)
        gics_col = "GICS_Sector" if "GICS_Sector" in df.columns else ("gics_sector" if "gics_sector" in df.columns else None)
        vol_col = "Rolling_30Day_StdDev" if "Rolling_30Day_StdDev" in df.columns else None
        
        rsi = float(df[rsi_col].dropna().iloc[-1]) if rsi_col and not df[rsi_col].dropna().empty else None
        gics_sector = str(df[gics_col].dropna().iloc[-1]) if gics_col and not df[gics_col].dropna().empty else None
        volatility = float(df[vol_col].dropna().iloc[-1]) if vol_col and not df[vol_col].dropna().empty else None

        return QuoteOut(
            ticker=ticker,
            price=price,
            previous_close=prev_close,
            change=change,
            change_percent=change_percent,
            currency=None,
            rsi=rsi,
            gics_sector=gics_sector,
            volatility=volatility
        )
    except Exception as exc:
        print(f"Failed to fetch S3 quote for {ticker}: {exc}")
        return QuoteOut(
            ticker=ticker,
            price=None,
            previous_close=None,
            change=None,
            change_percent=None,
            currency=None,
            rsi=None,
            gics_sector=None,
            volatility=None
        )


async def _fetch_all_quotes_from_s3(client: S3GoldClient, tickers: list[str]) -> dict[str, QuoteOut]:
    semaphore = asyncio.Semaphore(40)  # up to 40 concurrent S3 GET requests
    quotes = {}

    async def worker(ticker: str, s3):
        async with semaphore:
            quote = await _fetch_quote_from_s3(client, s3, ticker)
            quotes[ticker] = quote

    async with client._session.client("s3") as s3:
        tasks = [worker(ticker, s3) for ticker in tickers]
        await asyncio.gather(*tasks)

    return quotes


async def _quotes_scheduler_task(client: S3GoldClient):
    try:
        egypt_tz = pytz.timezone("Africa/Cairo")
    except Exception:
        # Fallback to UTC+2 if pytz fails
        from datetime import timezone
        egypt_tz = timezone(timedelta(hours=2))

    while True:
        try:
            # Load tickers dynamically from S3
            tickers = await client.list_tickers()

            # Perform initial or daily batch fetch directly from S3
            quotes = await _fetch_all_quotes_from_s3(client, tickers)
            
            # Update quotes cache
            _batch_quotes_cache["all_quotes"] = quotes
            print(f"Background quotes cache successfully populated with {len(quotes)} tickers from S3.")

            # Calculate delay until next 11:00 PM (23:00) Cairo time
            now_egypt = datetime.now(egypt_tz)
            target_egypt = datetime.combine(now_egypt.date(), time(23, 0, 0))
            if hasattr(egypt_tz, "localize"):
                target_egypt = egypt_tz.localize(target_egypt)
            else:
                target_egypt = target_egypt.replace(tzinfo=egypt_tz)

            if now_egypt >= target_egypt:
                target_egypt += timedelta(days=1)

            sleep_seconds = (target_egypt - now_egypt).total_seconds()
            print(f"Next quotes cache update scheduled at {target_egypt} Cairo Time (sleeping for {sleep_seconds:.1f}s)")
            
            await asyncio.sleep(sleep_seconds)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            print(f"Error in background quotes scheduler: {exc}")
            await asyncio.sleep(60)  # Retry after 1 minute


def start_quotes_scheduler(client: S3GoldClient):
    global _quotes_task
    if _quotes_task is None:
        _quotes_task = asyncio.create_task(_quotes_scheduler_task(client))


def stop_quotes_scheduler():
    global _quotes_task
    if _quotes_task is not None:
        _quotes_task.cancel()
        _quotes_task = None


@router.get("", response_model=list[str])
async def list_tickers(client: S3GoldClient = Depends(get_s3_gold_client)) -> list[str]:
    try:
        return await client.list_tickers()
    except S3GoldError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/quotes", response_model=dict[str, QuoteOut])
async def list_ticker_quotes(client: S3GoldClient = Depends(get_s3_gold_client)) -> dict[str, QuoteOut]:
    cache_key = "all_quotes"
    if cache_key in _batch_quotes_cache:
        return _batch_quotes_cache[cache_key]

    # Return empty dict if cache is not initialized yet
    # Let the background task fetch it to avoid server hangs
    return {}


