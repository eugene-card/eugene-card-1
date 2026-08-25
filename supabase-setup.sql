-- Eugene Card: clean Supabase-only authentication foundation
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  instagram text,
  tiktok text,
  x_url text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "users update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    lower(regexp_replace(split_part(coalesce(new.email,''),'@',1), '[^a-zA-Z0-9_]', '', 'g')),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Google OAuth is configured in Supabase Auth settings, not in SQL.
-- Email/password UI is intentionally not exposed by this application.

-- ---------------------------------------------------------------------
-- Generic document store backing js/supabase-firebase-compat.js
-- (window.db.collection(...).doc(...) etc.). index.html still uses
-- Firestore-style calls across ~13 "collections" (cards, transactions,
-- chats, clientGifts, ...); rather than build a bespoke table per
-- collection, they're all stored as JSON rows here.
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  collection text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

alter table public.documents enable row level security;

-- Permissive defaults so the app works out of the box: anyone can read,
-- any signed-in user can write to any collection/document.
-- TIGHTEN THIS before going to production — collections like
-- "transactions", "clientGifts", "tokens" and "system" should not be
-- writable (or even readable) by every authenticated user. Add
-- collection-specific policies (e.g. `using (collection <> 'system')`,
-- or check `data->>'ownerId' = auth.uid()::text`) once you know each
-- collection's real access rules.
create policy "documents are readable"
on public.documents for select
to anon, authenticated
using (true);

create policy "authenticated users can write documents"
on public.documents for insert
to authenticated
with check (true);

create policy "authenticated users can update documents"
on public.documents for update
to authenticated
using (true)
with check (true);

create policy "authenticated users can delete documents"
on public.documents for delete
to authenticated
using (true);

-- Enables db.collection(...).onSnapshot(...) realtime listeners.
alter publication supabase_realtime add table public.documents;
