import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { getBestTrailer, type TmdbVideo } from '../api/tmdb';

/**
 * Vignette avec bouton "Play" — l'iframe YouTube n'est chargée qu'au clic
 * pour éviter d'imposer les cookies YT et alléger la page.
 */
export function Trailer({ mediaType, tmdbId, backdropUrl }: {
  mediaType: 'tv' | 'movie';
  tmdbId: number;
  backdropUrl: string | null;
}) {
  const [video, setVideo] = useState<TmdbVideo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBestTrailer(mediaType, tmdbId)
      .then((v) => { if (!cancelled) { setVideo(v); setLoaded(true); } })
      .catch(() => { if (!cancelled) { setVideo(null); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [mediaType, tmdbId]);

  if (!loaded) return null;
  if (!video) return <div className="text-xs text-muted">Aucun trailer trouvé.</div>;

  if (playing) {
    return (
      <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-border">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0&modestbranding=1`}
          title="Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface border border-border group"
      aria-label="Lire le trailer"
    >
      {backdropUrl && (
        <img src={backdropUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
      )}
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
          <Play size={26} fill="black" className="text-black translate-x-0.5" />
        </div>
      </div>
      <div className="absolute bottom-2 left-3 text-xs text-white/80 bg-black/50 px-2 py-0.5 rounded">
        Trailer{video.iso_639_1 ? ` · ${video.iso_639_1.toUpperCase()}` : ''}
      </div>
    </button>
  );
}
