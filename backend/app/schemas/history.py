from pydantic import BaseModel


class HistoryLinkOut(BaseModel):
    download_url: str


class HistoryPoint(BaseModel):
    date: str
    ticker: str
    gics_sector: str | None = None
    close: float | None = None

    # Daily-only indicators (interval="daily")
    daily_return: float | None = None
    rolling_30day_stddev: float | None = None
    sma_50: float | None = None
    sma_200: float | None = None
    signal: str | None = None
    macd_signal_line: float | None = None

    # Hourly-only indicators (interval="hourly")
    hourly_return: float | None = None
    sma_short: float | None = None
    sma_long: float | None = None

    # Shared indicators
    rsi: float | None = None
    macd_line: float | None = None


class OhlcHistoryPoint(HistoryPoint):
    """HistoryPoint plus the raw OHLCV columns, joined in from the silver layer."""

    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: float | None = None
