import { useState } from 'react';
import { Mail, Loader2, Check, Film } from 'lucide-react';
import { sendMagicLink, signInWithGoogle } from '../hooks/useAuth';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

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

  async function handleGoogle() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      // redirection auto via Supabase OAuth
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Connexion Google impossible');
      setGoogleBusy(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent to-accent-strong flex items-center justify-center shadow-xl mb-4">
            <Film size={30} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold">TV Tracker</h1>
          <p className="text-sm text-muted mt-1">Ta biblio de séries et films</p>
        </div>

        {status === 'sent' ? (
          <div className="text-center glass rounded-2xl p-6">
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
          <>
            {/* Google — action primaire recommandée */}
            <button
              onClick={handleGoogle}
              disabled={googleBusy}
              className="w-full inline-flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-900 font-medium text-sm shadow-sm hover:bg-gray-50 disabled:opacity-70 transition"
            >
              {googleBusy
                ? <Loader2 size={18} className="animate-spin" />
                : <GoogleIcon />}
              <span>Continuer avec Google</span>
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted uppercase">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Magic link email */}
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-5">
              <label className="text-xs text-muted uppercase tracking-wide">Ton email</label>
              <div className="relative mt-2">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="email"
                  inputMode="email"
                  enterKeyHint="go"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@exemple.ch"
                  className="w-full bg-bg border border-border rounded-xl pl-10 pr-3 py-3 outline-none focus:border-muted"
                />
              </div>

              {status === 'error' && errorMsg && (
                <div className="mt-3 text-xs text-red-400">{errorMsg}</div>
              )}

              <button
                type="submit"
                disabled={status === 'sending' || !email.trim()}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white font-semibold text-sm disabled:opacity-50"
              >
                {status === 'sending'
                  ? <><Loader2 size={16} className="animate-spin" /> Envoi…</>
                  : 'Recevoir un lien par email'}
              </button>

              <p className="mt-4 text-[11px] text-muted text-center leading-relaxed">
                Le magic link peut mettre 1-2 min à arriver — vérifie tes spams.
              </p>
            </form>

            {status === 'error' && errorMsg && !email && (
              <div className="mt-3 text-xs text-red-400 text-center">{errorMsg}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Logo Google officiel (SVG inline, 4 couleurs)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
