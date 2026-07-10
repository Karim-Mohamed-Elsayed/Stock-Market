from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException

from app.services.s3_gold import S3GoldClient, get_s3_gold_client, S3GoldError
from app.routers.tickers import _batch_quotes_cache, _fetch_all_quotes_from_s3

router = APIRouter(prefix="/sectors", tags=["sectors"])

@router.get("")
async def get_sectors(client: S3GoldClient = Depends(get_s3_gold_client)) -> list[dict]:
    cache_key = "all_quotes"
    
    # Use cached quotes if available, otherwise return empty list
    # Let the background task populate the cache to avoid hanging the server
    if cache_key in _batch_quotes_cache:
        quotes = _batch_quotes_cache[cache_key]
    else:
        # Cache is not ready yet
        return []

    sector_returns = defaultdict(list)

    for quote in quotes.values():
        if quote.gics_sector and quote.change_percent is not None:
            sector_returns[quote.gics_sector].append(quote.change_percent)

    results = []
    for sector, returns in sector_returns.items():
        if returns:
            avg_return = sum(returns) / len(returns)
            results.append({
                "gics_sector": sector,
                "avg_daily_return": avg_return
            })
            
    # Sort by avg daily return descending (biggest to smallest)
    results.sort(key=lambda x: x["avg_daily_return"], reverse=True)
    return results
