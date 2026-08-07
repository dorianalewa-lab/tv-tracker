import { useState } from 'react';
import { Mail, Loader2, Check, Film } from 'lucide-react';
import { sendMagicLink } from '../hooks/useAuth';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === 'sending') return;
    setStatus('sending');
    setErrorMsg(null);
    try {
      await sendMagicLink(email);
      setStatus('sent');
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Une erreur est survenue');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent to-yellow-500 flex items-center justify-center shadow-xl mb-4">
            <Film size={30} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold">TV Tracker</h1>
          <p className="text-sm text-muted mt-1">Ta biblio de séries et films</p>
        </div>

        {status === 'sent' ? (
          <div className="text-center bg-surface border border-border rounded-2xl p-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-accent/15 flex items-center justify-center mb-3">
              <Check size={24} className="text-accent" />
            </div>
            <div className="font-semibold mb-1">Vérifie tes emails</div>
            <p className="text-sm text-muted leading-relaxed">
              Un lien de connexion a été envoyé à <strong className="text-text">{email}</strong>.
              Ouvre-le depuis ce même appareil pour continuer.
            </p>
            <button
              onClick={() => { setStatus('idle'); setEmail(''); }}
              className="mt-4 text-xs text-accent"
            >
              Renvoyer / changer d'email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-5">
            <label className="text-xs text-muted uppercase tracking-wide">Ton email</label>
            <div className="relative mt-2">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="email"
                inputMode="email"
                enterKeyHint="go"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@exemple.ch"
                className="w-full bg-bg border border-border rounded-xl pl-10 pr-3 py-3 text-base outline-none focus:border-muted"
              />
            </div>

            {status === 'error' && errorMsg && (
              <div className="mt-3 text-xs text-red-400">{errorMsg}</div>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email.trim()}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-black font-semibold text-sm disabled:opacity-50"
            >
              {status === 'sending'
                ? <><Loader2 size={16} className="animate-spin" /> Envoi…</>
                : 'Recevoir le lien'}
            </button>

            <p className="mt-4 text-[11px] text-muted text-center leading-relaxed">
              Aucun mot de passe. On t'envoie un lien à cliquer, tu es connecté.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
