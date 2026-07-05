import uuid

from pydantic import BaseModel, ConfigDict


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None = None
    full_name: str | None
    avatar_url: str | None
    bio: str | None


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
