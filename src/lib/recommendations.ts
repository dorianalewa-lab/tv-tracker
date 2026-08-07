import type { DB, LibraryItem } from '../types';

export type GenreScore = { name: string; score: number };

export type UserProfile = {
  topGenres: GenreScore[];       // trié desc, score > 0
  seeds: LibraryItem[];          // titres notés 4-5 ou terminés bingés — servent d'ancres pour les explications
  hasEnoughData: boolean;
  itemCount: number;
};

// Pondérations par statut : les terminés valent plus que les "à voir".
const STATUS_WEIGHT: Record<LibraryItem['status'], number> = {
  completed: 3,
  watching: 1.5,
  planned: 0.5,
  dropped: -2,
};

/**
 * Construit un profil de goûts à partir de la biblio.
 * Chaque item contribue à chacun de ses genres, pondéré par statut + note.
 */
export function computeProfile(db: DB): UserProfile {
  const items = Object.values(db.items);
  const genreScore = new Map<string, number>();

  for (const it of items) {
    const statusW = STATUS_WEIGHT[it.status];
    // Bonus note : +0 si non noté, jusqu'à +2 pour 5 étoiles
    const ratingBonus = it.rating ? (it.rating - 3) * 0.5 : 0;
    const w = statusW + ratingBonus;
    for (const g of it.genres) {
      genreScore.set(g, (genreScore.get(g) ?? 0) + w);
    }
  }

  const topGenres: GenreScore[] = Array.from(genreScore.entries())
    .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);

  // Seeds : titres "aimés" pour ancrer les explications sur des cas concrets
  const seeds = items
    .filter((it) => (it.rating != null && it.rating >= 4) || it.status === 'completed')
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return {
    topGenres,
    seeds,
    itemCount: items.length,
    hasEnoughData: items.length >= 3 && topGenres.length > 0,
  };
}

/**
 * Choisit une explication en langage naturel pour proposer `candidateGenres`,
 * en s'appuyant sur le profil. Varie les tournures pour éviter la répétition.
 */
export function reasonFor(
  candidateGenres: string[],
  profile: UserProfile,
  seedIndex = 0
): string {
  const matches = profile.topGenres.filter((g) => candidateGenres.includes(g.name));

  // Cherche un seed qui partage au moins un genre avec le candidat
  const seed = profile.seeds.find((s) =>
    s.genres.some((g) => candidateGenres.includes(g))
  );

  const primaryMatch = matches[0]?.name;
  const secondaryMatch = matches[1]?.name;

  // Rotation d'idées différentes suivant seedIndex pour varier la présentation
  const bucket = seedIndex % 4;

  if (seed && primaryMatch) {
    if (seed.rating && seed.rating >= 4) {
      return `Comme ${seed.title} que tu as noté ${'★'.repeat(seed.rating)}, c'est du ${primaryMatch}.`;
    }
    if (bucket === 0) return `Tu as aimé ${seed.title} — même univers ${primaryMatch}.`;
    if (bucket === 1) return `Dans la lignée de ${seed.title} (${primaryMatch}).`;
  }

  if (primaryMatch && secondaryMatch) {
    return `Tu regardes beaucoup de ${primaryMatch} et de ${secondaryMatch}.`;
  }
  if (primaryMatch) {
    if (bucket === 2) return `Ton genre du moment : ${primaryMatch}.`;
    return `Beaucoup de ${primaryMatch} dans ta biblio — celui-ci devrait te parler.`;
  }
  return 'Populaire en ce moment, à découvrir.';
}
