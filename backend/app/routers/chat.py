from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.gemini_chat import (
    ChatMessage,
    ChatServiceError,
    stream_chat_reply,
)

router = APIRouter(prefix="/chat", tags=["chat"])

# Cap conversation size so a client can't push an unbounded payload upstream.
MAX_MESSAGES = 30
MAX_CONTENT_CHARS = 4000


class ChatMessageIn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=MAX_CONTENT_CHARS)


class ChatRequest(BaseModel):
    messages: list[ChatMessageIn] = Field(min_length=1, max_length=MAX_MESSAGES)


@router.post("")
async def chat(request: ChatRequest) -> StreamingResponse:
    if request.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="The last message must be from the user.")

    history = [ChatMessage(role=m.role, content=m.content) for m in request.messages]

    # Start the upstream stream eagerly so configuration/connection errors
    # surface as a normal HTTP error response instead of mid-stream.
    generator = stream_chat_reply(history)
    try:
        first_chunk = await generator.__anext__()
    except ChatServiceError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except StopAsyncIteration:
        first_chunk = ""

    async def body():
        if first_chunk:
            yield first_chunk
        try:
            async for chunk in generator:
                yield chunk
        except ChatServiceError:
            # Upstream failed part-way through; end the stream gracefully.
            return

    return StreamingResponse(
        body(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
