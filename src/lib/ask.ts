/**
 * Moteur du chatbot "Demande à l'app".
 * 100% local : les réponses cliquables se traduisent en filtres TMDB /discover.
 */

import type { LibraryItem } from '../types';

export type Mood = 'chill' | 'thrilling' | 'funny' | 'thoughtful' | 'moving' | 'scary';
export type TimeSlot = 'short' | 'onehour' | 'evening' | 'weekend';
export type FormatChoice = 'movie' | 'tv' | 'any';
export type Safety = 'safe' | 'discovery' | 'nearby';

export type Answers = {
  mood?: Mood;
  time?: TimeSlot;
  format?: FormatChoice;
  genres?: string[];      // noms FR, optionnel
  safety?: Safety;
};

export const MOOD_OPTIONS: { key: Mood; label: string; emoji: string; genres: string[] }[] = [
  { key: 'chill',      label: 'Chill',      emoji: '😌', genres: ['Comédie', 'Familial', 'Animation'] },
  { key: 'thrilling',  label: 'Palpitant',  emoji: '⚡',  genres: ['Action', 'Aventure', 'Thriller', 'Crime'] },
  { key: 'funny',      label: 'Rigoler',    emoji: '😂', genres: ['Comédie'] },
  { key: 'thoughtful', label: 'Réfléchir',  emoji: '🧠', genres: ['Documentaire', 'Drame', 'Science-Fiction', 'Mystère'] },
  { key: 'moving',     label: 'Ému',        emoji: '🥲', genres: ['Drame', 'Romance'] },
  { key: 'scary',      label: 'Frisson',    emoji: '😱', genres: ['Horreur', 'Mystère'] },
];

export const TIME_OPTIONS: { key: TimeSlot; label: string; hint: string }[] = [
  { key: 'short',    label: '< 45 min',    hint: '1 épisode ou court métrage' },
  { key: 'onehour',  label: '~ 1 h',       hint: '1-2 épisodes' },
  { key: 'evening',  label: 'Une soirée',  hint: '1 film ou plusieurs épisodes' },
  { key: 'weekend',  label: 'Un weekend',  hint: 'Prêt à binger une saison' },
];

export const FORMAT_OPTIONS: { key: FormatChoice; label: string; emoji: string }[] = [
  { key: 'movie', label: 'Film', emoji: '🎬' },
  { key: 'tv',    label: 'Série', emoji: '📺' },
  { key: 'any',   label: 'Peu importe', emoji: '🤷' },
];

export const SAFETY_OPTIONS: { key: Safety; label: string; hint: string }[] = [
  { key: 'safe',      label: 'Valeur sûre',        hint: 'Bien noté par la critique' },
  { key: 'nearby',    label: 'Proche de mes goûts',hint: 'Aligné avec ta biblio' },
  { key: 'discovery', label: 'Découverte',          hint: 'Un truc que tu ne connais pas' },
];

/** Traduit les réponses en paramètres TMDB /discover. */
export type DiscoverParams = {
  mediaType: 'tv' | 'movie';
  with_genres?: string;
  'vote_count.gte'?: number;
  'vote_average.gte'?: number;
  'with_runtime.lte'?: number;
  'with_runtime.gte'?: number;
  with_watch_providers?: string;    // ids providers TMDB
  watch_region?: string;
  sort_by?: string;
  page?: number;
};

export function buildDiscoverParams(
  answers: Answers,
  mediaType: 'tv' | 'movie',
  genreMap: Map<string, number>,
  userProfileTopGenres: string[],
  watchOpts?: { providers: number[]; region: string }
): DiscoverParams {
  const params: DiscoverParams = {
    mediaType,
    'vote_count.gte': 100,
    sort_by: 'popularity.desc',
  };

  // Combine les genres du mood + ceux choisis explicitement, + optionnellement le profil user.
  const moodGenres = MOOD_OPTIONS.find((m) => m.key === answers.mood)?.genres ?? [];
  const explicitGenres = answers.genres ?? [];
  const profileGenres = answers.safety === 'nearby' ? userProfileTopGenres.slice(0, 3) : [];
  const allGenres = Array.from(new Set([...moodGenres, ...explicitGenres, ...profileGenres]));
  const genreIds = allGenres
    .map((n) => genreMap.get(n))
    .filter((id): id is number => typeof id === 'number');
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join(',');
  }

  // "Valeur sûre" : on remonte la barre des notes.
  if (answers.safety === 'safe') {
    params['vote_average.gte'] = 7.5;
    params['vote_count.gte'] = 500;
  }

  // "Découverte" : moins populaire, mais quand même bien noté (limite les fonds de tiroir).
  if (answers.safety === 'discovery') {
    params.sort_by = 'vote_average.desc';
    params['vote_count.gte'] = 300;
  }

  // Runtime — uniquement pour les films (TMDB TV n'expose pas de filtre runtime utile).
  if (mediaType === 'movie' && answers.time) {
    if (answers.time === 'short') params['with_runtime.lte'] = 60;
    else if (answers.time === 'onehour') { params['with_runtime.gte'] = 60; params['with_runtime.lte'] = 100; }
    else if (answers.time === 'evening') { params['with_runtime.gte'] = 90; params['with_runtime.lte'] = 180; }
  }

  // Plateformes user (filtre "où regarder")
  if (watchOpts && watchOpts.providers.length > 0) {
    params.with_watch_providers = watchOpts.providers.join('|');   // OR entre plateformes
    params.watch_region = watchOpts.region;
  }

  return params;
}

/** Bandeau d'explication en langage naturel synthétisant la conversation. */
export function summarizeConversation(answers: Answers): string {
  const mood = MOOD_OPTIONS.find((m) => m.key === answers.mood)?.label.toLowerCase();
  const time = TIME_OPTIONS.find((t) => t.key === answers.time)?.label.toLowerCase();
  const format = FORMAT_OPTIONS.find((f) => f.key === answers.format)?.label.toLowerCase();
  const safety = SAFETY_OPTIONS.find((s) => s.key === answers.safety)?.label.toLowerCase();

  const parts: string[] = [];
  if (mood) parts.push(`quelque chose de ${mood}`);
  if (format && format !== 'peu importe') parts.push(format);
  if (time) parts.push(`pour ${time}`);
  if (answers.genres && answers.genres.length > 0) parts.push(`côté ${answers.genres.join(' / ')}`);
  if (safety) parts.push(`(${safety})`);

  return parts.length > 0
    ? `Tu veux ${parts.join(', ')}. Voici ce que je te propose :`
    : 'Voici ce que je te propose :';
}

/** Optionnel : booster une suggestion si elle "rime" avec un titre bien noté de la biblio. */
export function ownedHighlight(candidateGenres: string[], library: LibraryItem[]): LibraryItem | null {
  const wellRated = library.filter((i) => (i.rating ?? 0) >= 4);
  for (const it of wellRated) {
    if (it.genres.some((g) => candidateGenres.includes(g))) return it;
  }
  return null;
}
