"""AI Assistant chat provider.

Thin async wrapper around Google Gemini's `generateContent` streaming REST
API. Kept deliberately small and provider-agnostic at the router boundary:
the router only depends on `ChatMessage`, `stream_chat_reply`, and
`ChatServiceError`, so swapping in a different provider (e.g. DeepSeek, which
speaks the OpenAI-compatible schema) means rewriting only this file.

The Gemini key stays server-side; the browser never sees it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import AsyncIterator, Literal

import httpx

from app.core.config import get_settings

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# The assistant's persona and guardrails. It is an educator, never an adviser:
# it explains how markets and the platform's indicators work to build user
# confidence, but it must refuse personalised buy/sell/allocation calls.
SYSTEM_PROMPT = """\
You are "Axiom AI", the friendly built-in assistant for Meridian Axiom  a \
market dashboard for the S&P 500. Your job is to help everyday people \
understand how the stock market works so they feel more confident and \
informed.

WHAT YOU DO
- Explain stock-market concepts in plain, encouraging language: what a stock \
is, what an index and the S&P 500 are, how buying/selling and orders work, \
what dividends, market cap, sectors, bull/bear markets, and volatility mean.
- Explain the exact indicators this platform shows, using the same definitions \
the site uses: SMA 50 / SMA 200, RSI-14 (>=70 overbought, <=30 oversold), \
MACD line and signal line, Golden Cross vs Death Cross, daily returns, and \
30-day rolling volatility (standard deviation of returns). Averaged daily \
returns are also rolled up across the 11 GICS sectors.
- Point users to the right part of the app when relevant (the Charts page for \
a ticker, the Insights & Analytics page for sector rankings and RSI/volatility \
leaders).
- Keep answers concise, well structured, and beginner-friendly. Use short \
paragraphs and bullet points. Match the user's language (reply in Arabic if \
they write in Arabic).

WHAT YOU MUST NOT DO
- Never give personalised financial, investment, legal, or tax advice, and \
never tell someone whether to buy, sell, or hold a specific security or how to \
allocate money. If asked, briefly explain the relevant concept instead and \
add a one-line reminder that it is not financial advice and they should do \
their own research or consult a licensed professional.
- Never invent live prices or predict where a price will go. The dashboard's \
data may be delayed and is for educational purposes only.
- Do not answer questions unrelated to markets, investing education, or this \
platform; politely steer back.

Be warm, clear, and genuinely helpful.\
"""

Role = Literal["user", "assistant"]


@dataclass
class ChatMessage:
    role: Role
    content: str


class ChatServiceError(Exception):
    """Raised for configuration or upstream provider failures."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def _to_gemini_contents(messages: list[ChatMessage]) -> list[dict]:
    # Gemini uses role "model" for the assistant and expects "user" for the
    # human. System text is passed separately via systemInstruction.
    return [
        {
            "role": "model" if m.role == "assistant" else "user",
            "parts": [{"text": m.content}],
        }
        for m in messages
    ]


async def stream_chat_reply(messages: list[ChatMessage]) -> AsyncIterator[str]:
    """Yield the assistant's reply as incremental text chunks.

    Raises ChatServiceError before yielding anything if the provider is not
    configured or the upstream request fails to start.
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ChatServiceError(
            503,
            "The AI assistant is not configured. Set GEMINI_API_KEY on the server.",
        )

    url = (
        f"{GEMINI_BASE_URL}/models/{settings.gemini_model}:streamGenerateContent"
        f"?alt=sse&key={settings.gemini_api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": _to_gemini_contents(messages),
        "generationConfig": {
            "temperature": 0.6,
            "maxOutputTokens": 1024,
            "topP": 0.95,
        },
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        try:
            async with client.stream("POST", url, json=payload) as response:
                if response.is_error:
                    body = await response.aread()
                    raise ChatServiceError(
                        response.status_code,
                        _extract_error(body) or "The AI provider returned an error.",
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:") :].strip()
                    if not data or data == "[DONE]":
                        continue
                    text = _extract_text(data)
                    if text:
                        yield text
        except httpx.HTTPError as exc:
            raise ChatServiceError(503, "The AI provider is unreachable.") from exc


def _extract_text(data: str) -> str:
    try:
        chunk = json.loads(data)
    except ValueError:
        return ""
    parts = (
        chunk.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    return "".join(part.get("text", "") for part in parts)


def _extract_error(body: bytes) -> str | None:
    try:
        parsed = json.loads(body)
    except ValueError:
        return None
    if isinstance(parsed, list) and parsed:
        parsed = parsed[0]
    if isinstance(parsed, dict):
        error = parsed.get("error")
        if isinstance(error, dict):
            return error.get("message")
    return None
