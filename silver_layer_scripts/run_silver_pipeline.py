# main.py (run_silver_pipeline.py)
import os
import sys
import pyspark.sql.functions as F

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['HADOOP_HOME'] = 'C:\\hadoop'

from sessions import create_spark_session
from cleaner import clean_and_validate
import config

def save_silver_data(df, output_path):
    print("Writing data to Silver Layer partitioned by Ticker...")
    df.write \
        .mode("overwrite") \
        .partitionBy("Ticker") \
        .parquet(output_path)   
    print("Write complete!")

def run_pipeline():
    # 1. Start Spark 
    spark = create_spark_session(app_name="SP500_Silver_Pipeline")    
    
    # 2. Extract 
    raw_df = spark.read.csv(config.BRONZE_INPUT_PATH, header=True, inferSchema=True)
    
    if "Ticker" not in raw_df.columns:
        raw_df = raw_df.withColumn("Ticker", F.regexp_extract(F.input_file_name(), r'([^/]+)\.csv$', 1))
        
    # 3. Clean & Validate
    clean_df = clean_and_validate(raw_df)
    
    # 4. Display sample 
    print("Showing sample of cleaned Silver data:")
    clean_df.show(10, truncate=False)
    
    # 5. Load 
    save_silver_data(clean_df, config.SILVER_OUTPUT_PATH)
    
    print("Silver Pipeline completed successfully!")

if __name__ == "__main__":
    run_pipeline()