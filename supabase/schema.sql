-- =====================================================================
-- TV Tracker — Schéma Supabase (à exécuter dans SQL Editor)
-- Version : 1
-- Sécurité : Row-Level Security (RLS) — chaque user voit ses données
--            + celles de ses amis, jamais celles des autres.
-- =====================================================================

-- 1) PROFILES : extension publique de auth.users
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default 'Utilisateur',
  emoji text default '🎬',
  region text default 'CH',
  providers jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) ITEMS : titres en biblio (un enregistrement par (user, tmdb_id))
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('tv', 'movie')),
  title text not null,
  poster_path text,
  year integer,
  genres text[] default '{}',
  runtime integer,
  total_episodes integer,
  status text not null default 'planned',
  rating integer,
  reaction text,
  saved boolean not null default false,
  vote_average real,
  seen_episodes jsonb default '{}'::jsonb,
  added_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, media_type, tmdb_id)
);
create index if not exists items_user_id_idx on public.items(user_id);
create index if not exists items_lookup_idx  on public.items(user_id, media_type, tmdb_id);

-- 3) WATCH_EVENTS : historique de visionnage (base des stats)
create table if not exists public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  item_id uuid references public.items(id) on delete cascade not null,
  kind text not null check (kind in ('episode', 'movie')),
  episode_key text,
  watched_at timestamptz not null default now(),
  runtime integer
);
create index if not exists watch_events_user_id_idx on public.watch_events(user_id);
create index if not exists watch_events_item_id_idx on public.watch_events(item_id);

-- 4) FRIENDSHIPS : demandes + relations validées
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users on delete cascade not null,
  addressee_id uuid references auth.users on delete cascade not null,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);

-- Helper : deux users sont-ils amis (accepted, symétrique) ?
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = a and addressee_id = b) or
        (requester_id = b and addressee_id = a)
      )
  );
$$;

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.items         enable row level security;
alter table public.watch_events  enable row level security;
alter table public.friendships   enable row level security;

-- PROFILES : lecture publique (pour recherche d'amis), édition personnelle
drop policy if exists "profiles_select_all"     on public.profiles;
drop policy if exists "profiles_insert_own"     on public.profiles;
drop policy if exists "profiles_update_own"     on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- ITEMS : je vois les miens + ceux de mes amis
drop policy if exists "items_select_own_or_friend" on public.items;
drop policy if exists "items_insert_own"           on public.items;
drop policy if exists "items_update_own"           on public.items;
drop policy if exists "items_delete_own"           on public.items;
create policy "items_select_own_or_friend" on public.items for select using (
  user_id = auth.uid() or public.are_friends(auth.uid(), user_id)
);
create policy "items_insert_own" on public.items for insert with check (user_id = auth.uid());
create policy "items_update_own" on public.items for update using (user_id = auth.uid());
create policy "items_delete_own" on public.items for delete using (user_id = auth.uid());

-- WATCH_EVENTS : idem
drop policy if exists "events_select_own_or_friend" on public.watch_events;
drop policy if exists "events_insert_own"           on public.watch_events;
drop policy if exists "events_delete_own"           on public.watch_events;
create policy "events_select_own_or_friend" on public.watch_events for select using (
  user_id = auth.uid() or public.are_friends(auth.uid(), user_id)
);
create policy "events_insert_own" on public.watch_events for insert with check (user_id = auth.uid());
create policy "events_delete_own" on public.watch_events for delete using (user_id = auth.uid());

-- FRIENDSHIPS : chacun voit les relations où il est impliqué
drop policy if exists "friendships_select_involved" on public.friendships;
drop policy if exists "friendships_insert_as_req"   on public.friendships;
drop policy if exists "friendships_update_as_addr"  on public.friendships;
drop policy if exists "friendships_delete_involved" on public.friendships;
create policy "friendships_select_involved" on public.friendships for select using (
  requester_id = auth.uid() or addressee_id = auth.uid()
);
create policy "friendships_insert_as_req" on public.friendships for insert with check (
  requester_id = auth.uid()
);
create policy "friendships_update_as_addr" on public.friendships for update using (
  addressee_id = auth.uid()
);
create policy "friendships_delete_involved" on public.friendships for delete using (
  requester_id = auth.uid() or addressee_id = auth.uid()
);

-- =====================================================================
-- TRIGGER : auto-crée un profil à la 1re connexion d'un user
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
