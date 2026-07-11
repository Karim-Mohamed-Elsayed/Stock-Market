import time
import logging
import pandas as pd
import yfinance as yf
import requests
import boto3
import botocore

from io import StringIO, BytesIO
from datetime import datetime, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
BUCKET_NAME  = "sp500-bronze"  # Your globally unique AWS S3 bucket name
INTERVAL     = "1d"
BATCH_SIZE   = 50
SLEEP_SECS   = 2
START_DATE   = (datetime.today() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")
END_DATE     = datetime.today().strftime("%Y-%m-%d")
LOG_FILE     = "daily_download.log"
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",                  
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
log = logging.getLogger(__name__)

# Initialize AWS S3 Client
# Leaving parameters empty forces boto3 to securely read configuration from ~/.aws/credentials
s3_client = boto3.client("s3")

def get_sp500_tickers() -> list[str]:
    log.info("Fetching S&P 500 tickers from Wikipedia …")
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


def get_last_date(ticker: str) -> str | None:
    """Return the next fetch start (1 day after last stored row in S3), or None."""
    object_key = f"daily/{ticker}.csv"  # ◄ Added 'daily/' folder prefix
    try:
        # Try to fetch the existing file from AWS S3
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
        # Read the object body directly into pandas
        df = pd.read_csv(BytesIO(response['Body'].read()), index_col=0, parse_dates=True)
        last = pd.to_datetime(df.index).max()
        return (last + timedelta(days=1)).strftime("%Y-%m-%d")
    
    except botocore.exceptions.ClientError as e:
        # If the file doesn't exist yet inside this folder, return None
        if e.response['Error']['Code'] == 'NoSuchKey':
            return None
        log.warning(f"AWS S3 Error reading {ticker}: {e}")
        return None
    except Exception as e:
        log.warning(f"Could not parse {ticker} data: {e}")
        return None


def group_by_start(tickers: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for t in tickers:
        start = get_last_date(t) or START_DATE
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
        log.warning(f"  No new data for {ticker}  skipped.")
        return
        
    object_key = f"daily/{ticker}.csv"  # ◄ Added 'daily/' folder prefix
    
    try:
        # Check if we already have data to append to
        response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
        existing = pd.read_csv(BytesIO(response['Body'].read()), index_col=0, parse_dates=True)
        
        # Combine and deduplicate
        combined = pd.concat([existing, new_data])
        combined = combined[~combined.index.duplicated(keep="last")].sort_index()
        log.info(f"  {ticker}: +{len(new_data)} rows → {len(combined)} total in AWS S3")
    except botocore.exceptions.ClientError:
        # File doesn't exist, we just write the new data
        combined = new_data
        log.info(f"  {ticker}: created in AWS S3 with {len(new_data)} rows")

    # Write the combined DataFrame to an in-memory string buffer
    csv_buffer = StringIO()
    combined.to_csv(csv_buffer)
    
    # Upload the buffer directly to AWS S3
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
    log.info(f"Done. Files are safely synchronized to AWS S3 bucket: {BUCKET_NAME}")
    if all_failed:
        pd.Series(all_failed).to_csv("failed_daily.csv", index=False, header=["ticker"])
        log.warning(f"{len(all_failed)} failed tickers saved locally to failed_daily.csv")


if __name__ == "__main__":
    main()