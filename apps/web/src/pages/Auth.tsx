import { useState, useEffect, useRef, type CSSProperties, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AppPageFrame } from '../components/AppPageFrame';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function canUseLocalDevAccount(): boolean {
  if (!import.meta.env.DEV || !LOOPBACK_HOSTS.has(window.location.hostname)) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(import.meta.env.VITE_SUPABASE_URL || '').hostname);
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  background: '#fffdf6',
  border: '1px solid rgba(15,118,110,0.24)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
  fontSize: '0.95rem',
};

const secondaryButtonStyle: CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px solid var(--glass-border)',
  color: 'var(--text-primary)',
  padding: '0.875rem',
  borderRadius: 'var(--radius-sm)',
};

export const Auth = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const mounted = useRef(true);
  const requestBusy = useRef(false);
  const showLocalDevAccount = canUseLocalDevAccount();

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    const checkUser = async () => {
      try {
        const {
          data: { user },
          error: sessionError,
        } = await supabase.auth.getUser();
        // A visitor without a session belongs on this form. Existing guests
        // also need the form to upgrade to a regular account.
        if (sessionError && sessionError.name !== 'AuthSessionMissingError') throw sessionError;
        if (!cancelled && user && !user.is_anonymous) window.location.hash = '#/dashboard';
      } catch {
        if (!cancelled && !requestBusy.current) {
          setError('Could not check your current sign-in. You can still sign in below.');
        }
      }
    };
    void checkUser();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  const signInWithCredentials = async (loginEmail: string, loginPassword: string) => {
    if (requestBusy.current) return;
    requestBusy.current = true;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (signInError) throw signInError;
      if (mounted.current) window.location.hash = '#/dashboard';
    } catch (cause) {
      if (mounted.current) setError(getErrorMessage(cause, 'Sign-in failed. Please try again.'));
    } finally {
      requestBusy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'login') {
      await signInWithCredentials(email, password);
      return;
    }
    if (requestBusy.current) return;
    requestBusy.current = true;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUpError) throw signUpError;
      if (mounted.current) {
        setSuccessMsg('Registration successful! Please sign in.');
        setMode('login');
      }
    } catch (cause) {
      if (mounted.current) setError(getErrorMessage(cause, 'Registration failed. Please try again.'));
    } finally {
      requestBusy.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <AppPageFrame
      frameStyle={{ display: 'grid', placeItems: 'center', padding: '1.25rem' }}
      contentStyle={{
        maxWidth: '440px',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Bounded sign-in card; its form body scrolls while the identity and footer stay visible. */}
      <div
        data-layout="authCard"
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '780px',
          minHeight: 0,
          textAlign: 'center',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '1.5rem 1.5rem 0.75rem', flex: '0 0 auto' }}>
          {/* Existing meeple identity, kept separate from the scrolling form. */}
          <div
            data-layout="authMeepleBadge"
            style={{
              width: '48px',
              height: '48px',
              background: 'var(--gradient-glow)',
              borderRadius: '12px',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 512 512"
              width="28"
              height="28"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M256 0 C300 0, 316 40, 316 65 C316 90, 300 115, 256 115 C212 115, 196 90, 196 65 C196 40, 212 0, 256 0 Z M256 125 C310 125, 360 140, 420 200 C430 210, 440 240, 420 250 C400 260, 370 230, 360 230 C340 230, 330 250, 330 300 L360 490 C360 510, 310 510, 300 480 L256 320 L212 480 C202 510, 152 510, 152 490 L182 300 C182 250, 172 230, 152 230 C142 230, 112 260, 92 250 C72 240, 82 210, 92 200 C152 140, 202 125, 256 125 Z" />
            </svg>
          </div>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem' }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
            {mode === 'login'
              ? 'Enter your details to access your workspace.'
              : 'Start building your next board game project.'}
          </p>
        </header>

        {/* Errors, credentials, and local account shortcut share the bounded scrolling body. */}
        <div
          data-layout="authFormBody"
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0.75rem 1.5rem 1rem' }}
        >
          {error && (
            <p
              role="alert"
              style={{
                background: 'rgba(239,68,68,0.08)',
                color: '#a33b32',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                margin: '0 0 1rem',
                border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </p>
          )}
          {successMsg && (
            <p
              role="status"
              style={{
                background: 'rgba(16,185,129,0.1)',
                color: '#065f46',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                margin: '0 0 1rem',
                fontSize: '0.85rem',
              }}
            >
              {successMsg}
            </p>
          )}
          <form
            onSubmit={handleSubmit}
            aria-busy={loading}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}
          >
            {/* Email label is explicitly bound for browser autofill and assistive technology. */}
            <div data-layout="authEmailField">
              <label
                htmlFor="auth-email"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.25rem',
                }}
              >
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={inputStyle}
              />
            </div>
            {/* Password autocomplete follows the current sign-in or registration mode. */}
            <div data-layout="authPasswordField">
              <label
                htmlFor="auth-password"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '0.25rem',
                }}
              >
                Password
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                disabled={loading}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                padding: '0.875rem',
                marginTop: '0.25rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
          {import.meta.env.DEV && showLocalDevAccount && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode('login');
                setEmail('dev@turnbased.local');
                setPassword('');
                void signInWithCredentials('dev@turnbased.local', 'dev-local-only');
              }}
              style={{
                ...secondaryButtonStyle,
                background: 'rgba(16,185,129,0.06)',
                marginTop: '1rem',
                opacity: loading ? 0.7 : 1,
              }}
            >
              Use local dev account
            </button>
          )}
        </div>

        <footer
          style={{
            flex: '0 0 auto',
            padding: '1rem 1.5rem 1.25rem',
            borderTop: '1px solid var(--glass-border)',
          }}
        >
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              window.location.hash = '#/dashboard';
            }}
            style={{ ...secondaryButtonStyle, opacity: loading ? 0.7 : 1 }}
          >
            Continue without signing in
          </button>
          <p style={{ margin: '1.1rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0f766e',
                padding: 0,
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </footer>
      </div>
    </AppPageFrame>
  );
};
