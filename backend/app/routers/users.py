from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.cookies import clear_auth_cookies
from app.dependencies.auth import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.profile import Profile
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services.supabase_auth import SupabaseAuthClient, SupabaseAuthError, get_supabase_auth_client

router = APIRouter(prefix="/users", tags=["users"])


def _get_profile_or_404(db: Session, user_id) -> Profile:
    profile = db.get(Profile, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


def _to_profile_out(profile: Profile, email: str | None) -> ProfileOut:
    return ProfileOut(
        id=profile.id,
        email=email,
        full_name=profile.full_name,
        avatar_url=profile.avatar_url,
        bio=profile.bio,
    )


@router.get("/me", response_model=ProfileOut)
def read_current_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    profile = _get_profile_or_404(db, current_user.id)
    return _to_profile_out(profile, current_user.email)


@router.put("/me", response_model=ProfileOut)
def update_current_profile(
    payload: ProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileOut:
    profile = _get_profile_or_404(db, current_user.id)

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _to_profile_out(profile, current_user.email)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    response: Response,
    current_user: CurrentUser = Depends(get_current_user),
    auth_client: SupabaseAuthClient = Depends(get_supabase_auth_client),
) -> None:
    # get_current_user has already verified current_user.id against Supabase,
    # so it's safe to delete that same id here. The `profiles`/`watchlists`
    # rows cascade via their FK to auth.users.
    try:
        await auth_client.delete_user(str(current_user.id))
    except SupabaseAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    clear_auth_cookies(response)
