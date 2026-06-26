# config.py

# 1. Bronze Layer (Input)
BRONZE_DAILY_PATH = "s3a://sp500-daily/*.csv"
BRONZE_HOURLY_PATH = "s3a://sp500-hourly/*.csv" 

# 2. Silver Layer (Cleaned Data)
SILVER_DAILY_PATH = "s3a://sp500-silver/daily/"
SILVER_HOURLY_PATH = "s3a://sp500-silver/hourly/"

# 3. Gold Layer (Processed/Indicators)
GOLD_DAILY_PATH = "s3a://sp500-gold/daily/"
GOLD_HOURLY_PATH = "s3a://sp500-gold/hourly/"

# 4. MinIO / S3 Credentials
S3_ENDPOINT = "http://localhost:9000"
ACCESS_KEY = "admin"
SECRET_KEY = "supersecretpassword"