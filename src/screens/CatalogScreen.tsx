import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Star } from 'lucide-react';
import { discoverWithParams, posterUrl } from '../api/tmdb';
import { useDB } from '../hooks/useLibrary';
import {
  enrichItemInBackground, ensureItemFromLight, markAllEpisodesSeen, markMovieSeen,
  resetTvProgress, unmarkMovieSeen,
} from '../storage/library';
import type { MediaType, TmdbSearchResult } from '../types';

export function CatalogScreen() {
  const { mediaType: mediaTypeParam } = useParams();
  const navigate = useNavigate();
  const mediaType: MediaType = mediaTypeParam === 'movie' ? 'movie' : 'tv';
  const db = useDB();

  const [items, setItems] = useState<TmdbSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setItems([]); setPage(1); setDone(false); setBusyIds(new Set());
  }, [mediaType]);

  useEffect(() => {
    if (done) return;
    setLoading(true);
    discoverWithParams(mediaType, {
      sort_by: 'popularity.desc',
      'vote_count.gte': 50,
      page,
    })
      .then((res) => {
        const mapped: TmdbSearchResult[] = res.map((r) => ({
          ...r,
          media_type: mediaType,
          title: mediaType === 'movie' ? r.title : r.name,
          name: r.name,
          release_date: r.release_date,
          first_air_date: r.first_air_date,
        }));
        setItems((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const fresh = mapped.filter((r) => !seen.has(r.id));
          if (fresh.length === 0) setDone(true);
          return [...prev, ...fresh];
        });
      })
      .catch(() => setDone(true))
      .finally(() => setLoading(false));
  }, [mediaType, page, done]);

  const seenIds = useMemo(() => {
    const s = new Set<string>();
    for (const it of Object.values(db.items)) {
      if (it.status === 'completed') s.add(`${it.mediaType}:${it.tmdbId}`);
    }
    return s;
  }, [db.items]);

  async function toggleSeen(r: TmdbSearchResult) {
    const id = `${mediaType}:${r.id}`;
    const isSeen = seenIds.has(id);
    if (isSeen) {
      // Décoche : films → retire l'event, séries → efface tous les eps
      if (mediaType === 'movie') unmarkMovieSeen(id);
      else resetTvProgress(id);
      return;
    }

    // Coche : optimiste + enrichissement + marquage épisodes en arrière-plan
    const localId = ensureItemFromLight(r, mediaType);
    if (mediaType === 'movie') {
      markMovieSeen(localId);
      void enrichItemInBackground(localId, r.id, mediaType);
    } else {
      // Pour une série, on coche tous les épisodes derrière (correct pour stats).
      setBusyIds((prev) => new Set(prev).add(id));
      try {
        await markAllEpisodesSeen(localId, r.id);
      } finally {
        setBusyIds((prev) => {
          const n = new Set(prev); n.delete(id); return n;
        });
      }
    }
  }

  function switchType(next: MediaType) {
    navigate(`/catalog/${next}`, { replace: true });
  }

  const title = mediaType === 'tv' ? 'Toutes les séries' : 'Tous les films';

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <Link to="/" className="p-2 -m-2 text-muted" aria-label="Retour">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            <div className="text-[11px] text-muted">
              Tap ✓ pour marquer vu. Auto-ajouté à ta biblio.
            </div>
          </div>
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-xs shrink-0">
            <button
              onClick={() => switchType('tv')}
              className={`px-2.5 py-1 rounded-full ${mediaType === 'tv' ? 'bg-accent text-black font-medium' : 'text-muted'}`}
            >
              Séries
            </button>
            <button
              onClick={() => switchType('movie')}
              className={`px-2.5 py-1 rounded-full ${mediaType === 'movie' ? 'bg-accent text-black font-medium' : 'text-muted'}`}
            >
              Films
            </button>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {items.map((r) => {
          const id = `${mediaType}:${r.id}`;
          const isSeen = seenIds.has(id);
          const busy = busyIds.has(id);
          const label = (r.title || r.name) ?? '(sans titre)';
          const dateStr = r.release_date || r.first_air_date;
          const year = dateStr ? dateStr.slice(0, 4) : null;
          return (
            <li key={id} className={`flex items-center gap-3 px-3 py-2 transition ${isSeen ? 'bg-accent/5' : ''}`}>
              <Link
                to={mediaType === 'tv' ? `/show/${r.id}` : `/movie/${r.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="w-11 h-16 rounded-md overflow-hidden bg-surface border border-border shrink-0">
                  {posterUrl(r.poster_path, 'w154') ? (
                    <img src={posterUrl(r.poster_path, 'w154')!} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight line-clamp-2">{label}</div>
                  <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                    {year && <span>{year}</span>}
                    {typeof r.vote_average === 'number' && r.vote_average > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Star size={10} className="text-accent" fill="currentColor" strokeWidth={0} />
                        {r.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              <button
                onClick={() => toggleSeen(r)}
                disabled={busy}
                aria-label={isSeen ? 'Marquer non vu' : 'Marquer vu'}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition shrink-0 ${
                  isSeen ? 'bg-accent text-black' : 'bg-surface border border-border text-muted active:scale-95'
                } ${busy ? 'opacity-60' : ''}`}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={20} strokeWidth={isSeen ? 3 : 2} />}
              </button>
            </li>
          );
        })}
      </ul>

      {!done && items.length > 0 && (
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
          className="mt-4 mx-4 w-[calc(100%-2rem)] py-3 rounded-lg border border-border text-sm text-muted disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Chargement…</> : 'Charger plus'}
        </button>
      )}

      {items.length === 0 && loading && (
        <div className="flex items-center gap-2 text-muted text-sm py-16 justify-center">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      )}

      {done && items.length > 0 && (
        <div className="my-6 text-center text-xs text-muted">— fin de la liste —</div>
      )}
    </div>
  );
}
