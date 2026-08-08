-- =====================================================================
-- Migration : ajouter avatar_url + banner_url dans profiles
-- Permet à l'user de choisir une image de film comme avatar/bannière
-- À exécuter dans SQL Editor Supabase
-- =====================================================================

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;
