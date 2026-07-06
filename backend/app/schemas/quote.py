from pydantic import BaseModel


class QuoteOut(BaseModel):
    ticker: str
    price: float | None
    previous_close: float | None
    change: float | None
    change_percent: float | None
    currency: str | None
    rsi: float | None = None
    gics_sector: str | None = None
    volatility: float | None = None
