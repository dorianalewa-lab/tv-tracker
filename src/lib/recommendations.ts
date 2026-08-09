import type { DB, LibraryItem } from '../types';

export type GenreScore = { name: string; score: number };

export type UserProfile = {
  topGenres: GenreScore[];       // trié desc, score > 0
  seeds: LibraryItem[];          // titres notés 4-5 ou terminés bingés — servent d'ancres pour les explications
  hasEnoughData: boolean;
  itemCount: number;
};

/**
 * Construit un profil de goûts à partir de la biblio.
 * Se base UNIQUEMENT sur les titres terminés — un "à voir" ne dit rien sur ce
 * qu'on aime, seul un titre qu'on a vraiment fini parle de nos goûts.
 * Les notes 8-10/10 boostent encore le poids de leur genre.
 */
export function computeProfile(db: DB): UserProfile {
  const allItems = Object.values(db.items);
  const items = allItems.filter((it) => it.status === 'completed');
  const genreScore = new Map<string, number>();

  for (const it of items) {
    // Poids de base 3 pour un terminé, + bonus si noté haut (8-10/10 → +1 à +2.5)
    const ratingBonus = it.rating ? Math.max(0, (it.rating - 6) * 0.5) : 0;
    const w = 3 + ratingBonus;
    for (const g of it.genres) {
      genreScore.set(g, (genreScore.get(g) ?? 0) + w);
    }
  }

  const topGenres: GenreScore[] = Array.from(genreScore.entries())
    .map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score);

  // Seeds : tous les titres terminés servent d'ancres pour les explications
  // (ordre : les mieux notés d'abord, puis les autres — variété assurée par reasonFor)
  const seeds = items
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
 * en s'appuyant sur le profil. Varie les tournures ET les seeds pour éviter
 * l'effet "toujours la même phrase avec le même titre".
 */
export function reasonFor(
  candidateGenres: string[],
  profile: UserProfile,
  seedIndex = 0
): string {
  const matches = profile.topGenres.filter((g) => candidateGenres.includes(g.name));
  const primary = matches[0]?.name;
  const secondary = matches[1]?.name;

  // Tous les seeds qui partagent au moins un genre : on tourne dessus
  const matchingSeeds = profile.seeds.filter((s) => s.genres.some((g) => candidateGenres.includes(g)));
  const seed = matchingSeeds.length > 0
    ? matchingSeeds[seedIndex % matchingSeeds.length]
    : null;

  // Génère toutes les tournures possibles, on n'en garde qu'une (variée)
  const candidates: string[] = [];

  if (seed && primary) {
    if (seed.rating && seed.rating >= 8) {
      candidates.push(`Comme ${seed.title} que tu as noté ${seed.rating}/10, c'est du ${primary}.`);
      candidates.push(`Tu as adoré ${seed.title} ? Celui-ci est dans la même veine ${primary}.`);
    }
    if (seed.rating && seed.rating >= 6) {
      candidates.push(`Dans le style de ${seed.title} — ${primary}.`);
    }
    candidates.push(`Si t'as aimé ${seed.title}, celui-ci est du même bord.`);
    candidates.push(`Fan de ${seed.title} ? ${primary} c'est ton créneau.`);
  }

  if (primary && secondary) {
    candidates.push(`Tu regardes pas mal de ${primary} et de ${secondary}.`);
    candidates.push(`${primary} + ${secondary} : ton mélange préféré.`);
    candidates.push(`Mix de ${primary} et ${secondary}, comme ta biblio.`);
  }

  if (primary) {
    candidates.push(`Ton genre du moment : ${primary}.`);
    candidates.push(`Beaucoup de ${primary} chez toi, celui-ci devrait plaire.`);
    candidates.push(`Encore du ${primary}, mais un que tu n'as pas.`);
    candidates.push(`Solide dans le registre ${primary}.`);
    candidates.push(`Bien noté chez les fans de ${primary}.`);
  }

  candidates.push('Populaire en ce moment, à découvrir.');
  candidates.push('Tendance chez les critiques.');
  candidates.push('Choisi pour toi, sans raison précise — juste bon.');

  return candidates[seedIndex % candidates.length] ?? candidates[0];
}
