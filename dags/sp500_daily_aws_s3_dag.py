"""
Airflow DAG: S&P 500 Daily Data Downloader -> AWS S3
Converted to modern TaskFlow API. Runs Mon-Fri at 10:00 PM UTC.
Downloads missing daily bars per ticker, and stores results in S3 under daily/<ticker>.parquet
"""

import time
import logging
import pandas as pd
import yfinance as yf
import requests
import boto3
import botocore

from io import BytesIO
from datetime import datetime, timedelta
from airflow.decorators import dag, task

# -- DAG Definition -------------------------------------------------------------
default_args = {
    "owner": "admin",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

@dag(
    dag_id="sp500_daily_s3_ingestion",
    description="Downloads daily S&P 500 OHLCV data and stores it in S3 as Parquet",
    default_args=default_args,
    schedule="30 23 * * 1-5",  # 11:30 PM UTC, Mon-Fri (after US market close)
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["sp500", "yfinance", "s3", "parquet"],
)
def sp500_daily_s3_ingestion_pipeline():

    @task()
    def run_daily_download():
        """Main task callable executed by Airflow."""
        
        # -- Config -------------------------------------------------------------------
        BUCKET_NAME = "sp500-bronze"  # Your globally unique AWS S3 bucket name
        INTERVAL    = "1d"
        BATCH_SIZE  = 50
        SLEEP_SECS  = 2
        # -------------------------------------------------------------------------------
        
        log = logging.getLogger(__name__)
        log.setLevel(logging.INFO)

        start_date = (datetime.today() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")
        end_date   = datetime.today().strftime("%Y-%m-%d")

        # boto3 reads credentials from the environment / instance role / ~/.aws/credentials
        s3_client = boto3.client("s3")

        # -- Nested Helper Functions ------------------------------------------
        def get_sp500_tickers() -> list[str]:
            log.info("Fetching S&P 500 tickers from Wikipedia ...")
            url     = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            resp    = requests.get(url, headers=headers, timeout=15)
            resp.raise_for_status()
            tables  = pd.read_html(BytesIO(resp.content))
            for t in tables:
                if "Symbol" in t.columns:
                    tickers = t["Symbol"].dropna().str.replace(".", "-", regex=False).tolist()
                    log.info(f"Found {len(tickers)} tickers.")
                    return tickers
            raise ValueError("Symbol column not found.")

        def get_last_date(ticker: str, s3_client, bucket_name: str) -> str | None:
            """Return the next fetch start (1 day after last stored row in S3), or None."""
            object_key = f"daily/{ticker}.parquet"
            try:
                response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
                df = pd.read_parquet(BytesIO(response["Body"].read()))
                last = pd.to_datetime(df.index).max()
                return (last + timedelta(days=1)).strftime("%Y-%m-%d")
            except botocore.exceptions.ClientError as e:
                if e.response["Error"]["Code"] == "NoSuchKey":
                    return None
                log.warning(f"AWS S3 Error reading {ticker}: {e}")
                return None
            except Exception as e:
                log.warning(f"Could not parse {ticker} data: {e}")
                return None

        def group_by_start(tickers: list[str], start_date: str, s3_client, bucket_name: str) -> dict[str, list[str]]:
            groups: dict[str, list[str]] = {}
            for t in tickers:
                start = get_last_date(t, s3_client, bucket_name) or start_date
                groups.setdefault(start, []).append(t)
            return groups

        def download_batch(tickers: list[str], start: str, end: str) -> pd.DataFrame:
            return yf.download(
                tickers, start=start, end=end,
                interval=INTERVAL,
                group_by="ticker", auto_adjust=True,
                threads=True, progress=False,
            )

        def append_or_create(ticker: str, new_data: pd.DataFrame, s3_client, bucket_name: str) -> None:
            if new_data.empty:
                log.warning(f"  No new data for {ticker} -- skipped.")
                return

            object_key = f"daily/{ticker}.parquet"

            try:
                response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
                existing = pd.read_parquet(BytesIO(response["Body"].read()))
                combined = pd.concat([existing, new_data])
                combined = combined[~combined.index.duplicated(keep="last")].sort_index()
                log.info(f"  {ticker}: +{len(new_data)} rows -> {len(combined)} total in AWS S3")
            except botocore.exceptions.ClientError:
                combined = new_data
                log.info(f"  {ticker}: created in AWS S3 with {len(new_data)} rows")

            parquet_buffer = BytesIO()
            combined.to_parquet(parquet_buffer, engine="pyarrow")

            s3_client.put_object(
                Bucket=bucket_name,
                Key=object_key,
                Body=parquet_buffer.getvalue()
            )

        def process_batch(batch: list[str], start: str, end: str, s3_client, bucket_name: str) -> list[str]:
            failed = []
            try:
                df = download_batch(batch, start, end)
                if df.empty:
                    return batch
                for ticker in batch:
                    try:
                        data = df[ticker].dropna(how="all") if len(batch) > 1 else df.dropna(how="all")
                        append_or_create(ticker, data, s3_client, bucket_name)
                    except KeyError:
                        log.warning(f"  {ticker} missing from batch.")
                        failed.append(ticker)
            except Exception as e:
                log.error(f"  Batch failed: {e}")
                failed.extend(batch)
            return failed

        # -- Main Execution Flow ----------------------------------------------
        tickers = get_sp500_tickers()
        groups  = group_by_start(tickers, start_date, s3_client, BUCKET_NAME)

        new_count    = len(groups.get(start_date, []))
        update_count = len(tickers) - new_count
        log.info(f"New tickers: {new_count} | To update: {update_count} | End date: {end_date}")

        all_failed = []
        for batch_start, group in sorted(groups.items()):
            for i in range(0, len(group), BATCH_SIZE):
                batch = group[i: i + BATCH_SIZE]
                log.info(f"Batch {i // BATCH_SIZE + 1} | start={batch_start} | {len(batch)} tickers")
                failed = process_batch(batch, batch_start, end_date, s3_client, BUCKET_NAME)
                all_failed.extend(failed)
                time.sleep(SLEEP_SECS)

        log.info("=" * 50)
        log.info(f"Done. Files are synchronized to AWS S3 bucket: {BUCKET_NAME}")
        if all_failed:
            log.warning(f"{len(all_failed)} tickers failed: {all_failed}")

    run_daily_download()

dag_instance = sp500_daily_s3_ingestion_pipeline()