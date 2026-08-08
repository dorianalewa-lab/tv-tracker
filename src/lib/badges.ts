import type { DB } from '../types';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type Badge = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  tier: BadgeTier;
  unlocked: boolean;
  progress?: { current: number; target: number };
};

export type LevelInfo = {
  level: number;
  totalEvents: number;
  prevThreshold: number;
  nextThreshold: number;
  eventsToNext: number;
  progressPct: number;
};

const LEVEL_THRESHOLDS = [0, 5, 15, 30, 60, 120, 250, 500, 1000, 2000, 4000];

export function computeLevel(db: DB): LevelInfo {
  const total = db.watchEvents.length;
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (total >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const clamped = Math.min(level, LEVEL_THRESHOLDS.length);
  const prevThreshold = LEVEL_THRESHOLDS[clamped - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[clamped] ?? prevThreshold;
  const range = Math.max(1, nextThreshold - prevThreshold);
  const progressPct = Math.min(100, Math.round(((total - prevThreshold) / range) * 100));
  return {
    level,
    totalEvents: total,
    prevThreshold,
    nextThreshold,
    eventsToNext: Math.max(0, nextThreshold - total),
    progressPct,
  };
}

export const TIER_META: Record<BadgeTier, { label: string; color: string; bgClass: string; borderClass: string; textClass: string }> = {
  bronze:   { label: 'Bronze',   color: '#cd7f32', bgClass: 'bg-orange-950/30', borderClass: 'border-orange-700/50', textClass: 'text-orange-400' },
  silver:   { label: 'Argent',   color: '#c0c0c0', bgClass: 'bg-slate-800/40',  borderClass: 'border-slate-500/50',  textClass: 'text-slate-300' },
  gold:     { label: 'Or',       color: '#f5c518', bgClass: 'bg-yellow-900/25', borderClass: 'border-yellow-500/50', textClass: 'text-yellow-400' },
  platinum: { label: 'Platine',  color: '#7dd3fc', bgClass: 'bg-cyan-950/40',   borderClass: 'border-cyan-400/50',   textClass: 'text-cyan-300' },
};

export function computeBadges(db: DB): Badge[] {
  const items = Object.values(db.items);
  const events = db.watchEvents;

  const genreSet = new Set<string>();
  for (const it of items) for (const g of it.genres) genreSet.add(g);

  const perDay = new Map<string, number>();
  for (const e of events) {
    const key = e.watchedAt.slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const maxInDay = perDay.size ? Math.max(...perDay.values()) : 0;

  // Max sur 7 jours glissants
  const dailyEntries = Array.from(perDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let maxIn7Days = 0;
  for (let i = 0; i < dailyEntries.length; i++) {
    const startDate = new Date(dailyEntries[i][0]);
    let sum = 0;
    for (let j = i; j < dailyEntries.length; j++) {
      const d = new Date(dailyEntries[j][0]);
      const diffDays = (d.getTime() - startDate.getTime()) / 86_400_000;
      if (diffDays > 6) break;
      sum += dailyEntries[j][1];
    }
    if (sum > maxIn7Days) maxIn7Days = sum;
  }

  const completedTv = items.filter((i) => i.status === 'completed' && i.mediaType === 'tv').length;
  const seenMovies = items.filter((i) => i.mediaType === 'movie' && i.status === 'completed').length;
  const droppedCount = items.filter((i) => i.status === 'dropped').length;
  const libraryCount = items.length;
  const ratedCount = items.filter((i) => i.rating != null).length;
  const totalEpisodes = events.filter((e) => e.kind === 'episode').length;
  const totalMinutes = events.reduce((s, e) => s + (e.runtime ?? 0), 0);
  const totalHours = totalMinutes / 60;

  const b = (
    id: string, label: string, description: string, emoji: string,
    tier: BadgeTier, unlocked: boolean, current?: number, target?: number
  ): Badge => ({
    id, label, description, emoji, tier, unlocked,
    progress: target != null ? { current: Math.min(current ?? 0, target), target } : undefined,
  });

  return [
    // ---- BRONZE — mise en jambe ----
    b('first-tap',    'Premier pas',       'Ton tout premier épisode coché.',       '👋', 'bronze', events.length >= 1),
    b('first-movie',  'Ta 1re toile',      'Marque ton premier film comme vu.',      '🍿', 'bronze', seenMovies >= 1),
    b('first-rating', 'Ton premier avis',  'Note un titre.',                         '⭐', 'bronze', ratedCount >= 1),
    b('first-finish', 'Générique final',   'Termine ta première série.',             '🏁', 'bronze', completedTv >= 1),
    b('ten-episodes', 'La machine démarre','10 épisodes vus au total.',              '📺', 'bronze', totalEpisodes >= 10, totalEpisodes, 10),

    // ---- ARGENT — habitude ----
    b('marathon-10',  'Marathonien',       '10 épisodes dans la même journée.',       '🏃', 'silver', maxInDay >= 10, maxInDay, 10),
    b('explorer-5',   'Explorateur',       '5 genres différents dans ta biblio.',     '🧭', 'silver', genreSet.size >= 5, genreSet.size, 5),
    b('cinephile-10', 'Cinéphile',         '10 films vus.',                           '🎞️', 'silver', seenMovies >= 10, seenMovies, 10),
    b('collector-25', 'Collectionneur',    '25 titres dans ta biblio.',               '📚', 'silver', libraryCount >= 25, libraryCount, 25),
    b('assumed',      'Assumé',            "Abandonner c'est aussi choisir. Ton temps est précieux.", '🕊️', 'silver', droppedCount >= 1),

    // ---- OR — vraiment engagé ----
    b('binge-25',      'Binge master',      '25 épisodes dans la même journée.',      '🔥', 'gold', maxInDay >= 25, maxInDay, 25),
    b('week-30',       'Semaine intense',   '30 épisodes en 7 jours glissants.',      '⚡', 'gold', maxIn7Days >= 30, maxIn7Days, 30),
    b('explorer-8',    'Multi-culturel',    '8 genres différents.',                    '🌍', 'gold', genreSet.size >= 8, genreSet.size, 8),
    b('cinephage-50',  'Cinéphage',         '50 films vus.',                           '🎥', 'gold', seenMovies >= 50, seenMovies, 50),
    b('serivore-10',   'Sérivore',          '10 séries terminées.',                    '🎭', 'gold', completedTv >= 10, completedTv, 10),
    b('critic-25',     'Critique averti',   '25 titres notés.',                        '🖊️', 'gold', ratedCount >= 25, ratedCount, 25),

    // ---- PLATINE — hall of fame ----
    b('insomniac-50',  'Insomniaque',       '50 épisodes en 24h. Dors un peu.',       '🧟', 'platinum', maxInDay >= 50, maxInDay, 50),
    b('encyclopedia',  'Encyclopédie',      '12 genres explorés — quasi tous les grands.', '🌐', 'platinum', genreSet.size >= 12, genreSet.size, 12),
    b('historian-250', 'Historien',         '250 films vus.',                          '🎞️', 'platinum', seenMovies >= 250, seenMovies, 250),
    b('completionist', 'Complétionniste',   '25 séries terminées.',                    '🏆', 'platinum', completedTv >= 25, completedTv, 25),
    b('epoch-500h',    'Une vie devant',    '500 heures cumulées de visionnage.',      '⏳', 'platinum', totalHours >= 500, Math.round(totalHours), 500),
  ];
}
