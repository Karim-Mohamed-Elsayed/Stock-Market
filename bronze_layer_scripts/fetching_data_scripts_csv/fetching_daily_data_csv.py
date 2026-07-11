"""
S&P 500 Daily Data Downloader
- First run : downloads last 10 years of daily data
- Daily runs: checks last stored date and appends only missing days
"""

import time
import logging
import pandas as pd
import yfinance as yf
import requests

from io import StringIO
from pathlib import Path
from datetime import datetime, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
OUTPUT_DIR   = Path("sp500_daily_csv")
INTERVAL     = "1d"
BATCH_SIZE   = 50
SLEEP_SECS   = 2
START_DATE   = (datetime.today() - timedelta(days=365 * 10)).strftime("%Y-%m-%d")
END_DATE     = datetime.today().strftime("%Y-%m-%d")
LOG_FILE     = "daily_download.log"
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
log = logging.getLogger(__name__)


def get_sp500_tickers() -> list[str]:
    log.info("Fetching S&P 500 tickers from Wikipedia …")
    url     = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    resp    = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    tables  = pd.read_html(StringIO(resp.text))
    for t in tables:
        if "Symbol" in t.columns:
            tickers = t["Symbol"].dropna().str.replace(".", "-", regex=False).tolist()
            log.info(f"Found {len(tickers)} tickers.")
            return tickers
    raise ValueError("Symbol column not found.")


def get_last_date(ticker: str) -> str | None:
    """Return the next fetch start (1 day after last stored row), or None."""
    path = OUTPUT_DIR / f"{ticker}.csv"
    if not path.exists():
        return None
    try:
        df   = pd.read_csv(path, index_col=0, parse_dates=True)
        last = pd.to_datetime(df.index).max()
        return (last + timedelta(days=1)).strftime("%Y-%m-%d")
    except Exception as e:
        log.warning(f"Could not read {ticker}: {e}")
        return None


def group_by_start(tickers: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for t in tickers:
        start = get_last_date(t) or START_DATE
        groups.setdefault(start, []).append(t)
    return groups


def download_batch(tickers: list[str], start: str) -> pd.DataFrame:
    return yf.download(
        tickers, start=start, end=END_DATE,
        interval=INTERVAL,
        group_by="ticker", auto_adjust=True,
        threads=True, progress=False,
    )


def append_or_create(ticker: str, new_data: pd.DataFrame) -> None:
    if new_data.empty:
        log.warning(f"  No new data for {ticker}  skipped.")
        return
    path = OUTPUT_DIR / f"{ticker}.csv"
    if path.exists():
        existing = pd.read_csv(path, index_col=0, parse_dates=True)
        combined = pd.concat([existing, new_data])
        combined = combined[~combined.index.duplicated(keep="last")].sort_index()
        combined.to_csv(path)
        log.info(f"  {ticker}: +{len(new_data)} rows → {len(combined)} total")
    else:
        new_data.to_csv(path)
        log.info(f"  {ticker}: created with {len(new_data)} rows")


def process_batch(batch: list[str], start: str) -> list[str]:
    failed = []
    try:
        df = download_batch(batch, start)
        if df.empty:
            return batch
        for ticker in batch:
            try:
                data = df[ticker].dropna(how="all") if len(batch) > 1 else df.dropna(how="all")
                append_or_create(ticker, data)
            except KeyError:
                log.warning(f"  {ticker} missing from batch.")
                failed.append(ticker)
    except Exception as e:
        log.error(f"  Batch failed: {e}")
        failed.extend(batch)
    return failed


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    tickers = get_sp500_tickers()
    groups  = group_by_start(tickers)

    new_count    = len(groups.get(START_DATE, []))
    update_count = len(tickers) - new_count
    log.info(f"New tickers: {new_count} | To update: {update_count} | End date: {END_DATE}")

    all_failed = []
    for start_date, group in sorted(groups.items()):
        for i in range(0, len(group), BATCH_SIZE):
            batch = group[i : i + BATCH_SIZE]
            log.info(f"Batch {i // BATCH_SIZE + 1} | start={start_date} | {len(batch)} tickers")
            failed = process_batch(batch, start_date)
            all_failed.extend(failed)
            time.sleep(SLEEP_SECS)

    log.info("=" * 50)
    log.info(f"Done. Output: {OUTPUT_DIR}/")
    if all_failed:
        pd.Series(all_failed).to_csv("failed_daily.csv", index=False, header=["ticker"])
        log.warning(f"{len(all_failed)} failed tickers saved to failed_daily.csv")


if __name__ == "__main__":
    main()