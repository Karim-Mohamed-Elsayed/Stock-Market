import sys
import os
from pyspark.sql import SparkSession
import pyspark.sql.functions as F

# Add the main project directory to the system path. 
# This prevents "ModuleNotFoundError" and allows Python to find 'config' and 'sessions' files.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import config
from sessions import create_spark_session
from clean_daily import clean_and_validate 

def run_silver_daily_pipeline():
    # Initialize the Spark Session for the Daily Silver pipeline and get the Spark Context
    spark = create_spark_session(app_name="SP500_Silver_Daily")
    sc = spark.sparkContext
    
    print(" Reading raw daily data from Bronze Layer...")
    # Read all raw daily CSV files from the Bronze layer
    raw_df = spark.read.csv(config.BRONZE_DAILY_PATH, header=True)
    
    # Check if the 'Ticker' column exists. If it does not exist in the CSV, 
    # extract the company name directly from the file name (e.g., extracting "AAPL" from "AAPL.csv").
    if "Ticker" not in raw_df.columns:
        raw_df = raw_df.withColumn("Ticker", F.regexp_extract(F.input_file_name(), r'([^/]+)\.csv$', 1))
    
    # Clean the data using your custom validation rules (removing nulls, filtering zeros, casting types)
    cleaned_df = clean_and_validate(raw_df)
    
    # Extract a distinct list of all company tickers available in the cleaned data
    tickers = [row['Ticker'] for row in cleaned_df.select("Ticker").distinct().collect()]
    print(f" Processing and saving {len(tickers)} companies...")
    
    # Loop through each ticker to save it as an individual, clean file
    for ticker in tickers:
        if not ticker:
            continue
            
        # Filter the main dataframe to only contain rows for the current company
        ticker_df = cleaned_df.filter(F.col("Ticker") == ticker)
        
        # Define the temporary folder path and the exact final file path.
        # We use a temporary folder because Spark's default behavior is to save data inside a folder, not as a single file.
        temp_dir = config.SILVER_DAILY_PATH + f"temp_{ticker}"
        final_file = config.SILVER_DAILY_PATH + f"{ticker}.parquet"
        
        # coalesce(1) forces Spark to combine all the data for this company into one single file piece inside the temp folder.
        ticker_df.coalesce(1).write.mode("overwrite").parquet(temp_dir)
        
        # Access the Hadoop FileSystem (FS) tool. 
        # This allows us to interact directly with the storage (like MinIO/S3) to rename and delete files.
        Path = sc._jvm.org.apache.hadoop.fs.Path
        temp_dir_path = Path(temp_dir)
        fs = temp_dir_path.getFileSystem(sc._jsc.hadoopConfiguration())
        
        # Search the temporary folder to find the exact name of the file Spark just created (it usually starts with "part-")
        temp_files = fs.globStatus(Path(temp_dir + "/part-*.parquet"))
        
        if temp_files:
            src_path = temp_files[0].getPath()
            dst_path = Path(final_file)
            
            # If an old file with this company's name already exists, delete it first to prevent errors
            if fs.exists(dst_path):
                fs.delete(dst_path, False)
                
            # Rename the file from its random Spark name to the clean name (e.g., "AAPL.parquet") and move it to the final folder
            fs.rename(src_path, dst_path)
            
        # Delete the temporary folder completely to keep the storage clean and organized
        fs.delete(temp_dir_path, True)
        print(f" Daily File Saved: {ticker}.parquet")

    print(f" Daily Silver Pipeline completed successfully! Created {len(tickers)} files.")
    spark.stop()

if __name__ == "__main__":
    run_silver_daily_pipeline()