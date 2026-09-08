import { useEffect, useRef, useState } from 'react';
import type { ComponentDesignDocument } from './types';

/** Gestures commit once; undo restores artwork without discarding component data edits. */
export function useTemplateHistory(
  document: ComponentDesignDocument,
  onChange: (document: ComponentDesignDocument) => void,
) {
  const history = useRef<{ past: ComponentDesignDocument[]; future: ComponentDesignDocument[] }>({
    past: [],
    future: [],
  });
  const current = useRef(document);
  useEffect(() => {
    current.current = document;
  }, [document]);
  const [availability, setAvailability] = useState({ canUndo: false, canRedo: false });
  const refresh = () =>
    setAvailability({ canUndo: history.current.past.length > 0, canRedo: history.current.future.length > 0 });
  const commit = (next: ComponentDesignDocument) => {
    if (next === current.current) return;
    history.current.past = [...history.current.past.slice(-79), current.current];
    history.current.future = [];
    current.current = next;
    onChange(next);
    refresh();
  };
  const undo = () => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(current.current);
    current.current = previous;
    onChange(previous);
    refresh();
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(current.current);
    current.current = next;
    onChange(next);
    refresh();
  };
  return { commit, undo, redo, ...availability };
}
