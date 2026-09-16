import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Trophy, Settings, Users } from 'lucide-react';
import { useDB } from '../hooks/useLibrary';
import { computeStats, formatHours, PERIOD_LABELS, type Period } from '../lib/stats';
import { computeBadges, computeLevel, TIER_META, type BadgeTier } from '../lib/badges';

const PERIODS: Period[] = ['year', '30d', 'all'];

export function ProfileScreen() {
  const db = useDB();
  const [period, setPeriod] = useState<Period>('year');

  const stats = useMemo(() => computeStats(db, period), [db, period]);
  const level = useMemo(() => computeLevel(db), [db]);
  const badges = useMemo(() => computeBadges(db), [db]);
  const unlockedBadges = badges.filter((b) => b.unlocked);

  const isEmpty = stats.totalEpisodes === 0 && stats.totalMovies === 0;

  return (
    <div className="min-h-full pb-24">
      {/* Bannière profil */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-br from-accent/40 via-purple-600/20 to-bg" />
        <div className="absolute top-3 right-3 flex gap-2">
          <Link
            to="/friends"
            aria-label="Amis"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60"
          >
            <Users size={20} />
          </Link>
          <Link
            to="/settings"
            aria-label="Paramètres"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60"
          >
            <Settings size={20} />
          </Link>
        </div>

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

      {/* Sélecteur de période */}
      <div className="pt-4 pb-2 no-scrollbar overflow-x-auto">
        <div className="flex gap-1 min-w-max px-4">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition ${
                period === p
                  ? 'bg-accent text-black border-accent font-medium'
                  : 'border-border text-muted'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-6">
        {/* HERO stats */}
        <div className="rounded-2xl bg-gradient-to-br from-accent/25 via-surface to-surface border border-border p-5">
          <div className="text-xs text-muted uppercase tracking-wide">Sur cette période</div>
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

          <div className="mt-5 pt-4 border-t border-border/60">
            <div className="flex items-center gap-2 text-sm">
              <Trophy size={16} className="text-accent" />
              <span>
                Niveau <span className="font-semibold">{level.level}</span>
                <span className="text-muted"> · {level.totalEvents} événements totaux</span>
              </span>
            </div>
            <div className="mt-2 w-full h-2 bg-bg rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${level.progressPct}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-muted">
              {level.eventsToNext > 0
                ? `${level.eventsToNext} de plus pour le niveau ${level.level + 1}`
                : 'Niveau max atteint 🎉'}
            </div>
          </div>
        </div>

        {isEmpty && (
          <div className="text-muted text-sm text-center py-8">
            Rien à afficher pour cette période. Coche quelques épisodes pour voir tes stats apparaître.
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="En cours" value={stats.watchingShows} />
          <MiniStat label="À voir" value={stats.plannedItems} />
          <MiniStat label="Terminées" value={stats.completedShows} />
          <MiniStat label="Lâchées" value={stats.droppedItems} />
        </div>

        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Badges {unlockedBadges.length > 0 && (
              <span className="text-accent font-normal normal-case">
                · {unlockedBadges.length} / {badges.length} débloqués
              </span>
            )}
          </h2>
          <div className="space-y-4">
            {(['bronze', 'silver', 'gold', 'platinum'] as BadgeTier[]).map((tier) => {
              const tierBadges = badges.filter((b) => b.tier === tier);
              const meta = TIER_META[tier];
              const unlockedInTier = tierBadges.filter((b) => b.unlocked).length;
              return (
                <div key={tier}>
                  <div className={`flex items-center gap-2 mb-2 ${meta.textClass}`}>
                    <span className="text-xs font-semibold uppercase tracking-widest">{meta.label}</span>
                    <span className="text-[11px] text-muted">{unlockedInTier} / {tierBadges.length}</span>
                    <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${meta.color}55, transparent)` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {tierBadges.map((b) => (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border ${
                          b.unlocked
                            ? `${meta.bgClass} ${meta.borderClass}`
                            : 'bg-surface/40 border-border opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`text-2xl ${b.unlocked ? '' : 'grayscale opacity-50'}`}>{b.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{b.label}</div>
                            <div className="text-[11px] text-muted leading-tight mt-0.5">{b.description}</div>
                            {!b.unlocked && b.progress && (
                              <div className="mt-1.5">
                                <div className="h-1 bg-bg rounded-full overflow-hidden">
                                  <div
                                    className="h-full"
                                    style={{
                                      width: `${(b.progress.current / b.progress.target) * 100}%`,
                                      background: meta.color,
                                      opacity: 0.7,
                                    }}
                                  />
                                </div>
                                <div className="text-[10px] text-muted mt-0.5">{b.progress.current} / {b.progress.target}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {!isEmpty && (
          <Link
            to={`/wrapped?p=${period}`}
            className="block w-full text-center py-4 rounded-xl bg-gradient-to-br from-accent to-yellow-500 text-black font-semibold shadow-lg active:scale-[0.98] transition"
          >
            <div className="inline-flex items-center gap-2">
              <Sparkles size={18} />
              Voir ma rétrospective {PERIOD_LABELS[period]}
            </div>
          </Link>
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
