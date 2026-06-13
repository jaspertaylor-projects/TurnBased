import { useRef, useState, type ReactNode } from 'react';
import { Sparkles, BookImage, Hexagon, ImagePlus, Palette, Upload, Wand2, X, Plus } from 'lucide-react';
import { inputStyle } from '../styles';
import { PROJECT_PALETTE_LABELS, PROJECT_PALETTE_ORDER } from '../projectPalette';
import type { EditorImageAsset, EditorProject, ProjectColorPalette } from '../types';
import { addIconAsset, addReferenceAsset } from './art/artUtils';
import { ArtReferenceCard } from './art/ArtReferenceCard';
import { IconAssetCard } from './art/IconAssetCard';
import { IconArtworkPreview } from './art/IconArtworkPreview';
import { PalettePage } from './art/PalettePage';
import { STUDIO_BG_STYLE, STUDIO_BG_VALUE } from './art/studioBackground';
import { SubPageShell } from './art/SubPageShell';
import { supabase } from '../../lib/supabaseClient';
import { generateId } from '@turnbased/shared-utils';

// Re-export the studio background value for non-art callers (page chrome,
// etc.) that imported it from this module before the extract.
export { STUDIO_BG_VALUE };

const STUDIO_BG = STUDIO_BG_STYLE;

async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = typeof error === 'object' && error !== null && 'context' in error
    ? (error as { context?: unknown }).context
    : null;

  if (context instanceof Response) {
    const response = context.clone();
    try {
      const payload = await response.json();
      if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
        return payload.error;
      }
      if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
        return payload.message;
      }
    } catch {
      const text = await context.clone().text().catch(() => '');
      if (text.trim().length > 0) {
        return text;
      }
    }
  }

  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

// ── Home tile ──────────────────────────────────────────────────────

function StudioTile({
  icon,
  label,
  count,
  children,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  children?: ReactNode;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left',
        borderRadius: '20px',
        border: hovered ? '2px solid rgba(13,148,136,0.35)' : '2px solid rgba(15,118,110,0.14)',
        background: hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(12px)',
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        height: '100%',
        transition: 'all 200ms ease',
        boxShadow: hovered
          ? '0 12px 40px rgba(6,78,59,0.14)'
          : '0 2px 12px rgba(6,78,59,0.05)',
        transform: hovered ? 'translateY(-2px) scale(1.01)' : 'none',
      }}
    >
      <div style={{
        padding: '1.5rem 1rem',
        display: 'grid',
        placeItems: 'center',
      }}>
        {children ?? (
          <span style={{ color: '#0d9488', opacity: 0.3 }}>{icon}</span>
        )}
      </div>

      <div style={{
        padding: '0.7rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderTop: '2px solid rgba(15,118,110,0.08)',
        background: 'rgba(255,255,255,0.75)',
      }}>
        <span style={{ color: '#0d9488', flexShrink: 0 }}>{icon}</span>
        <span style={{ color: '#064e3b', fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>{label}</span>
        {typeof count === 'number' ? (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, color: '#0d9488',
            background: 'rgba(13,148,136,0.1)', padding: '0.18rem 0.5rem', borderRadius: '999px',
          }}>
            {count}
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ── Images sub-page content ────────────────────────────────────────

function ImagesContent({
  projectId, images, imageModelId, onUpdateImages,
}: {
  projectId: string;
  images: EditorImageAsset[];
  imageModelId: string;
  onUpdateImages: (updater: (images: EditorImageAsset[]) => EditorImageAsset[]) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function getImagePreviewSource(image: EditorImageAsset): string | null {
    if (image.imageDataUrl) return image.imageDataUrl;
    if (image.r2Key.startsWith('data:image/')) return image.r2Key;
    return null;
  }

  async function handleUpload(file: File) {
    setIsUploading(true); setError(null);
    try {
      const { data: signData, error: signErr } = await supabase.functions.invoke('assets-manager', {
        body: { action: 'sign-upload', projectId, fileName: file.name, mime: file.type || 'application/octet-stream', sizeBytes: file.size },
      });
      if (signErr) throw new Error(await getFunctionErrorMessage(signErr, 'Failed to sign upload'));
      if (!signData?.success) throw new Error('Failed to sign upload');
      await new Promise((r) => setTimeout(r, 800));
      const { error: finalizeErr } = await supabase.functions.invoke('assets-manager', {
        body: { action: 'finalize-upload', projectId, r2Key: signData.r2Key, mime: file.type || 'application/octet-stream', sizeBytes: file.size },
      });
      if (finalizeErr) throw new Error(await getFunctionErrorMessage(finalizeErr, 'Failed to finalize upload'));
      onUpdateImages((c) => [{ id: generateId('img'), name: file.name.replace(/\.[^.]+$/, ''), r2Key: signData.r2Key, mime: file.type || 'application/octet-stream', bytes: file.size, tags: [], createdAt: new Date().toISOString() }, ...c]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setIsUploading(false); }
  }

  async function handleAiGenerate() {
    const trimmed = aiPrompt.trim(); if (!trimmed) return;
    setIsGenerating(true); setError(null);
    try {
      const { data, error: genErr } = await supabase.functions.invoke('ai-image-agent', { body: { projectId, prompt: trimmed, modelId: imageModelId } });
      if (genErr) throw new Error(await getFunctionErrorMessage(genErr, 'Image generation failed'));
      onUpdateImages((c) => [{
        id: generateId('img'),
        name: trimmed.slice(0, 60),
        r2Key: data?.r2Key ?? `${projectId}/ai-${Date.now()}.png`,
        imageDataUrl: typeof data?.imageDataUrl === 'string' ? data.imageDataUrl : undefined,
        mime: data?.mime ?? 'image/png',
        bytes: data?.sizeBytes ?? 0,
        aiPrompt: trimmed,
        tags: [],
        createdAt: new Date().toISOString(),
      }, ...c]);
      setAiPrompt(''); setShowAiInput(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Generation failed'); }
    finally { setIsGenerating(false); }
  }

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button type="button" onClick={() => setShowAiInput((v) => !v)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '999px', border: 'none',
          background: showAiInput ? 'rgba(139,92,246,0.15)' : 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
          color: showAiInput ? '#6d28d9' : 'white', padding: '0.5rem 0.85rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
        }}><Wand2 size={13} /> Generate</button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '999px', border: 'none',
          background: 'linear-gradient(135deg, #064e3b, #0d9488)', color: 'white', padding: '0.5rem 0.85rem',
          fontWeight: 700, fontSize: '0.78rem', cursor: isUploading ? 'wait' : 'pointer', opacity: isUploading ? 0.7 : 1,
        }}><Upload size={13} /> {isUploading ? 'Uploading...' : 'Upload'}</button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
      </div>

      {showAiInput ? (
        <div style={{ display: 'flex', gap: '0.45rem', padding: '0.65rem', borderRadius: '14px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.14)', alignItems: 'center' }}>
          <Wand2 size={16} style={{ color: '#8b5cf6', flexShrink: 0 }} />
          <input autoFocus value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate(); }}
            placeholder="Describe the image..." style={{ ...inputStyle, flex: 1, border: 'none', background: 'rgba(255,255,255,0.8)', padding: '0.5rem 0.7rem', fontSize: '0.82rem' }} />
          <button type="button" onClick={handleAiGenerate} disabled={isGenerating || !aiPrompt.trim()} style={{
            borderRadius: '999px', border: 'none', background: isGenerating ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
            color: 'white', padding: '0.45rem 0.8rem', fontWeight: 700, fontSize: '0.76rem', cursor: isGenerating ? 'wait' : 'pointer', flexShrink: 0,
          }}>{isGenerating ? 'Creating...' : 'Create'}</button>
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: '0.6rem 0.8rem', borderRadius: '12px', background: 'rgba(254,242,242,0.95)', border: '1px solid rgba(239,68,68,0.18)', color: '#b91c1c', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      ) : null}

      {images.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
          {images.map((image) => (
            <div key={image.id} style={{ borderRadius: '16px', border: '1px solid rgba(15,118,110,0.08)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', overflow: 'hidden' }}>
              <div style={{ aspectRatio: '4 / 3', background: 'linear-gradient(135deg, rgba(240,253,244,0.9), rgba(236,254,255,0.9))', display: 'grid', placeItems: 'center', position: 'relative' }}>
                {getImagePreviewSource(image) ? (
                  <img
                    src={getImagePreviewSource(image) ?? undefined}
                    alt={image.name || 'Generated game art'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : image.aiPrompt ? <Wand2 size={20} style={{ color: '#8b5cf6', opacity: 0.6 }} /> : <ImagePlus size={20} style={{ color: '#0d9488', opacity: 0.6 }} />}
                <button type="button" onClick={() => onUpdateImages((c) => c.filter((i) => i.id !== image.id))} title="Remove"
                  style={{ position: 'absolute', top: '0.35rem', right: '0.35rem', width: '24px', height: '24px', borderRadius: '999px', border: 'none', background: 'rgba(0,0,0,0.25)', color: 'white', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={11} /></button>
              </div>
              <div style={{ padding: '0.5rem 0.6rem' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#064e3b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{image.name || 'Untitled'}</div>
                <div style={{ fontSize: '0.66rem', color: '#6b7280', marginTop: '0.15rem' }}>{image.aiPrompt ? 'AI' : `${(image.bytes / 1024).toFixed(0)} KB`}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '2.5rem 1rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', color: '#0f766e', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
          Upload files or generate art with AI<br />to build your visual library.
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

type StudioPage = 'home' | 'palette' | 'themes' | 'assets' | 'icons' | 'images';

export function ArtSection({
  project,
  projectId,
  onUpdateArt,
  onUpdateTheme,
  onAssignPaletteColor,
  onSavePalette,
}: {
  project: EditorProject;
  projectId: string;
  onUpdateArt: (updater: (art: EditorProject['art']) => EditorProject['art']) => void;
  onUpdateTheme: (value: string) => void;
  /* Single-slot palette assignment — still used by icon color pickers
     that need to commit immediately. */
  onAssignPaletteColor: (paletteId: string, value: string) => void;
  /* Atomic palette save: commits all nine slots in one history entry.
     Used by the PalettePage's Save button. */
  onSavePalette: (palette: ProjectColorPalette) => void;
}) {
  const [page, setPage] = useState<StudioPage>('home');

  const styleCount = project.art.definedArtStyles.length;
  const assetCount = project.art.recurringAssets.length;
  const iconCount = project.art.icons.length;
  const imageCount = (project.art.images ?? []).length;

  // ── Home ──
  if (page === 'home') {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={STUDIO_BG} />

        {/* Header */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '1.2rem 1rem 0 1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <Sparkles size={18} style={{ color: '#0d9488' }} />
          <span style={{
            fontSize: '1.1rem', fontWeight: 800, color: '#064e3b',
            letterSpacing: '-0.01em',
          }}>Art</span>
        </div>

        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', flex: '1 1 0',
          minHeight: 0,
          padding: '0.75rem',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
          gap: '0.75rem',
          overflow: 'auto',
        }}>
            {/* Palette */}
            <StudioTile icon={<Palette size={22} />} label="Palette" onClick={() => setPage('palette')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', padding: '0.5rem' }}>
                {PROJECT_PALETTE_ORDER.map((paletteId) => (
                  <span
                    key={paletteId}
                    title={PROJECT_PALETTE_LABELS[paletteId]}
                    style={{
                      width: '26px', height: '26px', borderRadius: '999px',
                      background: project.settings.colorPalette[paletteId] || 'rgba(15,118,110,0.15)',
                      border: '2px solid rgba(255,255,255,0.7)',
                      boxShadow: '0 1px 4px rgba(6,78,59,0.12)',
                    }}
                  />
                ))}
              </div>
            </StudioTile>

            {/* Themes & Styles */}
            <StudioTile icon={<Sparkles size={22} />} label="Themes & Styles" count={styleCount || undefined} onClick={() => setPage('themes')}>
              {styleCount > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center', padding: '0.5rem' }}>
                  {project.art.definedArtStyles.slice(0, 5).map((s) => (
                    <span key={s.id} style={{ padding: '0.28rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.8)', color: '#064e3b', border: '1px solid rgba(15,118,110,0.1)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name || 'Untitled'}
                    </span>
                  ))}
                  {styleCount > 5 ? <span style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 600, padding: '0.28rem' }}>+{styleCount - 5}</span> : null}
                </div>
              ) : (
                <div style={{ color: '#0d9488', opacity: 0.45, fontSize: '0.76rem', textAlign: 'center', lineHeight: 1.5 }}>
                  Define the visual<br />language of your game
                </div>
              )}
            </StudioTile>

            {/* Reusable Characters & More */}
            <StudioTile icon={<BookImage size={22} />} label="Reusable Characters & More" count={assetCount || undefined} onClick={() => setPage('assets')}>
              {assetCount > 0 ? (
                <div style={{ display: 'grid', gap: '0.25rem', justifyItems: 'center', padding: '0.5rem' }}>
                  {project.art.recurringAssets.slice(0, 4).map((a) => (
                    <span key={a.id} style={{ fontSize: '0.74rem', fontWeight: 600, color: '#064e3b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name || 'Untitled'}
                      {a.category ? <span style={{ color: '#6b7280', fontWeight: 400 }}> — {a.category}</span> : null}
                    </span>
                  ))}
                  {assetCount > 4 ? <span style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 600 }}>+{assetCount - 4} more</span> : null}
                </div>
              ) : (
                <div style={{ color: '#0d9488', opacity: 0.45, fontSize: '0.76rem', textAlign: 'center', lineHeight: 1.5 }}>
                  Characters, factions,<br />locations, and props
                </div>
              )}
            </StudioTile>

            {/* Icons */}
            <StudioTile icon={<Hexagon size={22} />} label="Icons" count={iconCount || undefined} onClick={() => setPage('icons')}>
              {iconCount > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center', padding: '0.5rem' }}>
                  {project.art.icons.slice(0, 8).map((icon) => (
                    <IconArtworkPreview key={icon.id} item={icon} project={project} size={38} />
                  ))}
                  {iconCount > 8 ? <span style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 600, alignSelf: 'center' }}>+{iconCount - 8}</span> : null}
                </div>
              ) : (
                <div style={{ color: '#0d9488', opacity: 0.45, fontSize: '0.76rem', textAlign: 'center', lineHeight: 1.5 }}>
                  Gameplay symbols<br />like :attack: or :vp:
                </div>
              )}
            </StudioTile>

            {/* Images */}
            <StudioTile icon={<ImagePlus size={22} />} label="Images" count={imageCount || undefined} onClick={() => setPage('images')}>
              {imageCount > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', padding: '0.5rem' }}>
                  {(project.art.images ?? []).slice(0, 6).map((img) => (
                    <div key={img.id} style={{ width: '52px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(240,253,244,0.9), rgba(236,254,255,0.9))', border: '1px solid rgba(15,118,110,0.08)', display: 'grid', placeItems: 'center' }}>
                      {img.imageDataUrl || img.r2Key.startsWith('data:image/') ? (
                        <img
                          src={img.imageDataUrl ?? img.r2Key}
                          alt={img.name || 'Generated game art'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px', display: 'block' }}
                        />
                      ) : img.aiPrompt ? <Wand2 size={13} style={{ color: '#8b5cf6', opacity: 0.7 }} /> : <ImagePlus size={13} style={{ color: '#0d9488', opacity: 0.7 }} />}
                    </div>
                  ))}
                  {imageCount > 6 ? <span style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 600, alignSelf: 'center' }}>+{imageCount - 6}</span> : null}
                </div>
              ) : (
                <div style={{ color: '#0d9488', opacity: 0.45, fontSize: '0.76rem', textAlign: 'center', lineHeight: 1.5 }}>
                  Upload or AI-generate<br />art for your game
                </div>
              )}
            </StudioTile>
        </div>
      </div>
    );
  }

  // ── Palette ──
  if (page === 'palette') {
    return (
      <PalettePage
        project={project}
        onBack={() => setPage('home')}
        onSavePalette={onSavePalette}
      />
    );
  }

  // ── Themes & Styles ──
  if (page === 'themes') {
    return (
      <SubPageShell title="Themes & Styles" icon={<Sparkles size={22} />} onBack={() => setPage('home')}        actions={
          <button type="button" onClick={() => onUpdateArt((art) => ({ ...art, definedArtStyles: addReferenceAsset(art.definedArtStyles) }))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #064e3b, #0d9488)', color: 'white', padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            <Plus size={13} /> Add Style
          </button>
        }
      >
        {/* Theme input */}
        <div style={{ marginBottom: '1rem', padding: '0.8rem', borderRadius: '16px', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(15,118,110,0.06)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Theme</div>
          <input value={project.art.theme} onChange={(e) => onUpdateTheme(e.target.value)} placeholder="Clockwork jungle rebellion..."
            style={{ ...inputStyle, border: 'none', background: 'rgba(255,255,255,0.7)', padding: '0.6rem 0.8rem', fontSize: '0.88rem', borderRadius: '12px', width: '100%', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {project.art.definedArtStyles.length > 0 ? (
            project.art.definedArtStyles.map((style) => (
              <ArtReferenceCard key={style.id} item={{ ...style, category: '', tags: [] }} showCategory={false} showTags={false} showHeader={false} collapsible
                namePlaceholder="Painterly storybook" descriptionPlaceholder="Describe the visual lane this style represents."
                onChange={(next) => onUpdateArt((art) => ({ ...art, definedArtStyles: art.definedArtStyles.map((e) => e.id === style.id ? { ...next, category: '', tags: [] } : e) }))}
                onRemove={() => onUpdateArt((art) => ({ ...art, definedArtStyles: art.definedArtStyles.filter((e) => e.id !== style.id) }))} />
            ))
          ) : (
            <div style={{ padding: '2rem 1rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', color: '#0f766e', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
              Add art styles to define visual lanes like<br />painterly boards, flat icons, or monochrome cards.
            </div>
          )}
        </div>
      </SubPageShell>
    );
  }

  // ── Reusable Characters & More ──
  if (page === 'assets') {
    return (
      <SubPageShell title="Reusable Characters & More" icon={<BookImage size={22} />} onBack={() => setPage('home')}        actions={
          <button type="button" onClick={() => onUpdateArt((art) => ({ ...art, recurringAssets: addReferenceAsset(art.recurringAssets, { category: 'Character' }) }))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #064e3b, #0d9488)', color: 'white', padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            <Plus size={13} /> Add Asset
          </button>
        }
      >
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {project.art.recurringAssets.length > 0 ? (
            project.art.recurringAssets.map((asset) => (
              <ArtReferenceCard key={asset.id} item={asset} categoryLabel="Asset Type" categoryPlaceholder="Character, location, monster, relic"
                onChange={(next) => onUpdateArt((art) => ({ ...art, recurringAssets: art.recurringAssets.map((e) => e.id === asset.id ? next : e) }))}
                onRemove={() => onUpdateArt((art) => ({ ...art, recurringAssets: art.recurringAssets.filter((e) => e.id !== asset.id) }))} />
            ))
          ) : (
            <div style={{ padding: '2rem 1rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', color: '#0f766e', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
              Add the monsters, heroes, locations,<br />and props that need visual continuity.
            </div>
          )}
        </div>
      </SubPageShell>
    );
  }

  // ── Icons ──
  if (page === 'icons') {
    return (
      <SubPageShell title="Icons" icon={<Hexagon size={22} />} onBack={() => setPage('home')}        actions={
          <button type="button" onClick={() => onUpdateArt((art) => ({ ...art, icons: addIconAsset(art.icons) }))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #064e3b, #0d9488)', color: 'white', padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            <Plus size={13} /> Add Icon
          </button>
        }
      >
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {project.art.icons.length > 0 ? (
            project.art.icons.map((icon) => (
              <IconAssetCard key={icon.id} project={project} item={icon}
                onChange={(next) => onUpdateArt((art) => ({ ...art, icons: art.icons.map((e) => e.id === icon.id ? next : e) }))}
                onRemove={() => onUpdateArt((art) => ({ ...art, icons: art.icons.filter((e) => e.id !== icon.id) }))}
                onAssignPaletteColor={onAssignPaletteColor} />
            ))
          ) : (
            <div style={{ padding: '2rem 1rem', borderRadius: '18px', border: '1px dashed rgba(15,118,110,0.12)', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', color: '#0f766e', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.6 }}>
              Add gameplay symbols like :attack:, :move:,<br />or :vp: as reusable game primitives.
            </div>
          )}
        </div>
      </SubPageShell>
    );
  }

  // ── Images ──
  return (
    <SubPageShell title="Images" icon={<ImagePlus size={22} />} onBack={() => setPage('home')}>
      <ImagesContent projectId={projectId} images={project.art.images ?? []} imageModelId={project.settings.aiModels.imageGeneration}
        onUpdateImages={(updater) => onUpdateArt((art) => ({ ...art, images: updater(art.images ?? []) }))} />
    </SubPageShell>
  );
}
