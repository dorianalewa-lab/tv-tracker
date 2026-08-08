import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  getWatchProviders, IMG_BASE, pickRegion,
  type ProvidersByRegion, type WatchProvider,
} from '../api/tmdb';

type Props = {
  mediaType: 'tv' | 'movie';
  tmdbId: number;
};

const REGION_LABELS: Record<string, string> = {
  CH: 'Suisse', FR: 'France', US: 'États-Unis', BE: 'Belgique', CA: 'Canada', LU: 'Luxembourg',
};

function providerLogo(path: string) {
  return `${IMG_BASE}/w45${path}`;
}

/**
 * Affiche les plateformes où le titre est dispo, groupées par mode
 * (streaming inclus, location, achat). Rien affiché si aucune donnée.
 * Données via JustWatch (fournies par TMDB) — attribution en pied de bloc.
 */
export function WatchProviders({ mediaType, tmdbId }: Props) {
  const [data, setData] = useState<{ region: string; providers: ProvidersByRegion } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWatchProviders(mediaType, tmdbId)
      .then((r) => {
        if (cancelled) return;
        const chosen = pickRegion(r, ['CH', 'FR', 'BE', 'LU', 'US']);
        setData(chosen ? { region: chosen.region, providers: chosen.data } : null);
      })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mediaType, tmdbId]);

  if (loading) return null;

  if (!data) {
    return (
      <div className="text-xs text-muted">
        Aucune plateforme de streaming connue pour ce titre.
      </div>
    );
  }

  const { region, providers } = data;
  const flatrate = uniqueByProviderId(providers.flatrate ?? []);
  const rent = uniqueByProviderId(providers.rent ?? []);
  const buy = uniqueByProviderId(providers.buy ?? []);
  const free = uniqueByProviderId([...(providers.free ?? []), ...(providers.ads ?? [])]);
  const anything = flatrate.length + rent.length + buy.length + free.length > 0;

  if (!anything) {
    return <div className="text-xs text-muted">Aucune plateforme référencée en {REGION_LABELS[region] ?? region}.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted">
        Région : {REGION_LABELS[region] ?? region}
      </div>

      {flatrate.length > 0 && <ProviderRow label="En streaming" providers={flatrate} />}
      {free.length > 0 && <ProviderRow label="Gratuit" providers={free} />}
      {rent.length > 0 && <ProviderRow label="Location" providers={rent} />}
      {buy.length > 0 && <ProviderRow label="Achat" providers={buy} />}

      {providers.link && (
        <a
          href={providers.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Voir toutes les options <ExternalLink size={12} />
        </a>
      )}
      <div className="text-[10px] text-muted/70 italic">Source : JustWatch via TMDB</div>
    </div>
  );
}

function ProviderRow({ label, providers }: { label: string; providers: WatchProvider[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <div
            key={p.provider_id}
            className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg bg-surface border border-border"
            title={p.provider_name}
          >
            <img
              src={providerLogo(p.logo_path)}
              alt={p.provider_name}
              className="w-7 h-7 rounded-md object-cover"
              loading="lazy"
            />
            <span className="text-xs">{p.provider_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function uniqueByProviderId(list: WatchProvider[]): WatchProvider[] {
  const seen = new Set<number>();
  const out: WatchProvider[] = [];
  for (const p of list.sort((a, b) => a.display_priority - b.display_priority)) {
    if (seen.has(p.provider_id)) continue;
    seen.add(p.provider_id);
    out.push(p);
  }
  return out;
}
