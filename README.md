# TV Tracker

App web perso de suivi de séries et films, dans l'esprit de TV Time — priorité rapidité de coche et outil pilote.

Stack :

- **Vite + React + TypeScript**
- **Tailwind CSS** (dark mode par défaut, mobile-first)
- **Supabase** (Postgres + Auth magic link, RLS)
- **TMDB** pour la data séries/films
- Déploiement **Vercel**

## Dev local

```bash
npm install
npm run dev
```

Crée un fichier `.env.local` à la racine avec :

```
VITE_TMDB_API_KEY=xxx
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## Schéma Supabase

Le schéma SQL est dans [`supabase/schema.sql`](supabase/schema.sql).
La migration pour les amis dans [`supabase/friends-migration.sql`](supabase/friends-migration.sql).
À exécuter dans SQL Editor du projet Supabase.
