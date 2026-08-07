import type { DB } from '../types';

export type Badge = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
};

export type LevelInfo = {
  level: number;
  totalEvents: number;
  prevThreshold: number;
  nextThreshold: number;
  eventsToNext: number;
  progressPct: number;      // 0..100 dans le palier courant
};

// Paliers volontairement doux au début pour donner rapidement le sentiment de progresser.
const LEVEL_THRESHOLDS = [0, 5, 15, 30, 60, 120, 250, 500, 1000, 2000];

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

export function computeBadges(db: DB): Badge[] {
  const items = Object.values(db.items);
  const events = db.watchEvents;

  // Genres distincts couverts par la biblio
  const genreSet = new Set<string>();
  for (const it of items) for (const g of it.genres) genreSet.add(g);

  // Meilleur cumul d'événements sur une même journée
  const perDay = new Map<string, number>();
  for (const e of events) {
    const key = e.watchedAt.slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const maxInDay = perDay.size ? Math.max(...perDay.values()) : 0;

  const completedTv = items.filter((i) => i.status === 'completed' && i.mediaType === 'tv').length;
  const seenMovies = items.filter((i) => i.mediaType === 'movie' && i.status === 'completed').length;
  const droppedCount = items.filter((i) => i.status === 'dropped').length;
  const libraryCount = items.length;
  const ratedCount = items.filter((i) => i.rating != null).length;

  return [
    {
      id: 'first-tap',
      label: 'Ça commence !',
      description: 'Ton tout premier épisode coché.',
      emoji: '👋',
      unlocked: events.length >= 1,
    },
    {
      id: 'marathon',
      label: 'Marathonien',
      description: '10 épisodes dans la même journée.',
      emoji: '🏃',
      unlocked: maxInDay >= 10,
      progress: { current: Math.min(maxInDay, 10), target: 10 },
    },
    {
      id: 'explorer',
      label: 'Explorateur',
      description: '5 genres différents dans ta biblio.',
      emoji: '🧭',
      unlocked: genreSet.size >= 5,
      progress: { current: Math.min(genreSet.size, 5), target: 5 },
    },
    {
      id: 'finisher',
      label: 'Générique de fin',
      description: 'Ta première série terminée.',
      emoji: '🎬',
      unlocked: completedTv >= 1,
    },
    {
      id: 'serial-binger',
      label: 'Sérivore',
      description: '3 séries terminées.',
      emoji: '📺',
      unlocked: completedTv >= 3,
      progress: { current: Math.min(completedTv, 3), target: 3 },
    },
    {
      id: 'cinephile',
      label: 'Cinéphile',
      description: '10 films vus.',
      emoji: '🎞️',
      unlocked: seenMovies >= 10,
      progress: { current: Math.min(seenMovies, 10), target: 10 },
    },
    {
      id: 'assumed',
      label: 'Assumé',
      description: 'Abandonner c\'est aussi choisir. Ton temps est précieux.',
      emoji: '🕊️',
      unlocked: droppedCount >= 1,
    },
    {
      id: 'critic',
      label: 'Critique',
      description: '10 titres notés.',
      emoji: '⭐',
      unlocked: ratedCount >= 10,
      progress: { current: Math.min(ratedCount, 10), target: 10 },
    },
    {
      id: 'collector',
      label: 'Collectionneur',
      description: '25 titres dans ta bibliothèque.',
      emoji: '📚',
      unlocked: libraryCount >= 25,
      progress: { current: Math.min(libraryCount, 25), target: 25 },
    },
  ];
}
