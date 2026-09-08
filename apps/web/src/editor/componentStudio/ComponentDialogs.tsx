import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { TemplateComponentKind } from '../templateStudio/types';
import { COMPONENT_FAMILIES } from './types';

export function ComponentDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="component-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" className="component-icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function CreateComponentDialog({
  initialKind = 'card',
  onCreate,
  onClose,
}: {
  initialKind?: TemplateComponentKind;
  onCreate: (kind: TemplateComponentKind, name: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const [name, setName] = useState('');
  const family = COMPONENT_FAMILIES.find((item) => item.kind === kind)!;
  return (
    <ComponentDialog title="A new piece of your game" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(kind, name.trim() || family.singular);
        }}
      >
        <div data-layout="componentFamilyChoices" className="component-family-choices">
          {COMPONENT_FAMILIES.map((item) => (
            <button
              key={item.kind}
              type="button"
              className={kind === item.kind ? 'is-active' : ''}
              aria-pressed={kind === item.kind}
              onClick={() => setKind(item.kind)}
            >
              {item.singular}
            </button>
          ))}
        </div>
        <p className="component-muted">{family.description}</p>
        <label className="component-field">
          Component name
          <input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            placeholder={family.singular}
          />
        </label>
        <footer>
          <button type="button" className="component-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="component-button component-button--primary">
            Create component <ArrowRight size={14} />
          </button>
        </footer>
      </form>
    </ComponentDialog>
  );
}

export function RenameComponentDialog({
  name,
  onRename,
  onClose,
}: {
  name: string;
  onRename: (name: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <ComponentDialog title="Name this component" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) onRename(draft.trim());
        }}
      >
        <label className="component-field">
          Component name
          <input
            autoFocus
            required
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <footer>
          <button type="button" className="component-button" onClick={onClose}>
            Cancel
          </button>
          <button className="component-button component-button--primary" disabled={!draft.trim()}>
            Save name
          </button>
        </footer>
      </form>
    </ComponentDialog>
  );
}
