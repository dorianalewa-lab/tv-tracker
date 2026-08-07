-- =====================================================================
-- Migration : ajouter email public dans profiles pour permettre la recherche d'amis
-- À exécuter dans SQL Editor Supabase après le schema.sql initial
-- =====================================================================

-- 1) Ajoute la colonne email + index (case-insensitive via ILIKE)
alter table public.profiles add column if not exists email text;
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- 2) Backfill : remplit l'email pour les profils déjà existants
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 3) Trigger de création : inclut désormais l'email
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, split_part(new.email, '@', 1), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Le trigger est déjà en place — la fonction est juste mise à jour.
