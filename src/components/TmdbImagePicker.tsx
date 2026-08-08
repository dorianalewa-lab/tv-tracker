import { useEffect, useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import {
  searchTitles, getMovieDetails, getTvDetails, posterUrl, backdropUrl,
} from '../api/tmdb';
import { useDebounce } from '../hooks/useDebounce';
import type { TmdbSearchResult } from '../types';

type Props = {
  mode: 'poster' | 'backdrop';
  onPick: (url: string) => void;
  onClose: () => void;
};

/**
 * Cherche des titres TMDB et permet de choisir soit un poster (mode avatar),
 * soit un backdrop (mode bannière). Pour le backdrop, on refetch les détails
 * du titre choisi car /search ne renvoie pas backdrop_path.
 */
export function TmdbImagePicker({ mode, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 350);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([searchTitles(debounced, 'movie'), searchTitles(debounced, 'tv')])
      .then(([m, t]) => {
        if (cancelled) return;
        setResults([...m, ...t].filter((r) => r.poster_path).slice(0, 40));
      })
      .catch((e) => { if (!cancelled) setError(String((e as Error).message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  async function handlePick(r: TmdbSearchResult) {
    if (mode === 'poster') {
      const url = posterUrl(r.poster_path, 'w500');
      if (url) onPick(url);
      return;
    }
    // Bannière : besoin du backdrop_path via un fetch details
    setBusy(r.id);
    try {
      const details = r.media_type === 'tv'
        ? await getTvDetails(r.id)
        : await getMovieDetails(r.id);
      const url = backdropUrl(details.backdrop_path, 'w1280');
      if (url) onPick(url);
      else setError('Ce titre n\'a pas d\'image de fond en HD, choisis-en un autre.');
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <div className="text-base font-semibold">
              {mode === 'poster' ? 'Choisir un avatar' : 'Choisir une bannière'}
            </div>
            <div className="text-xs text-muted mt-0.5">
              Cherche un film ou une série — son {mode === 'poster' ? 'affiche' : 'image de fond'} sera utilisée.
            </div>
          </div>
          <button onClick={onClose} className="text-muted p-1 -m-1" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Interstellar, Breaking Bad…"
              className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-muted"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center">
              <Loader2 size={16} className="animate-spin" /> Recherche…
            </div>
          )}
          {error && <div className="text-red-400 text-sm py-3 text-center">{error}</div>}
          {!query.trim() && !loading && (
            <div className="text-muted text-sm text-center py-8">
              Tape un titre au-dessus pour commencer.
            </div>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <div className="text-muted text-sm text-center py-8">Aucun résultat.</div>
          )}
          {results.length > 0 && (
            <div className={mode === 'poster'
              ? 'grid grid-cols-3 gap-2'
              : 'flex flex-col gap-2'
            }>
              {results.map((r) => {
                const isBusy = busy === r.id;
                if (mode === 'poster') {
                  return (
                    <button
                      key={`${r.media_type}:${r.id}`}
                      onClick={() => handlePick(r)}
                      disabled={isBusy}
                      className="aspect-[2/3] rounded-lg overflow-hidden bg-bg border border-border active:scale-95 transition disabled:opacity-60"
                      title={r.title || r.name}
                    >
                      <img src={posterUrl(r.poster_path, 'w342')!} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                }
                return (
                  <button
                    key={`${r.media_type}:${r.id}`}
                    onClick={() => handlePick(r)}
                    disabled={isBusy}
                    className="flex gap-3 items-center p-2 rounded-lg border border-border hover:bg-bg active:scale-[0.98] transition disabled:opacity-60 text-left"
                  >
                    <img src={posterUrl(r.poster_path, 'w154')!} alt="" className="w-10 h-14 rounded-md object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.title || r.name}</div>
                      <div className="text-[11px] text-muted">
                        {r.media_type === 'tv' ? 'Série' : 'Film'}
                        {(r.release_date || r.first_air_date) && ` · ${(r.release_date || r.first_air_date)!.slice(0, 4)}`}
                      </div>
                    </div>
                    {isBusy && <Loader2 size={16} className="animate-spin text-muted" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
