from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, chat, history, quote, sectors, tickers, users, watchlist
from app.services.supabase_auth import get_supabase_auth_client

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background quotes fetcher
    from app.services.s3_gold import get_s3_gold_client
    from app.routers.tickers import start_quotes_scheduler, stop_quotes_scheduler

    start_quotes_scheduler(get_s3_gold_client())

    yield

    # Shutdown: Stop quotes task
    stop_quotes_scheduler()
    await get_supabase_auth_client().aclose()


app = FastAPI(title="Stock Market API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(quote.router, prefix=API_V1_PREFIX)
app.include_router(watchlist.router, prefix=API_V1_PREFIX)
app.include_router(history.router, prefix=API_V1_PREFIX)
app.include_router(tickers.router, prefix=API_V1_PREFIX)
app.include_router(sectors.router, prefix=API_V1_PREFIX)
app.include_router(chat.router, prefix=API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
