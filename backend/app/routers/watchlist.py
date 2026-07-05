from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_user
from app.models.watchlist import Watchlist
from app.schemas.watchlist import WatchlistItemIn, WatchlistItemOut

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("", response_model=list[WatchlistItemOut])
def list_watchlist(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Watchlist]:
    stmt = select(Watchlist).where(Watchlist.user_id == current_user.id).order_by(Watchlist.added_at.desc())
    return list(db.scalars(stmt))


@router.post("", response_model=WatchlistItemOut, status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    payload: WatchlistItemIn,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Watchlist:
    ticker = payload.ticker.upper()

    existing = db.get(Watchlist, (current_user.id, ticker))
    if existing is not None:
        return existing

    item = Watchlist(user_id=current_user.id, ticker=ticker)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(
    ticker: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    item = db.get(Watchlist, (current_user.id, ticker.upper()))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticker not in watchlist")

    db.delete(item)
    db.commit()
