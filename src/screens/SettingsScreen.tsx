import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Upload, Trash2, Loader2, Check, LogOut,
} from 'lucide-react';
import { useDB } from '../hooks/useLibrary';
import { exportDB, importDB, resetDB } from '../storage/db';
import { updateProfile } from '../storage/library';
import { getProvidersForRegion, IMG_BASE, type RegionProvider } from '../api/tmdb';
import { signOut, useAuth } from '../hooks/useAuth';
import { wipeCloudData } from '../lib/cloudSync';
import { filterAllowedProviders } from '../lib/providers';

export function SettingsScreen() {
  const db = useDB();
  const { profile } = db;
  const { user } = useAuth();

  const [providers, setProviders] = useState<RegionProvider[] | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setLoadingProviders(true);
    getProvidersForRegion(profile.region)
      .then((p) => setProviders(filterAllowedProviders(p)))
      .catch(() => setProviders([]))
      .finally(() => setLoadingProviders(false));
  }, [profile.region]);

  function flash(msg: string) {
    setSaved(msg);
    setTimeout(() => setSaved(null), 1500);
  }

  const providerIds = useMemo(() => new Set(profile.providers), [profile.providers]);

  function toggleProvider(id: number) {
    const next = providerIds.has(id)
      ? profile.providers.filter((p) => p !== id)
      : [...profile.providers, id];
    updateProfile({ providers: next });
    flash('Préférences mises à jour');
  }

  function handleExport() {
    const blob = new Blob([exportDB()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tv-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Export téléchargé');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importDB(String(reader.result));
      flash(ok ? 'Import réussi' : 'Fichier invalide');
    };
    reader.readAsText(file);
  }

  async function handleReset() {
    if (!confirm('Tout effacer : biblio, événements, cloud inclus. Cette action est irréversible. Confirmer ?')) return;
    await wipeCloudData();
    resetDB();
    flash('Données remises à zéro');
  }

  const topProviders = providers?.slice(0, 30) ?? [];

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <Link to="/profile" className="p-2 -m-2 text-muted" aria-label="Retour">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base font-semibold">Paramètres</h1>
          <span className="w-6" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Identité — emoji + nom */}
        <section className="flex items-center gap-4">
          <input
            value={profile.emoji ?? '🎬'}
            onChange={(e) => updateProfile({ emoji: e.target.value })}
            maxLength={2}
            className="w-20 h-20 text-4xl text-center bg-surface border border-border rounded-full"
          />
          <div className="flex-1 min-w-0">
            <label className="text-xs text-muted">Nom affiché</label>
            <input
              value={profile.displayName}
              onChange={(e) => updateProfile({ displayName: e.target.value })}
              className="mt-1 w-full bg-surface border border-border rounded-lg px-3 py-2 text-base outline-none focus:border-muted"
            />
          </div>
        </section>

        {/* Plateformes */}
        <section>
          <label className="text-sm font-semibold text-muted uppercase tracking-wide">
            Mes plateformes
          </label>
          <p className="mt-1 text-xs text-muted">
            Coche ce à quoi tu as accès — les suggestions et reco filtreront selon ça.
          </p>
          {loadingProviders && (
            <div className="mt-4 flex items-center gap-2 text-muted text-sm">
              <Loader2 size={16} className="animate-spin" /> Chargement des plateformes…
            </div>
          )}
          {!loadingProviders && topProviders.length === 0 && (
            <div className="mt-3 text-sm text-muted">Aucune plateforme trouvée pour cette région.</div>
          )}
          {topProviders.length > 0 && (
            <div className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
              {topProviders.map((p) => {
                const on = providerIds.has(p.provider_id);
                return (
                  <button
                    key={p.provider_id}
                    onClick={() => toggleProvider(p.provider_id)}
                    className={`relative p-1.5 rounded-xl border transition ${
                      on ? 'border-accent bg-accent/10' : 'border-border bg-surface opacity-70'
                    }`}
                    title={p.provider_name}
                  >
                    <img
                      src={`${IMG_BASE}/w92${p.logo_path}`}
                      alt={p.provider_name}
                      className="w-full aspect-square rounded-md object-cover"
                      loading="lazy"
                    />
                    <div className="text-[10px] mt-1 text-muted truncate">{p.provider_name}</div>
                    {on && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                        <Check size={12} className="text-black" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Données */}
        <section>
          <label className="text-sm font-semibold text-muted uppercase tracking-wide">
            Mes données
          </label>
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-sm"
            >
              <Download size={16} /> Exporter (JSON)
            </button>
            <label className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-sm cursor-pointer">
              <Upload size={16} /> Importer un backup
              <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-red-500/30 text-red-400 text-sm"
            >
              <Trash2 size={16} /> Tout effacer
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted italic">
            Ta biblio est synchronisée en cloud (Supabase). Tu peux te connecter depuis un autre appareil et retrouver tes données.
          </p>
        </section>

        {/* Compte */}
        <section>
          <label className="text-sm font-semibold text-muted uppercase tracking-wide">
            Compte
          </label>
          {user && (
            <div className="mt-2 text-xs text-muted">
              Connecté avec <span className="text-text">{user.email}</span>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-border text-sm text-muted"
          >
            <LogOut size={16} /> Se déconnecter
          </button>
        </section>
      </div>

      {saved && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-surface border border-border px-4 py-2 rounded-full text-sm shadow-lg z-50">
          {saved}
        </div>
      )}

    </div>
  );
}
