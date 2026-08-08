import type { RegionProvider } from '../api/tmdb';

/**
 * Whitelist des plateformes affichées dans l'app.
 * TMDB en propose des dizaines par région, mais 95% des users ne s'abonnent
 * qu'aux 4 majeures. On simplifie l'UI.
 *
 * IDs stables TMDB :
 *  - Netflix       : 8
 *  - Amazon Prime  : 9  (Prime Video), 119 (Amazon Video Rental) — on garde 9
 *  - Disney+       : 337
 *  - Apple TV+     : 350
 */
export const ALLOWED_PROVIDER_IDS = new Set<number>([8, 9, 337, 350]);

export function filterAllowedProviders(list: RegionProvider[]): RegionProvider[] {
  return list.filter((p) => ALLOWED_PROVIDER_IDS.has(p.provider_id));
}
