import os
import logging
import pandas as pd
import boto3
import botocore
from io import StringIO, BytesIO
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
LOCAL_CSV_DIR = r"D:\Projects\Depi_project\sp500_hourly_csv"  
BUCKET_NAME   = "sp500-hourly"      
MINIO_URL     = "http://localhost:9000"
MINIO_ACCESS  = "admin"
MINIO_SECRET  = "supersecretpassword"
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# Initialize MinIO (S3) Client
s3_client = boto3.client(
    "s3",
    endpoint_url=MINIO_URL,
    aws_access_key_id=MINIO_ACCESS,
    aws_secret_access_key=MINIO_SECRET,
)

def migrate_files():
    local_dir = Path(LOCAL_CSV_DIR)
    
    if not local_dir.exists():
        logging.error(f"Directory '{LOCAL_CSV_DIR}' not found!")
        return

    # Find all CSVs in the local directory
    csv_files = list(local_dir.glob("*.csv"))
    logging.info(f"Found {len(csv_files)} local CSV files to process.")

    for file_path in csv_files:
        ticker = file_path.stem  # Gets 'AAPL' from 'AAPL.csv'
        object_key = f"{ticker}.csv"
        
        try:
            # 1. Read the local data
            local_df = pd.read_csv(file_path, index_col=0, parse_dates=True)
            if local_df.empty:
                continue
                
            combined_df = local_df

            # 2. Check if data already exists in MinIO
            try:
                response = s3_client.get_object(Bucket=BUCKET_NAME, Key=object_key)
                minio_df = pd.read_csv(BytesIO(response['Body'].read()), index_col=0, parse_dates=True)
                
                # Merge the two dataframes
                combined_df = pd.concat([minio_df, local_df])
                
                # Deduplicate by Date (index) and sort chronologically
                combined_df = combined_df[~combined_df.index.duplicated(keep="last")].sort_index()
                
                logging.info(f"Merged {ticker}: {len(local_df)} local rows + MinIO data -> {len(combined_df)} total.")
            
            except botocore.exceptions.ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchKey':
                    logging.info(f"Uploaded {ticker}: New file created with {len(local_df)} rows.")
                else:
                    raise e

            # 3. Upload the merged data back to MinIO
            csv_buffer = StringIO()
            combined_df.to_csv(csv_buffer)
            
            s3_client.put_object(
                Bucket=BUCKET_NAME, 
                Key=object_key, 
                Body=csv_buffer.getvalue()
            )

        except Exception as e:
            logging.error(f"Failed to process {ticker}: {e}")

if __name__ == "__main__":
    migrate_files()