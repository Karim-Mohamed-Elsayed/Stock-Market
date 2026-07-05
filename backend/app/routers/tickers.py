from fastapi import APIRouter, Depends, HTTPException

from app.services.s3_gold import S3GoldClient, S3GoldError, get_s3_gold_client

router = APIRouter(prefix="/tickers", tags=["tickers"])


@router.get("", response_model=list[str])
async def list_tickers(client: S3GoldClient = Depends(get_s3_gold_client)) -> list[str]:
    try:
        return await client.list_tickers()
    except S3GoldError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
