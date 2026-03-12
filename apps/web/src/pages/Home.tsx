import { useEffect, useRef, useState, useCallback } from 'react';
import { ForestWorld } from '../components/ForestScene';
import { Loader } from '../components/Loader';

/* ── Scroll-reveal hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(40px)',
      transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

/* ── Feature card ── */
function FeatureCard({ icon, title, children, accent }: { icon: string; title: string; children: React.ReactNode; accent: string }) {
  return (
    <div style={{
      padding: '2.5rem 2rem',
      display: 'flex', flexDirection: 'column', gap: '1rem',
      transition: 'transform 0.3s, box-shadow 0.3s',
      cursor: 'default',
      background: 'rgba(255,255,255,0.88)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid rgba(16,185,129,0.15)',
      boxShadow: '0 8px 32px rgba(6,78,59,0.10)',
    }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${accent}30`; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(6,78,59,0.10)'; }}
    >
      <div style={{
        width: '56px', height: '56px', background: accent,
        borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem', boxShadow: `0 4px 16px ${accent}40`,
      }}>{icon}</div>
      <h3 style={{ fontSize: '1.35rem', margin: 0, color: '#064e3b' }}>{title}</h3>
      <div style={{ color: '#0f766e', lineHeight: 1.7, margin: 0, fontSize: '0.95rem' }}>{children}</div>
    </div>
  );
}

/* ── Step card ── */
function StepCard({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', gap: '1.5rem', alignItems: 'flex-start',
      padding: '1.5rem 2rem',
      background: 'rgba(255,255,255,0.88)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid rgba(16,185,129,0.15)',
      boxShadow: '0 8px 32px rgba(6,78,59,0.10)',
    }}>
      <div style={{
        width: '48px', height: '48px', minWidth: '48px',
        borderRadius: '50%', background: 'var(--gradient-primary)',
        color: 'white', fontFamily: 'Outfit, sans-serif', fontWeight: 800,
        fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
      }}>{num}</div>
      <div>
        <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.35rem 0', color: '#064e3b' }}>{title}</h4>
        <p style={{ color: '#0f766e', lineHeight: 1.7, margin: 0 }}>{desc}</p>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════ */
/*  HOME PAGE                                     */
/* ══════════════════════════════════════════════ */
export const Home = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = document.documentElement;
    const scrollTop = el.scrollTop || document.body.scrollTop;
    const scrollHeight = el.scrollHeight - el.clientHeight;
    if (scrollHeight > 0) {
      setScrollProgress(Math.min(scrollTop / scrollHeight, 1));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    requestAnimationFrame(handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <>
      {/* Loading screen */}
      <Loader onReady={sceneReady} />

      {/* Fixed Three.js background */}
      <ForestWorld scrollProgress={scrollProgress} onReady={() => setSceneReady(true)} />

      {/* Scrollable HTML content on top */}
      <div ref={containerRef} style={{ position: 'relative', zIndex: 1 }}>

        {/* ─── HERO ─── */}
        <section style={{
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start',
          padding: '12vh 2rem 4rem 2rem',
          textAlign: 'center',
        }}>
          <div className="animate-slide-up" style={{ maxWidth: '800px' }}>
            <h1 style={{
              fontSize: 'clamp(2.4rem, 7vw, 4.2rem)',
              lineHeight: 1.1, marginBottom: '1.25rem',
              fontFamily: 'Outfit, sans-serif', fontWeight: 800,
              color: '#064e3b',
            }}>
              Welcome to Your Home for<br />Everything <span style={{
                background: 'linear-gradient(90deg, #f97316, #facc15, #fb923c)',
                backgroundSize: '200% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'gradientPan 5s linear infinite',
              }}>TurnBased</span>.
            </h1>

            <p style={{
              fontSize: '1.2rem', color: 'white',
              maxWidth: '580px', margin: '0 auto 2.5rem auto',
              lineHeight: 1.7, fontWeight: 500,
              textShadow: '0 1px 6px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.15)',
            }}>
              Create, Iterate, Playtest, Sell and Play Board Games
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#/auth" id="cta-start" style={{
                padding: '1rem 2.2rem',
                background: '#064e3b', color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '1.05rem',
                display: 'inline-flex', alignItems: 'center',
                boxShadow: '0 4px 20px rgba(6,78,59,0.35)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(6,78,59,0.45)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(6,78,59,0.35)'; }}
              >
                Start Creating
              </a>

              <a href="#/marketplace" id="cta-browse" style={{
                padding: '1rem 2.2rem',
                color: '#064e3b',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '1.05rem',
                display: 'inline-flex', alignItems: 'center',
                transition: 'background 0.2s, transform 0.2s',
                background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(16,185,129,0.25)',
                boxShadow: '0 4px 16px rgba(6,78,59,0.12)',
              }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Browse Games
              </a>
            </div>
          </div>

        </section>

        {/* ─── FEATURES ─── */}
        <section style={{ padding: '5rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <RevealSection>
              <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h2 style={{
                  fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800,
                  marginBottom: '0.8rem', color: 'white',
                  textShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.15)',
                }}>
                  Everything You Need to Build
                </h2>
              </div>
            </RevealSection>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
              <RevealSection delay={0.1}>
                <FeatureCard icon="🍃" title="AI-Powered Browser Editor" accent="#10b981">
                  <p style={{ margin: 0 }}>
                    Write game logic, design rules, and generate assets — all in your browser. No downloads required.
                    Built-in AI agents help you code, write rules text, and create art.
                  </p>
                </FeatureCard>
              </RevealSection>
              <RevealSection delay={0.2}>
                <FeatureCard icon="☀️" title="Instant Playtests" accent="#eab308">
                  <p style={{ margin: 0 }}>
                    Generate live multiplayer sessions in one click. Invite your community to test without deploying any servers. Guest testers can join without an account.
                  </p>
                </FeatureCard>
              </RevealSection>
              <RevealSection delay={0.3}>
                <FeatureCard icon="🌲" title="Monetize Effortlessly" accent="#84cc16">
                  <p style={{ margin: 0 }}>
                    Publish to the marketplace. Players buy once and host lobbies for friends with "one friend owns" licensing — game night stays effortless.
                  </p>
                </FeatureCard>
              </RevealSection>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section style={{ padding: '5rem 2rem' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <RevealSection>
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800,
                textAlign: 'center', marginBottom: '3rem', color: 'white',
                textShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.15)',
              }}>
                From Idea to Game Night in Minutes
              </h2>
            </RevealSection>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <RevealSection delay={0.1}>
                <StepCard num={1} title="Pick a Template" desc="Choose from hand-crafted quickstart templates — card games, grid movers, party games, and more. Each comes pre-wired with multiplayer and an instant preview." />
              </RevealSection>
              <RevealSection delay={0.2}>
                <StepCard num={2} title="Edit in the Browser" desc="Use the built-in code editor and AI assistant to modify rules, generate art assets, and tweak game logic. Commit changes with one click." />
              </RevealSection>
              <RevealSection delay={0.3}>
                <StepCard num={3} title="Invite & Playtest" desc="Generate a shareable link. Friends join your multiplayer room instantly — no accounts required for guest testers." />
              </RevealSection>
              <RevealSection delay={0.4}>
                <StepCard num={4} title="Publish & Sell" desc="List your game on the TurnBased marketplace. Players purchase access, and our 'one friend owns' model means game night stays effortless." />
              </RevealSection>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section style={{ padding: '6rem 2rem', textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RevealSection>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 800,
                marginBottom: '1rem', color: '#064e3b',
                textShadow: '0 2px 12px rgba(255,255,255,0.6)',
              }}>
                Ready to Build Something Magical?
              </h2>
              <p style={{
                color: 'white', fontSize: '1.1rem',
                maxWidth: '500px', margin: '0 auto 2.5rem auto',
                lineHeight: 1.7, fontWeight: 600,
                textShadow: '0 1px 6px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.15)',
              }}>
                Join the community of indie creators bringing their board game visions to life.
              </p>
              <a href="#/auth" id="cta-final" style={{
                padding: '1rem 3rem',
                background: 'var(--gradient-primary)', color: 'white',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700, fontSize: '1.15rem',
                display: 'inline-flex', alignItems: 'center',
                boxShadow: '0 4px 24px rgba(16,185,129,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(16,185,129,0.5)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(16,185,129,0.4)'; }}
              >
                Get Started — It's Free
              </a>
            </div>
          </RevealSection>
        </section>

        {/* ─── FOOTER ─── */}
        <footer style={{
          padding: '2rem', textAlign: 'center',
          color: '#0f766e', fontSize: '0.85rem',
          background: 'rgba(255,255,255,0.7)',
          borderTop: '1px solid rgba(16,185,129,0.15)',
        }}>
          © {new Date().getFullYear()} TurnBased.
        </footer>

      </div>
    </>
  );
};
