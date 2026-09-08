import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

export const AI_PANEL_WIDTH = 440;
/** Keep the whole floating card reachable; update the DOM once per frame while dragging. */
export function useFloatingAIPanel() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => ({
    x: typeof window === 'undefined' ? 120 : Math.max(16, window.innerWidth - AI_PANEL_WIDTH - 28),
    y: 96,
  }));
  const [dragging, setDragging] = useState(false);
  const latest = useRef(pos);
  const offset = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const clamp = useCallback((next: { x: number; y: number }) => {
    const width = cardRef.current?.offsetWidth ?? Math.min(AI_PANEL_WIDTH, window.innerWidth - 24);
    const height = cardRef.current?.offsetHeight ?? 360;
    return {
      x: Math.max(8, Math.min(next.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(next.y, window.innerHeight - height - 8)),
    };
  }, []);
  useEffect(() => {
    function resize() {
      const next = clamp(latest.current);
      if (next.x === latest.current.x && next.y === latest.current.y) return;
      latest.current = next;
      setPos(next);
    }
    const observer = new ResizeObserver(resize);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [clamp]);
  function onHeaderPointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    offset.current = { x: event.clientX - latest.current.x, y: event.clientY - latest.current.y };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onHeaderPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!offset.current) return;
    latest.current = clamp({ x: event.clientX - offset.current.x, y: event.clientY - offset.current.y });
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!cardRef.current) return;
      cardRef.current.style.left = `${latest.current.x}px`;
      cardRef.current.style.top = `${latest.current.y}px`;
    });
  }
  function onHeaderPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!offset.current) return;
    offset.current = null;
    setDragging(false);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setPos(latest.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return { cardRef, pos, dragging, onHeaderPointerDown, onHeaderPointerMove, onHeaderPointerUp };
}
