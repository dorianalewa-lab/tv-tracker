export type MediaType = 'tv' | 'movie';
export type Status = 'planned' | 'watching' | 'completed' | 'dropped';
export type Reaction = 'like' | 'dislike';

export type LibraryItem = {
  id: string;                    // "tv:12345" | "movie:678"
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  year: number | null;
  genres: string[];
  runtime: number | null;
  totalEpisodes: number | null;  // TV : total d'épisodes (hors specials) — sert au calcul auto de statut
  status: Status;                // auto-dérivé — ne pas éditer directement
  rating: number | null;         // 1-10 (échelle IMDB)
  reaction: Reaction | null;     // conservé pour compat, non affiché
  saved: boolean;                // "enregistré" (bookmark indépendant)
  voteAverage: number | null;    // note TMDB pour affichage sur les cartes
  addedAt: string;
  updatedAt: string;
  seenEpisodes?: Record<string, true>;
};

export type WatchEvent = {
  id: string;
  itemId: string;
  kind: 'episode' | 'movie';
  episodeKey?: string;
  watchedAt: string;
  runtime: number | null;
};

export type Profile = {
  displayName: string;
  emoji?: string;
  avatarUrl?: string | null;    // URL TMDB (poster de film choisi)
  bannerUrl?: string | null;    // URL TMDB (backdrop de film choisi)
  region: string;
  providers: number[];
};

export type DB = {
  version: number;
  items: Record<string, LibraryItem>;
  watchEvents: WatchEvent[];
  profile: Profile;
  meta: {
    level: number;
    unlockedBadges: string[];
  };
};

// -------- TMDB API types (partiels) --------

export type TmdbSearchResult = {
  id: number;
  media_type: 'tv' | 'movie' | 'person';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  overview?: string;
  genre_ids?: number[];
  vote_average?: number;
};

export type TmdbGenre = { id: number; name: string };
