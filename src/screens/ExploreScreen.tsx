import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getTrending, getUpcomingMovies, getOnAirTv } from '../api/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useDB } from '../hooks/useLibrary';
import type { TmdbSearchResult } from '../types';

type ExploreKind = 'trending-tv' | 'trending-movie' | 'trending-all' | 'upcoming' | 'onair';

const CONFIG: Record<ExploreKind, { title: string; fetch: (page: number) => Promise<TmdbSearchResult[]> }> = {
  'trending-tv':    { title: '🔥 Séries tendances',       fetch: (p) => getTrending('tv', 'week', p) },
  'trending-movie': { title: '🔥 Films tendances',        fetch: (p) => getTrending('movie', 'week', p) },
  'trending-all':   { title: '🔥 Tendances de la semaine', fetch: (p) => getTrending('all', 'week', p) },
  upcoming:         { title: '🎬 Prochainement au ciné',   fetch: (p) => getUpcomingMovies(p) },
  onair:            { title: '📺 En ce moment à la TV',    fetch: (p) => getOnAirTv(p) },
};

export function ExploreScreen() {
  const { kind } = useParams();
  const db = useDB();
  const cfg = kind && kind in CONFIG ? CONFIG[kind as ExploreKind] : null;

  const [items, setItems] = useState<TmdbSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setItems([]); setPage(1); setDone(false);
  }, [kind]);

  useEffect(() => {
    if (!cfg || done) return;
    setLoading(true);
    cfg.fetch(page)
      .then((res) => {
        setItems((prev) => {
          const seen = new Set(prev.map((r) => `${r.media_type}:${r.id}`));
          const fresh = res.filter((r) => !seen.has(`${r.media_type}:${r.id}`));
          if (fresh.length === 0) setDone(true);
          return [...prev, ...fresh];
        });
      })
      .catch(() => setDone(true))
      .finally(() => setLoading(false));
  }, [cfg, page, done]);

  if (!cfg) {
    return (
      <div className="min-h-full pb-24 px-4 pt-4">
        <div className="text-muted text-center py-16 text-sm">Catégorie inconnue.</div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <Link to="/" className="p-2 -m-2 text-muted" aria-label="Retour">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold flex-1 truncate">{cfg.title}</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {items.length === 0 && loading && (
          <div className="flex items-center gap-2 text-muted text-sm py-16 justify-center">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((r) => {
            const t = r.media_type === 'tv' ? 'tv' : 'movie';
            const owned = db.items[`${t}:${r.id}`];
            return (
              <Link
                key={`${t}:${r.id}`}
                to={t === 'tv' ? `/show/${r.id}` : `/movie/${r.id}`}
                className="block"
              >
                <PosterCard
                  posterPath={r.poster_path}
                  title={(r.title || r.name) ?? '(sans titre)'}
                  year={yearFrom(r)}
                  mediaType={t as 'tv' | 'movie'}
                  voteAverage={r.vote_average ?? null}
                  reaction={owned?.reaction ?? null}
                  saved={owned?.saved ?? false}
                />
              </Link>
            );
          })}
        </div>

        {!done && items.length > 0 && (
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="mt-6 w-full py-3 rounded-lg border border-border text-sm text-muted disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Chargement…</> : 'Charger plus'}
          </button>
        )}

        {done && items.length > 0 && (
          <div className="mt-6 text-center text-xs text-muted">— fin de la liste —</div>
        )}
      </div>
    </div>
  );
}

function yearFrom(r: TmdbSearchResult): number | null {
  const d = r.release_date || r.first_air_date;
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}
