import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import {
  getPersonCombinedCredits, getPersonDetails, profileUrl,
  type PersonCredit, type PersonDetails,
} from '../api/tmdb';
import { PosterCard } from '../components/PosterCard';
import { useDB } from '../hooks/useLibrary';

export function PersonScreen() {
  const { id: idParam } = useParams();
  const personId = Number(idParam);
  const db = useDB();

  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [credits, setCredits] = useState<PersonCredit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedBio, setExpandedBio] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([getPersonDetails(personId), getPersonCombinedCredits(personId)])
      .then(([p, c]) => {
        if (cancelled) return;
        setPerson(p);
        // Dédup (un acteur peut être crédité plusieurs fois sur la même série), tri par popularité.
        const seen = new Set<string>();
        const unique: PersonCredit[] = [];
        for (const cr of c.cast) {
          const key = `${cr.media_type}:${cr.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(cr);
        }
        unique.sort((a, b) => b.popularity - a.popularity);
        setCredits(unique);
      })
      .catch((e) => { if (!cancelled) setError(String((e as Error).message ?? e)); });
    return () => { cancelled = true; };
  }, [personId]);

  const owned = useMemo(() => db.items, [db]);

  if (error) {
    return (
      <div className="min-h-full pb-24 px-4 pt-4">
        <BackLink />
        <div className="text-red-400 text-sm pt-10 text-center">{error}</div>
      </div>
    );
  }
  if (!person || !credits) {
    return (
      <div className="min-h-full pb-24 flex items-center justify-center text-muted">
        <Loader2 size={20} className="animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  const bioTruncated = person.biography && person.biography.length > 250;

  return (
    <div className="min-h-full pb-24">
      <div className="px-4 pt-4">
        <BackLink />

        <div className="flex gap-4 items-center mt-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center shrink-0">
            {profileUrl(person.profile_path, 'w185') ? (
              <img src={profileUrl(person.profile_path, 'w185')!} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={36} className="text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">{person.name}</h1>
            {person.known_for_department && (
              <div className="text-xs text-muted mt-1">{translateDept(person.known_for_department)}</div>
            )}
            <div className="text-xs text-muted mt-1">
              {credits.length} apparition{credits.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {person.biography && (
          <div className="mt-4 text-sm text-muted leading-relaxed">
            <p className={expandedBio ? '' : 'line-clamp-4'}>{person.biography}</p>
            {bioTruncated && (
              <button
                onClick={() => setExpandedBio((v) => !v)}
                className="mt-1 text-accent text-xs"
              >
                {expandedBio ? 'Réduire' : 'Lire la suite'}
              </button>
            )}
          </div>
        )}

        <h2 className="mt-6 text-sm font-semibold text-muted uppercase tracking-wide mb-3">
          Filmographie
        </h2>
        {credits.length === 0 ? (
          <div className="text-muted text-sm">Aucun crédit connu.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {credits.slice(0, 60).map((c) => {
              const title = (c.media_type === 'tv' ? c.name : c.title) ?? '(sans titre)';
              const dateStr = c.media_type === 'tv' ? c.first_air_date : c.release_date;
              const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
              const owningKey = `${c.media_type}:${c.id}`;
              const owning = owned[owningKey];
              return (
                <div key={owningKey} className="relative">
                  <Link
                    to={c.media_type === 'tv' ? `/show/${c.id}` : `/movie/${c.id}`}
                    className="block"
                  >
                    <PosterCard
                      posterPath={c.poster_path}
                      title={title}
                      year={Number.isFinite(year) ? year : null}
                      mediaType={c.media_type}
                    />
                  </Link>
                  {c.character && (
                    <div className="mt-1 text-[10px] text-muted italic truncate px-0.5">
                      {c.character}
                    </div>
                  )}
                  {owning && (
                    <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/70 text-accent border border-accent/60">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-muted text-sm">
      <ArrowLeft size={16} /> Retour recherche
    </Link>
  );
}

function translateDept(dept: string): string {
  return (
    { Acting: 'Acteur/actrice', Directing: 'Réalisation', Writing: 'Scénario', Production: 'Production' }[dept] ?? dept
  );
}
