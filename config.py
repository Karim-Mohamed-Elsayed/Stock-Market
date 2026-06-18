# 1. Bronze Layer 
BRONZE_INPUT_PATH = "s3a://sp500-daily/*.csv"
# 2. Silver Layer 
SILVER_OUTPUT_PATH = "s3a://sp500-silver/final_data/"
SILVER_INPUT_PATH = "s3a://sp500-silver/final_data/"
# 3. Gold Layer 
GOLD_OUTPUT_PATH = "s3a://sp500-gold/technical_indicators/"
S3_ENDPOINT = "http://localhost:9000"
ACCESS_KEY = "admin"
SECRET_KEY = "supersecretpassword"
BUCKET_NAME = "sp500-daily"