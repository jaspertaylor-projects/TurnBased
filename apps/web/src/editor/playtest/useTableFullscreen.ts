import { useEffect, useRef, useState } from 'react';

export function useTableFullscreen() {
  const ref = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const sync = () => setNative(document.fullscreenElement === ref.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !ref.current?.querySelector('dialog[open]')) setFallback(false);
    };
    document.addEventListener('fullscreenchange', sync);
    window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('fullscreenchange', sync); window.removeEventListener('keydown', escape); };
  }, []);
  const toggle = async () => {
    if (document.fullscreenElement === ref.current) { await document.exitFullscreen().catch(() => {}); return; }
    if (fallback) { setFallback(false); return; }
    try {
      if (!ref.current?.requestFullscreen) throw new Error('Fullscreen unavailable');
      await ref.current.requestFullscreen();
    } catch { setFallback(true); }
  };
  return { ref, active: native || fallback, fallback, toggle };
}
