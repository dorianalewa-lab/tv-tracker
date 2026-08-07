import type { DB, Profile } from '../types';

const KEY = 'tv-app-db';
const CURRENT_VERSION = 4;

const DEFAULT_PROFILE: Profile = {
  displayName: 'Toi',
  emoji: '🎬',
  region: 'CH',
  providers: [],
};

const EMPTY: DB = {
  version: CURRENT_VERSION,
  items: {},
  watchEvents: [],
  profile: DEFAULT_PROFILE,
  meta: { level: 1, unlockedBadges: [] },
};

const listeners = new Set<() => void>();
let cache: DB | null = null;

// Hook facultatif appelé après chaque saveDB — utilisé pour déclencher
// la synchro cloud sans créer d'import circulaire.
let saveHook: (() => void) | null = null;
export function setSaveHook(fn: (() => void) | null) { saveHook = fn; }

function readFromStorage(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<DB> & { items?: Record<string, unknown> };
    const prevVersion = parsed.version ?? 1;

    // Migration items : garantit les nouveaux champs + passage rating 1-5 → 1-10 (IMDB)
    const items: DB['items'] = {};
    for (const [id, itRaw] of Object.entries(parsed.items ?? {})) {
      const it = itRaw as Partial<DB['items'][string]>;
      let rating = it.rating ?? null;
      if (prevVersion < 4 && rating != null && rating <= 5) {
        rating = rating * 2;   // 5 → 10, 4 → 8, etc.
      }
      items[id] = {
        id: it.id ?? id,
        tmdbId: it.tmdbId ?? 0,
        mediaType: it.mediaType ?? 'movie',
        title: it.title ?? '',
        posterPath: it.posterPath ?? null,
        year: it.year ?? null,
        genres: it.genres ?? [],
        runtime: it.runtime ?? null,
        totalEpisodes: (it as { totalEpisodes?: number | null }).totalEpisodes ?? null,
        status: it.status ?? 'planned',
        rating,
        reaction: it.reaction ?? null,
        saved: it.saved ?? false,
        voteAverage: it.voteAverage ?? null,
        addedAt: it.addedAt ?? new Date().toISOString(),
        updatedAt: it.updatedAt ?? new Date().toISOString(),
        seenEpisodes: it.seenEpisodes,
      };
    }

    return {
      version: CURRENT_VERSION,
      items,
      watchEvents: parsed.watchEvents ?? [],
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
      meta: parsed.meta ?? { level: 1, unlockedBadges: [] },
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('DB corrompue, réinit :', e);
    return structuredClone(EMPTY);
  }
}

export function loadDB(): DB {
  if (cache === null) cache = readFromStorage();
  return cache;
}

export function saveDB(db: DB) {
  cache = db;
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn());
  saveHook?.();
}

/**
 * Écrit la DB sans déclencher le saveHook (utilisé au pull cloud pour éviter
 * de re-pousser immédiatement ce qu'on vient de recevoir).
 */
export function setDBSilent(db: DB) {
  cache = db;
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function mutateDB(fn: (db: DB) => void) {
  const next = structuredClone(loadDB());
  fn(next);
  saveDB(next);
}

export function exportDB(): string {
  return JSON.stringify(loadDB(), null, 2);
}

export function importDB(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return false;
    localStorage.setItem(KEY, JSON.stringify(parsed));
    cache = null;             // force reload
    listeners.forEach((fn) => fn());
    return true;
  } catch {
    return false;
  }
}

export function resetDB() {
  saveDB(structuredClone(EMPTY));
}
