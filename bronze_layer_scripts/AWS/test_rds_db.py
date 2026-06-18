import os

import psycopg2

DB_HOST = os.getenv("rds_endpoint")
DB_NAME = "airflow"
DB_USER = "postgres"
DB_PASS = os.getenv("rds_master_password")

try:
    print("Attempting to connect to AWS RDS PostgreSQL with SSL...")
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port="5432",
        sslmode="require"  # ◄ THIS IS THE MAGIC FIX
    )
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    db_version = cursor.fetchone()
    print(f" Connection Successful! AWS Database Version: {db_version[0]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f" Connection Failed. Error: {e}")