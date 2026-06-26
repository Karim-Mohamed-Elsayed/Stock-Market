import requests
import urllib3
from io import StringIO
import pandas as pd
import pyspark.sql.functions as F
from pyspark.sql.window import Window

# Disable SSL warnings to prevent connection issues on Windows
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def fetch_gics_mapping(spark):
    # Fetch S&P 500 sector mapping from Wikipedia
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, verify=False, timeout=20)
        tables = pd.read_html(StringIO(response.text))
        
        gics_pd = tables[0][['Symbol', 'GICS Sector']].copy()
        gics_pd.rename(columns={'Symbol': 'Ticker', 'GICS Sector': 'GICS_Sector'}, inplace=True)
        gics_pd['Ticker'] = gics_pd['Ticker'].str.strip()
        
        return spark.createDataFrame(gics_pd)
    except Exception as e:
        print(f"Error fetching GICS data: {e}")
        return None

def calculate_hourly_indicators(df):
    spark = df.sparkSession
    
    # Crucial fix: Convert 'Close' to double (numeric) to allow mathematical operations
    df = df.withColumn("Close", F.col("Close").cast("double"))

    # 1. Join with GICS Sector dataframe
    gics_df = fetch_gics_mapping(spark)
    if gics_df:
        df = df.join(F.broadcast(gics_df), on="Ticker", how="left")
        df = df.na.fill({"GICS_Sector": "No_Match"})
    else:
        df = df.withColumn("GICS_Sector", F.lit("Scraping_Failed"))

    # 2. Window Configurations and Calculations
    windowSpec = Window.partitionBy("Ticker").orderBy("Date")
    df = df.withColumn("Previous_Close", F.lag("Close", 1).over(windowSpec))
    
    # Calculate Hourly Return using the numeric Close column
    df = df.withColumn("Hourly_Return", (F.col("Close") - F.col("Previous_Close")) / F.col("Previous_Close"))
    
    # Calculate Simple Moving Averages for long-term hourly trends (200 hours & 800 hours)
    df = df.withColumn("SMA_Short", F.avg("Close").over(windowSpec.rowsBetween(-199, 0)))
    df = df.withColumn("SMA_Long", F.avg("Close").over(windowSpec.rowsBetween(-799, 0)))
    
    # Calculate 14-period Relative Strength Index (RSI)
    delta = F.col("Close") - F.col("Previous_Close")
    gain = F.when(delta > 0, delta).otherwise(0)
    loss = F.when(delta < 0, F.abs(delta)).otherwise(0)
    
    avg_gain = F.avg(gain).over(windowSpec.rowsBetween(-13, 0))
    avg_loss = F.avg(loss).over(windowSpec.rowsBetween(-13, 0))
    df = df.withColumn("RSI", 100 - (100 / (1 + (avg_gain / F.when(avg_loss == 0, 1).otherwise(avg_loss)))))
    
    # Calculate Moving Average Convergence Divergence (MACD) using 12 and 26 hourly periods
    df = df.withColumn("MACD_Line", F.avg("Close").over(windowSpec.rowsBetween(-11, 0)) - F.avg("Close").over(windowSpec.rowsBetween(-25, 0)))
    
    # Clean up intermediate columns and sort the final dataset logically
    return df.drop("Previous_Close").orderBy("Ticker", "Date")