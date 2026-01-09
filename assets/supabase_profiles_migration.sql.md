# Supabase migration: `public.profiles` (RoadRescue – QuickAssist)

This project’s frontends expect a `public.profiles` table to exist and to include at least these fields:

- `id` (uuid, primary key, references `auth.users(id)`)
- `role` (text)
- `approved` (boolean)
- `profile` (jsonb; stores mechanic profile details like `{ name, serviceArea }`)
- `full_name` (text; optional display name used by some UI paths)
- `created_at` / `updated_at` timestamps

If you see errors like:
- `relation "profiles" does not exist`
- `column profiles.approved does not exist`
- `Could not find the 'approved' column of 'profiles' in the schema cache`

Run the SQL below in **Supabase Dashboard → SQL Editor**.

After running the SQL, if the UI still errors with “schema cache” (PostgREST cache), do the following:
1) Wait ~30–90 seconds (Supabase PostgREST can take a moment to reload schema metadata)
2) Hard refresh the admin UI
3) Retry the action (approve mechanic) — the admin panel also performs an automatic one-time retry after ~2–3 seconds.

---

## 1) Create/upgrade `public.profiles`

```sql
-- Ensure extension exists (usually already present on Supabase)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  approved boolean not null default false,
  -- Optional fields used across the 3 frontends
  full_name text,
  profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If your table exists but is missing columns, add them safely:
alter table public.profiles add column if not exists role text;
alter table public.profiles alter column role set default 'user';

-- IMPORTANT: `approved` is required by the admin approval flow
alter table public.profiles add column if not exists approved boolean;
alter table public.profiles alter column approved set default false;
-- Make it explicitly NOT NULL as expected by the frontends (safe if column is new; if existing with NULLs you may need to backfill first)
alter table public.profiles alter column approved set not null;

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists profile jsonb;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles alter column created_at set default now();
alter table public.profiles add column if not exists updated_at timestamptz;
alter table public.profiles alter column updated_at set default now();
```

---

## 2) Keep `updated_at` fresh

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();
```

---

## 3) Indexes (optional but recommended)

```sql
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_approved_idx on public.profiles(approved);
```

---

## 4) RLS policies (baseline placeholders)

> IMPORTANT: Adjust to your security model. This is a minimal baseline so the apps can function.

```sql
alter table public.profiles enable row level security;

-- Allow users to read their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

-- Allow users to insert their own profile row (first-login bootstrap)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

-- Allow users to update their own profile json + name
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Admin access:
-- If you use a Supabase service role key in the admin panel, it bypasses RLS automatically.
-- If you use anon/authenticated keys for admin UI, you'll need stricter policies based on JWT claims.
```
