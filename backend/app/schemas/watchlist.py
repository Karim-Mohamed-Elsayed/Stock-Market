from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WatchlistItemIn(BaseModel):
    ticker: str


class WatchlistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str
    added_at: datetime
