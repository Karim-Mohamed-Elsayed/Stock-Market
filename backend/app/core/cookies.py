from fastapi import Response

from app.core.config import get_settings

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str | None, expires_in: int | None) -> None:
    settings = get_settings()
    common = dict(
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )
    response.set_cookie(ACCESS_TOKEN_COOKIE, access_token, max_age=expires_in, **common)
    if refresh_token is not None:
        response.set_cookie(
            REFRESH_TOKEN_COOKIE, refresh_token, max_age=settings.refresh_token_max_age_seconds, **common
        )


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(ACCESS_TOKEN_COOKIE, domain=settings.cookie_domain, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, domain=settings.cookie_domain, path="/")
