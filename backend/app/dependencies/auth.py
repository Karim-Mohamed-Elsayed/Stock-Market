import uuid

from fastapi import Depends, HTTPException, Request, status

from app.core.cookies import ACCESS_TOKEN_COOKIE
from app.services.supabase_auth import SupabaseAuthClient, SupabaseAuthError, get_supabase_auth_client


class CurrentUser:
    def __init__(self, id: uuid.UUID, email: str | None, access_token: str):
        self.id = id
        self.email = email
        self.access_token = access_token


async def get_current_user(
    request: Request,
    auth_client: SupabaseAuthClient = Depends(get_supabase_auth_client),
) -> CurrentUser:
    access_token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if access_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        user = await auth_client.get_user(access_token)
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    return CurrentUser(id=uuid.UUID(user["id"]), email=user.get("email"), access_token=access_token)
