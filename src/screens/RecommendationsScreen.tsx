import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Loader2, RefreshCw } from 'lucide-react';
import { useDB } from '../hooks/useLibrary';
import { computeProfile, reasonFor, type UserProfile } from '../lib/recommendations';
import { discover, getGenreMap, posterUrl, type DiscoverResult } from '../api/tmdb';
import type { MediaType } from '../types';

type Suggestion = {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: number | null;
  genreNames: string[];
  reason: string;
};

export function RecommendationsScreen() {
  const db = useDB();
  const profile = useMemo(() => computeProfile(db), [db]);

  const [tvSuggestions, setTvSuggestions] = useState<Suggestion[]>([]);
  const [movieSuggestions, setMovieSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const ownedIds = useMemo(() => {
    const s = new Set<string>();
    for (const it of Object.values(db.items)) s.add(`${it.mediaType}:${it.tmdbId}`);
    return s;
  }, [db.items]);

  useEffect(() => {
    if (!profile.hasEnoughData) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [tvGenreMap, movieGenreMap] = await Promise.all([
          getGenreMap('tv'),
          getGenreMap('movie'),
        ]);
        const topNames = profile.topGenres.slice(0, 3).map((g) => g.name);

        const tvIds = topNames
          .map((n) => tvGenreMap.get(n))
          .filter((id): id is number => typeof id === 'number');
        const movieIds = topNames
          .map((n) => movieGenreMap.get(n))
          .filter((id): id is number => typeof id === 'number');

        const [tvRaw, movieRaw] = await Promise.all([
          tvIds.length ? discover('tv', tvIds) : Promise.resolve([]),
          movieIds.length ? discover('movie', movieIds) : Promise.resolve([]),
        ]);

        if (cancelled) return;
        setTvSuggestions(pickAndAnnotate(tvRaw, 'tv', tvGenreMap, ownedIds, profile, refreshKey));
        setMovieSuggestions(pickAndAnnotate(movieRaw, 'movie', movieGenreMap, ownedIds, profile, refreshKey));
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile, ownedIds, refreshKey]);

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pour toi</h1>
            <p className="text-xs text-muted mt-0.5">
              Basé sur tes {profile.itemCount} titre{profile.itemCount > 1 ? 's' : ''} en biblio
            </p>
          </div>
          {profile.hasEnoughData && (
            <button
              onClick={() => setRefreshKey((n) => n + 1)}
              className="p-2 rounded-full border border-border text-muted"
              aria-label="Rafraîchir"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {!profile.hasEnoughData ? (
          <EmptyState itemCount={profile.itemCount} />
        ) : (
          <>
            <TopGenreBar profile={profile} />

            {error && (
              <div className="text-red-400 text-sm py-4 text-center">{error}</div>
            )}

            {loading && tvSuggestions.length === 0 && movieSuggestions.length === 0 && (
              <div className="flex items-center gap-2 text-muted text-sm py-8 justify-center">
                <Loader2 size={16} className="animate-spin" /> Recherche de suggestions…
              </div>
            )}

            <Section title="Séries que tu pourrais aimer" items={tvSuggestions} mediaType="tv" />
            <Section title="Films dans ta vibe" items={movieSuggestions} mediaType="movie" />
          </>
        )}
      </div>
    </div>
  );
}

function pickAndAnnotate(
  raw: DiscoverResult[],
  mediaType: MediaType,
  genreMap: Map<string, number>,
  ownedIds: Set<string>,
  profile: UserProfile,
  refreshKey: number
): Suggestion[] {
  // Inversion nom↔id pour retrouver les noms depuis genre_ids
  const idToName = new Map<number, string>();
  for (const [name, id] of genreMap) idToName.set(id, name);

  const filtered = raw.filter((r) => !ownedIds.has(`${mediaType}:${r.id}`));
  // Rotation légère (refreshKey décale le point de départ) pour varier les résultats.
  const offset = (refreshKey * 3) % Math.max(1, filtered.length);
  const rotated = [...filtered.slice(offset), ...filtered.slice(0, offset)];
  const picks = rotated.slice(0, 8);

  return picks.map((r, i) => {
    const names = r.genre_ids.map((id) => idToName.get(id)).filter((n): n is string => !!n);
    const title = (mediaType === 'tv' ? r.name : r.title) ?? '(sans titre)';
    const dateStr = mediaType === 'tv' ? r.first_air_date : r.release_date;
    const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
    return {
      mediaType,
      tmdbId: r.id,
      title,
      posterPath: r.poster_path,
      year: Number.isFinite(year) ? year : null,
      genreNames: names,
      reason: reasonFor(names, profile, i),
    };
  });
}

function Section({
  title,
  items,
  mediaType,
}: {
  title: string;
  items: Suggestion[];
  mediaType: MediaType;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((s) => (
          <Link
            key={`${s.mediaType}:${s.tmdbId}`}
            to={mediaType === 'tv' ? `/show/${s.tmdbId}` : `/movie/${s.tmdbId}`}
            className="flex gap-3 p-2 rounded-xl bg-surface border border-border active:bg-border/40 transition-colors"
          >
            <div className="w-16 h-24 shrink-0 rounded-md overflow-hidden bg-bg border border-border">
              {posterUrl(s.posterPath, 'w154') ? (
                <img
                  src={posterUrl(s.posterPath, 'w154')!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0 py-0.5">
              <div className="font-medium leading-tight line-clamp-2">{s.title}</div>
              <div className="text-[11px] text-muted mt-0.5">{s.year ?? '—'}</div>
              <p className="mt-1.5 text-xs text-muted italic leading-snug line-clamp-3">
                {s.reason}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TopGenreBar({ profile }: { profile: UserProfile }) {
  return (
    <div className="mb-5 flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted">Ton profil :</span>
      {profile.topGenres.slice(0, 3).map((g) => (
        <span
          key={g.name}
          className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent"
        >
          {g.name}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ itemCount }: { itemCount: number }) {
  return (
    <div className="text-center py-16">
      <Compass size={40} className="mx-auto text-muted mb-4" />
      <div className="text-lg font-medium mb-2">Encore un peu de patience</div>
      <p className="text-sm text-muted max-w-xs mx-auto leading-relaxed">
        {itemCount === 0
          ? "Ajoute quelques séries ou films à ta biblio, note ceux que tu as aimés, et je te propose des choses ciblées."
          : "Ajoute au moins 3 titres et note-en un ou deux 4-5★ pour que je puisse cibler ce que tu aimes."}
      </p>
      <Link
        to="/"
        className="mt-6 inline-block px-4 py-2 rounded-full bg-accent text-black font-medium text-sm"
      >
        Aller à la recherche
      </Link>
    </div>
  );
}
