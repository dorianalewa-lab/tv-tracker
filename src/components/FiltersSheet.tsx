import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  getGenreMap, getProvidersForRegion, IMG_BASE,
  type RegionProvider,
} from '../api/tmdb';
import { filterAllowedProviders } from '../lib/providers';

export type SearchFilters = {
  yearMin: number | null;
  yearMax: number | null;
  minRating: number;              // 0..9
  genreNames: string[];
  providerIds: number[];          // ids TMDB providers
};

export const EMPTY_FILTERS: SearchFilters = {
  yearMin: null, yearMax: null, minRating: 0, genreNames: [], providerIds: [],
};

export function activeFilterCount(f: SearchFilters): number {
  let n = 0;
  if (f.yearMin) n++;
  if (f.yearMax) n++;
  if (f.minRating > 0) n++;
  if (f.genreNames.length > 0) n++;
  if (f.providerIds.length > 0) n++;
  return n;
}

type Props = {
  value: SearchFilters;
  region: string;
  onChange: (v: SearchFilters) => void;
  onClose: () => void;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = 1950;
// De la plus récente à la plus ancienne — plus intuitif dans un picker.
const YEAR_OPTIONS: number[] = [];
for (let y = CURRENT_YEAR + 3; y >= YEAR_MIN; y--) YEAR_OPTIONS.push(y);

export function FiltersSheet({ value, region, onChange, onClose }: Props) {
  const [local, setLocal] = useState<SearchFilters>(value);
  const [genres, setGenres] = useState<string[]>([]);
  const [providers, setProviders] = useState<RegionProvider[] | null>(null);

  useEffect(() => {
    Promise.all([getGenreMap('tv'), getGenreMap('movie')])
      .then(([tv, movie]) => {
        setGenres(Array.from(new Set([...tv.keys(), ...movie.keys()])).sort());
      })
      .catch(() => setGenres([]));
  }, []);

  useEffect(() => {
    getProvidersForRegion(region)
      .then((p) => setProviders(filterAllowedProviders(p)))
      .catch(() => setProviders([]));
  }, [region]);

  function apply() {
    onChange(local);
    onClose();
  }
  function reset() {
    setLocal(EMPTY_FILTERS);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="text-base font-semibold">Filtres</div>
          <button onClick={onClose} className="text-muted p-1 -m-1" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-5">
          {/* GENRES en premier */}
          <section>
            <label className="text-xs uppercase tracking-wide text-muted">Genres</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {genres.map((g) => {
                const active = local.genreNames.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() =>
                      setLocal((v) => ({
                        ...v,
                        genreNames: active ? v.genreNames.filter((x) => x !== g) : [...v.genreNames, g],
                      }))
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      active ? 'bg-accent text-white border-accent font-medium' : 'border-border text-muted'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </section>

          {/* PLATEFORMES */}
          <section>
            <label className="text-xs uppercase tracking-wide text-muted">Plateformes ({region})</label>
            {providers === null ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </div>
            ) : providers.length === 0 ? (
              <div className="mt-2 text-xs text-muted">Aucune plateforme dans cette région.</div>
            ) : (
              <div className="mt-2 grid grid-cols-6 gap-2">
                {providers.map((p) => {
                  const active = local.providerIds.includes(p.provider_id);
                  return (
                    <button
                      key={p.provider_id}
                      onClick={() =>
                        setLocal((v) => ({
                          ...v,
                          providerIds: active ? v.providerIds.filter((x) => x !== p.provider_id) : [...v.providerIds, p.provider_id],
                        }))
                      }
                      className={`relative p-1 rounded-lg border transition ${
                        active ? 'border-accent bg-accent/10' : 'border-border opacity-70'
                      }`}
                      title={p.provider_name}
                    >
                      <img
                        src={`${IMG_BASE}/w92${p.logo_path}`}
                        alt={p.provider_name}
                        className="w-full aspect-square rounded-md object-cover"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ANNÉES — <select> natifs (wheel picker iOS, dropdown Android/desktop) */}
          <section>
            <label className="text-xs uppercase tracking-wide text-muted">Année</label>
            <div className="mt-2 flex gap-2 items-center">
              <select
                value={local.yearMin ?? ''}
                onChange={(e) => setLocal((v) => ({ ...v, yearMin: e.target.value ? Number(e.target.value) : null }))}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Depuis</option>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-muted">—</span>
              <select
                value={local.yearMax ?? ''}
                onChange={(e) => setLocal((v) => ({ ...v, yearMax: e.target.value ? Number(e.target.value) : null }))}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Jusqu'à</option>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </section>

          {/* NOTE min */}
          <section>
            <label className="text-xs uppercase tracking-wide text-muted">
              Note minimum : <span className="text-text font-medium">{local.minRating.toFixed(1)}</span> / 10
            </label>
            <input
              type="range"
              min={0}
              max={9}
              step={0.5}
              value={local.minRating}
              onChange={(e) => setLocal((v) => ({ ...v, minRating: Number(e.target.value) }))}
              className="mt-2 w-full accent-[#f5c518]"
            />
          </section>
        </div>

        <div className="flex gap-2 p-3 border-t border-border">
          <button onClick={reset} className="flex-1 py-3 rounded-lg border border-border text-sm text-muted">
            Réinitialiser
          </button>
          <button onClick={apply} className="flex-1 py-3 rounded-lg bg-accent text-white text-sm font-medium">
            Appliquer{activeFilterCount(local) > 0 && ` (${activeFilterCount(local)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
