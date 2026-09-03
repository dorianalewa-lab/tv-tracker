import { Film, Tv, ThumbsUp, ThumbsDown } from 'lucide-react';
import { posterUrl } from '../api/tmdb';
import type { MediaType, Reaction } from '../types';

type Props = {
  posterPath: string | null;
  title: string;
  year: number | null;
  mediaType: MediaType;
  voteAverage?: number | null;   // conservé dans l'API mais non affiché
  reaction?: Reaction | null;    // avis perso, badge discret
  saved?: boolean;               // badge "enregistré"
  size?: 'sm' | 'md';
  onClick?: () => void;
};

export function PosterCard({
  posterPath, title, year, mediaType, reaction, saved,
  size = 'md', onClick,
}: Props) {
  const src = posterUrl(posterPath, size === 'sm' ? 'w154' : 'w342');

  return (
    <button
      onClick={onClick}
      className="text-left w-full active:opacity-70 transition-opacity"
    >
      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-surface border border-border relative">
        {src ? (
          <img src={src} alt={title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            {mediaType === 'tv' ? <Tv size={32} /> : <Film size={32} />}
          </div>
        )}
        {saved && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center text-black text-[10px] font-bold">
            ✓
          </span>
        )}
        {reaction && (
          <span className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center ${
            reaction === 'like' ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'
          }`}>
            {reaction === 'like' ? <ThumbsUp size={12} fill="currentColor" /> : <ThumbsDown size={12} fill="currentColor" />}
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="text-sm font-medium leading-tight line-clamp-2">{title}</div>
        <div className="mt-0.5 text-xs text-muted flex items-center gap-1">
          {mediaType === 'tv' ? <Tv size={12} /> : <Film size={12} />}
          {year ?? '—'}
        </div>
      </div>
    </button>
  );
}
