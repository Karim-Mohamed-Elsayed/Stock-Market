import pyspark.sql.functions as F

def clean_hourly_data(df):
    # 1. Rename Datetime to Date
    df = df.withColumnRenamed("Datetime", "Date")
    
    # 2. Clean the Date string to remove the '+00:00' part
    df = df.withColumn("Date", F.substring(F.col("Date"), 1, 19))
    
    # 3. Convert to timestamp
    df = df.withColumn("Date", F.to_timestamp(F.col("Date"), "yyyy-MM-dd HH:mm:ss"))
    
    # 4. Drop rows with missing essential data
    df = df.dropna(subset=["Close", "Ticker", "Date"])
    
    return df