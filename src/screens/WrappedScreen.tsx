import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import { useDB } from '../hooks/useLibrary';
import { computeStats, formatHours, PERIOD_LABELS, type Period } from '../lib/stats';
import { computeBadges, computeLevel } from '../lib/badges';
import { posterUrl } from '../api/tmdb';

export function WrappedScreen() {
  const db = useDB();
  const [params] = useSearchParams();
  const period = (params.get('p') as Period) || 'year';

  const stats = useMemo(() => computeStats(db, period), [db, period]);
  const level = useMemo(() => computeLevel(db), [db]);
  const badges = useMemo(() => computeBadges(db).filter((b) => b.unlocked), [db]);

  const topGenre = stats.genres[0] ?? null;

  const isEmpty = stats.totalEpisodes === 0 && stats.totalMovies === 0;

  return (
    <div className="min-h-full bg-bg">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-bg/95 backdrop-blur border-b border-border">
        <div className="text-sm font-medium flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          Ta rétro · {PERIOD_LABELS[period]}
        </div>
        <Link to="/stats" className="p-2 -m-2 text-muted" aria-label="Fermer">
          <X size={20} />
        </Link>
      </div>

      {isEmpty ? (
        <div className="text-muted text-sm text-center py-20 px-4">
          Il faut d'abord cocher quelques épisodes pour générer une rétrospective.
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          <Card gradient="from-purple-600/60 to-pink-500/40">
            <div className="text-xs uppercase tracking-widest opacity-80">Le grand chiffre</div>
            <div className="mt-2 text-6xl font-black leading-none">
              {stats.totalEpisodes + stats.totalMovies}
            </div>
            <div className="mt-1 text-lg opacity-90">titres vus</div>
            <div className="mt-4 text-sm opacity-80">
              soit environ <strong>{formatHours(stats.totalHours)}</strong> passées devant l'écran.
            </div>
            {stats.totalHours >= 1 && (
              <div className="mt-2 text-xs opacity-70 italic">
                {funHoursComment(stats.totalHours)}
              </div>
            )}
          </Card>

          {topGenre && (
            <Card gradient="from-emerald-500/60 to-teal-500/40">
              <div className="text-xs uppercase tracking-widest opacity-80">Ton genre du moment</div>
              <div className="mt-2 text-4xl font-bold">{topGenre.name}</div>
              <div className="mt-1 text-sm opacity-90">
                {formatHours(topGenre.hours)} · {topGenre.count} épisodes
              </div>
              {stats.genres.length > 1 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {stats.genres.slice(1, 5).map((g) => (
                    <span
                      key={g.name}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-black/30"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          {stats.mostBinged && (
            <Card gradient="from-amber-500/70 to-orange-500/50">
              <div className="text-xs uppercase tracking-widest opacity-80">Ta série obsession</div>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-20 h-28 rounded-lg overflow-hidden bg-black/30 shrink-0 shadow-lg">
                  {posterUrl(stats.mostBinged.item.posterPath, 'w154') && (
                    <img
                      src={posterUrl(stats.mostBinged.item.posterPath, 'w154')!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold leading-tight">{stats.mostBinged.item.title}</div>
                  <div className="mt-1 text-sm opacity-90">
                    {stats.mostBinged.count} épisode{stats.mostBinged.count > 1 ? 's' : ''} vus
                  </div>
                </div>
              </div>
            </Card>
          )}

          {stats.bestMonth && stats.bestMonth.count > 0 && (
            <Card gradient="from-sky-500/60 to-indigo-500/50">
              <div className="text-xs uppercase tracking-widest opacity-80">Ton mois record</div>
              <div className="mt-2 text-5xl font-bold">{stats.bestMonth.label}</div>
              <div className="mt-1 text-sm opacity-90">
                {stats.bestMonth.count} événements — un vrai marathon.
              </div>
            </Card>
          )}

          <Card gradient="from-yellow-400/70 to-amber-500/50">
            <div className="text-xs uppercase tracking-widest opacity-80">Ton niveau</div>
            <div className="mt-2 text-6xl font-black leading-none">Nv. {level.level}</div>
            <div className="mt-2 text-sm opacity-90">
              {level.totalEvents} événements enregistrés depuis le début.
            </div>
            {level.eventsToNext > 0 && (
              <div className="mt-1 text-xs opacity-75">
                Plus que {level.eventsToNext} pour le niveau {level.level + 1}.
              </div>
            )}
          </Card>

          {badges.length > 0 && (
            <Card gradient="from-rose-500/60 to-fuchsia-500/40">
              <div className="text-xs uppercase tracking-widest opacity-80">
                Badges débloqués · {badges.length}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {badges.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/25">
                    <div className="text-2xl">{b.emoji}</div>
                    <div className="text-xs font-medium leading-tight">{b.label}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="pt-6 pb-16 text-center">
            <div className="text-muted text-sm">Encore plein d'épisodes à découvrir.</div>
            <Link
              to="/"
              className="mt-3 inline-block px-4 py-2 rounded-full border border-border text-sm text-muted"
            >
              Chercher quelque chose de nouveau
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  children,
  gradient,
}: {
  children: React.ReactNode;
  gradient: string;
}) {
  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-5 overflow-hidden text-white shadow-lg`}
    >
      {/* Overlay léger pour ancrer le blanc sur les gradients clairs */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      <div className="relative">{children}</div>
    </div>
  );
}

function funHoursComment(h: number): string {
  const days = h / 24;
  if (days < 0.5) return 'Un plateau apéro de visionnage.';
  if (days < 1) return "Presque une journée pleine à ne rien faire d'autre.";
  if (days < 3) return `Soit ${days.toFixed(1)} jours non-stop devant l'écran.`;
  if (days < 7) return `Une semaine de vacances entière, tu vois le tableau ?`;
  return `Plus de ${Math.round(days)} jours cumulés — c'est du sérieux.`;
}
