import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, Check, X, Loader2, Mail, Trash2, Search, ChevronRight } from 'lucide-react';
import {
  acceptFriendRequest, listFriendships, removeOrDeclineFriendship,
  searchProfileByEmail, sendFriendRequest,
  type Friendship, type PublicProfile,
} from '../lib/friends';
import { useAuth } from '../hooks/useAuth';

export function FriendsScreen() {
  const { user } = useAuth();
  const [friendships, setFriendships] = useState<Friendship[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function reload() {
    if (!user) return;
    try {
      const list = await listFriendships(user.id);
      setFriendships(list);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const received = (friendships ?? []).filter((f) => f.status === 'pending' && f.role === 'addressee');
  const sent = (friendships ?? []).filter((f) => f.status === 'pending' && f.role === 'requester');
  const friends = (friendships ?? []).filter((f) => f.status === 'accepted');

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-10 glass-bar border-b">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <Link to="/profile" className="p-2 -m-2 text-muted" aria-label="Retour">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base font-semibold">Amis</h1>
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Ajouter un ami"
            className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {friendships === null && (
          <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center py-4">{error}</div>
        )}

        {received.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Demandes reçues · {received.length}
            </h2>
            <div className="space-y-2">
              {received.map((f) => (
                <div key={f.friendshipId} className="flex items-center gap-3 p-3 rounded-xl glass" style={{ borderColor: 'rgba(167,139,250,0.3)' }}>
                  <Avatar profile={f.other} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{f.other.displayName}</div>
                    <div className="text-[11px] text-muted truncate">{f.other.email}</div>
                  </div>
                  <button
                    onClick={async () => { await removeOrDeclineFriendship(f.friendshipId); reload(); }}
                    aria-label="Refuser"
                    className="w-10 h-10 rounded-full bg-bg border border-border text-muted flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={async () => { await acceptFriendRequest(f.friendshipId); reload(); }}
                    aria-label="Accepter"
                    className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center"
                  >
                    <Check size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {friendships !== null && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Mes amis {friends.length > 0 && `· ${friends.length}`}
            </h2>
            {friends.length === 0 ? (
              <div className="text-muted text-sm text-center py-10">
                Tu n'as pas encore d'ami. Tap le bouton en haut pour en ajouter.
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => (
                  <div key={f.friendshipId} className="flex items-center gap-3 p-2 rounded-xl glass">
                    <Link to={`/friend/${f.other.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar profile={f.other} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{f.other.displayName}</div>
                        <div className="text-[11px] text-muted truncate">{f.other.email}</div>
                      </div>
                      <ChevronRight size={18} className="text-muted shrink-0" />
                    </Link>
                    <button
                      onClick={async () => {
                        if (confirm(`Retirer ${f.other.displayName} de tes amis ?`)) {
                          await removeOrDeclineFriendship(f.friendshipId); reload();
                        }
                      }}
                      aria-label="Retirer"
                      className="w-8 h-8 rounded-full text-muted flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {sent.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Envoyées · en attente
            </h2>
            <div className="space-y-2">
              {sent.map((f) => (
                <div key={f.friendshipId} className="flex items-center gap-3 p-3 rounded-xl glass opacity-80">
                  <Avatar profile={f.other} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{f.other.displayName}</div>
                    <div className="text-[11px] text-muted truncate">{f.other.email}</div>
                  </div>
                  <button
                    onClick={async () => { await removeOrDeclineFriendship(f.friendshipId); reload(); }}
                    className="text-xs text-muted px-3 py-1.5 rounded-md border border-border"
                  >
                    Annuler
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {addOpen && (
        <AddFriendSheet
          myUserId={user?.id ?? ''}
          onClose={() => setAddOpen(false)}
          onSent={() => { reload(); setAddOpen(false); }}
        />
      )}
    </div>
  );
}

function Avatar({ profile }: { profile: PublicProfile }) {
  return (
    <div className="w-11 h-11 rounded-full bg-bg border border-border flex items-center justify-center text-xl shrink-0">
      {profile.emoji}
    </div>
  );
}

function AddFriendSheet({ myUserId, onClose, onSent }: { myUserId: string; onClose: () => void; onSent: () => void }) {
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<PublicProfile | null | 'none'>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || searching) return;
    setSearching(true);
    setFound(null);
    setError(null);
    try {
      const p = await searchProfileByEmail(email);
      if (!p) setFound('none');
      else if (p.id === myUserId) { setFound('none'); setError('C\'est toi 🙃'); }
      else setFound(p);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSearching(false);
    }
  }

  async function handleSend() {
    if (!found || found === 'none') return;
    setSending(true);
    setError(null);
    try {
      await sendFriendRequest(found.id);
      onSent();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm bg-surface border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="text-base font-semibold">Ajouter un ami</div>
          <button onClick={onClose} className="text-muted p-1 -m-1" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSearch}>
          <label className="text-xs text-muted uppercase tracking-wide">Email de l'ami</label>
          <div className="relative mt-2">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFound(null); setError(null); }}
              placeholder="ami@exemple.ch"
              className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-muted"
            />
          </div>
          <button
            type="submit"
            disabled={!email.trim() || searching}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm text-muted disabled:opacity-40"
          >
            {searching ? <><Loader2 size={14} className="animate-spin" /> Recherche…</> : <><Search size={14} /> Chercher</>}
          </button>
        </form>

        {error && <div className="mt-3 text-xs text-red-400">{error}</div>}

        {found === 'none' && !error && (
          <div className="mt-3 text-sm text-muted text-center py-3">
            Aucun user trouvé avec cet email. Il doit d'abord se créer un compte sur l'app.
          </div>
        )}

        {found && found !== 'none' && (
          <div className="mt-4 p-3 rounded-xl bg-bg border border-border flex items-center gap-3">
            <Avatar profile={found} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{found.displayName}</div>
              <div className="text-[11px] text-muted truncate">{found.email}</div>
            </div>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
            >
              {sending ? '…' : 'Inviter'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
