from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase project (Settings -> API in the Supabase dashboard)
    supabase_url: str
    supabase_anon_key: str

    # Service-role key (Settings -> API in the Supabase dashboard). Only used
    # for the admin-only user-delete call in SupabaseAuthClient.delete_user.
    supabase_service_role_key: str

    # Postgres connection string (Settings -> Database -> Connection string,
    # "Transaction pooler" tab for IPv4 compatibility), e.g.
    # postgresql://postgres.<project-ref>:<password>@<host>.pooler.supabase.com:6543/postgres
    database_url: str

    # Comma-separated list of allowed frontend origins, e.g.
    # "http://localhost:3000,https://your-app.vercel.app"
    cors_origins: str = "http://localhost:3000"

    # TTL (seconds) for the /quote in-process cache.
    quote_cache_ttl_seconds: int = 30

    # Auth cookie settings. `cookie_secure` must be True in production (HTTPS);
    # keep False for local http:// development. `cookie_samesite` must be "none"
    # (with cookie_secure=True) if the frontend and API are on different sites.
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None
    refresh_token_max_age_seconds: int = 60 * 60 * 24 * 30   # 30 days

    # AWS credentials for reading the gold- and silver-layer parquet buckets
    # (see app.services.s3_gold). Populated by gold_layer_scripts/ and
    # silver_layer_scripts/ respectively.
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_bucket_name: str
    s3_silver_bucket_name: str

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
