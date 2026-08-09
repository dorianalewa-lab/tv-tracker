import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, X, Loader2, User, SlidersHorizontal, Wand2, ListChecks, Check } from 'lucide-react';
import {
  searchMulti, searchTitles, searchPersons, profileUrl,
  getTrending, getUpcomingMovies, getOnAirTv, discoverWithParams,
  getGenreMap, getPopular, getTopRated, discoverByGenreName,
  type MultiSearchItem, type TmdbPerson,
} from '../api/tmdb';
import { PosterCard } from '../components/PosterCard';
import { FiltersSheet, EMPTY_FILTERS, activeFilterCount, type SearchFilters } from '../components/FiltersSheet';
import { TrendingRow } from '../components/TrendingRow';
import { useDebounce } from '../hooks/useDebounce';
import { useDB } from '../hooks/useLibrary';
import {
  ensureItemFromLight, enrichItemInBackground, markAllEpisodesSeen, markMovieSeen,
  resetTvProgress, unmarkMovieSeen,
} from '../storage/library';
import type { TmdbSearchResult, Status } from '../types';

type TypeToggle = 'tv' | 'movie';

export function SearchScreen() {
  const db = useDB();
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<TypeToggle>('tv');
  const [includePersons, setIncludePersons] = useState(false); // toggle personnes seulement dans la recherche
  const debounced = useDebounce(query, 350);

  const [titles, setTitles] = useState<TmdbSearchResult[]>([]);
  const [persons, setPersons] = useState<TmdbPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (picker de statut retiré — statut auto-dérivé)

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersCount = activeFilterCount(filters);

  const [homeRows, setHomeRows] = useState<Record<string, TmdbSearchResult[]>>({});
  const [homeLoading, setHomeLoading] = useState(false);

  const knownById = useMemo(() => db.items, [db]);
  const hasQuery = debounced.trim().length > 0;
  const showHome = !hasQuery && filtersCount === 0;

  // Recharge la home à chaque changement de type — plein de rangées, chargées en parallèle
  useEffect(() => {
    if (!showHome) return;
    setHomeLoading(true);
    setHomeRows({});
    let cancelled = false;

    // Chargement par petits chunks pour éviter d'attendre TOUT avant d'afficher qqch
    const tasks: { key: string; promise: Promise<TmdbSearchResult[]> }[] = [
      { key: 'trending',   promise: getTrending(mediaType, 'week') },
      { key: 'secondary',  promise: mediaType === 'movie' ? getUpcomingMovies() : getOnAirTv() },
      { key: 'popular',    promise: getPopular(mediaType) },
      { key: 'topRated',   promise: getTopRated(mediaType) },
      { key: 'action',     promise: discoverByGenreName(mediaType, 'Action') },
      { key: 'comedy',     promise: discoverByGenreName(mediaType, 'Comédie') },
      { key: 'drama',      promise: discoverByGenreName(mediaType, 'Drame') },
      { key: 'scifi',      promise: discoverByGenreName(mediaType, mediaType === 'tv' ? 'Science-Fiction & Fantastique' : 'Science-Fiction') },
      { key: 'horror',     promise: mediaType === 'movie' ? discoverByGenreName('movie', 'Horreur') : Promise.resolve([]) },
      { key: 'doc',        promise: discoverByGenreName(mediaType, 'Documentaire') },
    ];

    for (const t of tasks) {
      t.promise
        .then((rows) => {
          if (cancelled) return;
          setHomeRows((prev) => ({ ...prev, [t.key]: rows.slice(0, 20) }));
        })
        .catch(() => { if (!cancelled) setHomeRows((prev) => ({ ...prev, [t.key]: [] })); });
    }

    Promise.allSettled(tasks.map((t) => t.promise)).finally(() => {
      if (!cancelled) setHomeLoading(false);
    });

    return () => { cancelled = true; };
  }, [showHome, mediaType]);

  // Recherche + discover selon présence de query/filtres
  useEffect(() => {
    let cancelled = false;
    if (!hasQuery && filtersCount === 0) {
      setTitles([]); setPersons([]); setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (hasQuery) {
          // Multi si on veut aussi les personnes, sinon spécifique
          if (includePersons) {
            const results: MultiSearchItem[] = await searchMulti(debounced);
            if (cancelled) return;
            setTitles(
              results
                .filter((r): r is TmdbSearchResult & { kind: 'title' } => r.kind === 'title')
                .filter((r) => r.media_type === mediaType)
            );
            setPersons(results.filter((r): r is TmdbPerson & { kind: 'person'; media_type: 'person' } => r.kind === 'person'));
          } else {
            const t = await searchTitles(debounced, mediaType);
            if (cancelled) return;
            setTitles(t);
            // On garde les personnes si on avait déjà cherché — on les vide sinon
            const p = await searchPersons(debounced);
            if (!cancelled) setPersons(p.slice(0, 8));
          }
        } else {
          // /discover avec filtres uniquement
          const map = await getGenreMap(mediaType);
          const params: Record<string, string | number> = {
            sort_by: 'popularity.desc',
            'vote_count.gte': 50,
          };
          if (filters.genreNames.length > 0) {
            const ids = filters.genreNames.map((n) => map.get(n)).filter((id): id is number => typeof id === 'number');
            if (ids.length > 0) params.with_genres = ids.join(',');
          }
          if (filters.yearMin) params[mediaType === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte'] = `${filters.yearMin}-01-01`;
          if (filters.yearMax) params[mediaType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte'] = `${filters.yearMax}-12-31`;
          if (filters.minRating > 0) params['vote_average.gte'] = filters.minRating;
          if (filters.providerIds.length > 0) {
            params.with_watch_providers = filters.providerIds.join('|');
            params.watch_region = db.profile.region;
          }
          const res = await discoverWithParams(mediaType, params);
          if (cancelled) return;
          setTitles(res.map((r) => ({
            ...r,
            media_type: mediaType,
            title: mediaType === 'movie' ? r.title : r.name,
            name: r.name,
            release_date: mediaType === 'movie' ? r.release_date : r.first_air_date,
            first_air_date: r.first_air_date,
          })));
          setPersons([]);
        }
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced, mediaType, includePersons, filters, hasQuery, filtersCount, db.profile.region]);

  const filteredTitles = useMemo(() => {
    if (!hasQuery) return titles;
    return titles.filter((r) => {
      const dateStr = r.release_date || r.first_air_date;
      const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
      if (filters.yearMin != null && (year == null || year < filters.yearMin)) return false;
      if (filters.yearMax != null && (year == null || year > filters.yearMax)) return false;
      const va = r.vote_average ?? 0;
      if (filters.minRating > 0 && va < filters.minRating) return false;
      return true;
    });
  }, [titles, filters, hasQuery]);

  const nothingShown = !loading && !error && (hasQuery || filtersCount > 0) && filteredTitles.length === 0 && persons.length === 0;

  return (
    <div className="min-h-full pb-32">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        {/* Toggle Séries/Films en haut — pilote tendances ET recherche */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Découvrir</h1>
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5 text-sm">
            <button
              onClick={() => setMediaType('tv')}
              className={`px-3 py-1 rounded-full ${mediaType === 'tv' ? 'bg-accent text-black font-medium' : 'text-muted'}`}
            >
              📺 Séries
            </button>
            <button
              onClick={() => setMediaType('movie')}
              className={`px-3 py-1 rounded-full ${mediaType === 'movie' ? 'bg-accent text-black font-medium' : 'text-muted'}`}
            >
              🎬 Films
            </button>
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mediaType === 'tv' ? 'Chercher une série, un acteur…' : 'Chercher un film, un acteur…'}
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-3 text-base outline-none focus:border-muted"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted p-1.5" aria-label="Effacer">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className={`relative w-11 h-11 rounded-xl border flex items-center justify-center ${
              filtersCount > 0 ? 'bg-accent text-black border-accent' : 'bg-surface border-border text-muted'
            }`}
            aria-label="Filtres"
          >
            <SlidersHorizontal size={18} />
            {filtersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {filtersCount}
              </span>
            )}
          </button>
        </div>

        {hasQuery && (
          <div className="px-4 pb-2 -mt-1">
            <label className="text-xs text-muted flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePersons}
                onChange={(e) => setIncludePersons(e.target.checked)}
                className="accent-[#f5c518]"
              />
              Inclure les acteurs / réalisateurs
            </label>
          </div>
        )}
      </div>

      <div className="pt-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center">
            <Loader2 size={16} className="animate-spin" /> Recherche…
          </div>
        )}

        {error && <div className="text-red-400 text-sm py-6 text-center px-4">{error}</div>}

        {showHome && (
          <>
            {homeLoading && Object.keys(homeRows).length === 0 && (
              <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center">
                <Loader2 size={16} className="animate-spin" /> Chargement…
              </div>
            )}

            <TrendingRow
              title={mediaType === 'tv' ? '🔥 Séries tendances' : '🔥 Films tendances'}
              items={homeRows.trending ?? []}
              viewAllHref={`/explore/${mediaType === 'tv' ? 'trending-tv' : 'trending-movie'}`}
            />
            <TrendingRow
              title={mediaType === 'tv' ? '📺 En ce moment à la TV' : '🎬 Prochainement au ciné'}
              items={homeRows.secondary ?? []}
              viewAllHref={mediaType === 'tv' ? '/explore/onair' : '/explore/upcoming'}
            />
            <TrendingRow
              title={mediaType === 'tv' ? '⭐ Séries populaires' : '⭐ Films populaires'}
              items={homeRows.popular ?? []}
              viewAllHref={`/catalog/${mediaType}`}
            />
            <TrendingRow
              title="🏆 Les mieux notés"
              items={homeRows.topRated ?? []}
              viewAllHref={`/catalog/${mediaType}`}
            />
            <TrendingRow title="💥 Action"        items={homeRows.action ?? []} />
            <TrendingRow title="😂 Comédie"       items={homeRows.comedy ?? []} />
            <TrendingRow title="🎭 Drame"         items={homeRows.drama ?? []} />
            <TrendingRow title="🚀 Sci-Fi"        items={homeRows.scifi ?? []} />
            {mediaType === 'movie' && (
              <TrendingRow title="😱 Horreur"     items={homeRows.horror ?? []} />
            )}
            <TrendingRow title="🎥 Documentaires" items={homeRows.doc ?? []} />

            {/* CTA catalogue rapide : rattraper sa biblio en un clin d'œil */}
            <div className="px-4 mt-4 mb-6">
              <Link
                to={`/catalog/${mediaType}`}
                className="flex items-center gap-3 p-4 rounded-2xl bg-surface border border-border active:bg-border/40 transition-colors"
              >
                <div className="w-11 h-11 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                  <ListChecks size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    {mediaType === 'tv' ? 'Toutes les séries' : 'Tous les films'}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    Parcours la liste et coche ce que tu as déjà vu
                  </div>
                </div>
              </Link>
            </div>
          </>
        )}

        {nothingShown && (
          <div className="text-muted text-sm py-10 text-center px-4">
            Aucun résultat{filtersCount > 0 ? ' avec ces filtres' : ''}.
          </div>
        )}

        {(hasQuery || filtersCount > 0) && filteredTitles.length > 0 && (
          <div className="px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
              {filteredTitles.map((r) => {
                const id = `${mediaType}:${r.id}`;
                const existing = knownById[id];
                const isSeen = existing?.status === 'completed';
                return (
                  <div key={id} className="relative">
                    <Link to={mediaType === 'tv' ? `/show/${r.id}` : `/movie/${r.id}`} className="block">
                      <PosterCard
                        posterPath={r.poster_path}
                        title={(r.title || r.name) ?? '(sans titre)'}
                        year={yearFrom(r)}
                        mediaType={mediaType}
                        voteAverage={r.vote_average ?? existing?.voteAverage ?? null}
                        saved={existing?.saved ?? false}
                      />
                    </Link>
                    {existing && !isSeen && (
                      <span className="absolute bottom-14 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/70 text-accent border border-accent/60">
                        {labelOf(existing.status)}
                      </span>
                    )}
                    {/* Bouton "Vu" en overlay — coche rapide sans ouvrir la fiche */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleQuickSeen(r, mediaType, isSeen);
                      }}
                      aria-label={isSeen ? 'Marquer non vu' : 'Marquer comme vu'}
                      className={`absolute bottom-14 right-1.5 h-8 min-w-[38px] px-2 rounded-full flex items-center justify-center gap-1 text-[11px] font-bold shadow-lg transition active:scale-90 ${
                        isSeen
                          ? 'bg-emerald-500/90 text-white'
                          : 'bg-accent text-black'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                      <span>Vu</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasQuery && includePersons && persons.length > 0 && (
          <div className="px-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Personnes
            </h2>
            <div className="flex flex-col gap-2">
              {persons.map((p) => (
                <Link
                  key={p.id}
                  to={`/person/${p.id}`}
                  className="flex items-center gap-3 p-2 rounded-xl bg-surface border border-border active:bg-border/40 transition-colors"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-bg border border-border shrink-0 flex items-center justify-center">
                    {profileUrl(p.profile_path, 'w185') ? (
                      <img src={profileUrl(p.profile_path, 'w185')!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={22} className="text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted truncate">
                      {p.known_for_department ? translateDept(p.known_for_department) : 'Personne'}
                      {p.known_for && p.known_for.length > 0 && (
                        <> · {p.known_for.slice(0, 2).map((k) => k.title || k.name).filter(Boolean).join(', ')}</>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bouton "Aide-moi" — texte compact pour tenir sur une ligne */}
      <Link
        to="/ask"
        className="fixed left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 px-5 h-11 rounded-full bg-gradient-to-br from-accent to-yellow-500 text-black font-semibold shadow-xl active:scale-95 transition whitespace-nowrap"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
      >
        <Wand2 size={18} /> Aide-moi
      </Link>

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

/**
 * Toggle rapide "vu" depuis les résultats de recherche : évite de devoir
 * ouvrir la fiche pour cocher. Auto-ajoute à la biblio si absent.
 */
async function toggleQuickSeen(r: TmdbSearchResult, mediaType: 'tv' | 'movie', isSeen: boolean) {
  const id = `${mediaType}:${r.id}`;
  if (isSeen) {
    if (mediaType === 'movie') unmarkMovieSeen(id);
    else resetTvProgress(id);
    return;
  }
  const localId = ensureItemFromLight(r, mediaType);
  if (mediaType === 'movie') {
    markMovieSeen(localId);
    void enrichItemInBackground(localId, r.id, 'movie');
  } else {
    await markAllEpisodesSeen(localId, r.id);
  }
}

function yearFrom(r: TmdbSearchResult): number | null {
  const d = r.release_date || r.first_air_date;
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function labelOf(s: Status): string {
  return { planned: 'À voir', watching: 'En cours', completed: 'Terminé', dropped: 'Abandonné' }[s];
}

function translateDept(dept: string): string {
  return (
    { Acting: 'Acteur/actrice', Directing: 'Réalisation', Writing: 'Scénario', Production: 'Production' }[dept] ?? dept
  );
}
