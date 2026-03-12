import { useEffect, useState } from 'react';
import './Loader.css';

export function Loader({ onReady }: { onReady?: boolean }) {
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (onReady) {
      // Start fade-out when scene is ready
      setFadeOut(true);
      const timer = setTimeout(() => setHidden(true), 700);
      return () => clearTimeout(timer);
    }
  }, [onReady]);

  if (hidden) return null;

  const hexColors = ['#064e3b', '#065f46', '#047857', '#059669', '#10b981', '#34d399'];

  return (
    <div
      className={`loader-overlay ${fadeOut ? 'loader-fade-out' : ''}`}
      aria-label="Loading"
    >
      <div className="loader-content">
        {/* Hex ring */}
        <div className="hex-ring">
          {hexColors.map((color, i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * 52;
            const y = Math.sin(angle) * 52;
            return (
              <div
                key={i}
                className="hex"
                style={{
                  left: `calc(50% + ${x}px - 18px)`,
                  top: `calc(50% + ${y}px - 20px)`,
                  backgroundColor: color,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            );
          })}
          {/* Orbiting favicon */}
          <div className="favicon-orbit">
            <img
              src="/favicon.png"
              alt="Loading"
              className="favicon-spinner"
              width="36"
              height="36"
            />
          </div>
        </div>

        <p className="loader-text">Loading the forest...</p>
      </div>
    </div>
  );
}
