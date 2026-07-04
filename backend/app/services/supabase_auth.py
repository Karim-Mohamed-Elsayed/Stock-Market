from functools import lru_cache
from typing import Any

import httpx
from fastapi import status

from app.core.config import get_settings


class SupabaseAuthError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class SupabaseAuthClient:
    """Thin wrapper around Supabase's GoTrue REST API (auth.v1).

    Uses plain per-call HTTP requests rather than the `supabase-py` SDK's
    stateful client: that SDK stores the active session on the client
    instance, which is unsafe to share across concurrent requests from
    different users in a server process.
    """

    def __init__(self, base_url: str, anon_key: str, service_role_key: str):
        self._auth_url = f"{base_url.rstrip('/')}/auth/v1"
        self._anon_key = anon_key
        self._service_role_key = service_role_key
        self._client = httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            response = await self._client.request(method, f"{self._auth_url}{path}", **kwargs)
        except httpx.HTTPError as exc:
            raise SupabaseAuthError(status.HTTP_503_SERVICE_UNAVAILABLE, "Auth service unavailable") from exc

        if response.is_error:
            try:
                body = response.json()
                detail = body.get("msg") or body.get("message") or body.get("error_description") or response.text
            except ValueError:
                detail = response.text
            raise SupabaseAuthError(response.status_code, detail)

        return response

    async def sign_up(self, email: str, password: str, data: dict[str, Any] | None = None) -> dict:
        response = await self._request(
            "POST",
            "/signup",
            json={"email": email, "password": password, "data": data or {}},
            headers={"apikey": self._anon_key},
        )
        return response.json()

    async def sign_in_with_password(self, email: str, password: str) -> dict:
        response = await self._request(
            "POST",
            "/token",
            params={"grant_type": "password"},
            json={"email": email, "password": password},
            headers={"apikey": self._anon_key},
        )
        return response.json()

    async def refresh_session(self, refresh_token: str) -> dict:
        response = await self._request(
            "POST",
            "/token",
            params={"grant_type": "refresh_token"},
            json={"refresh_token": refresh_token},
            headers={"apikey": self._anon_key},
        )
        return response.json()

    async def sign_out(self, access_token: str) -> None:
        await self._request(
            "POST",
            "/logout",
            headers={"apikey": self._anon_key, "Authorization": f"Bearer {access_token}"},
        )

    async def get_user(self, access_token: str) -> dict:
        """Ask Supabase to validate `access_token` and return its owner.

        Used instead of local JWT verification so the backend never needs
        the project's JWT secret (or any other elevated credential) just to
        check whether a request is authenticated.
        """
        response = await self._request(
            "GET",
            "/user",
            headers={"apikey": self._anon_key, "Authorization": f"Bearer {access_token}"},
        )
        return response.json()

    async def delete_user(self, user_id: str) -> None:
        """Deletes a Supabase Auth user by id via the service-role-only admin API.

        Callers must have already established that `user_id` is the caller's
        own id (e.g. via `get_current_user`) -- this method performs no
        ownership check itself, since the service-role key can delete any
        user. `profiles`/`watchlists` rows cascade via their FK to auth.users.
        """
        await self._request(
            "DELETE",
            f"/admin/users/{user_id}",
            headers={"apikey": self._service_role_key, "Authorization": f"Bearer {self._service_role_key}"},
        )


@lru_cache
def get_supabase_auth_client() -> SupabaseAuthClient:
    settings = get_settings()
    return SupabaseAuthClient(settings.supabase_url, settings.supabase_anon_key, settings.supabase_service_role_key)
