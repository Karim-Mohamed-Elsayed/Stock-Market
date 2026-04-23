import io
import time
import os
from dotenv import load_dotenv
load_dotenv()
import logging
import pandas as pd
import yfinance as yf
import requests
from io import StringIO
from datetime import datetime, timedelta
from azure.storage.blob import BlobServiceClient

AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING")
CONTAINER_NAME          = "bronze"
INTERVAL                = "1h"

# yfinance hourly limit is730 days
START_DATE              = (datetime.today() - timedelta(days=729)).strftime("%Y-%m-%d")
END_DATE                = datetime.today().strftime("%Y-%m-%d")
BATCH_SIZE              = 50 
SLEEP_SECS              = 2
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# Initialize Azure Clients
blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client    = blob_service_client.get_container_client(CONTAINER_NAME)

def get_sp500_tickers() -> list[str]:
    log.info("Fetching S&P 500 tickers from Wikipedia...")
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=15)
    tables = pd.read_html(StringIO(resp.text))
    tickers = tables[0]["Symbol"].dropna().str.replace(".", "-", regex=False).tolist()
    return tickers

def get_metadata_from_azure(ticker: str):
    """Checks Azure for the last hourly timestamp."""
    blob_path = f"hourly/{ticker}.parquet"
    blob_client = container_client.get_blob_client(blob_path)
    
    if not blob_client.exists():
        return None, None
    
    try:
        stream = blob_client.download_blob().readall()
        existing_df = pd.read_parquet(io.BytesIO(stream))
        
        if existing_df.empty:
            return None, None
            
        last_ts = pd.to_datetime(existing_df.index).max()
        
        # Clamp: yfinance won't allow hourly data older than 730 days
        yf_limit = datetime.today() - timedelta(days=729)
        if last_ts < yf_limit:
            return START_DATE, existing_df
            
        # Start 1 hour after the last stored timestamp
        fetch_start = (last_ts + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        return fetch_start, existing_df
    except Exception as e:
        log.error(f"Error reading metadata for {ticker}: {e}")
        return None, None

def sync_hourly_to_azure(ticker: str, start_date: str, existing_df: pd.DataFrame = None):
    """Downloads missing hours and appends to Member 1's Parquet file."""
    try:
        new_data = yf.download(ticker, start=start_date, end=END_DATE, interval=INTERVAL, progress=False)
        
        if new_data.empty:
            return

        if existing_df is not None:
            combined = pd.concat([existing_df, new_data])
            combined = combined[~combined.index.duplicated(keep='last')].sort_index()
        else:
            combined = new_data

        # Save to memory as Parquet
        parquet_buffer = io.BytesIO()
        combined.to_parquet(parquet_buffer, engine='pyarrow', compression='snappy')
        parquet_buffer.seek(0)

        # Upload to 'hourly/' directory in Bronze
        blob_path = f"hourly/{ticker}.parquet"
        blob_client = container_client.get_blob_client(blob_path)
        blob_client.upload_blob(parquet_buffer, overwrite=True)
        log.info(f"  {ticker}: Hourly Sync Complete ({len(combined)} total hours)")

    except Exception as e:
        log.error(f"  Failed to sync hourly {ticker}: {e}")

def main():
    tickers = get_sp500_tickers()
    
    for i in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[i : i + BATCH_SIZE]
        log.info(f"Processing Hourly Batch {i//BATCH_SIZE + 1}...")

        for ticker in batch:
            fetch_start, existing_df = get_metadata_from_azure(ticker)
            final_start = fetch_start if fetch_start else START_DATE
            sync_hourly_to_azure(ticker, final_start, existing_df)
            
        time.sleep(SLEEP_SECS)

    log.info("Full Hourly Ingestion Cycle Complete.")

if __name__ == "__main__":
    main()