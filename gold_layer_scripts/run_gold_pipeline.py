import os
import sys

from pyspark.sql import functions as F
from pyspark.sql.window import Window

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sessions import create_spark_session
import config


def compute_volatility(df):

    price_window = Window.partitionBy("Ticker").orderBy("Date")

    df = df.withColumn(
        "Previous_Close",
        F.lag("Close").over(price_window)
    )

    df = df.withColumn(
        "Daily_Return",
        (F.col("Close") - F.col("Previous_Close")) /
        F.col("Previous_Close")
    )

    rolling_window = (
        Window.partitionBy("Ticker")
        .orderBy("Date")
        .rowsBetween(-29, 0)
    )

    df = df.withColumn(
        "Rolling_30Day_StdDev",
        F.stddev("Daily_Return").over(rolling_window)
    )

    latest_window = Window.partitionBy("Ticker").orderBy(F.desc("Date"))

    ranking_df = (
        df.withColumn(
            "row_num",
            F.row_number().over(latest_window)
        )
        .filter(F.col("row_num") == 1)
        .orderBy(F.desc("Rolling_30Day_StdDev"))
    )

    return df, ranking_df


def run_pipeline():

    spark = create_spark_session(
        app_name="SP500_Gold_Pipeline"
    )

    silver_df = spark.read.parquet(
        config.SILVER_INPUT_PATH
    )

    full_df, ranking_df = compute_volatility(
        silver_df
    )

    print("Sample:")

    full_df.select(
        "Date",
        "Ticker",
        "Close",
        "Daily_Return",
        "Rolling_30Day_StdDev"
    ).show(10, False)

    print("Most Volatile Assets:")

    ranking_df.select(
        "Ticker",
        "Rolling_30Day_StdDev"
    ).show(20, False)

    full_df.write.mode("overwrite").parquet(
        config.GOLD_OUTPUT_PATH
    )

    print("Gold Pipeline Completed Successfully")


if __name__ == "__main__":
    run_pipeline()