# Vantage — frontend

Next.js (App Router) + TypeScript + CSS Modules frontend for the Stock-Market
project. No component/CSS framework — hand-rolled design system in
`src/app/globals.css`.

## Getting started

```bash
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_URL at the backend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The FastAPI backend
(`../backend`) should be running on the URL set in `.env.local`
(`http://localhost:8000` by default) for auth and live quotes to work — the
landing page falls back to static demo data if it's unreachable.

## Auth model

The backend issues its own httpOnly session cookies (via `/auth/register`,
`/auth/login`, `/auth/refresh`, `/auth/logout`) rather than exposing Supabase
tokens to the browser. `src/lib/api.ts` always calls `fetch` with
`credentials: "include"`; `src/lib/auth-context.tsx` exposes the current user
(`GET /users/me`) to the rest of the app via `useAuth()`.

## Structure

- `src/app/` — routes: `/` (landing), `/login`, `/register`
- `src/components/` — `Header`, `Footer`, and the landing page's
  `TickerTape` (live quotes), `SectorPreview` (sector performance), and
  `MiniCandles` (decorative hero chart)
- `src/lib/api.ts` — typed fetch client for the FastAPI backend
- `src/lib/auth-context.tsx` — session state shared across the app

## What's not built yet

Per `../plan.md` Phase 3: ticker search, ticker detail page with real charts
(`lightweight-charts`), and the watchlist page. The API client already has
`listTickers`/`getQuote` helpers to build on.
