import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { posterUrl } from '../api/tmdb';
import type { TmdbSearchResult } from '../types';

type Props = {
  title: string;
  items: TmdbSearchResult[];
  viewAllHref?: string;      // active le bouton "Tout voir"
};

export function TrendingRow({ title, items, viewAllHref }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3 px-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          {title}
        </h2>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="inline-flex items-center gap-0.5 text-xs text-accent"
          >
            Tout voir <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-3 min-w-max px-4 pb-1">
          {items.map((r) => {
            const t = r.media_type === 'tv' ? 'tv' : 'movie';
            const label = (r.title || r.name) ?? '(sans titre)';
            const dateStr = r.release_date || r.first_air_date;
            const year = dateStr ? dateStr.slice(0, 4) : null;
            return (
              <Link
                key={`${t}:${r.id}`}
                to={t === 'tv' ? `/show/${r.id}` : `/movie/${r.id}`}
                className="w-28 shrink-0"
              >
                <div className="w-28 aspect-[2/3] rounded-lg overflow-hidden glass">
                  {posterUrl(r.poster_path, 'w342') ? (
                    <img src={posterUrl(r.poster_path, 'w342')!} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="mt-1.5 text-xs font-medium leading-tight line-clamp-2">{label}</div>
                {year && <div className="text-[10px] text-muted">{year}</div>}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
