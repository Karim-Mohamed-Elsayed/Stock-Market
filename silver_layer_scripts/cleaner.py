from pyspark.sql.functions import col
def clean_and_validate(df):
    # Convert 'Close' column to float type
    df = df.withColumn("Close", col("Close").cast("float"))
    
    # Remove null values in 'Close' and 'Date' columns
    df = df.filter(col("Close").isNotNull() & col("Date").isNotNull())
    
    # Remove rows where 'Close' price is zero
    df = df.filter(col("Close") != 0)
    return df