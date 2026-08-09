import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDB } from '../hooks/useLibrary';
import { removeItem } from '../storage/library';
import { PosterCard } from '../components/PosterCard';
import { SwipeableCard } from '../components/SwipeableCard';
import type { LibraryItem, Status } from '../types';

const TABS: { status: Status; label: string }[] = [
  { status: 'watching',  label: 'En cours' },
  { status: 'planned',   label: 'À voir' },
  { status: 'completed', label: 'Terminé' },
];

export function LibraryScreen() {
  const db = useDB();
  const [tab, setTab] = useState<Status>('watching');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

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
          <>
            <div className="text-[11px] text-muted mb-3 italic">
              Astuce : balaye une carte vers la gauche pour la retirer.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((it) => (
                <SwipeableCard
                  key={it.id}
                  isOpen={openSwipeId === it.id}
                  onOpen={() => setOpenSwipeId(it.id)}
                  onCloseRequest={() => setOpenSwipeId(null)}
                  onDelete={() => { removeItem(it.id); setOpenSwipeId(null); }}
                >
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
                </SwipeableCard>
              ))}
            </div>
          </>
        )}
      </div>
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
