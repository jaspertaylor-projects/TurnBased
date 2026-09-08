import { LayoutTemplate, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

function TemplateDialog({
  label,
  small = false,
  onClose,
  children,
}: {
  label: string;
  small?: boolean;
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
      aria-label={label}
      className={`template-dialog${small ? ' template-dialog-small' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}

interface TemplateDialogsProps {
  library: boolean;
  pending: { name: string } | null;
  onCloseLibrary: () => void;
  onChoosePreset: (preset: string) => void;
  onKeepCurrent: () => void;
  onApplyPending: () => void;
}

export function TemplateDialogs({
  library,
  pending,
  onCloseLibrary,
  onChoosePreset,
  onKeepCurrent,
  onApplyPending,
}: TemplateDialogsProps) {
  return (
    <>
      {library && !pending && (
        <TemplateDialog label="Template layouts" onClose={onCloseLibrary}>
          <header>
            <div data-layout="templateLibraryTitle">
              <small>A PLACE TO START</small>
              <h2>Choose a layout. Make it yours.</h2>
            </div>
            <button aria-label="Close template layouts" onClick={() => onCloseLibrary()}>
              <X size={18} />
            </button>
          </header>
          <p>Every text box, ornament, image, grid, and border becomes an editable layer.</p>
          <div data-layout="templatePresetGrid" className="template-preset-grid">
            {['woodland', 'storybook', 'modern', 'blank'].map((preset) => (
              <button
                key={preset}
                className={`template-preset template-preset-${preset}`}
                onClick={() => onChoosePreset(preset)}
              >
                <LayoutTemplate size={30} />
                <strong>{preset[0].toUpperCase() + preset.slice(1)}</strong>
                <span>
                  {preset === 'blank'
                    ? 'An open canvas for your own idea.'
                    : preset === 'woodland'
                      ? 'Warm parchment and forest details.'
                      : preset === 'storybook'
                        ? 'A little wonder in every piece.'
                        : 'Confident shapes and clear type.'}
                </span>
              </button>
            ))}
          </div>
        </TemplateDialog>
      )}
      {pending && (
        <TemplateDialog label="Replace template confirmation" small onClose={onKeepCurrent}>
          <h2>Use {pending.name}?</h2>
          <p>
            This replaces the current template faces and layers. Your table data stays with the component, and
            Undo brings this layout back.
          </p>
          <div data-layout="templateReplaceActions" className="template-dialog-actions">
            <button onClick={() => onKeepCurrent()}>Keep current template</button>
            <button className="template-primary" onClick={onApplyPending}>
              Use this template
            </button>
          </div>
        </TemplateDialog>
      )}
    </>
  );
}
