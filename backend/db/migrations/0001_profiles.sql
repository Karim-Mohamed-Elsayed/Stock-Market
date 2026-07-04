-- Public profile data for each Supabase Auth user.
-- auth.users is managed by Supabase; custom user fields live here instead.

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text,
    avatar_url text,
    bio text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Keep updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
-- Reads optional full_name passed as sign-up "data" (user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name'
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- Row Level Security: users can only read/update their own profile.
-- The backend also uses a service-role connection for admin operations
-- (e.g. deleting a user), which bypasses RLS by design.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Profiles are updatable by owner"
    on public.profiles for update
    using (auth.uid() = id);
