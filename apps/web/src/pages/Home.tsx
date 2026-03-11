export const Home = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Hero Section */}
            <section style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '4rem 2rem',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background decorative blobs */}
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    left: '10%',
                    width: '400px',
                    height: '400px',
                    background: 'var(--accent-primary)',
                    filter: 'blur(150px)',
                    opacity: 0.3,
                    borderRadius: '50%',
                    zIndex: 0,
                    animation: 'float 8s infinite alternate'
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '10%',
                    right: '10%',
                    width: '300px',
                    height: '300px',
                    background: 'var(--accent-secondary)',
                    filter: 'blur(120px)',
                    opacity: 0.2,
                    borderRadius: '50%',
                    zIndex: 0,
                    animation: 'float 6s infinite alternate-reverse'
                }} />

                <div className="animate-slide-up" style={{ zIndex: 1, position: 'relative', maxWidth: '800px' }}>
                    <div style={{ 
                        display: 'inline-block',
                        padding: '0.25rem 1rem',
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: 'var(--radius-full)',
                        color: 'var(--accent-primary)',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '1.5rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        The Future of Digital Tabletop
                    </div>

                    <h1 style={{ 
                        fontSize: 'clamp(3rem, 8vw, 5rem)', 
                        lineHeight: 1.1, 
                        marginBottom: '1.5rem',
                        background: 'var(--gradient-glow)',
                        backgroundSize: '200% auto',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'gradientPan 5s linear infinite'
                    }}>
                        Create, Play, and Sell Board Games.
                    </h1>
                    
                    <p style={{ 
                        fontSize: '1.25rem', 
                        color: 'var(--text-secondary)', 
                        marginBottom: '3rem',
                        maxWidth: '600px',
                        margin: '0 auto 3rem auto',
                        lineHeight: 1.6
                    }}>
                        A complete platform for independent creators to build multiplayer 
                        board games right in the browser, and for players to discover their next obsession.
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href="#/auth" style={{ 
                            padding: '1rem 2rem', 
                            background: 'var(--text-primary)', 
                            color: 'var(--bg-primary)', 
                            borderRadius: 'var(--radius-md)',
                            fontWeight: '600',
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 14px rgba(255,255,255,0.2)'
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            Start Creating <span style={{ fontSize: '1.2rem' }}>→</span>
                        </a>

                        <a href="#/marketplace" className="glass-panel" style={{ 
                            padding: '1rem 2rem', 
                            color: 'var(--text-primary)', 
                            borderRadius: 'var(--radius-md)',
                            fontWeight: '600',
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseOut={e => e.currentTarget.style.background = 'var(--glass-bg)'}
                        >
                            Browse Marketplace
                        </a>
                    </div>
                </div>
            </section>

            {/* Feature Cards */}
            <section style={{ padding: '4rem 2rem', background: 'transparent', position: 'relative', zIndex: 1 }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    
                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ width: '48px', height: '48px', background: 'var(--accent-primary)', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                            🍃
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Browser-First Editor</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Write logic, design rules, and generate AI assets directly in your browser. No local setup or heavy downloads required.
                        </p>
                    </div>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ width: '48px', height: '48px', background: 'var(--accent-secondary)', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                            ☀️
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Instant Playtests</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Generate instant live multiplayer sessions. Invite your community to playtest securely without deploying servers.
                        </p>
                    </div>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ width: '48px', height: '48px', background: 'var(--accent-tertiary)', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                            🌲
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Monetize Effortlessly</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Publish to the marketplace. Players buy once, and can host private lobbies for their friends with enforced "One friend owns" licensing.
                        </p>
                    </div>

                </div>
            </section>
        </div>
    );
};
