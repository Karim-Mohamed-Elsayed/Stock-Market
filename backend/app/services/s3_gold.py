import asyncio
from functools import lru_cache
from io import BytesIO
from typing import Literal

import aioboto3
import pandas as pd
from botocore.config import Config
from botocore.exceptions import ClientError
from cachetools import TTLCache

from app.core.config import get_settings

Interval = Literal["daily", "hourly"]

# Short-lived so a leaked/logged URL stops working almost immediately; the
# frontend is expected to fetch it right after requesting the link.
DOWNLOAD_URL_EXPIRES_IN_SECONDS = 60

# The ticker universe (which S&P 500 constituents have a gold-layer file)
# changes at most daily, so a listing is safe to cache for a while rather
# than re-listing the bucket on every page load.
TICKER_LIST_CACHE_TTL_SECONDS = 300


class S3GoldError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class S3GoldClient:
    """Reads per-ticker parquet files from the gold- and silver-layer S3 buckets.

    Both layers are written by the Spark scripts under gold_layer_scripts/ and
    silver_layer_scripts/ using the same per-ticker layout,
    ``daily/<TICKER>.parquet`` and ``hourly/<TICKER>.parquet``. Gold holds the
    computed indicators (close, SMA/RSI/MACD, signal); silver still has the
    raw OHLCV columns that gold's ``select()`` drops. A fresh aioboto3 client
    is opened per call rather than held open, since aioboto3 clients wrap an
    aiohttp session that's meant to be used as a short-lived context manager
    rather than a long-lived singleton.
    """

    def __init__(
        self,
        gold_bucket: str,
        silver_bucket: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
    ):
        self._gold_bucket = gold_bucket
        self._silver_bucket = silver_bucket
        self._session = aioboto3.Session(
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
        )
        self._ticker_list_cache: TTLCache = TTLCache(maxsize=1, ttl=TICKER_LIST_CACHE_TTL_SECONDS)

    async def _read_parquet(self, s3, bucket: str, key: str, not_found_message: str) -> pd.DataFrame:
        try:
            response = await s3.get_object(Bucket=bucket, Key=key)
            body = await response["Body"].read()
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")
            if error_code in ("NoSuchKey", "404"):
                raise S3GoldError(404, not_found_message) from exc
            raise S3GoldError(502, f"S3 error fetching '{bucket}/{key}': {exc}") from exc

        return await asyncio.to_thread(pd.read_parquet, BytesIO(body))

    @staticmethod
    def _to_records(df: pd.DataFrame) -> list[dict]:
        df = df.rename(columns=str.lower)
        df["date"] = df["date"].astype(str)
        # Rolling indicators are NaN for the first rows of a ticker's history
        # (not enough data yet for the window); NaN isn't valid JSON, so these
        # must become None or the response body fails to parse client-side.
        df = df.astype(object).where(df.notna(), None)
        return df.to_dict(orient="records")

    async def get_history(self, ticker: str, interval: Interval) -> list[dict]:
        key = f"{interval}/{ticker}.parquet"
        async with self._session.client("s3") as s3:
            df = await self._read_parquet(
                s3, self._gold_bucket, key, f"No {interval} history found for '{ticker}'"
            )
        return self._to_records(df)

    async def get_ohlc_history(self, ticker: str, interval: Interval) -> list[dict]:
        """Gold's indicators joined with silver's Open/High/Low/Volume on Date.

        Gold is derived from silver by the same pipeline run, so every Date in
        gold is expected to have a matching row in silver — a left join off
        gold keeps its indicator set as the source of truth for which rows
        exist, same as ``get_history``.
        """
        key = f"{interval}/{ticker}.parquet"
        async with self._session.client("s3") as s3:
            gold_df, silver_df = await asyncio.gather(
                self._read_parquet(
                    s3, self._gold_bucket, key, f"No {interval} history found for '{ticker}'"
                ),
                self._read_parquet(
                    s3, self._silver_bucket, key, f"No {interval} OHLC data found for '{ticker}'"
                ),
            )

        merged = gold_df.merge(silver_df[["Date", "Open", "High", "Low", "Volume"]], on="Date", how="left")
        return self._to_records(merged)

    async def list_tickers(self) -> list[str]:
        """All tickers with a daily gold-layer file, i.e. the tracked universe.

        Derived from the bucket listing rather than a static table, so it's
        always exactly the set of tickers ``get_history``/``get_ohlc_history``
        can actually serve.
        """
        cached = self._ticker_list_cache.get("tickers")
        if cached is not None:
            return cached

        prefix = "daily/"
        tickers: list[str] = []
        async with self._session.client("s3") as s3:
            paginator = s3.get_paginator("list_objects_v2")
            try:
                async for page in paginator.paginate(Bucket=self._gold_bucket, Prefix=prefix):
                    for obj in page.get("Contents", []):
                        key = obj["Key"]
                        if key.endswith(".parquet"):
                            tickers.append(key.removeprefix(prefix).removesuffix(".parquet"))
            except ClientError as exc:
                raise S3GoldError(502, f"S3 error listing tickers: {exc}") from exc

        tickers.sort()
        self._ticker_list_cache["tickers"] = tickers
        return tickers

    async def get_history_download_url(self, ticker: str, interval: Interval) -> str:
        """Presigns a short-lived GET URL for the same key ``get_history`` reads.

        Signing is local (no request to AWS), so unlike ``get_history`` this
        can't confirm the object exists first — a bad ticker just yields a
        URL that 404s when the frontend fetches it directly from S3.
        """
        key = f"{interval}/{ticker}.parquet"
        async with self._session.client("s3", config=Config(signature_version="s3v4")) as s3:
            try:
                return await s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self._gold_bucket, "Key": key},
                    ExpiresIn=DOWNLOAD_URL_EXPIRES_IN_SECONDS,
                )
            except ClientError as exc:
                raise S3GoldError(502, f"Failed to generate download link for '{ticker}': {exc}") from exc


@lru_cache
def get_s3_gold_client() -> S3GoldClient:
    settings = get_settings()
    return S3GoldClient(
        gold_bucket=settings.s3_bucket_name,
        silver_bucket=settings.s3_silver_bucket_name,
        region=settings.aws_region,
        access_key_id=settings.aws_access_key_id,
        secret_access_key=settings.aws_secret_access_key,
    )
