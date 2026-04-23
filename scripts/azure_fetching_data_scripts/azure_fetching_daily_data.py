import io
import os
from dotenv import load_dotenv
load_dotenv()
import time
import logging
import pandas as pd
import yfinance as yf
import requests
from io import StringIO
from datetime import datetime, timedelta
from azure.storage.blob import BlobServiceClient


AZURE_CONNECTION_STRING = os.getenv("AZURE_CONNECTION_STRING")
CONTAINER_NAME          = "bronze"
INTERVAL                = "1d"
# 10 years of history for first run
START_DATE              = (datetime.today() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")
END_DATE                = datetime.today().strftime("%Y-%m-%d")
BATCH_SIZE              = 50  # Process 50 stocks at a time to prevent API timeout
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# Initialize Azure Clients
blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client    = blob_service_client.get_container_client(CONTAINER_NAME)

def get_sp500_tickers() -> list[str]:
    """Fetches current S&P 500 list from Wikipedia."""
    log.info("Fetching S&P 500 tickers...")
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = requests.get(url, headers=headers, timeout=15)
    tables = pd.read_html(StringIO(resp.text))
    tickers = tables[0]["Symbol"].dropna().str.replace(".", "-", regex=False).tolist()
    return tickers

def get_metadata_from_azure(ticker: str):
    """
    Checks storage to see the last date we have for this stock.
    Returns: (Last Date as string, Existing DataFrame or None)
    """
    blob_path = f"daily/{ticker}.parquet"
    blob_client = container_client.get_blob_client(blob_path)
    
    if not blob_client.exists():
        return None, None
    
    try:
        # Download existing parquet into memory
        stream = blob_client.download_blob().readall()
        existing_df = pd.read_parquet(io.BytesIO(stream))
        last_date = pd.to_datetime(existing_df.index).max()
        # Start fetch 1 day after the last stored date
        fetch_start = (last_date + timedelta(days=1)).strftime("%Y-%m-%d")
        return fetch_start, existing_df
    except Exception as e:
        log.error(f"Error reading metadata for {ticker}: {e}")
        return None, None

def sync_stock_to_azure(ticker: str, start_date: str, existing_df: pd.DataFrame = None):
    """Downloads missing data and appends it to the Parquet file in Azure."""
    try:
        # 1. Download only the 'Delta' (missing data)
        new_data = yf.download(ticker, start=start_date, end=END_DATE, interval=INTERVAL, progress=False)
        
        if new_data.empty:
            log.info(f"  {ticker} is already up to date.")
            return

        # 2. Combine with existing data if it exists
        if existing_df is not None:
            combined = pd.concat([existing_df, new_data])
            # Drop duplicates in case of overlap
            combined = combined[~combined.index.duplicated(keep='last')].sort_index()
        else:
            combined = new_data

        # 3. Convert to Parquet in-memory (High Efficiency)
        parquet_buffer = io.BytesIO()
        combined.to_parquet(parquet_buffer, engine='pyarrow', compression='snappy')
        parquet_buffer.seek(0)

        # 4. Upload to Member 1's Bronze Layer
        blob_path = f"daily/{ticker}.parquet"
        blob_client = container_client.get_blob_client(blob_path)
        blob_client.upload_blob(parquet_buffer, overwrite=True)
        log.info(f"  {ticker}: Synced to Azure (Total Rows: {len(combined)})")

    except Exception as e:
        log.error(f"  Failed to sync {ticker}: {e}")

def main():
    tickers = get_sp500_tickers()
    
    for i in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[i : i + BATCH_SIZE]
        log.info(f"Processing Batch {i//BATCH_SIZE + 1}...")

        for ticker in batch:
            # Check what we already have in the cloud
            fetch_start, existing_df = get_metadata_from_azure(ticker)
            
            # If nothing exists, use the 10-year default
            final_start = fetch_start if fetch_start else START_DATE
            
            sync_stock_to_azure(ticker, final_start, existing_df)
            
        # Small sleep to avoid API rate limits
        time.sleep(2)

    log.info("Full Ingestion Cycle Complete.")

if __name__ == "__main__":
    main()