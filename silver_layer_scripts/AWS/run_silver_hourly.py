#This script is responsible for orchestrating the Silver layer processing of hourly stock data.
#This script is placed in the script tab in the sp500-silver-hourly job

import boto3
import pandas as pd
import io

BRONZE_BUCKET = 'sp500-bronze'
SILVER_BUCKET = 'sp500-silver'
BRONZE_PREFIX = 'hourly/'
SILVER_PREFIX = 'hourly/'
REGION = 'eu-north-1'

s3 = boto3.client('s3', region_name=REGION)

def clean_hourly_data(df):
    df = df.reset_index()
    
    print(f"Columns: {df.columns.tolist()}", flush=True)
    
    # Rename Datetime to Date if it exists
    if 'Datetime' in df.columns:
        df = df.rename(columns={'Datetime': 'Date'})
    
    # Clean the Date string to remove timezone part (e.g. '+00:00')
    df['Date'] = df['Date'].astype(str).str[:19]
    
    # Convert to datetime
    df['Date'] = pd.to_datetime(df['Date'], format='%Y-%m-%d %H:%M:%S', errors='coerce')
    
    # Drop rows with missing essential data
    df = df.dropna(subset=['Close', 'Date'])
    
    # Remove rows where Close is zero
    df = df[df['Close'] != 0]
    
    return df

def run_silver_hourly_pipeline():
    print("Listing all files in bronze hourly bucket...", flush=True)
    
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
            
            cleaned_df = clean_hourly_data(df)
            
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

run_silver_hourly_pipeline()