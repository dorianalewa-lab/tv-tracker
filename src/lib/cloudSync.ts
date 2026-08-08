import { supabase } from '../api/supabase';
import { loadDB } from '../storage/db';
import type { DB, LibraryItem, Profile, WatchEvent } from '../types';

/**
 * Couche de synchro : cache local = source de vérité pour l'UI (rapide),
 * cloud = source de vérité entre appareils. On push/pull en arrière-plan.
 *
 * Modèle simple :
 *  - pullFromCloud() au login → remplace la DB locale
 *  - pushDebounced() après chaque mutation → upsert cumulatif (500ms de debounce)
 *  - deleteItem/deleteEvent : sync inline (car l'upsert ne gère pas les suppressions)
 */

let currentUserId: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

export function setSyncUser(userId: string | null) {
  currentUserId = userId;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
}

// ---------------- Conversions row ↔ modèle client ----------------

type ItemRow = {
  id: string; user_id: string; tmdb_id: number; media_type: 'tv' | 'movie';
  title: string; poster_path: string | null; year: number | null;
  genres: string[]; runtime: number | null; total_episodes: number | null;
  status: string; rating: number | null; reaction: string | null;
  saved: boolean; vote_average: number | null;
  seen_episodes: Record<string, true>;
  added_at: string; updated_at: string;
};

type EventRow = {
  id: string; user_id: string; item_id: string;
  kind: 'episode' | 'movie'; episode_key: string | null;
  watched_at: string; runtime: number | null;
};

function rowToItem(row: ItemRow): LibraryItem {
  return {
    id: `${row.media_type}:${row.tmdb_id}`,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    posterPath: row.poster_path,
    year: row.year,
    genres: row.genres ?? [],
    runtime: row.runtime,
    totalEpisodes: row.total_episodes,
    status: row.status as LibraryItem['status'],
    rating: row.rating,
    reaction: (row.reaction as LibraryItem['reaction']) ?? null,
    saved: row.saved,
    voteAverage: row.vote_average,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
    seenEpisodes: Object.keys(row.seen_episodes ?? {}).length > 0 ? row.seen_episodes : undefined,
  };
}

function itemToRow(item: LibraryItem, userId: string) {
  return {
    user_id: userId,
    tmdb_id: item.tmdbId,
    media_type: item.mediaType,
    title: item.title,
    poster_path: item.posterPath,
    year: item.year,
    genres: item.genres,
    runtime: item.runtime,
    total_episodes: item.totalEpisodes,
    status: item.status,
    rating: item.rating,
    reaction: item.reaction,
    saved: item.saved,
    vote_average: item.voteAverage,
    seen_episodes: item.seenEpisodes ?? {},
    added_at: item.addedAt,
    updated_at: item.updatedAt,
  };
}

// ---------------- Pull ----------------

/**
 * Récupère toute la data cloud d'un user et la reconstruit en DB locale.
 * Utilisé au login.
 */
export async function pullFromCloud(userId: string): Promise<DB> {
  const [profileRes, itemsRes, eventsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('items').select('*').eq('user_id', userId),
    supabase
      .from('watch_events')
      .select('id, item_id, kind, episode_key, watched_at, runtime, items!inner(media_type, tmdb_id)')
      .eq('user_id', userId),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const items: Record<string, LibraryItem> = {};
  for (const row of (itemsRes.data ?? []) as ItemRow[]) {
    const it = rowToItem(row);
    items[it.id] = it;
  }

  const events: WatchEvent[] = [];
  // Double cast — TS ne peut pas prouver la forme jointe de Supabase, on l'assume ici.
  const rawEvents = (eventsRes.data ?? []) as unknown as (EventRow & { items: { media_type: string; tmdb_id: number } })[];
  for (const row of rawEvents) {
    const localItemId = `${row.items.media_type}:${row.items.tmdb_id}`;
    events.push({
      id: row.id,
      itemId: localItemId,
      kind: row.kind,
      episodeKey: row.episode_key ?? undefined,
      watchedAt: row.watched_at,
      runtime: row.runtime,
    });
  }

  const profileData = profileRes.data;
  const profile: Profile = profileData
    ? {
        displayName: profileData.display_name ?? 'Toi',
        emoji: profileData.emoji ?? '🎬',
        avatarUrl: profileData.avatar_url ?? null,
        bannerUrl: profileData.banner_url ?? null,
        region: profileData.region ?? 'CH',
        providers: profileData.providers ?? [],
      }
    : { displayName: 'Toi', emoji: '🎬', region: 'CH', providers: [] };

  return {
    version: 4,
    items,
    watchEvents: events,
    profile,
    meta: { level: 1, unlockedBadges: [] },
  };
}

// ---------------- Push (debounced) ----------------

export function pushDebounced() {
  if (!currentUserId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, 500);
}

async function pushNow() {
  if (!currentUserId || syncing) return;
  syncing = true;
  try {
    const db = loadDB();
    const userId = currentUserId;

    // 1) Profil
    await supabase.from('profiles').upsert({
      id: userId,
      display_name: db.profile.displayName,
      emoji: db.profile.emoji ?? '🎬',
      avatar_url: db.profile.avatarUrl ?? null,
      banner_url: db.profile.bannerUrl ?? null,
      region: db.profile.region,
      providers: db.profile.providers,
      updated_at: new Date().toISOString(),
    });

    // 2) Items (upsert avec la contrainte composite) — retourne les rows avec leur uuid
    let itemsInserted: { id: string; media_type: string; tmdb_id: number }[] = [];
    const itemRows = Object.values(db.items).map((it) => itemToRow(it, userId));
    if (itemRows.length > 0) {
      const { data, error } = await supabase
        .from('items')
        .upsert(itemRows, { onConflict: 'user_id,media_type,tmdb_id' })
        .select('id, media_type, tmdb_id');
      if (error) throw error;
      itemsInserted = data ?? [];
    } else {
      // Aucun item local → on récupère quand même les rows existants pour le mapping events
      const { data } = await supabase
        .from('items')
        .select('id, media_type, tmdb_id')
        .eq('user_id', userId);
      itemsInserted = data ?? [];
    }

    // 3) Build local_id → cloud_uuid map (nécessaire pour la FK des events)
    const idMap = new Map<string, string>();
    for (const row of itemsInserted) {
      idMap.set(`${row.media_type}:${row.tmdb_id}`, row.id);
    }

    // 4) Events : upsert par id (client-generated uuid)
    const eventRows = db.watchEvents
      .map((e) => {
        const dbItemId = idMap.get(e.itemId);
        if (!dbItemId) return null;
        return {
          id: e.id,
          user_id: userId,
          item_id: dbItemId,
          kind: e.kind,
          episode_key: e.episodeKey ?? null,
          watched_at: e.watchedAt,
          runtime: e.runtime,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (eventRows.length > 0) {
      const { error } = await supabase.from('watch_events').upsert(eventRows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[cloudSync] push failed :', e);
  } finally {
    syncing = false;
  }
}

// ---------------- Deletes explicites ----------------

/** Supprime un item côté cloud (cascade → ses watch_events partent aussi). */
export async function deleteItemFromCloud(mediaType: 'tv' | 'movie', tmdbId: number) {
  if (!currentUserId) return;
  await supabase
    .from('items')
    .delete()
    .eq('user_id', currentUserId)
    .eq('media_type', mediaType)
    .eq('tmdb_id', tmdbId);
}

/** Supprime un watch_event côté cloud. */
export async function deleteEventFromCloud(eventId: string) {
  if (!currentUserId) return;
  await supabase.from('watch_events').delete().eq('id', eventId).eq('user_id', currentUserId);
}

/** Efface tout ce que possède le user (pour bouton "Tout effacer"). */
export async function wipeCloudData() {
  if (!currentUserId) return;
  await supabase.from('watch_events').delete().eq('user_id', currentUserId);
  await supabase.from('items').delete().eq('user_id', currentUserId);
}
