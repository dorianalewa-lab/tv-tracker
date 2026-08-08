import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { getCredits, profileUrl, type CastMember } from '../api/tmdb';

/** Distribution horizontale scrollable. Top 12 acteurs. */
export function CastRow({ mediaType, tmdbId }: { mediaType: 'tv' | 'movie'; tmdbId: number }) {
  const [cast, setCast] = useState<CastMember[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCredits(mediaType, tmdbId)
      .then((r) => { if (!cancelled) setCast(r.cast.slice(0, 12)); })
      .catch(() => { if (!cancelled) setCast([]); });
    return () => { cancelled = true; };
  }, [mediaType, tmdbId]);

  if (cast === null) return null;
  if (cast.length === 0) return <div className="text-xs text-muted">Distribution non renseignée.</div>;

  return (
    <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-3 min-w-max pb-1">
        {cast.map((m) => (
          <Link
            key={m.id}
            to={`/person/${m.id}`}
            className="w-20 shrink-0 text-center active:opacity-70"
          >
            <div className="w-20 h-20 rounded-full overflow-hidden glass flex items-center justify-center">
              {profileUrl(m.profile_path, 'w185') ? (
                <img src={profileUrl(m.profile_path, 'w185')!} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <User size={22} className="text-muted" />
              )}
            </div>
            <div className="mt-1.5 text-xs font-medium leading-tight line-clamp-2">{m.name}</div>
            {m.character && (
              <div className="text-[10px] text-muted italic leading-tight line-clamp-2 mt-0.5">
                {m.character}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
