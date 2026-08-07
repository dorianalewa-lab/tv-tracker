import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env manquants — vérifie .env.local');
}

// Client unique partagé. `persistSession` sauvegarde le token en localStorage
// (donc reconnexion automatique après refresh).
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // gère le hash #access_token=... au retour du magic link
  },
});
