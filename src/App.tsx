import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { SearchScreen } from './screens/SearchScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { ShowDetailScreen } from './screens/ShowDetailScreen';
import { MovieDetailScreen } from './screens/MovieDetailScreen';
import { PersonScreen } from './screens/PersonScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WrappedScreen } from './screens/WrappedScreen';
import { RecommendationsScreen } from './screens/RecommendationsScreen';
import { AskScreen } from './screens/AskScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { LoginScreen } from './screens/LoginScreen';
import { FriendsScreen } from './screens/FriendsScreen';
import { FriendProfileScreen } from './screens/FriendProfileScreen';
import { useAuth } from './hooks/useAuth';
import { setSaveHook, setDBSilent } from './storage/db';
import { pullFromCloud, pushDebounced, setSyncUser } from './lib/cloudSync';

export default function App() {
  const { user, loading } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Login/logout : gère la synchro cloud
  useEffect(() => {
    if (!user) {
      // Logout : coupe la synchro cloud, vide le cache local pour éviter
      // qu'un prochain user voie les données du précédent sur le même browser.
      setSaveHook(null);
      setSyncUser(null);
      setDBSilent({
        version: 4,
        items: {},
        watchEvents: [],
        profile: { displayName: 'Toi', emoji: '🎬', region: 'CH', providers: [] },
        meta: { level: 1, unlockedBadges: [] },
      });
      return;
    }

    // Login : pull cloud → hydrate cache → active le push automatique
    let cancelled = false;
    setSyncing(true);
    setSyncError(null);
    setSyncUser(user.id);

    pullFromCloud(user.id)
      .then((db) => {
        if (cancelled) return;
        setDBSilent(db);              // pas de push : c'est ce qu'on vient de recevoir
        setSaveHook(() => pushDebounced());
      })
      .catch((e) => {
        if (cancelled) return;
        setSyncError(String((e as Error).message ?? e));
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  if (loading || (user && syncing)) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center text-muted gap-3">
        <Loader2 size={22} className="animate-spin" />
        {user && syncing && <div className="text-sm">Chargement de tes données…</div>}
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (syncError) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="text-red-400 text-sm">Erreur de synchro : {syncError}</div>
        <div className="text-xs text-muted">Vérifie ta connexion et recharge la page.</div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<SearchScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/show/:id" element={<ShowDetailScreen />} />
          <Route path="/movie/:id" element={<MovieDetailScreen />} />
          <Route path="/person/:id" element={<PersonScreen />} />
          <Route path="/ask" element={<AskScreen />} />
          <Route path="/reco" element={<RecommendationsScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/wrapped" element={<WrappedScreen />} />
          <Route path="/explore/:kind" element={<ExploreScreen />} />
          <Route path="/catalog/:mediaType" element={<CatalogScreen />} />
          <Route path="/friends" element={<FriendsScreen />} />
          <Route path="/friend/:userId" element={<FriendProfileScreen />} />
          <Route path="/stats" element={<Navigate to="/profile" replace />} />
          <Route path="/playlist/*" element={<Navigate to="/library" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
