import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth.ts';

type AuthMode = 'choose' | 'login' | 'signup';

export function Login() {
  const { t } = useTranslation();
  const { signInAsGuest, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<AuthMode>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAsGuest();
    } catch {
      setError(t('auth.authError'));
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.authError');
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-7xl mb-3">🐾</div>
        <h1 className="text-4xl font-bold text-white mb-1">Pawmate</h1>
        <p className="text-gray-400 text-sm">{t('app.tagline')}</p>
      </div>

      {mode === 'choose' && (
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-60 rounded-2xl font-bold text-lg text-white shadow-lg active:scale-95 transition-all"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('app.loading')}</span>
              </div>
            ) : (
              <>🎮 {t('auth.guestPlay')}</>
            )}
          </button>

          <div className="text-center text-gray-500 text-sm">{t('auth.orContinueWith')}</div>

          <button onClick={() => setMode('login')} className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-2xl font-semibold transition-colors">
            ✉️ {t('auth.login')}
          </button>
          <button onClick={() => setMode('signup')} className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-2xl font-semibold transition-colors">
            🆕 {t('auth.signup')}
          </button>

          <p className="text-center text-xs text-gray-600 mt-4 px-4">{t('auth.guestWarning')}</p>
        </div>
      )}

      {(mode === 'login' || mode === 'signup') && (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <h2 className="text-xl font-bold text-center mb-4">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
          </h2>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <input
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
          <input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 rounded-2xl font-bold transition-colors active:scale-95"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('app.loading')}</span>
              </div>
            ) : mode === 'login' ? t('auth.login') : t('auth.signup')}
          </button>

          <div className="text-center text-sm text-gray-400">
            {mode === 'login' ? (
              <>{t('auth.noAccount')}{' '}<button type="button" onClick={() => setMode('signup')} className="text-purple-400 font-semibold">{t('auth.signup')}</button></>
            ) : (
              <>{t('auth.hasAccount')}{' '}<button type="button" onClick={() => setMode('login')} className="text-purple-400 font-semibold">{t('auth.login')}</button></>
            )}
          </div>
          <button type="button" onClick={() => setMode('choose')} className="w-full py-2 text-gray-500 text-sm">
            ← {t('app.back')}
          </button>
        </form>
      )}
    </div>
  );
}
