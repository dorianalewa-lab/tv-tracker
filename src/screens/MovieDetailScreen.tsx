import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import {
  backdropUrl, getMovieDetails, posterUrl, type MovieDetails,
} from '../api/tmdb';
import { useDB } from '../hooks/useLibrary';
import {
  ensureItemFromDetails, markMovieSeen, setRating, toggleSaved, unmarkMovieSeen,
} from '../storage/library';
import { StarRating } from '../components/StarRating';
import { WatchProviders } from '../components/WatchProviders';
import { CastRow } from '../components/CastRow';
import { Trailer } from '../components/Trailer';
import { BookmarkButton } from './ShowDetailScreen';

export function MovieDetailScreen() {
  const { id: idParam } = useParams();
  const tmdbId = Number(idParam);
  const itemId = `movie:${tmdbId}`;
  const db = useDB();
  const item = db.items[itemId] ?? null;

  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getMovieDetails(tmdbId)
      .then((d) => { if (!cancelled) setDetails(d); })
      .catch((e) => { if (!cancelled) setLoadError(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, [tmdbId]);

  const seen = useMemo(
    () => (item ? db.watchEvents.some((e) => e.itemId === itemId && e.kind === 'movie') : false),
    [db.watchEvents, itemId, item]
  );

  function ensure(): string | null {
    if (!details) return null;
    if (item) return item.id;
    return ensureItemFromDetails(details, 'movie').id;
  }

  if (loadError) {
    return (
      <div className="min-h-full pb-24 px-4 pt-4">
        <BackButton to={item ? '/library' : '/'} />
        <div className="text-red-400 text-sm pt-10 text-center">
          Impossible de charger la fiche : {loadError}
        </div>
      </div>
    );
  }
  if (!details) {
    return (
      <div className="min-h-full pb-24 flex items-center justify-center text-muted">
        <Loader2 size={20} className="animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24">
      <div className="relative">
        <div
          className="w-full h-52 sm:h-64 bg-surface bg-cover bg-center"
          style={{ backgroundImage: backdropUrl(details.backdrop_path) ? `url(${backdropUrl(details.backdrop_path)})` : undefined }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-bg" />
        <BackButton to={item ? '/library' : '/'} floating />
      </div>

      <div className="px-4 -mt-16 relative">
        <div className="flex gap-3 items-end">
          <div className="w-24 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden bg-surface border border-border shrink-0 shadow-xl">
            {posterUrl(details.poster_path) ? (
              <img src={posterUrl(details.poster_path)!} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="pb-1 min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{details.title}</h1>
            <div className="text-xs text-muted mt-1">
              {details.release_date?.slice(0, 4) ?? '—'}
              {details.runtime ? ` · ${details.runtime} min` : ''}
              {typeof (details as unknown as { vote_average?: number }).vote_average === 'number' && (
                <> · ★ {(details as unknown as { vote_average: number }).vote_average.toFixed(1)}</>
              )}
            </div>
          </div>
        </div>

        {details.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {details.genres.map((g) => (
              <span key={g.id} className="text-[11px] px-2 py-0.5 rounded-full bg-surface border border-border text-muted">
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Actions : Marquer vu + Enregistrer. Statut auto. */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => {
              const id = ensure();
              if (!id) return;
              if (seen) unmarkMovieSeen(id);
              else markMovieSeen(id);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-black font-semibold text-sm"
          >
            <Check size={18} strokeWidth={seen ? 3 : 2} />
            {seen ? 'Vu' : 'Marquer vu'}
          </button>
          <BookmarkButton
            active={item?.saved ?? false}
            onClick={() => {
              const id = ensure();
              if (id) toggleSaved(id);
            }}
          />
        </div>

        {item && (
          <div className="mt-2 text-[11px] text-muted">
            Statut auto : <span className="text-text">{labelOf(item.status)}</span>
          </div>
        )}

        {item && (seen || item.rating != null) && (
          <div className="mt-5">
            <div className="text-sm text-muted mb-2">Ta note</div>
            <StarRating value={item.rating} onChange={(v) => setRating(item.id, v)} />
          </div>
        )}
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Trailer</h2>
        <Trailer mediaType="movie" tmdbId={tmdbId} backdropUrl={backdropUrl(details.backdrop_path, 'w1280')} />
      </div>

      {details.overview && (
        <div className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Synopsis</h2>
          <p className="text-sm text-muted leading-relaxed">{details.overview}</p>
        </div>
      )}

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Distribution</h2>
        <CastRow mediaType="movie" tmdbId={tmdbId} />
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Où regarder</h2>
        <WatchProviders mediaType="movie" tmdbId={tmdbId} />
      </div>
    </div>
  );
}

function BackButton({ to, floating }: { to: string; floating?: boolean }) {
  return (
    <Link
      to={to}
      className={
        floating
          ? 'absolute top-3 left-3 z-10 bg-black/60 backdrop-blur rounded-full p-2 text-white'
          : 'inline-flex items-center gap-1 text-muted text-sm mb-6'
      }
      aria-label="Retour"
    >
      <ArrowLeft size={18} />
      {!floating && 'Retour'}
    </Link>
  );
}

function labelOf(s: 'planned' | 'watching' | 'completed' | 'dropped'): string {
  return { planned: 'À voir', watching: 'En cours', completed: 'Terminé', dropped: 'Abandonné' }[s];
}
