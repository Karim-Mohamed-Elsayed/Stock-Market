#This script is responsible for orchestrating the Silver layer processing of hourly stock data.
# It reads raw CSV files from the Bronze layer,
#  cleans the data, and saves each company's data into its own Parquet file in the Silver layer.

import sys
import os
from pyspark.sql import SparkSession
import pyspark.sql.functions as F

# Append the root directory of the project to the system path.
# This ensures Python can find and import modules like 'config' and 'sessions' from parent folders.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import config
from clean_hourly import clean_hourly_data
from sessions import create_spark_session

def run_silver_hourly_pipeline():
    # Initialize the Spark session and get the Spark context for lower-level file operations
    spark = create_spark_session(app_name="SP500_Silver_Hourly")
    sc = spark.sparkContext
    
    # 1. Read the raw hourly data from the Bronze layer (CSV format)
    raw_df = spark.read.csv(config.BRONZE_HOURLY_PATH, header=True)
    
    # 2. Extract the company ticker symbol from the physical file name.
    # Spark's input_file_name() gets the full file path (e.g., "s3a://.../MSFT.csv").
    # The regular expression extracts just the "MSFT" part and creates a new "Ticker" column.
    raw_df = raw_df.withColumn("Ticker", F.regexp_extract(F.input_file_name(), r'([^/]+)\.csv$', 1))
    
    # 3. Clean the raw data using the custom imported cleaning function
    cleaned_df = clean_hourly_data(raw_df)
    
    # 4. Generate a list of all unique company tickers present in the cleaned data
    tickers = [row['Ticker'] for row in cleaned_df.select("Ticker").distinct().collect()]
    
    # 5. Process and save each company's data into its own dedicated Parquet file
    for ticker in tickers:
        # Skip any empty or invalid ticker names
        if not ticker:
            continue
            
        # Filter the main dataframe to isolate data for just this specific company
        ticker_df = cleaned_df.filter(F.col("Ticker") == ticker)
        
        # Define paths: a temporary folder for Spark to write into, and the precise final file path
        temp_dir = config.SILVER_HOURLY_PATH + f"temp_{ticker}"
        final_file = config.SILVER_HOURLY_PATH + f"{ticker}.parquet"
        
        # coalesce(1) forces Spark to combine all data for this ticker into a single file partition.
        # We save it into the temporary directory first.
        ticker_df.coalesce(1).write.mode("overwrite").parquet(temp_dir)
        
        # Access the Hadoop FileSystem (FS) API to perform direct file renaming and moving
        Path = sc._jvm.org.apache.hadoop.fs.Path
        temp_dir_path = Path(temp_dir)
        fs = temp_dir_path.getFileSystem(sc._jsc.hadoopConfiguration())
        
        # Look inside the temporary folder to find the actual data file (usually starts with "part-")
        temp_files = fs.globStatus(Path(temp_dir + "/part-*.parquet"))
        
        if temp_files:
            src_path = temp_files[0].getPath()
            dst_path = Path(final_file)
            
            # If a final file for this ticker already exists, delete it to prevent overwrite errors
            if fs.exists(dst_path):
                fs.delete(dst_path, False)
                
            # Rename and move the actual data file out of the temp folder to the final destination
            fs.rename(src_path, dst_path)
            
        # Clean up by completely deleting the temporary folder
        fs.delete(temp_dir_path, True)
        print(f" Saved: {ticker}.parquet")

    print(f" Pipeline finished! Created {len(tickers)} company files.")
    spark.stop()

if __name__ == "__main__":
    run_silver_hourly_pipeline()