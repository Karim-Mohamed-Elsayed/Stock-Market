from fastapi import APIRouter, Depends, HTTPException

from app.schemas.history import HistoryLinkOut, HistoryPoint, OhlcHistoryPoint
from app.services.s3_gold import Interval, S3GoldClient, S3GoldError, get_s3_gold_client

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/{ticker}", response_model=list[HistoryPoint])
async def get_history(
    ticker: str,
    interval: Interval = "daily",
    client: S3GoldClient = Depends(get_s3_gold_client),
) -> list[HistoryPoint]:
    try:
        records = await client.get_history(ticker.upper(), interval)
    except S3GoldError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return records


@router.get("/{ticker}/ohlc", response_model=list[OhlcHistoryPoint])
async def get_history_ohlc(
    ticker: str,
    interval: Interval = "daily",
    client: S3GoldClient = Depends(get_s3_gold_client),
) -> list[OhlcHistoryPoint]:
    try:
        records = await client.get_ohlc_history(ticker.upper(), interval)
    except S3GoldError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return records


@router.get("/{ticker}/link", response_model=HistoryLinkOut)
async def get_history_link(
    ticker: str,
    interval: Interval = "daily",
    client: S3GoldClient = Depends(get_s3_gold_client),
) -> HistoryLinkOut:
    try:
        download_url = await client.get_history_download_url(ticker.upper(), interval)
    except S3GoldError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return HistoryLinkOut(download_url=download_url)
