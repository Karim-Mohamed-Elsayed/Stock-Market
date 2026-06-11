import os
import sys
import time
import logging
import pandas as pd
import yfinance as yf
import requests
import boto3
import botocore

from io import StringIO, BytesIO
from pathlib import Path
from datetime import datetime, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET_NAME  = "sp500-hourly"  # Ensure you create this bucket in your MinIO console
# MINIO_URL    = "http://localhost:9000"
MINIO_URL    = "http://minio:9000"
MINIO_ACCESS = "admin"
MINIO_SECRET = "supersecretpassword"

INTERVAL     = "1h"
BATCH_SIZE   = 50
SLEEP_SECS   = 2
START_DATE   = (datetime.today() - timedelta(days=729)).strftime("%Y-%m-%d")
END_DATE     = datetime.today().strftime("%Y-%m-%d")
LOG_FILE     = "hourly_download.log"
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout), # Simply use sys.stdout directly
    ],

)
log = logging.getLogger(__name__)

# Initialize MinIO (S3) Client
s3_client = boto3.client(
    "s3",
    endpoint_url=MINIO_URL,
    aws_access_key_id=MINIO_ACCESS,
    aws_secret_access_key=MINIO_SECRET,
)


def get_sp500_tickers() -> list[str]:
    log.info("Fetching S&P 500 tickers from Wikipedia ...")
    url     = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp    = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    tables  = pd.read_html(StringIO(resp.text))
    for t in tables:
        if "Symbol" in t.columns:
            tickers = t["Symbol"].dropna().str.replace(".", "-", regex=False).tolist()
            log.info(f"Found {len(tickers)} tickers.")
            return tickers
    raise ValueError("Symbol column not found.")


def get_last_timestamp(ticker: str) -> str | None:
    """Return the next fetch start (1 hour after last stored row in MinIO), or None."""
    object_key = f"{ticker}.csv"
    try:
        # Fetch the object from MinIO
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
        df = pd.read_csv(BytesIO(response['Body'].read()), index_col=0, parse_dates=True)
        
        if df.empty:
            return None
            
        last = pd.to_datetime(df.index).max()
        
        # Strip timezone info so comparison with naive datetime.today() works
        if hasattr(last, "tzinfo") and last.tzinfo is not None:
            last = last.tz_localize(None)
            
        # clamp: don't go beyond yfinance's 730-day limit
        yf_limit = datetime.today() - timedelta(days=729)
        if last < yf_limit:
            return START_DATE
            
        return (last + timedelta(hours=1)).strftime("%Y-%m-%d")
        
    except botocore.exceptions.ClientError as e:
        # Key does not exist yet (first execution)
        if e.response['Error']['Code'] == 'NoSuchKey':
            return None
        log.warning(f"MinIO error reading {ticker}: {e}")
        return None
    except Exception as e:
        log.warning(f"Could not check timestamp for {ticker}: {e}")
        return None


def group_by_start(tickers: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for t in tickers:
        start = get_last_timestamp(t) or START_DATE
        groups.setdefault(start, []).append(t)
    return groups


def download_batch(tickers: list[str], start: str) -> pd.DataFrame:
    return yf.download(
        tickers, start=start, end=END_DATE,
        interval=INTERVAL,
        group_by="ticker", auto_adjust=True,
        threads=True, progress=False,
    )


def append_or_create(ticker: str, new_data: pd.DataFrame) -> None:
    if new_data.empty:
        log.warning(f"  No new data for {ticker} -- skipped.")
        return
        
    object_key = f"{ticker}.csv"
    
    try:
        # Check for existing records inside the target MinIO bucket
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
        existing = pd.read_csv(BytesIO(response['Body'].read()), index_col=0, parse_dates=True)
        
        # Merge old and incoming batch data
        combined = pd.concat([existing, new_data])
        combined = combined[~combined.index.duplicated(keep="last")].sort_index()
        log.info(f"  {ticker}: +{len(new_data)} rows -> {len(combined)} total in MinIO")
    except botocore.exceptions.ClientError:
        # Fresh file setup
        combined = new_data
        log.info(f"  {ticker}: created in MinIO with {len(new_data)} rows")

    # Serialize back to memory buffer string
    csv_buffer = StringIO()
    combined.to_csv(csv_buffer)
    
    # Upload streaming bytes directly to your storage architecture
    s3_client.put_object(
        Bucket=BUCKET_NAME, 
        Key=object_key, 
        Body=csv_buffer.getvalue()
    )


def process_batch(batch: list[str], start: str) -> list[str]:
    failed = []
    try:
        df = download_batch(batch, start)
        if df.empty:
            return batch
        for ticker in batch:
            try:
                data = df[ticker].dropna(how="all") if len(batch) > 1 else df.dropna(how="all")
                append_or_create(ticker, data)
            except KeyError:
                log.warning(f"  {ticker} missing from batch.")
                failed.append(ticker)
    except Exception as e:
        log.error(f"  Batch failed: {e}")
        failed.extend(batch)
    return failed


def main():
    tickers = get_sp500_tickers()
    groups  = group_by_start(tickers)

    new_count    = len(groups.get(START_DATE, []))
    update_count = len(tickers) - new_count
    log.info(f"New tickers: {new_count} | To update: {update_count} | End date: {END_DATE}")

    all_failed = []
    for start_date, group in sorted(groups.items()):
        for i in range(0, len(group), BATCH_SIZE):
            batch = group[i : i + BATCH_SIZE]
            log.info(f"Batch {i // BATCH_SIZE + 1} | start={start_date} | {len(batch)} tickers")
            failed = process_batch(batch, start_date)
            all_failed.extend(failed)
            time.sleep(SLEEP_SECS)

    log.info("=" * 50)
    log.info(f"Done. Check your MinIO console at http://localhost:9001")
    if all_failed:
        pd.Series(all_failed).to_csv("failed_hourly.csv", index=False, header=["ticker"])
        log.warning(f"{len(all_failed)} failed tickers saved locally to failed_hourly.csv")


if __name__ == "__main__":
    main()