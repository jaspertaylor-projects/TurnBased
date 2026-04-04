import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_HISTORY = 15;

/**
 * Rapid calls within this window coalesce into a single undo entry.
 * The snapshot saved is the state before the burst started, so an
 * entire drag or slider sweep becomes one undo step.
 */
const COALESCE_MS = 400;

interface UndoRedoResult<T> {
  value: T;
  set: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Replace current value without pushing to undo stack (e.g. initial load). */
  reset: (next: T) => void;
}

export function useUndoRedo<T>(initialValue: T): UndoRedoResult<T> {
  const [value, setValueRaw] = useState<T>(initialValue);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  // Coalescing state: tracks the "before" snapshot for a burst of rapid sets.
  const burstSnapshot = useRef<T | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBurst = useCallback(() => {
    if (burstSnapshot.current !== null) {
      undoStack.current = [...undoStack.current.slice(-(MAX_HISTORY - 1)), burstSnapshot.current];
      burstSnapshot.current = null;
    }
    if (burstTimer.current !== null) {
      clearTimeout(burstTimer.current);
      burstTimer.current = null;
    }
  }, []);

  const set = useCallback((next: T) => {
    setValueRaw((prev) => {
      // First call in a burst: save the "before" snapshot
      if (burstSnapshot.current === null) {
        burstSnapshot.current = prev;
      }
      redoStack.current = [];
      return next;
    });

    // Timer management must stay outside the state updater to avoid
    // side-effects that React StrictMode may double-invoke.
    if (burstTimer.current !== null) {
      clearTimeout(burstTimer.current);
    }
    burstTimer.current = setTimeout(flushBurst, COALESCE_MS);
  }, [flushBurst]);

  const undo = useCallback(() => {
    // If there's an in-flight burst, flush it first so we have something to undo
    flushBurst();

    setValueRaw((prev) => {
      if (undoStack.current.length === 0) return prev;
      const previous = undoStack.current[undoStack.current.length - 1];
      undoStack.current = undoStack.current.slice(0, -1);
      redoStack.current = [...redoStack.current, prev];
      return previous;
    });
  }, [flushBurst]);

  const redo = useCallback(() => {
    flushBurst();

    setValueRaw((prev) => {
      if (redoStack.current.length === 0) return prev;
      const next = redoStack.current[redoStack.current.length - 1];
      redoStack.current = redoStack.current.slice(0, -1);
      undoStack.current = [...undoStack.current, prev];
      return next;
    });
  }, [flushBurst]);

  const reset = useCallback((next: T) => {
    if (burstTimer.current !== null) {
      clearTimeout(burstTimer.current);
      burstTimer.current = null;
    }
    burstSnapshot.current = null;
    undoStack.current = [];
    redoStack.current = [];
    setValueRaw(next);
  }, []);

  const canUndo = undoStack.current.length > 0 || burstSnapshot.current !== null;
  const canRedo = redoStack.current.length > 0;

  return { value, set, undo, redo, canUndo, canRedo, reset };
}

export function useUndoRedoKeyboard(undo: () => void, redo: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;

      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    function handleKeyDownY(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'y') return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      e.preventDefault();
      redo();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDownY);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleKeyDownY);
    };
  }, [undo, redo]);
}
