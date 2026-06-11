import sys
import pendulum
from datetime import timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator

# 1. Point Airflow to your existing scripts folder
sys.path.insert(0, '/opt/airflow/bronze_layer_scripts/minIO_fetching_data')

# 2. Import BOTH of your main functions
from minio_fetching_data_daily import main as run_daily_ingestion
from minio_fetching_data_hourly import main as run_hourly_ingestion

# 3. Define your local timezone
egypt_tz = pendulum.timezone("Africa/Cairo")

# 4. Define the scheduling rules
default_args = {
    'owner': 'data_engineering_team',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'sp500_master_ingestion_pipeline',
    default_args=default_args,
    description='Fetches BOTH daily and hourly S&P 500 data at 11:30 PM',
    # CRON syntax for 11:30 PM
    schedule_interval='30 23 * * *',  
    # Lock the start date to your specific timezone
    start_date=pendulum.datetime(2024, 1, 1, tz=egypt_tz), 
    catchup=False,
    tags=['sp500', 'bronze_layer', 'master'],
) as dag:

    # 5. Task 1: The Daily Ingestion
    ingest_daily_data = PythonOperator(
        task_id='extract_daily_data',
        python_callable=run_daily_ingestion,
    )

    # 6. Task 2: The Hourly Ingestion
    ingest_hourly_data = PythonOperator(
        task_id='extract_hourly_data',
        python_callable=run_hourly_ingestion,
    )

    # 7. The Execution Order (The most important part)
    # The '>>' operator tells Airflow to run Task 1 FIRST, and only start Task 2 when it finishes.
    ingest_daily_data >> ingest_hourly_data