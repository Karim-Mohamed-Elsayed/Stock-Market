import requests
import urllib3
from io import StringIO
import pandas as pd
from pyspark.sql.window import Window
import pyspark.sql.functions as F

# Disable SSL warnings to prevent connection issues on Windows environments during web scraping
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def fetch_gics_mapping(spark):
    print("Fetching GICS Sector Mapping from Wikipedia...")
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    
    try:
        # Define a user-agent to mimic a browser, preventing the website from blocking the request
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, verify=False, timeout=20)
        
        # Parse the HTML tables from the webpage
        tables = pd.read_html(StringIO(response.text))
        
        # Extract only the Symbol and GICS Sector columns from the first table
        gics_pd = tables[0][['Symbol', 'GICS Sector']].copy()
        gics_pd.rename(columns={'Symbol': 'Ticker', 'GICS Sector': 'GICS_Sector'}, inplace=True)
        gics_pd['Ticker'] = gics_pd['Ticker'].str.strip()
        
        print(" GICS data fetched successfully.")
        # Convert the pandas dataframe to a Spark dataframe for joining later
        return spark.createDataFrame(gics_pd)
    except Exception as e:
        print(f" Scraping failed: {e}")
        return None


def calculate_daily_indicators(df):
    print("--- Starting Transformations ---")
    spark = df.sparkSession
    
    # Cast the 'Close' price column to double (numeric) to prevent data type mismatch errors during calculations
    df = df.withColumn("Close", F.col("Close").cast("double"))
    
    # Fetch and merge GICS sector information with the stock data
    gics_df = fetch_gics_mapping(spark)
    if gics_df:
        # Broadcast join is used for optimization since the GICS table is very small
        df = df.join(F.broadcast(gics_df), on="Ticker", how="left")
        df = df.na.fill({"GICS_Sector": "No_Match"})
    else:
        df = df.withColumn("GICS_Sector", F.lit("Scraping_Failed"))

    # Define a window specification: group calculations by Ticker and sort chronologically by Date
    windowSpec = Window.partitionBy("Ticker").orderBy("Date")

    # Calculate Daily Returns and Volatility
    # F.lag gets the value of the previous row (yesterday's close)
    df = df.withColumn("Previous_Close", F.lag("Close", 1).over(windowSpec))
    df = df.withColumn("Daily_Return", (F.col("Close") - F.col("Previous_Close")) / F.col("Previous_Close"))
    
    # Calculate 30-day rolling standard deviation to measure volatility
    df = df.withColumn("Rolling_30Day_StdDev", F.stddev("Daily_Return").over(windowSpec.rowsBetween(-29, 0)))
    
    # Calculate Simple Moving Averages (SMA) for 50 and 200 days
    df = df.withColumn("SMA_50", F.avg("Close").over(windowSpec.rowsBetween(-49, 0)))
    df = df.withColumn("SMA_200", F.avg("Close").over(windowSpec.rowsBetween(-199, 0)))
    
    # Generate Trading Signals
    # Golden Cross: Short-term SMA crosses ABOVE the long-term SMA (Bullish)
    # Death Cross: Short-term SMA crosses BELOW the long-term SMA (Bearish)
    df = df.withColumn("Signal", F.when((F.col("SMA_50") > F.col("SMA_200")) & (F.lag("SMA_50", 1).over(windowSpec) <= F.lag("SMA_200", 1).over(windowSpec)), "Golden Cross")
           .when((F.col("SMA_50") < F.col("SMA_200")) & (F.lag("SMA_50", 1).over(windowSpec) >= F.lag("SMA_200", 1).over(windowSpec)), "Death Cross")
           .otherwise("Neutral"))

    # Calculate RSI (Relative Strength Index) based on 14 periods
    delta = F.col("Close") - F.col("Previous_Close")
    gain = F.when(delta > 0, delta).otherwise(0)
    loss = F.when(delta < 0, F.abs(delta)).otherwise(0)
    
    avg_gain = F.avg(gain).over(windowSpec.rowsBetween(-13, 0))
    avg_loss = F.avg(loss).over(windowSpec.rowsBetween(-13, 0))
    
    # RSI Formula. If avg_loss is 0, we substitute it with 1 to avoid division by zero errors.
    df = df.withColumn("RSI", 100 - (100 / (1 + (avg_gain / F.when(avg_loss == 0, 1).otherwise(avg_loss)))))

    # Calculate MACD (Moving Average Convergence Divergence)
    # MACD Line = 12-period EMA minus 26-period EMA (approximated here with Simple Averages for 12 and 26 periods)
    df = df.withColumn("MACD_Line", F.avg("Close").over(windowSpec.rowsBetween(-11, 0)) - F.avg("Close").over(windowSpec.rowsBetween(-25, 0)))
    
    # Signal Line = 9-period average of the MACD line
    df = df.withColumn("MACD_Signal_Line", F.avg("MACD_Line").over(windowSpec.rowsBetween(-8, 0)))

    # Drop intermediate columns used for calculations to keep the schema clean
    return df.drop("Previous_Close")

def calculate_sector_daily_returns(df):
    # Groups the data by Date and Sector to find the average performance of an entire sector on a given day
    if "GICS_Sector" in df.columns:
        return df.groupBy("Date", "GICS_Sector").agg(F.mean("Daily_Return").alias("Sector_Daily_Return"))
    return None