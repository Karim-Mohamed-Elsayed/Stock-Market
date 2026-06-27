"""
Airflow DAG: S&P 500 Hourly Data Downloader -> AWS S3
Runs hourly. Downloads missing hourly bars per ticker, 
and stores results in S3 under hourly/<ticker>.parquet
"""

from airflow.decorators import dag, task
from datetime import datetime, timedelta
import logging
import pandas as pd
import yfinance as yf
import requests
import boto3
import botocore
import time
from io import BytesIO 

# ── Airflow DAG Configuration ────────────────────────────────────────────────
default_args = {
    'owner': 'data_engineer',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

@dag(
    dag_id='sp500_hourly_s3_ingestion',
    default_args=default_args,
    description='Ingest hourly S&P 500 data from yfinance to AWS S3 (Parquet format)',
    schedule_interval='@hourly',
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=['finance', 'ingestion', 'bronze-layer', 'parquet'],
)
def sp500_hourly_ingestion_pipeline():

    @task()
    def fetch_and_upload_sp500_data():
        """
        Main execution task for scraping, downloading, and uploading stock data.
        """
        # ── Execution-Time Config ─────────────────────────────────────────────
        BUCKET_NAME  = "sp500-bronze"  
        INTERVAL     = "1h"
        BATCH_SIZE   = 50
        SLEEP_SECS   = 2
        START_DATE   = (datetime.today() - timedelta(days=729)).strftime("%Y-%m-%d")
        END_DATE     = datetime.today().strftime("%Y-%m-%d")
        
        log = logging.getLogger(__name__)
        log.setLevel(logging.INFO)

        s3_client = boto3.client("s3")

        # ── Helper Functions ─────────────────────────────────────────────────
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

        def get_last_timestamp(ticker: str) -> str | None:
            """Return the next fetch start (1 hour after last stored row in S3), or None."""
            object_key = f"hourly/{ticker}.parquet" 
            try:
                response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
                df = pd.read_parquet(BytesIO(response['Body'].read()))
                
                if df.empty:
                    return None
                    
                last = pd.to_datetime(df.index).max()
                
                if hasattr(last, "tzinfo") and last.tzinfo is not None:
                    last = last.tz_localize(None)
                    
                yf_limit = datetime.today() - timedelta(days=729)
                if last < yf_limit:
                    return START_DATE
                    
                return (last + timedelta(hours=1)).strftime("%Y-%m-%d")
                
            except botocore.exceptions.ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchKey':
                    return None
                log.warning(f"AWS S3 error reading {ticker}: {e}")
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
                
            object_key = f"hourly/{ticker}.parquet" 
            
            try:
                response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
                existing = pd.read_parquet(BytesIO(response['Body'].read()))
                
                combined = pd.concat([existing, new_data])
                combined = combined[~combined.index.duplicated(keep="last")].sort_index()
                log.info(f"  {ticker}: +{len(new_data)} rows -> {len(combined)} total in AWS S3")
            except botocore.exceptions.ClientError:
                combined = new_data
                log.info(f"  {ticker}: created in AWS S3 with {len(new_data)} rows")

            # Serialize to binary buffer for Parquet
            parquet_buffer = BytesIO()
            combined.to_parquet(parquet_buffer, engine="pyarrow")
            
            s3_client.put_object(
                Bucket=BUCKET_NAME, 
                Key=object_key, 
                Body=parquet_buffer.getvalue()
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

        # ── Main Orchestration ───────────────────────────────────────────────
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
            log.warning(f"{len(all_failed)} tickers failed during this run: {all_failed}")

    fetch_and_upload_sp500_data()

dag_instance = sp500_hourly_ingestion_pipeline()