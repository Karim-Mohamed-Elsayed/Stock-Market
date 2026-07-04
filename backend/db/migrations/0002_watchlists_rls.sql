-- Per-user watchlist entries. Table may already exist (created outside of a
-- checked-in migration); this is safe to (re)run either way.
create table if not exists public.watchlists (
    user_id uuid not null references auth.users (id) on delete cascade,
    ticker text not null,
    added_at timestamptz not null default now(),
    primary key (user_id, ticker)
);

-- Row Level Security: users can only see/add/remove their own watchlist rows.
-- The backend now talks to Postgres exclusively through PostgREST using the
-- caller's own access token (no direct Postgres connection, no service-role
-- key), so these policies are what actually enforces per-user isolation.
alter table public.watchlists enable row level security;

drop policy if exists "Watchlist rows are viewable by owner" on public.watchlists;
create policy "Watchlist rows are viewable by owner"
    on public.watchlists for select
    using (auth.uid() = user_id);

drop policy if exists "Watchlist rows are insertable by owner" on public.watchlists;
create policy "Watchlist rows are insertable by owner"
    on public.watchlists for insert
    with check (auth.uid() = user_id);

drop policy if exists "Watchlist rows are deletable by owner" on public.watchlists;
create policy "Watchlist rows are deletable by owner"
    on public.watchlists for delete
    using (auth.uid() = user_id);
