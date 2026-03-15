import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export const Auth = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        // Redirect if already logged in
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) window.location.hash = '#/dashboard';
        };
        checkUser();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            if (mode === 'register') {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password
                });
                if (signUpError) throw signUpError;
                setSuccessMsg('Registration successful! Please login.');
                setMode('login');
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (signInError) throw signInError;
                window.location.hash = '#/dashboard';
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Authentication failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleGuestPlay = async () => {
        setLoading(true);
        setError('');
        try {
            const { error: anonErr } = await supabase.auth.signInAnonymously();
            if (anonErr) throw anonErr;
            window.location.hash = '#/dashboard';
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Guest login failed'));
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', padding: '2rem' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', background: 'var(--gradient-glow)', borderRadius: '12px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28" fill="currentColor">
                        <path d="M256 0 C300 0, 316 40, 316 65 C316 90, 300 115, 256 115 C212 115, 196 90, 196 65 C196 40, 212 0, 256 0 Z M256 125 C310 125, 360 140, 420 200 C430 210, 440 240, 420 250 C400 260, 370 230, 360 230 C340 230, 330 250, 330 300 L360 490 C360 510, 310 510, 300 480 L256 320 L212 480 C202 510, 152 510, 152 490 L182 300 C182 250, 172 230, 152 230 C142 230, 112 260, 92 250 C72 240, 82 210, 92 200 C152 140, 202 125, 256 125 Z" />
                    </svg>
                </div>
                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem' }}>
                    {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    {mode === 'login' ? 'Enter your details to access your workspace.' : 'Start building your next board game project.'}
                </p>

                {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}
                {successMsg && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{successMsg}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email</label>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                background: 'rgba(0,0,0,0.2)', 
                                border: '1px solid var(--glass-border)', 
                                color: 'white', 
                                borderRadius: 'var(--radius-sm)',
                                boxSizing: 'border-box'
                            }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Password</label>
                        <input 
                            type="password" 
                            required 
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                background: 'rgba(0,0,0,0.2)', 
                                border: '1px solid var(--glass-border)', 
                                color: 'white', 
                                borderRadius: 'var(--radius-sm)',
                                boxSizing: 'border-box'
                            }} 
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ 
                            background: 'var(--text-primary)', 
                            color: 'var(--bg-primary)', 
                            padding: '0.875rem', 
                            marginTop: '0.5rem',
                            border: 'none',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--glass-border)' }} />
                    <span style={{ padding: '0 1rem', fontSize: '0.875rem' }}>OR</span>
                    <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--glass-border)' }} />
                </div>

                <button 
                    onClick={handleGuestPlay}
                    disabled={loading}
                    style={{ 
                        width: '100%', 
                        background: 'transparent', 
                        border: '1px solid var(--glass-border)', 
                        color: 'var(--text-primary)',
                        padding: '0.875rem',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    Play as Guest (View Only)
                </button>

                <p style={{ marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <button 
                        type="button"
                        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: 'var(--accent-primary)', 
                            padding: 0, 
                            fontWeight: '600',
                            textDecoration: 'underline'
                        }}
                    >
                        {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
};
