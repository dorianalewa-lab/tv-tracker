import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Loader2,
  Bookmark, BookmarkCheck,
} from 'lucide-react';
import {
  backdropUrl, getTvDetails, getTvSeason, posterUrl, IMG_BASE,
  type TmdbEpisode, type TmdbSeasonSummary, type TvDetails,
} from '../api/tmdb';
import { useDB } from '../hooks/useLibrary';
import {
  ensureItemFromDetails, episodeKey, markAllEpisodesSeen, markEpisodeSeen,
  removeItem, resetTvProgress, setRating, unmarkEpisodeSeen,
} from '../storage/library';
import { StarRating } from '../components/StarRating';
import { WatchProviders } from '../components/WatchProviders';
import { CastRow } from '../components/CastRow';
import { Trailer } from '../components/Trailer';

export function ShowDetailScreen() {
  const { id: idParam } = useParams();
  const tmdbId = Number(idParam);
  const itemId = `tv:${tmdbId}`;
  const db = useDB();
  const item = db.items[itemId] ?? null;

  const [details, setDetails] = useState<TvDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getTvDetails(tmdbId)
      .then((d) => { if (!cancelled) setDetails(d); })
      .catch((e) => { if (!cancelled) setLoadError(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, [tmdbId]);

  const realSeasons = useMemo(
    () => (details?.seasons ?? []).filter((s) => s.season_number > 0 && s.episode_count > 0),
    [details]
  );

  const totalEps = useMemo(
    () => realSeasons.reduce((n, s) => n + s.episode_count, 0),
    [realSeasons]
  );
  const seenCount = useMemo(() => {
    if (!item?.seenEpisodes) return 0;
    const validSeasons = new Set(realSeasons.map((s) => s.season_number));
    return Object.keys(item.seenEpisodes).filter((k) => {
      const m = k.match(/^S(\d+)E\d+$/);
      return m && validSeasons.has(Number(m[1]));
    }).length;
  }, [item, realSeasons]);
  const pct = totalEps > 0 ? Math.round((seenCount / totalEps) * 100) : 0;
  const isCompleted = totalEps > 0 && seenCount >= totalEps;

  function ensure(): string | null {
    if (!details) return null;
    if (item) return item.id;
    return ensureItemFromDetails(details, 'tv').id;
  }

  async function toggleAllSeen() {
    const id = ensure();
    if (!id) return;
    if (isCompleted) {
      resetTvProgress(id);
      return;
    }
    setMarkingAll(true);
    try {
      await markAllEpisodesSeen(id, tmdbId);
    } finally {
      setMarkingAll(false);
    }
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
            <h1 className="text-xl font-bold leading-tight">{details.name}</h1>
            <div className="text-xs text-muted mt-1">
              {details.first_air_date?.slice(0, 4) ?? '—'} · {details.number_of_seasons} saison{details.number_of_seasons > 1 ? 's' : ''}
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

        {/* Actions : Marquer comme vu + Enregistrer */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={toggleAllSeen}
            disabled={markingAll}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-70 ${
              isCompleted
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                : 'bg-accent text-black'
            }`}
          >
            {markingAll ? (
              <><Loader2 size={16} className="animate-spin" /> Marquage…</>
            ) : isCompleted ? (
              <><Check size={18} strokeWidth={3} /> Vue</>
            ) : (
              <><Check size={18} /> Marquer comme vu</>
            )}
          </button>
          <BookmarkButton
            active={!!item}
            onClick={() => {
              if (item) {
                if (confirm(`Retirer "${details.name}" de ta biblio ?`)) {
                  removeItem(item.id);
                }
              } else {
                ensure();
              }
            }}
          />
        </div>

        {item && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted mb-1.5">
              <span>Progression</span>
              <span>{seenCount} / {totalEps} épisodes · {pct}%</span>
            </div>
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {item && (isCompleted || item.rating != null) && (
          <div className="mt-5">
            <div className="text-sm text-muted mb-2">Ta note</div>
            <StarRating value={item.rating} onChange={(v) => setRating(item.id, v)} />
          </div>
        )}
      </div>

      {/* Saisons */}
      {realSeasons.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Saisons</h2>
          <div className="flex flex-col gap-2">
            {realSeasons.map((s, i) => (
              <SeasonBlock
                key={s.id}
                tmdbId={tmdbId}
                itemId={itemId}
                ensureItem={() => ensure()}
                season={s}
                seenEpisodes={item?.seenEpisodes ?? {}}
                defaultOpen={firstIncompleteIndex(realSeasons, item?.seenEpisodes) === i}
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Trailer</h2>
        <Trailer mediaType="tv" tmdbId={tmdbId} backdropUrl={backdropUrl(details.backdrop_path, 'w1280')} />
      </div>

      {details.overview && (
        <div className="px-4 mt-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Synopsis</h2>
          <p className="text-sm text-muted leading-relaxed">{details.overview}</p>
        </div>
      )}

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Distribution</h2>
        <CastRow mediaType="tv" tmdbId={tmdbId} />
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Où regarder</h2>
        <WatchProviders mediaType="tv" tmdbId={tmdbId} />
      </div>
    </div>
  );
}

/* ---------------- Season accordion ---------------- */

function SeasonBlock({
  tmdbId, itemId, ensureItem, season, seenEpisodes, defaultOpen,
}: {
  tmdbId: number;
  itemId: string;
  ensureItem: () => string | null;
  season: TmdbSeasonSummary;
  seenEpisodes: Record<string, true>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [episodes, setEpisodes] = useState<TmdbEpisode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || episodes) return;
    setLoading(true);
    setError(null);
    getTvSeason(tmdbId, season.season_number)
      .then((r) => setEpisodes(r.episodes))
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [open, tmdbId, season.season_number, episodes]);

  const seenInSeason = useMemo(() => {
    let n = 0;
    for (let i = 1; i <= season.episode_count; i++) {
      if (seenEpisodes[episodeKey(season.season_number, i)]) n++;
    }
    return n;
  }, [seenEpisodes, season]);

  const allSeen = seenInSeason >= season.episode_count && season.episode_count > 0;

  function toggleEpisode(ep: TmdbEpisode) {
    const id = ensureItem();
    if (!id) return;
    const key = episodeKey(season.season_number, ep.episode_number);
    if (seenEpisodes[key]) {
      unmarkEpisodeSeen(itemId, season.season_number, ep.episode_number);
    } else {
      markEpisodeSeen(itemId, season.season_number, ep.episode_number, episodes ?? []);
    }
  }

  function toggleWholeSeason() {
    if (!episodes) return;
    const id = ensureItem();
    if (!id) return;
    if (allSeen) {
      for (const ep of episodes) unmarkEpisodeSeen(itemId, season.season_number, ep.episode_number);
    } else {
      const last = Math.max(...episodes.map((e) => e.episode_number));
      markEpisodeSeen(itemId, season.season_number, last, episodes);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        {season.poster_path && (
          <img
            src={`${IMG_BASE}/w154${season.poster_path}`}
            alt=""
            className="w-10 h-14 rounded-md object-cover border border-border shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium">{season.name}</div>
          <div className="text-xs text-muted">
            {seenInSeason} / {season.episode_count} vus{allSeen && ' · ✓'}
          </div>
        </div>
        {open ? <ChevronDown size={18} className="text-muted shrink-0" /> : <ChevronRight size={18} className="text-muted shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border">
          {loading && (
            <div className="px-4 py-4 text-sm text-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Chargement des épisodes…
            </div>
          )}
          {error && <div className="px-4 py-3 text-sm text-red-400">{error}</div>}
          {episodes && (
            <>
              <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between gap-2">
                <span className="text-xs text-muted truncate">
                  {allSeen ? 'Saison complète' : 'Cocher = marque aussi les précédents'}
                </span>
                <button
                  onClick={toggleWholeSeason}
                  className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:text-text whitespace-nowrap"
                >
                  {allSeen ? 'Tout décocher' : 'Tout vu'}
                </button>
              </div>
              <ul>
                {episodes.map((ep) => {
                  const key = episodeKey(season.season_number, ep.episode_number);
                  const seen = !!seenEpisodes[key];
                  const still = ep.still_path ? `${IMG_BASE}/w300${ep.still_path}` : null;
                  return (
                    <li key={ep.id} className="flex items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0">
                      <div className="w-8 text-center text-xs text-muted font-mono shrink-0">{ep.episode_number}</div>
                      <div className="w-16 h-10 rounded-md overflow-hidden bg-bg border border-border shrink-0">
                        {still && <img src={still} alt="" loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{ep.name || `Épisode ${ep.episode_number}`}</div>
                        <div className="text-[11px] text-muted">
                          {formatDate(ep.air_date)}
                          {ep.runtime ? ` · ${ep.runtime} min` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEpisode(ep)}
                        aria-label={seen ? 'Marquer non vu' : 'Marquer vu'}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition shrink-0 ${
                          seen ? 'bg-accent text-black' : 'bg-bg border border-border text-muted active:scale-95'
                        }`}
                      >
                        <Check size={20} strokeWidth={seen ? 3 : 2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- shared button ---------------- */

export function BookmarkButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const Icon = active ? BookmarkCheck : Bookmark;
  return (
    <button
      onClick={onClick}
      aria-label={active ? 'Retirer des enregistrés' : 'Enregistrer'}
      className={`w-12 h-12 rounded-xl border flex items-center justify-center transition ${
        active ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-surface border-border text-muted'
      }`}
    >
      <Icon size={20} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ---------------- helpers ---------------- */

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function firstIncompleteIndex(seasons: TmdbSeasonSummary[], seen: Record<string, true> | undefined): number {
  if (!seen) return 0;
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    let n = 0;
    for (let e = 1; e <= s.episode_count; e++) {
      if (seen[episodeKey(s.season_number, e)]) n++;
    }
    if (n < s.episode_count) return i;
  }
  return 0;
}
