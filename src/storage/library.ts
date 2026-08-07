import type {
  DB, LibraryItem, MediaType, Reaction, Status, TmdbSearchResult, Profile,
} from '../types';
import {
  getMovieDetails, getTvDetails, getTvSeason,
  type MovieDetails, type TvDetails,
} from '../api/tmdb';
import { mutateDB, loadDB } from './db';
import { uuid } from '../lib/uuid';
import { deleteEventFromCloud, deleteItemFromCloud } from '../lib/cloudSync';

function makeId(type: MediaType, tmdbId: number) {
  return `${type}:${tmdbId}`;
}

function yearOf(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const y = Number(dateStr.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function episodeKey(seasonNumber: number, episodeNumber: number) {
  return `S${seasonNumber}E${episodeNumber}`;
}

/** Total d'épisodes hors specials, depuis un TvDetails. */
function totalEpisodesOf(details: TvDetails): number | null {
  const seasons = details.seasons?.filter((s) => s.season_number > 0) ?? [];
  const total = seasons.reduce((n, s) => n + (s.episode_count ?? 0), 0);
  return total > 0 ? total : null;
}

/**
 * Statut auto-dérivé — jamais édité manuellement par l'user.
 * Film vu → completed. TV tous eps → completed. TV eps partiels → watching.
 * Sinon → planned (par défaut, s'applique aussi aux items juste enregistrés).
 */
function deriveStatus(item: LibraryItem, db: DB): Status {
  if (item.mediaType === 'movie') {
    const seen = db.watchEvents.some((e) => e.itemId === item.id && e.kind === 'movie');
    return seen ? 'completed' : 'planned';
  }
  const totalSeen = item.seenEpisodes ? Object.keys(item.seenEpisodes).length : 0;
  const total = item.totalEpisodes ?? 0;
  if (total > 0 && totalSeen >= total) return 'completed';
  if (totalSeen > 0) return 'watching';
  return 'planned';
}

/** Recalcule + assigne le statut d'un item. À appeler après chaque mutation. */
function touchStatus(item: LibraryItem, db: DB) {
  item.status = deriveStatus(item, db);
  item.updatedAt = new Date().toISOString();
}

export function updateProfile(patch: Partial<Profile>) {
  mutateDB((db) => {
    db.profile = { ...db.profile, ...patch };
  });
}

/**
 * Ajoute un item en fetchant les détails complets (genres, runtime, totalEpisodes).
 */
export async function addFromSearchResult(
  result: TmdbSearchResult,
  _statusHint: Status = 'planned'  // kept for signature compat, ignored (statut est auto)
): Promise<LibraryItem> {
  void _statusHint;
  const mediaType = result.media_type as MediaType;
  const id = makeId(mediaType, result.id);
  const now = new Date().toISOString();

  let title: string, posterPath: string | null, year: number | null;
  let genres: string[], runtime: number | null, voteAverage: number | null;
  let totalEpisodes: number | null = null;

  if (mediaType === 'movie') {
    const d = await getMovieDetails(result.id);
    title = d.title;
    posterPath = d.poster_path;
    year = yearOf(d.release_date);
    genres = d.genres.map((g) => g.name);
    runtime = d.runtime ?? null;
    voteAverage = (d as unknown as { vote_average?: number }).vote_average ?? null;
  } else {
    const d = await getTvDetails(result.id);
    title = d.name;
    posterPath = d.poster_path;
    year = yearOf(d.first_air_date);
    genres = d.genres.map((g) => g.name);
    runtime = d.episode_run_time?.[0] ?? null;
    voteAverage = (d as unknown as { vote_average?: number }).vote_average ?? null;
    totalEpisodes = totalEpisodesOf(d);
  }

  let created!: LibraryItem;
  mutateDB((db) => {
    const existing = db.items[id];
    const item: LibraryItem = {
      id,
      tmdbId: result.id,
      mediaType,
      title,
      posterPath,
      year,
      genres,
      runtime,
      totalEpisodes,
      voteAverage,
      status: existing?.status ?? 'planned',
      rating: existing?.rating ?? null,
      reaction: existing?.reaction ?? null,
      saved: existing?.saved ?? false,
      addedAt: existing?.addedAt ?? now,
      updatedAt: now,
      seenEpisodes: existing?.seenEpisodes,
    };
    db.items[id] = item;
    touchStatus(item, db);
    created = item;
  });
  return created;
}

/** Ajoute silencieusement à partir de détails déjà fetchés (fiche). */
export function ensureItemFromDetails(
  details: MovieDetails | TvDetails,
  mediaType: MediaType,
  _statusHint: Status = 'planned'
): LibraryItem {
  void _statusHint;
  const id = makeId(mediaType, details.id);
  const now = new Date().toISOString();
  let created!: LibraryItem;

  mutateDB((db) => {
    if (db.items[id]) { created = db.items[id]; return; }
    const isMovie = mediaType === 'movie';
    const movieD = details as MovieDetails;
    const tvD = details as TvDetails;
    const item: LibraryItem = {
      id,
      tmdbId: details.id,
      mediaType,
      title: isMovie ? movieD.title : tvD.name,
      posterPath: details.poster_path,
      year: yearOf(isMovie ? movieD.release_date : tvD.first_air_date),
      genres: details.genres.map((g) => g.name),
      runtime: isMovie ? (movieD.runtime ?? null) : (tvD.episode_run_time?.[0] ?? null),
      totalEpisodes: isMovie ? null : totalEpisodesOf(tvD),
      voteAverage: (details as unknown as { vote_average?: number }).vote_average ?? null,
      status: 'planned',
      rating: null,
      reaction: null,
      saved: false,
      addedAt: now,
      updatedAt: now,
    };
    db.items[id] = item;
    touchStatus(item, db);
    created = item;
  });
  return created;
}

/** Ajoute à partir de peu de données (résultat search), sans fetch — utilisé par le catalogue rapide. */
export function ensureItemFromLight(
  r: TmdbSearchResult,
  mediaType: MediaType,
  _statusHint: Status = 'planned'
): string {
  void _statusHint;
  const id = makeId(mediaType, r.id);
  mutateDB((db) => {
    if (db.items[id]) return;
    const now = new Date().toISOString();
    const dateStr = r.release_date || r.first_air_date;
    const item: LibraryItem = {
      id,
      tmdbId: r.id,
      mediaType,
      title: (r.title || r.name) ?? '',
      posterPath: r.poster_path,
      year: yearOf(dateStr),
      genres: [],
      runtime: null,
      totalEpisodes: null,
      voteAverage: r.vote_average ?? null,
      status: 'planned',
      rating: null,
      reaction: null,
      saved: false,
      addedAt: now,
      updatedAt: now,
    };
    db.items[id] = item;
  });
  return id;
}

/** Enrichit un item light avec ses détails complets (genres/runtime/totalEpisodes). Non bloquant. */
export async function enrichItemInBackground(itemId: string, tmdbId: number, mediaType: MediaType) {
  try {
    if (mediaType === 'movie') {
      const d = await getMovieDetails(tmdbId);
      mutateDB((db) => {
        const it = db.items[itemId];
        if (!it) return;
        it.genres = d.genres.map((g) => g.name);
        it.runtime = d.runtime ?? null;
        it.voteAverage = (d as unknown as { vote_average?: number }).vote_average ?? it.voteAverage;
        it.updatedAt = new Date().toISOString();
      });
    } else {
      const d = await getTvDetails(tmdbId);
      mutateDB((db) => {
        const it = db.items[itemId];
        if (!it) return;
        it.genres = d.genres.map((g) => g.name);
        it.runtime = d.episode_run_time?.[0] ?? null;
        it.totalEpisodes = totalEpisodesOf(d);
        it.voteAverage = (d as unknown as { vote_average?: number }).vote_average ?? it.voteAverage;
        it.updatedAt = new Date().toISOString();
        touchStatus(it, db);   // statut peut changer maintenant qu'on connaît le total
      });
    }
  } catch { /* silent */ }
}

/** Retire l'item et son historique. */
export function removeItem(id: string) {
  // Capture avant suppression pour connaître mediaType + tmdbId
  const item = loadDB().items[id];
  mutateDB((db) => {
    delete db.items[id];
    db.watchEvents = db.watchEvents.filter((e) => e.itemId !== id);
  });
  if (item) void deleteItemFromCloud(item.mediaType, item.tmdbId);
}

export function setRating(id: string, rating: number | null) {
  mutateDB((db) => {
    const item = db.items[id];
    if (!item) return;
    item.rating = rating;
    item.updatedAt = new Date().toISOString();
  });
}

// -- Reaction (conservé pour compat, non utilisé dans l'UI actuelle) --
export function setReaction(id: string, reaction: Reaction | null) {
  mutateDB((db) => {
    const item = db.items[id];
    if (!item) return;
    item.reaction = reaction;
    item.updatedAt = new Date().toISOString();
  });
}

export function toggleSaved(id: string) {
  mutateDB((db) => {
    const item = db.items[id];
    if (!item) return;
    item.saved = !item.saved;
    item.updatedAt = new Date().toISOString();
  });
}

// -------- Séries : cocher / décocher un épisode --------

type EpisodeLite = { episode_number: number; runtime: number | null };

export function markEpisodeSeen(
  itemId: string,
  seasonNumber: number,
  upToEpisodeNumber: number,
  seasonEpisodes: EpisodeLite[]
) {
  mutateDB((db) => {
    const item = db.items[itemId];
    if (!item) return;
    item.seenEpisodes ??= {};
    const now = new Date().toISOString();
    for (const ep of seasonEpisodes) {
      if (ep.episode_number > upToEpisodeNumber) continue;
      const key = episodeKey(seasonNumber, ep.episode_number);
      if (item.seenEpisodes[key]) continue;
      item.seenEpisodes[key] = true;
      db.watchEvents.push({
        id: uuid(),
        itemId,
        kind: 'episode',
        episodeKey: key,
        watchedAt: now,
        runtime: ep.runtime ?? item.runtime,
      });
    }
    touchStatus(item, db);
  });
}

export function unmarkEpisodeSeen(itemId: string, seasonNumber: number, episodeNumber: number) {
  const key = episodeKey(seasonNumber, episodeNumber);
  const removedIds: string[] = [];
  mutateDB((db) => {
    const item = db.items[itemId];
    if (!item?.seenEpisodes) return;
    delete item.seenEpisodes[key];
    db.watchEvents = db.watchEvents.filter((e) => {
      const drop = e.itemId === itemId && e.episodeKey === key;
      if (drop) removedIds.push(e.id);
      return !drop;
    });
    touchStatus(item, db);
  });
  for (const id of removedIds) void deleteEventFromCloud(id);
}

/** Coche tous les épisodes de toutes les saisons d'une série. Fetch en tâche de fond. */
export async function markAllEpisodesSeen(itemId: string, tmdbId: number) {
  try {
    const details = await getTvDetails(tmdbId);
    const seasons = details.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);
    const perSeason = await Promise.all(
      seasons.map((s) => getTvSeason(tmdbId, s.season_number).then((r) => ({ s, eps: r.episodes })))
    );

    // Met à jour totalEpisodes de l'item pour que le statut se calcule bien
    const total = perSeason.reduce((n, { eps }) => n + eps.length, 0);
    mutateDB((db) => {
      const it = db.items[itemId];
      if (it) {
        it.totalEpisodes = total;
        it.genres = details.genres.map((g) => g.name);
        it.runtime = details.episode_run_time?.[0] ?? it.runtime;
      }
    });

    // Coche chaque saison en une passe (markEpisodeSeen ajoute uniquement les nouveaux)
    for (const { s, eps } of perSeason) {
      if (eps.length === 0) continue;
      const last = Math.max(...eps.map((e) => e.episode_number));
      markEpisodeSeen(itemId, s.season_number, last, eps);
    }
  } catch { /* silencieux — l'user pourra retry via la fiche */ }
}

/** Décoche tous les épisodes + supprime les événements associés. */
export function resetTvProgress(itemId: string) {
  const removedIds: string[] = [];
  mutateDB((db) => {
    const item = db.items[itemId];
    if (!item) return;
    item.seenEpisodes = {};
    db.watchEvents = db.watchEvents.filter((e) => {
      const drop = e.itemId === itemId && e.kind === 'episode';
      if (drop) removedIds.push(e.id);
      return !drop;
    });
    touchStatus(item, db);
  });
  for (const id of removedIds) void deleteEventFromCloud(id);
}

// -------- Films : marquer / retirer "vu" --------

export function markMovieSeen(itemId: string) {
  mutateDB((db) => {
    const item = db.items[itemId];
    if (!item || item.mediaType !== 'movie') return;
    const now = new Date().toISOString();
    const already = db.watchEvents.some((e) => e.itemId === itemId && e.kind === 'movie');
    if (!already) {
      db.watchEvents.push({
        id: uuid(),
        itemId,
        kind: 'movie',
        watchedAt: now,
        runtime: item.runtime,
      });
    }
    touchStatus(item, db);
  });
}

export function unmarkMovieSeen(itemId: string) {
  const removedIds: string[] = [];
  mutateDB((db) => {
    const item = db.items[itemId];
    if (!item) return;
    db.watchEvents = db.watchEvents.filter((e) => {
      const drop = e.itemId === itemId && e.kind === 'movie';
      if (drop) removedIds.push(e.id);
      return !drop;
    });
    touchStatus(item, db);
  });
  for (const id of removedIds) void deleteEventFromCloud(id);
}
