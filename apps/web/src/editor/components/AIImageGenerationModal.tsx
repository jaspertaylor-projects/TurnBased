import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, Wand2, X } from 'lucide-react';

import { supabase } from '../../lib/supabaseClient';
import { getFunctionErrorMessage } from '../aiFunctionErrors';
import { IMAGE_GENERATION_MODEL_OPTIONS } from '../aiModelCatalog';
import { inputStyle } from '../styles';

export interface GeneratedImageAssetPayload {
  prompt: string;
  name: string;
  r2Key: string;
  imageDataUrl?: string;
  mime: string;
  sizeBytes: number;
  modelId?: string;
}

export interface AIImagePromptContextOption {
  id: string;
  label: string;
  kind: 'theme' | 'style';
  value: string;
}

function normalizeImageModelId(value: string): string {
  const ids = new Set(IMAGE_GENERATION_MODEL_OPTIONS.map((option) => option.id));
  return ids.has(value) ? value : IMAGE_GENERATION_MODEL_OPTIONS[0].id;
}

export function AIImageGenerationModal({
  open,
  projectId,
  modelId,
  title = 'Generate image',
  initialPrompt = '',
  contextOptions = [],
  onClose,
  onGenerated,
}: {
  open: boolean;
  projectId: string;
  modelId: string;
  title?: string;
  initialPrompt?: string;
  contextOptions?: AIImagePromptContextOption[];
  onClose: () => void;
  onGenerated: (asset: GeneratedImageAssetPayload) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModelId, setSelectedModelId] = useState(modelId);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrompt(initialPrompt);
    setSelectedModelId(normalizeImageModelId(modelId));
    setSelectedContextIds(contextOptions.map((option) => option.id));
    setError(null);
  }, [contextOptions, initialPrompt, modelId, open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isGenerating) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, onClose, open]);

  if (!open) return null;

  const selectedModel = IMAGE_GENERATION_MODEL_OPTIONS.find((option) => option.id === selectedModelId)
    ?? IMAGE_GENERATION_MODEL_OPTIONS[0];

  const selectedContext = contextOptions.filter((option) => selectedContextIds.includes(option.id));

  function buildPromptWithContext(trimmedPrompt: string): string {
    if (selectedContext.length === 0) {
      return trimmedPrompt;
    }

    const contextLines = selectedContext.map((option) => (
      option.kind === 'theme'
        ? `Theme: ${option.value}`
        : `Style - ${option.label}: ${option.value}`
    ));
    return `${trimmedPrompt}\n\nProject art direction:\n${contextLines.map((line) => `- ${line}`).join('\n')}`;
  }

  function toggleContext(id: string) {
    setSelectedContextIds((current) => (
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    ));
  }

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;
    const finalPrompt = buildPromptWithContext(trimmed);

    setIsGenerating(true);
    setError(null);
    try {
      const { data, error: generationError } = await supabase.functions.invoke('ai-image-agent', {
        body: { projectId, prompt: finalPrompt, modelId: selectedModelId },
      });
      if (generationError) {
        throw new Error(await getFunctionErrorMessage(generationError, 'Image generation failed'));
      }

      onGenerated({
        prompt: finalPrompt,
        name: trimmed.slice(0, 60),
        r2Key: data?.r2Key ?? `${projectId}/ai-${Date.now()}.png`,
        imageDataUrl: typeof data?.imageDataUrl === 'string' ? data.imageDataUrl : undefined,
        mime: data?.mime ?? 'image/png',
        sizeBytes: data?.sizeBytes ?? 0,
        modelId: typeof data?.model === 'string' ? data.model : selectedModelId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div
      data-layout="aiImageModalOverlay"
      /* fixed viewport overlay that centers the reusable image generation dialog */
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isGenerating) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
        background: 'rgba(6, 78, 59, 0.28)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <section
        data-layout="aiImageModalPanel"
        /* bounded dialog frame: header/body/footer stay inside one reusable modal surface */
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-image-modal-title"
        style={{
          width: 'min(680px, 100%)',
          maxHeight: 'min(620px, calc(100vh - 2rem))',
          borderRadius: '18px',
          border: '1px solid rgba(15,118,110,0.18)',
          background: 'rgba(255,255,255,0.96)',
          boxShadow: '0 28px 80px rgba(6,78,59,0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          data-layout="aiImageModalHeader"
          /* pinned title row with identity icon and close affordance */
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1rem 1.1rem',
            borderBottom: '1px solid rgba(15,118,110,0.1)',
            background: 'linear-gradient(135deg, rgba(240,253,244,0.96), rgba(245,243,255,0.92))',
          }}
        >
          <div
            data-layout="aiImageModalTitleGroup"
            /* compact title group that names the modal and its AI image purpose */
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}
          >
            <span style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
              <Sparkles size={18} />
            </span>
            <h2 id="ai-image-modal-title" style={{ margin: 0, color: '#064e3b', fontSize: '1.05rem', lineHeight: 1.2 }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close image generator"
            title="Close"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '999px',
              border: '1px solid rgba(15,118,110,0.18)',
              background: 'rgba(255,255,255,0.86)',
              color: '#064e3b',
              display: 'grid',
              placeItems: 'center',
              cursor: isGenerating ? 'wait' : 'pointer',
              opacity: isGenerating ? 0.55 : 1,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div
          data-layout="aiImageModalBody"
          /* scrollable prompt and status body for the reusable generator workflow */
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '1rem 1.1rem',
            display: 'grid',
            gap: '0.85rem',
          }}
        >
          <label
            data-layout="aiImagePromptField"
            /* prompt field takes the full modal width and can grow without resizing chrome */
            style={{ display: 'grid', gap: '0.45rem', color: '#064e3b', fontWeight: 800 }}
          >
            Prompt
            <textarea
              autoFocus
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  void handleGenerate();
                }
              }}
              placeholder="A gateway driver for a board game card, bright readable shape language..."
              style={{
                ...inputStyle,
                minHeight: '132px',
                resize: 'vertical',
                borderRadius: '14px',
                padding: '0.8rem 0.9rem',
                lineHeight: 1.5,
              }}
            />
          </label>

          <div
            data-layout="aiImageModelPicker"
            /* model picker lets each modal invocation override the project default model */
            style={{ display: 'grid', gap: '0.45rem', color: '#064e3b', fontWeight: 800 }}
          >
            <label htmlFor="ai-image-model-select">Image model</label>
            <select
              id="ai-image-model-select"
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.target.value)}
              disabled={isGenerating}
              style={{
                ...inputStyle,
                borderRadius: '12px',
                padding: '0.65rem 0.75rem',
                cursor: isGenerating ? 'wait' : 'pointer',
              }}
            >
              {IMAGE_GENERATION_MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <span style={{ color: '#0f766e', fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.45 }}>
              {selectedModel.description}
            </span>
          </div>

          {contextOptions.length > 0 ? (
            <div
              data-layout="aiImageContextPicker"
              /* project art direction picker exposes exactly which theme/style context is added to the prompt */
              style={{ display: 'grid', gap: '0.55rem' }}
            >
              <div style={{ color: '#064e3b', fontWeight: 800 }}>Project context</div>
              <div
                data-layout="aiImageContextControls"
                /* wrapping checkbox controls for project theme and style references */
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}
              >
                {contextOptions.map((option) => {
                  const selected = selectedContextIds.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      data-layout="aiImageContextToggle"
                      /* individual checkbox chip toggles one visible piece of art direction */
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.38rem',
                        maxWidth: '100%',
                        borderRadius: '999px',
                        border: selected ? '1px solid rgba(124,58,237,0.45)' : '1px solid rgba(15,118,110,0.16)',
                        background: selected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.82)',
                        color: selected ? '#6d28d9' : '#064e3b',
                        padding: '0.42rem 0.68rem',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: isGenerating ? 'wait' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={isGenerating}
                        onChange={() => toggleContext(option.id)}
                        style={{ accentColor: '#7c3aed' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {option.kind === 'theme' ? 'Theme' : 'Style'}: {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div
            data-layout="aiImageModalHint"
            /* small reusable status strip that shows the active model route */
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '12px',
              background: 'rgba(240,253,244,0.72)',
              border: '1px solid rgba(15,118,110,0.1)',
              padding: '0.65rem 0.75rem',
              color: '#0f766e',
              fontSize: '0.82rem',
            }}
          >
            <ImagePlus size={15} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              OpenRouter model: {selectedModelId}
            </span>
          </div>

          {error ? (
            <div
              data-layout="aiImageModalError"
              /* error banner surfaces the edge-function message directly inside the modal */
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                borderRadius: '12px',
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(254,242,242,0.95)',
                color: '#b91c1c',
                padding: '0.65rem 0.75rem',
                fontSize: '0.82rem',
              }}
            >
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>

        <div
          data-layout="aiImageModalFooter"
          /* pinned action row keeps generation controls visible at the modal bottom */
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.6rem',
            padding: '0.9rem 1.1rem',
            borderTop: '1px solid rgba(15,118,110,0.1)',
            background: 'rgba(255,255,255,0.92)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(15,118,110,0.18)',
              background: 'rgba(255,255,255,0.9)',
              color: '#064e3b',
              padding: '0.55rem 0.9rem',
              fontWeight: 800,
              cursor: isGenerating ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !prompt.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.42rem',
              borderRadius: '999px',
              border: 'none',
              background: isGenerating || !prompt.trim()
                ? 'rgba(139,92,246,0.35)'
                : 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
              color: 'white',
              padding: '0.6rem 1rem',
              fontWeight: 900,
              cursor: isGenerating ? 'wait' : 'pointer',
            }}
          >
            {isGenerating ? <Loader2 size={15} /> : <Wand2 size={15} />}
            {isGenerating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </section>
    </div>
  );
}
