#This script is responsible for orchestrating the gold layer processing of daily stock data.
#This script is placed in the script tab in the sp500-gold-daily job

import boto3
import pandas as pd
import numpy as np
import io
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==============================
# CONFIGURATION
# ==============================
SILVER_BUCKET = 'sp500-silver'
GOLD_BUCKET = 'sp500-gold'
SILVER_PREFIX = 'daily/'
GOLD_PREFIX = 'daily/'
REGION = 'eu-north-1'

s3 = boto3.client('s3', region_name=REGION)

# ==============================
# FETCH GICS SECTOR MAPPING
# ==============================
def fetch_gics_mapping():
    print("Fetching GICS Sector Mapping from Wikipedia...", flush=True)
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, verify=False, timeout=20)
        tables = pd.read_html(io.StringIO(response.text))
        gics_df = tables[0][['Symbol', 'GICS Sector']].copy()
        gics_df.rename(columns={'Symbol': 'Ticker', 'GICS Sector': 'GICS_Sector'}, inplace=True)
        gics_df['Ticker'] = gics_df['Ticker'].str.strip()
        print("GICS data fetched successfully.", flush=True)
        return gics_df
    except Exception as e:
        print(f"Scraping failed: {e}", flush=True)
        return None

# ==============================
# CALCULATE DAILY INDICATORS
# ==============================
def calculate_daily_indicators(df, gics_df):
    # Sort by date for correct window calculations
    df = df.sort_values('Date').reset_index(drop=True)
    
    # Cast Close to float
    df['Close'] = pd.to_numeric(df['Close'], errors='coerce')
    
    # Merge GICS sector
    if gics_df is not None:
        df = df.merge(gics_df, on='Ticker', how='left')
        df['GICS_Sector'] = df['GICS_Sector'].fillna('No_Match')
    else:
        df['GICS_Sector'] = 'Scraping_Failed'
    
    # Daily Return
    df['Previous_Close'] = df['Close'].shift(1)
    df['Daily_Return'] = (df['Close'] - df['Previous_Close']) / df['Previous_Close']
    
    # Rolling 30-day Volatility
    df['Rolling_30Day_StdDev'] = df['Daily_Return'].rolling(window=30, min_periods=1).std()
    
    # Simple Moving Averages
    df['SMA_50'] = df['Close'].rolling(window=50, min_periods=1).mean()
    df['SMA_200'] = df['Close'].rolling(window=200, min_periods=1).mean()
    
    # Trading Signals — Golden Cross / Death Cross
    df['Prev_SMA_50'] = df['SMA_50'].shift(1)
    df['Prev_SMA_200'] = df['SMA_200'].shift(1)
    
    conditions = [
        (df['SMA_50'] > df['SMA_200']) & (df['Prev_SMA_50'] <= df['Prev_SMA_200']),
        (df['SMA_50'] < df['SMA_200']) & (df['Prev_SMA_50'] >= df['Prev_SMA_200'])
    ]
    choices = ['Golden Cross', 'Death Cross']
    df['Signal'] = np.select(conditions, choices, default='Neutral')
    
    # RSI (14 periods)
    delta = df['Close'] - df['Previous_Close']
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.rolling(window=14, min_periods=1).mean()
    avg_loss = loss.rolling(window=14, min_periods=1).mean()
    avg_loss = avg_loss.replace(0, 1)  # Avoid division by zero
    df['RSI'] = 100 - (100 / (1 + (avg_gain / avg_loss)))
    
    # MACD
    df['MACD_Line'] = df['Close'].rolling(window=12, min_periods=1).mean() - df['Close'].rolling(window=26, min_periods=1).mean()
    df['MACD_Signal_Line'] = df['MACD_Line'].rolling(window=9, min_periods=1).mean()
    
    # Drop intermediate columns
    df = df.drop(columns=['Previous_Close', 'Prev_SMA_50', 'Prev_SMA_200'])
    
    # Keep only final columns
    final_columns = [
        'Date', 'Ticker', 'GICS_Sector', 'Close',
        'Daily_Return', 'Rolling_30Day_StdDev',
        'SMA_50', 'SMA_200', 'Signal',
        'RSI', 'MACD_Line', 'MACD_Signal_Line'
    ]
    
    return df[final_columns]

# ==============================
# MAIN PIPELINE
# ==============================
def run_gold_daily_pipeline():
    print("Starting Gold Daily Pipeline...", flush=True)
    
    # Fetch GICS mapping once for all stocks
    gics_df = fetch_gics_mapping()
    
    # List all files in silver daily bucket
    response = s3.list_objects_v2(Bucket=SILVER_BUCKET, Prefix=SILVER_PREFIX)
    
    if 'Contents' not in response:
        print("No files found in silver bucket!", flush=True)
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
            # Read from silver
            obj = s3.get_object(Bucket=SILVER_BUCKET, Key=file_key)
            df = pd.read_parquet(io.BytesIO(obj['Body'].read()))
            
            if 'Ticker' not in df.columns:
                df['Ticker'] = ticker
            
            # Apply gold transformations
            gold_df = calculate_daily_indicators(df, gics_df)
            
            # Save to gold bucket
            buffer = io.BytesIO()
            gold_df.to_parquet(buffer, index=False)
            buffer.seek(0)
            
            gold_key = f"{GOLD_PREFIX}{ticker}.parquet"
            s3.put_object(Bucket=GOLD_BUCKET, Key=gold_key, Body=buffer.getvalue())
            print(f"✓ Saved {ticker}.parquet", flush=True)
            success += 1
            
        except Exception as e:
            print(f"✗ Error processing {ticker}: {str(e)}", flush=True)
            failed += 1
            continue
    
    print(f"Gold Daily Pipeline completed! Success: {success}, Failed: {failed}", flush=True)

run_gold_daily_pipeline()