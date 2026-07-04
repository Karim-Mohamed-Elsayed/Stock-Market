from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.cookies import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, clear_auth_cookies, set_auth_cookies
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
)
from app.services.supabase_auth import SupabaseAuthClient, SupabaseAuthError, get_supabase_auth_client

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_session(response: Response, session_data: dict) -> AuthResponse:
    set_auth_cookies(
        response,
        access_token=session_data["access_token"],
        refresh_token=session_data.get("refresh_token"),
        expires_in=session_data.get("expires_in"),
    )
    return AuthResponse()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    auth_client: SupabaseAuthClient = Depends(get_supabase_auth_client),
) -> RegisterResponse:
    try:
        result = await auth_client.sign_up(
            payload.email,
            payload.password,
            data={"full_name": payload.full_name},
        )
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

   
    if "access_token" in result:
        _issue_session(response, result)
        authenticated = True
        message = "Registration successful."
    else:
        authenticated = False
        message = "Registration successful. Check your email to confirm your account."

    return RegisterResponse(authenticated=authenticated, message=message)


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    auth_client: SupabaseAuthClient = Depends(get_supabase_auth_client),
) -> AuthResponse:
    try:
        result = await auth_client.sign_in_with_password(payload.email, payload.password)
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message) from exc

    return _issue_session(response, result)


@router.post("/refresh", response_model=AuthResponse)
async def refresh(
    request: Request,
    response: Response,
    auth_client: SupabaseAuthClient = Depends(get_supabase_auth_client),
) -> AuthResponse:
    refresh_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    try:
        result = await auth_client.refresh_session(refresh_token)
    except SupabaseAuthError as exc:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message) from exc

    return _issue_session(response, result)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    auth_client: SupabaseAuthClient = Depends(get_supabase_auth_client),
) -> None:
    access_token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if access_token is not None:
        try:
            await auth_client.sign_out(access_token)
        except SupabaseAuthError:
            pass

    clear_auth_cookies(response)
