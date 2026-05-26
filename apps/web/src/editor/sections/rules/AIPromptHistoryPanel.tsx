import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

import { SERIF_STACK } from './rulebookStyles';

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch { /* give up silently */ }
    document.body.removeChild(el);
  }
}

export function AIPromptHistoryPanel({
  prompts,
  onUse,
  onDelete,
}: {
  prompts: string[];
  onUse: (prompt: string) => void;
  onDelete: (prompt: string) => void;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedPrompt) return;
    const t = setTimeout(() => setCopiedPrompt(null), 1100);
    return () => clearTimeout(t);
  }, [copiedPrompt]);

  async function handleCopy(prompt: string) {
    await copyText(prompt);
    setCopiedPrompt(prompt);
  }

  return (
    <div
      data-layout="aiRecentPromptsList"
      /* Scrollable list of the user's last 10 prompts. Use reloads the
         textarea; copy keeps the current draft untouched; x removes it. */
      style={{
        border: '1px solid rgba(120,95,50,0.2)',
        borderRadius: '10px',
        background: 'rgba(255,253,246,0.95)',
        maxHeight: '180px',
        overflowY: 'auto',
        padding: '0.25rem',
        display: 'grid',
        gap: '0.2rem',
      }}
    >
      {prompts.map((entry) => {
        const copied = copiedPrompt === entry;
        return (
          <div
            key={entry}
            data-layout="aiRecentPromptRow"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', borderRadius: '6px' }}
          >
            <button
              type="button"
              onClick={() => onUse(entry)}
              title="Load this prompt into the textarea"
              style={{
                flex: '1 1 auto', minWidth: 0,
                textAlign: 'left',
                padding: '0.4rem 0.55rem',
                border: 'none',
                background: 'transparent',
                color: '#3b2412',
                fontFamily: SERIF_STACK, fontSize: '0.82rem', lineHeight: 1.35,
                cursor: 'pointer',
                borderRadius: '6px',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }}
              onMouseEnter={(event) => { (event.currentTarget as HTMLButtonElement).style.background = 'rgba(13,148,136,0.10)'; }}
              onMouseLeave={(event) => { (event.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              {entry.length > 220 ? `${entry.slice(0, 220)}...` : entry}
            </button>
            <button
              type="button"
              onClick={() => handleCopy(entry)}
              aria-label="Copy prompt"
              title={copied ? 'Copied!' : 'Copy prompt'}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', flexShrink: 0,
                borderRadius: '999px',
                border: copied ? '1px solid rgba(13,148,136,0.55)' : 'none',
                background: copied ? 'rgba(13,148,136,0.15)' : 'transparent',
                color: copied ? '#0d9488' : 'rgba(80,55,25,0.55)',
                cursor: 'pointer',
                marginTop: '0.25rem',
              }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            <button
              type="button"
              onClick={() => onDelete(entry)}
              aria-label="Remove from history"
              title="Remove from history"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '22px', height: '22px', flexShrink: 0,
                borderRadius: '999px',
                border: 'none', background: 'transparent',
                color: 'rgba(120,60,30,0.55)', cursor: 'pointer',
                marginTop: '0.25rem',
              }}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
