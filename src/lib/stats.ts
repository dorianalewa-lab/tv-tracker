import type { DB, LibraryItem } from '../types';

export type Period = 'year' | '30d' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  year: String(new Date().getFullYear()),
  '30d': '30 derniers jours',
  all: 'Depuis le début',
};

export type GenreStat = { name: string; hours: number; count: number };
export type MonthlyBucket = { month: string; label: string; count: number };

export type Stats = {
  totalEpisodes: number;
  totalMovies: number;
  totalHours: number;                 // arrondi 0.1
  genres: GenreStat[];                // trié desc par heures
  mostBinged: { item: LibraryItem; count: number } | null;
  monthly: MonthlyBucket[];           // 12 derniers mois, du + ancien au + récent
  bestMonth: MonthlyBucket | null;
  completedShows: number;
  droppedItems: number;
  watchingShows: number;
  plannedItems: number;
  distinctGenres: number;
  libraryCount: number;
};

function inPeriod(iso: string, period: Period, now: Date): boolean {
  if (period === 'all') return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (period === '30d') return now.getTime() - d.getTime() <= 30 * 86_400_000;
  return true;
}

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export function computeStats(db: DB, period: Period, now = new Date()): Stats {
  const events = db.watchEvents.filter((e) => inPeriod(e.watchedAt, period, now));
  const items = db.items;

  const totalEpisodes = events.filter((e) => e.kind === 'episode').length;
  const totalMovies = events.filter((e) => e.kind === 'movie').length;
  const totalMinutes = events.reduce((sum, e) => sum + (e.runtime ?? 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  // Genres agrégés par heures + count
  const genreMap = new Map<string, { minutes: number; count: number }>();
  for (const ev of events) {
    const item = items[ev.itemId];
    if (!item) continue;
    const min = ev.runtime ?? 0;
    for (const g of item.genres) {
      const cur = genreMap.get(g) ?? { minutes: 0, count: 0 };
      cur.minutes += min;
      cur.count += 1;
      genreMap.set(g, cur);
    }
  }
  const genres: GenreStat[] = Array.from(genreMap.entries())
    .map(([name, v]) => ({ name, hours: Math.round((v.minutes / 60) * 10) / 10, count: v.count }))
    .sort((a, b) => b.hours - a.hours || b.count - a.count);

  // Série la + regardée sur la période
  const perItem = new Map<string, number>();
  for (const ev of events) {
    perItem.set(ev.itemId, (perItem.get(ev.itemId) ?? 0) + 1);
  }
  let mostBinged: Stats['mostBinged'] = null;
  for (const [id, count] of perItem) {
    const it = items[id];
    if (!it) continue;
    if (!mostBinged || count > mostBinged.count) mostBinged = { item: it, count };
  }

  // 12 derniers mois (aligné sur le mois courant)
  const monthlyMap = new Map<string, number>();
  for (const ev of events) {
    const d = new Date(ev.watchedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  }
  const monthly: MonthlyBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly.push({
      month: key,
      label: MONTHS_FR[d.getMonth()],
      count: monthlyMap.get(key) ?? 0,
    });
  }
  const bestMonth = monthly.reduce<MonthlyBucket | null>(
    (best, b) => (best === null || b.count > best.count ? b : best),
    null
  );

  const allItems = Object.values(items);
  const completedShows = allItems.filter((i) => i.status === 'completed' && i.mediaType === 'tv').length;
  const droppedItems = allItems.filter((i) => i.status === 'dropped').length;
  const watchingShows = allItems.filter((i) => i.status === 'watching').length;
  const plannedItems = allItems.filter((i) => i.status === 'planned').length;

  return {
    totalEpisodes,
    totalMovies,
    totalHours,
    genres,
    mostBinged,
    monthly,
    bestMonth: bestMonth && bestMonth.count > 0 ? bestMonth : null,
    completedShows,
    droppedItems,
    watchingShows,
    plannedItems,
    distinctGenres: genres.length,
    libraryCount: allItems.length,
  };
}

export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 10) return `${h.toFixed(1)} h`;
  return `${Math.round(h)} h`;
}
