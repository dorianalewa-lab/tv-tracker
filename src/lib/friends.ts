import { supabase } from '../api/supabase';

export type PublicProfile = {
  id: string;
  displayName: string;
  emoji: string;
  email: string;
};

export type Friendship = {
  friendshipId: string;
  other: PublicProfile;
  status: 'pending' | 'accepted';
  role: 'requester' | 'addressee';   // ai-je envoyé la demande ou l'ai-je reçue ?
  createdAt: string;
};

/** Cherche un profil par email (case-insensitive). null si aucun. */
export async function searchProfileByEmail(email: string): Promise<PublicProfile | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, emoji, email')
    .ilike('email', clean)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name ?? 'Utilisateur',
    emoji: data.emoji ?? '🎬',
    email: data.email ?? '',
  };
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  if (!me) throw new Error('Session invalide');
  if (me === targetUserId) throw new Error('Tu ne peux pas t\'ajouter toi-même 🙃');

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: me, addressee_id: targetUserId, status: 'pending' });
  if (error) {
    // Contrainte unique violée = demande déjà envoyée
    if (error.code === '23505') throw new Error('Demande déjà envoyée à cette personne.');
    throw error;
  }
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function removeOrDeclineFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  if (error) throw error;
}

/** Toutes les relations impliquant le user courant, avec profils joints. */
export async function listFriendships(myUserId: string): Promise<Friendship[]> {
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${myUserId},addressee_id.eq.${myUserId}`)
    .in('status', ['pending', 'accepted']);
  if (error) throw error;

  const others = Array.from(new Set(
    (rows ?? []).map((r) => (r.requester_id === myUserId ? r.addressee_id : r.requester_id))
  ));
  if (others.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name, emoji, email')
    .in('id', others);
  if (pErr) throw pErr;

  const profMap = new Map<string, PublicProfile>();
  for (const p of profiles ?? []) {
    profMap.set(p.id, {
      id: p.id,
      displayName: p.display_name ?? 'Utilisateur',
      emoji: p.emoji ?? '🎬',
      email: p.email ?? '',
    });
  }

  return (rows ?? []).map((r): Friendship => {
    const isRequester = r.requester_id === myUserId;
    const otherId = isRequester ? r.addressee_id : r.requester_id;
    return {
      friendshipId: r.id,
      other: profMap.get(otherId) ?? { id: otherId, displayName: 'Inconnu', emoji: '👤', email: '' },
      status: r.status,
      role: isRequester ? 'requester' : 'addressee',
      createdAt: r.created_at,
    };
  });
}
