from functools import lru_cache

import yfinance as yf
from cachetools import TTLCache
from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.schemas.quote import QuoteOut

router = APIRouter(prefix="/quote", tags=["quote"])


@lru_cache
def _cache() -> TTLCache:
    return TTLCache(maxsize=512, ttl=get_settings().quote_cache_ttl_seconds)


def _fetch_quote(ticker: str) -> QuoteOut:
    info = yf.Ticker(ticker).fast_info
    price = info.get("last_price")
    previous_close = info.get("previous_close")
    change = None
    change_percent = None
    if price is not None and previous_close:
        change = price - previous_close
        change_percent = (change / previous_close) * 100

    return QuoteOut(
        ticker=ticker.upper(),
        price=price,
        previous_close=previous_close,
        change=change,
        change_percent=change_percent,
        currency=info.get("currency"),
    )


@router.get("/{ticker}", response_model=QuoteOut)
def get_quote(ticker: str) -> QuoteOut:
    ticker = ticker.upper()
    cache = _cache()
    if ticker in cache:
        return cache[ticker]

    try:
        quote = _fetch_quote(ticker)
    except Exception as exc:  # yfinance raises assorted exceptions for bad tickers/network errors
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not fetch a live quote for '{ticker}'",
        ) from exc

    cache[ticker] = quote
    return quote
