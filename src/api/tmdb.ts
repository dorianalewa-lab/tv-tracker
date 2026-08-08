import type { TmdbGenre, TmdbSearchResult } from '../types';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string;
const BASE = 'https://api.themoviedb.org/3';

export const IMG_BASE = 'https://image.tmdb.org/t/p';

if (!API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_TMDB_API_KEY manquante — recharge après avoir configuré .env.local');
}

function url(path: string, params: Record<string, string | number> = {}) {
  const u = new URL(BASE + path);
  u.searchParams.set('api_key', API_KEY);
  u.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

export function posterUrl(path: string | null, size: 'w154' | 'w342' | 'w500' = 'w342') {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null, size: 'w780' | 'w1280' = 'w780') {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

export type TmdbPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity: number;
  known_for?: { id: number; media_type: 'tv' | 'movie'; title?: string; name?: string; poster_path: string | null }[];
};

export type MultiSearchItem =
  | (TmdbSearchResult & { kind: 'title' })
  | (TmdbPerson & { kind: 'person'; media_type: 'person' });

/** /search/multi : garde titres ET personnes, discriminés par `kind`. */
export async function searchMulti(query: string): Promise<MultiSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(url('/search/multi', { query: q, include_adult: 'false', page: 1 }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return (data.results as (TmdbSearchResult | TmdbPerson & { media_type?: 'person' })[])
    .map((r): MultiSearchItem | null => {
      const mt = (r as { media_type?: string }).media_type;
      if (mt === 'tv' || mt === 'movie') {
        return { ...(r as TmdbSearchResult), kind: 'title' };
      }
      if (mt === 'person') {
        return { ...(r as TmdbPerson), kind: 'person', media_type: 'person' };
      }
      return null;
    })
    .filter((r): r is MultiSearchItem => r !== null);
}

export async function searchTitles(
  query: string,
  type: 'tv' | 'movie'
): Promise<TmdbSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(url(`/search/${type}`, { query: q, include_adult: 'false', page: 1 }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  // /search/tv et /search/movie ne posent pas media_type — on l'ajoute pour rester uniforme.
  return (data.results as TmdbSearchResult[]).map((r) => ({ ...r, media_type: type }));
}

export async function searchPersons(query: string): Promise<TmdbPerson[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(url('/search/person', { query: q, include_adult: 'false', page: 1 }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return data.results as TmdbPerson[];
}

export function profileUrl(path: string | null, size: 'w45' | 'w185' | 'h632' = 'w185') {
  if (!path) return null;
  return `${IMG_BASE}/${size}${path}`;
}

export type PersonDetails = TmdbPerson & { biography: string; birthday: string | null };

export async function getPersonDetails(id: number): Promise<PersonDetails> {
  const res = await fetch(url(`/person/${id}`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export type PersonCredit = {
  id: number;
  media_type: 'tv' | 'movie';
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  popularity: number;
  vote_count: number;
};

export async function getPersonCombinedCredits(id: number): Promise<{ cast: PersonCredit[] }> {
  const res = await fetch(url(`/person/${id}/combined_credits`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// -------- Où regarder (JustWatch via TMDB) --------

export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
};

export type ProvidersByRegion = {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  ads?: WatchProvider[];
  free?: WatchProvider[];
};

export type WatchProvidersResponse = {
  id: number;
  results: Record<string, ProvidersByRegion>;
};

/** Résout la meilleure région dispo : CH d'abord, sinon FR, sinon la 1re disponible. */
export function pickRegion(resp: WatchProvidersResponse, preferred: string[] = ['CH', 'FR']): { region: string; data: ProvidersByRegion } | null {
  for (const r of preferred) if (resp.results[r]) return { region: r, data: resp.results[r] };
  const first = Object.entries(resp.results)[0];
  return first ? { region: first[0], data: first[1] } : null;
}

export async function getWatchProviders(
  mediaType: 'tv' | 'movie',
  id: number
): Promise<WatchProvidersResponse> {
  const u = new URL(`${BASE}/${mediaType}/${id}/watch/providers`);
  u.searchParams.set('api_key', API_KEY);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// -------- Cast (distribution) --------

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
};

export async function getCredits(
  mediaType: 'tv' | 'movie',
  id: number
): Promise<{ cast: CastMember[] }> {
  const res = await fetch(url(`/${mediaType}/${id}/credits`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// -------- Vidéos (trailers) --------

export type TmdbVideo = {
  id: string;
  key: string;                   // YouTube video id
  site: string;                  // "YouTube"
  type: string;                  // "Trailer", "Teaser", "Clip"...
  official: boolean;
  iso_639_1: string;             // langue
  published_at: string;
};

/** Retourne la meilleure vidéo trailer YouTube : FR d'abord, sinon EN, sinon la 1re dispo. */
export async function getBestTrailer(
  mediaType: 'tv' | 'movie',
  id: number
): Promise<TmdbVideo | null> {
  // On tente FR (via ?language) puis EN comme fallback.
  const fetchLang = async (lang: string) => {
    const res = await fetch(
      `${BASE}/${mediaType}/${id}/videos?api_key=${API_KEY}&language=${lang}`
    );
    if (!res.ok) return [] as TmdbVideo[];
    const data = await res.json();
    return (data.results ?? []) as TmdbVideo[];
  };
  const [frVideos, enVideos] = await Promise.all([fetchLang('fr-FR'), fetchLang('en-US')]);
  const all = [...frVideos, ...enVideos];
  const yt = all.filter((v) => v.site === 'YouTube');
  const preferred =
    yt.find((v) => v.type === 'Trailer' && v.official) ??
    yt.find((v) => v.type === 'Trailer') ??
    yt.find((v) => v.type === 'Teaser') ??
    yt[0] ??
    null;
  return preferred ?? null;
}

// -------- Trending / Now Playing / Airing --------

export async function getTrending(
  mediaType: 'all' | 'tv' | 'movie' = 'all',
  window: 'day' | 'week' = 'week',
  page = 1
): Promise<TmdbSearchResult[]> {
  const res = await fetch(url(`/trending/${mediaType}/${window}`, { page }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  // Sur /trending/tv|movie, TMDB n'inclut pas media_type (implicite par l'URL) — on le rajoute.
  if (mediaType !== 'all') {
    return (data.results as TmdbSearchResult[]).map((r) => ({ ...r, media_type: mediaType }));
  }
  return (data.results as TmdbSearchResult[]).filter(
    (r) => r.media_type === 'tv' || r.media_type === 'movie'
  );
}

export async function getUpcomingMovies(page = 1): Promise<TmdbSearchResult[]> {
  const res = await fetch(url('/movie/upcoming', { region: 'CH', page }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return (data.results as TmdbSearchResult[]).map((r) => ({ ...r, media_type: 'movie' }));
}

export async function getOnAirTv(page = 1): Promise<TmdbSearchResult[]> {
  const res = await fetch(url('/tv/on_the_air', { page }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return (data.results as TmdbSearchResult[]).map((r) => ({ ...r, media_type: 'tv' }));
}

export async function getPopular(mediaType: 'tv' | 'movie', page = 1): Promise<TmdbSearchResult[]> {
  const res = await fetch(url(`/${mediaType}/popular`, { page }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return (data.results as TmdbSearchResult[]).map((r) => ({ ...r, media_type: mediaType }));
}

export async function getTopRated(mediaType: 'tv' | 'movie', page = 1): Promise<TmdbSearchResult[]> {
  const res = await fetch(url(`/${mediaType}/top_rated`, { page }));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return (data.results as TmdbSearchResult[]).map((r) => ({ ...r, media_type: mediaType }));
}

/** Découvre les titres par genre (nom FR). Utilise le genre map en cache. */
export async function discoverByGenreName(
  mediaType: 'tv' | 'movie',
  genreName: string,
  page = 1
): Promise<TmdbSearchResult[]> {
  const map = await getGenreMap(mediaType);
  const id = map.get(genreName);
  if (!id) return [];
  const rows = await discoverWithParams(mediaType, {
    with_genres: String(id),
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
    page,
  });
  return rows.map((r) => ({
    ...r,
    media_type: mediaType,
    title: mediaType === 'movie' ? r.title : r.name,
    name: r.name,
    release_date: r.release_date,
    first_air_date: r.first_air_date,
  })) as TmdbSearchResult[];
}

// -------- Providers par région (pour choix profil) --------

export type RegionProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
};

/** Liste des plateformes dispos dans la région, dédupliquées TV+Movie et triées par priorité. */
export async function getProvidersForRegion(region: string): Promise<RegionProvider[]> {
  const fetchOne = async (kind: 'movie' | 'tv') => {
    const res = await fetch(url(`/watch/providers/${kind}`, { watch_region: region }));
    if (!res.ok) return [] as RegionProvider[];
    const data = await res.json();
    return (data.results as RegionProvider[]) ?? [];
  };
  const [m, t] = await Promise.all([fetchOne('movie'), fetchOne('tv')]);
  const map = new Map<number, RegionProvider>();
  for (const p of [...m, ...t]) {
    if (!map.has(p.provider_id)) map.set(p.provider_id, p);
  }
  return Array.from(map.values()).sort((a, b) => a.display_priority - b.display_priority);
}

export type TmdbSeasonSummary = {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string | null;
};

export type TmdbEpisode = {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  runtime: number | null;
  overview: string;
  still_path: string | null;
};

export type MovieDetails = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  overview: string;
  genres: TmdbGenre[];
};

export type TvDetails = {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  episode_run_time: number[];
  genres: TmdbGenre[];
  number_of_seasons: number;
  overview: string;
  seasons: TmdbSeasonSummary[];
};

export async function getMovieDetails(id: number): Promise<MovieDetails> {
  const res = await fetch(url(`/movie/${id}`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export async function getTvDetails(id: number): Promise<TvDetails> {
  const res = await fetch(url(`/tv/${id}`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

export async function getTvSeason(id: number, seasonNumber: number): Promise<{ episodes: TmdbEpisode[] }> {
  const res = await fetch(url(`/tv/${id}/season/${seasonNumber}`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// -------- Reco : discover + genre map --------

const genreCache: Partial<Record<'tv' | 'movie', Map<string, number>>> = {};

/** Récupère (et cache) la table nom→id de genres TMDB en français. */
export async function getGenreMap(type: 'tv' | 'movie'): Promise<Map<string, number>> {
  const hit = genreCache[type];
  if (hit) return hit;
  const res = await fetch(url(`/genre/${type}/list`));
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json() as { genres: TmdbGenre[] };
  const map = new Map<string, number>();
  for (const g of data.genres) map.set(g.name, g.id);
  genreCache[type] = map;
  return map;
}

export type DiscoverResult = {
  id: number;
  poster_path: string | null;
  title?: string;      // movie
  name?: string;       // tv
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
  genre_ids: number[];
};

export async function discover(
  type: 'tv' | 'movie',
  genreIds: number[]
): Promise<DiscoverResult[]> {
  if (genreIds.length === 0) return [];
  const res = await fetch(
    url(`/discover/${type}`, {
      with_genres: genreIds.join(','),
      sort_by: 'popularity.desc',
      'vote_count.gte': 100,   // écarte les niches sans notes fiables
      include_adult: 'false',
      page: 1,
    })
  );
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return data.results as DiscoverResult[];
}

/** Version paramétrée de discover — utilisée par le chatbot pour affiner. */
export async function discoverWithParams(
  type: 'tv' | 'movie',
  params: Record<string, string | number>
): Promise<DiscoverResult[]> {
  const res = await fetch(
    url(`/discover/${type}`, {
      include_adult: 'false',
      page: 1,
      ...params,
    })
  );
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = await res.json();
  return data.results as DiscoverResult[];
}
