import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Trophy } from 'lucide-react';
import { pullFromCloud } from '../lib/cloudSync';
import { computeStats, formatHours, PERIOD_LABELS, type Period } from '../lib/stats';
import { computeBadges, computeLevel } from '../lib/badges';
import { posterUrl } from '../api/tmdb';
import type { DB } from '../types';

const PERIODS: Period[] = ['year', '30d', 'all'];

/**
 * Vue read-only des stats d'un ami. Utilise pullFromCloud(friendUserId)
 * (RLS garantit qu'on ne voit que la data des amis validés).
 */
export function FriendProfileScreen() {
  const { userId } = useParams();
  const [db, setDb] = useState<DB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('year');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    pullFromCloud(userId)
      .then((d) => setDb(d))
      .catch((e) => setError(String((e as Error).message ?? e)))
      .finally(() => setLoading(false));
  }, [userId]);

  const stats = useMemo(() => (db ? computeStats(db, period) : null), [db, period]);
  const level = useMemo(() => (db ? computeLevel(db) : null), [db]);
  const badges = useMemo(() => (db ? computeBadges(db).filter((b) => b.unlocked) : []), [db]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center text-muted gap-2">
        <Loader2 size={20} className="animate-spin" /> Chargement du profil…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-full pb-24 px-4 pt-4">
        <Link to="/friends" className="inline-flex items-center gap-1 text-muted text-sm">
          <ArrowLeft size={16} /> Retour amis
        </Link>
        <div className="text-red-400 text-sm text-center py-16">
          Impossible de charger : {error}
        </div>
      </div>
    );
  }
  if (!db || !stats || !level) return null;

  const maxMonthly = Math.max(1, ...stats.monthly.map((m) => m.count));
  const maxGenreHours = Math.max(0.1, ...stats.genres.map((g) => g.hours));
  const isEmpty = stats.totalEpisodes === 0 && stats.totalMovies === 0;

  return (
    <div className="min-h-full pb-24">
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-purple-600/40 via-accent/20 to-bg" />
        <Link to="/friends" className="absolute top-3 left-3 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white" aria-label="Retour">
          <ArrowLeft size={20} />
        </Link>

        <div className="px-4 -mt-12 flex items-end gap-3">
          <div className="w-20 h-20 rounded-full bg-surface border-4 border-bg flex items-center justify-center text-4xl shadow-xl shrink-0">
            {db.profile.emoji ?? '🎬'}
          </div>
          <div className="pb-2 min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight truncate">{db.profile.displayName}</h1>
            <div className="text-xs text-muted mt-0.5">
              Niveau {level.level} · {level.totalEvents} événements
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 pb-2 no-scrollbar overflow-x-auto">
        <div className="flex gap-1 min-w-max px-4">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                period === p ? 'bg-accent text-black border-accent font-medium' : 'border-border text-muted'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-purple-600/25 via-surface to-surface border border-border p-5">
          <div className="text-xs text-muted uppercase tracking-wide">Son activité</div>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <div className="text-4xl font-bold">{stats.totalEpisodes}</div>
            <div className="text-muted">épisodes</div>
            {stats.totalMovies > 0 && (
              <>
                <div className="text-4xl font-bold ml-2">{stats.totalMovies}</div>
                <div className="text-muted">film{stats.totalMovies > 1 ? 's' : ''}</div>
              </>
            )}
          </div>
          <div className="mt-1 text-muted text-sm">≈ {formatHours(stats.totalHours)} de visionnage</div>
          <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 text-sm">
            <Trophy size={16} className="text-accent" />
            Niveau <span className="font-semibold">{level.level}</span>
          </div>
        </div>

        {isEmpty && (
          <div className="text-muted text-sm text-center py-8">
            Rien à afficher pour cette période.
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="En cours" value={stats.watchingShows} />
          <MiniStat label="À voir" value={stats.plannedItems} />
          <MiniStat label="Terminées" value={stats.completedShows} />
          <MiniStat label="Lâchées" value={stats.droppedItems} />
        </div>

        {stats.genres.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Ses top genres</h2>
            <div className="space-y-2">
              {stats.genres.slice(0, 6).map((g) => (
                <div key={g.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{g.name}</span>
                    <span className="text-muted text-xs">{formatHours(g.hours)}</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-accent/80" style={{ width: `${Math.max(4, (g.hours / maxGenreHours) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isEmpty && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Son activité (12 derniers mois)</h2>
            <div className="flex items-end gap-1.5 h-32">
              {stats.monthly.map((m, i) => {
                const isBest = stats.bestMonth?.month === m.month && m.count > 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-md ${
                        m.count === 0 ? 'bg-surface' : isBest ? 'bg-accent' : 'bg-accent/50'
                      }`}
                      style={{ height: `${Math.max(4, (m.count / maxMonthly) * 100)}%` }}
                    />
                    <div className={`text-[10px] ${i % 2 === 0 ? 'text-muted' : 'text-muted/60'}`}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {stats.mostBinged && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">Son obsession</h2>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
              <div className="w-14 h-20 rounded-md overflow-hidden bg-bg border border-border shrink-0">
                {posterUrl(stats.mostBinged.item.posterPath, 'w154') && (
                  <img src={posterUrl(stats.mostBinged.item.posterPath, 'w154')!} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{stats.mostBinged.item.title}</div>
                <div className="text-xs text-muted">
                  {stats.mostBinged.count} événement{stats.mostBinged.count > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </section>
        )}

        {badges.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Ses badges · {badges.length}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {badges.map((b) => (
                <div key={b.id} className="p-3 rounded-xl border bg-surface border-accent/40">
                  <div className="flex items-start gap-2">
                    <div className="text-2xl">{b.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{b.label}</div>
                      <div className="text-[11px] text-muted leading-tight mt-0.5">{b.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-muted mt-0.5">{label}</div>
    </div>
  );
}
