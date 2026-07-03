#This script is responsible for orchestrating the Silver layer processing of daily stock data.
#This script is placed in the script tab in the sp500-silver-daily job

import boto3
import pandas as pd
import io

BRONZE_BUCKET = 'sp500-bronze'
SILVER_BUCKET = 'sp500-silver'
BRONZE_PREFIX = 'daily/'
SILVER_PREFIX = 'daily/'
REGION = 'eu-north-1'

s3 = boto3.client('s3', region_name=REGION)

def clean_and_validate(df):
    df = df.reset_index()
    df['Close'] = pd.to_numeric(df['Close'], errors='coerce')
    df = df.dropna(subset=['Close', 'Date'])
    df = df[df['Close'] != 0]
    return df

def run_silver_daily_pipeline():
    print("Listing all files in bronze bucket...", flush=True)
    
    response = s3.list_objects_v2(Bucket=BRONZE_BUCKET, Prefix=BRONZE_PREFIX)
    
    if 'Contents' not in response:
        print("No files found!", flush=True)
        return
    
    parquet_files = [obj['Key'] for obj in response['Contents'] if obj['Key'].endswith('.parquet')]
    print(f"Found {len(parquet_files)} stocks to process", flush=True)
    
    success = 0
    failed = 0
    
    for file_key in parquet_files:
        ticker = file_key.split('/')[-1].replace('.parquet', '')
        
        if not ticker:
            continue
        
        try:
            obj = s3.get_object(Bucket=BRONZE_BUCKET, Key=file_key)
            df = pd.read_parquet(io.BytesIO(obj['Body'].read()))
            
            if 'Ticker' not in df.columns:
                df['Ticker'] = ticker
            
            cleaned_df = clean_and_validate(df)
            
            buffer = io.BytesIO()
            cleaned_df.to_parquet(buffer, index=False)
            buffer.seek(0)
            
            silver_key = f"{SILVER_PREFIX}{ticker}.parquet"
            s3.put_object(Bucket=SILVER_BUCKET, Key=silver_key, Body=buffer.getvalue())
            print(f"✓ Saved {ticker}.parquet", flush=True)
            success += 1
            
        except Exception as e:
            print(f"✗ Error processing {ticker}: {str(e)}", flush=True)
            failed += 1
            continue
    
    print(f"Pipeline completed! Success: {success}, Failed: {failed}", flush=True)

run_silver_daily_pipeline()