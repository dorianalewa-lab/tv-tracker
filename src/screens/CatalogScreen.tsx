import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Star, SlidersHorizontal } from 'lucide-react';
import { discoverWithParams, getGenreMap, posterUrl } from '../api/tmdb';
import { useDB } from '../hooks/useLibrary';
import {
  enrichItemInBackground, ensureItemFromLight, markAllEpisodesSeen, markMovieSeen,
  resetTvProgress, unmarkMovieSeen,
} from '../storage/library';
import { FiltersSheet, EMPTY_FILTERS, activeFilterCount, type SearchFilters } from '../components/FiltersSheet';
import type { MediaType, TmdbSearchResult } from '../types';

type SortKey = 'popular' | 'recent' | 'top-rated';
const SORT_OPTIONS: { key: SortKey; label: string; sortBy: string; minVotes: number }[] = [
  { key: 'popular',   label: '⭐ Populaires',  sortBy: 'popularity.desc',   minVotes: 50 },
  { key: 'recent',    label: '🆕 Récents',     sortBy: '',                  minVotes: 0 },   // spécial : sortBy runtime selon type
  { key: 'top-rated', label: '🏆 Mieux notés', sortBy: 'vote_average.desc', minVotes: 300 },
];

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

  const [sort, setSort] = useState<SortKey>('popular');
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersCount = activeFilterCount(filters);

  // Reset la liste quand n'importe quel critère change
  useEffect(() => {
    setItems([]); setPage(1); setDone(false); setBusyIds(new Set());
  }, [mediaType, sort, filters]);

  useEffect(() => {
    if (done) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const sortOpt = SORT_OPTIONS.find((s) => s.key === sort)!;
        const params: Record<string, string | number> = {
          'vote_count.gte': sortOpt.minVotes,
          page,
        };
        if (sort === 'recent') {
          params.sort_by = mediaType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc';
        } else {
          params.sort_by = sortOpt.sortBy;
        }

        // Genres (via genre map)
        if (filters.genreNames.length > 0) {
          const map = await getGenreMap(mediaType);
          const ids = filters.genreNames.map((n) => map.get(n)).filter((id): id is number => typeof id === 'number');
          if (ids.length > 0) params.with_genres = ids.join(',');
        }
        // Année
        if (filters.yearMin) params[mediaType === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte'] = `${filters.yearMin}-01-01`;
        if (filters.yearMax) params[mediaType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte'] = `${filters.yearMax}-12-31`;
        // Note min
        if (filters.minRating > 0 && sort !== 'top-rated') params['vote_average.gte'] = filters.minRating;
        // Plateformes
        if (filters.providerIds.length > 0) {
          params.with_watch_providers = filters.providerIds.join('|');
          params.watch_region = db.profile.region;
        }

        const res = await discoverWithParams(mediaType, params);
        if (cancelled) return;
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
      } catch {
        if (!cancelled) setDone(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [mediaType, page, done, sort, filters, db.profile.region]);

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
      if (mediaType === 'movie') unmarkMovieSeen(id);
      else resetTvProgress(id);
      return;
    }
    const localId = ensureItemFromLight(r, mediaType);
    if (mediaType === 'movie') {
      markMovieSeen(localId);
      void enrichItemInBackground(localId, r.id, mediaType);
    } else {
      setBusyIds((prev) => new Set(prev).add(id));
      try {
        await markAllEpisodesSeen(localId, r.id);
      } finally {
        setBusyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
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
          <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
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

        {/* Bar de tri + bouton filtres */}
        <div className="px-2 pb-2 flex items-center gap-1 no-scrollbar overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {SORT_OPTIONS.map((s) => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition ${
                    active ? 'bg-accent text-black border-accent font-medium' : 'border-border text-muted'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setFiltersOpen(true)}
            className={`relative w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mr-2 ${
              filtersCount > 0 ? 'bg-accent text-black border-accent' : 'bg-surface border-border text-muted'
            }`}
            aria-label="Filtres"
          >
            <SlidersHorizontal size={16} />
            {filtersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {filtersCount}
              </span>
            )}
          </button>
        </div>

        <div className="px-4 pb-2 text-[11px] text-muted">
          Tap ✓ pour marquer vu. Auto-ajouté à ta biblio.
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
                  isSeen ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300' : 'bg-surface border border-border text-muted active:scale-95'
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

      {items.length === 0 && !loading && (
        <div className="text-muted text-sm text-center py-16 px-4">
          Aucun résultat avec ces filtres.
        </div>
      )}

      {done && items.length > 0 && (
        <div className="my-6 text-center text-xs text-muted">— fin de la liste —</div>
      )}

      {filtersOpen && (
        <FiltersSheet
          value={filters}
          region={db.profile.region}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}
