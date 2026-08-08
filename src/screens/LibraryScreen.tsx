import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, MoreVertical } from 'lucide-react';
import { useDB } from '../hooks/useLibrary';
import { removeItem } from '../storage/library';
import { PosterCard } from '../components/PosterCard';
import type { LibraryItem, Status } from '../types';

const TABS: { status: Status; label: string }[] = [
  { status: 'watching',  label: 'En cours' },
  { status: 'planned',   label: 'À voir' },
  { status: 'completed', label: 'Terminé' },
];

export function LibraryScreen() {
  const db = useDB();
  const [tab, setTab] = useState<Status>('watching');
  const [menuFor, setMenuFor] = useState<LibraryItem | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Status, LibraryItem[]> = { planned: [], watching: [], completed: [], dropped: [] };
    for (const it of Object.values(db.items)) g[it.status].push(it);
    for (const k of Object.keys(g) as Status[]) {
      g[k].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }
    return g;
  }, [db]);

  const items = grouped[tab];

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-bold">Ma bibliothèque</h1>
        </div>

        <div className="px-2 pb-2 no-scrollbar overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map((t) => {
              const count = grouped[t.status].length;
              const active = tab === t.status;
              return (
                <button
                  key={t.status}
                  onClick={() => setTab(t.status)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                    active
                      ? 'bg-accent text-black border-accent font-medium'
                      : 'border-border text-muted'
                  }`}
                >
                  {t.label} {count > 0 && <span className="opacity-70">· {count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {items.length === 0 ? (
          <EmptyState status={tab} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((it) => (
              <div key={it.id} className="relative">
                <Link
                  to={it.mediaType === 'tv' ? `/show/${it.tmdbId}` : `/movie/${it.tmdbId}`}
                  className="block"
                >
                  <PosterCard
                    posterPath={it.posterPath}
                    title={it.title}
                    year={it.year}
                    mediaType={it.mediaType}
                    voteAverage={it.voteAverage}
                  />
                </Link>
                <button
                  onClick={() => setMenuFor(it)}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/60 text-white"
                  aria-label="Options"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {menuFor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setMenuFor(null)}>
          <div
            className="w-full sm:max-w-sm bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border font-semibold truncate">{menuFor.title}</div>
            <button
              onClick={() => {
                if (confirm(`Retirer "${menuFor.title}" de la biblio ?`)) {
                  removeItem(menuFor.id); setMenuFor(null);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-red-400 hover:bg-bg"
            >
              <Trash2 size={18} />
              Retirer de la biblio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ status }: { status: Status }) {
  const msg: Record<Status, string> = {
    watching:  'Rien en cours. Ajoute une série depuis la recherche.',
    planned:   'Ta liste "à voir" est vide.',
    completed: 'Aucun titre terminé pour le moment.',
    dropped:   'Rien d\'abandonné.',
  };
  return <div className="text-muted text-sm py-16 text-center">{msg[status]}</div>;
}
