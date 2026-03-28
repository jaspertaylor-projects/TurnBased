import { useState } from 'react';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { getBoardSurfaceTextureStyle } from '@turnbased/engine-ui';
import { generateId } from '@turnbased/shared-utils';

import { NumericInput } from '../../components/NumericInput';
import { InspectorAccordion, InspectorAppearanceControls, InspectorColorField } from '../components/InspectorControls';
import { EDITOR_ICON_OPTIONS, renderIcon } from '../iconography';
import { createProjectPaletteReference, listProjectPaletteOptions, resolveProjectPaletteColorValue } from '../projectPalette';
import { inputStyle, labelStyle, panelStyle, sectionTitleStyle, textareaStyle } from '../styles';
import type { EditorArtReference, EditorIconAsset, EditorProject } from '../types';

const INVISIBLE_ICON_FILL = 'rgba(0,0,0,0)';

function parseTagList(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function formatTagList(tags: readonly string[]): string {
  return tags.join(', ');
}

function addReferenceAsset(
  items: readonly EditorArtReference[],
  defaults: Partial<EditorArtReference> = {},
): EditorArtReference[] {
  return [...items, {
    id: generateId('art_ref'),
    name: '',
    category: '',
    description: '',
    tags: [],
    ...defaults,
  }];
}

function addIconAsset(items: readonly EditorIconAsset[]): EditorIconAsset[] {
  return [...items, {
    id: generateId('art_icon'),
    mode: 'library',
    name: 'Shield',
    iconKey: 'shield',
    iconColor: createProjectPaletteReference('primary'),
    iconFillColor: INVISIBLE_ICON_FILL,
    iconStrokeWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    backgroundTextureId: 'none',
    backgroundTextureOpacity: 0.35,
    borderColor: createProjectPaletteReference('secondary'),
    borderWidth: 1,
    borderRadius: 20,
    customSvgMarkup: '',
    inlineCode: ':shield:',
    description: '',
    tags: [],
  }];
}

function formatInlineCodeFromIconKey(iconKey: string): string {
  return `:${iconKey}:`;
}

function resolveEditorColor(project: EditorProject, value: string): string {
  return resolveProjectPaletteColorValue(project.settings.colorPalette, value) ?? value;
}

function clampNonNegativeNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function renderCustomIconArtwork(item: EditorIconAsset, color: string) {
  const trimmedMarkup = item.customSvgMarkup.trim();

  if (!trimmedMarkup) {
    return (
      <div style={{ fontSize: '0.78rem', color: '#0f766e', textAlign: 'center', lineHeight: 1.4, padding: '0.4rem' }}>
        Add SVG markup or a short glyph to create a custom icon.
      </div>
    );
  }

  if (trimmedMarkup.startsWith('<svg')) {
    return (
      <div
        style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color }}
        dangerouslySetInnerHTML={{ __html: trimmedMarkup }}
      />
    );
  }

  return (
    <div style={{ color, fontSize: '2.6rem', fontWeight: 800, lineHeight: 1 }}>
      {trimmedMarkup.slice(0, 2)}
    </div>
  );
}

function IconArtworkPreview({
  item,
  project,
  size,
}: {
  item: EditorIconAsset;
  project: EditorProject;
  size: number;
}) {
  const backgroundColor = resolveEditorColor(project, item.backgroundColor);
  const borderColor = resolveEditorColor(project, item.borderColor);
  const iconColor = resolveEditorColor(project, item.iconColor);
  const textureStyle = item.backgroundTextureId !== 'none'
    ? getBoardSurfaceTextureStyle(item.backgroundTextureId, item.backgroundTextureOpacity)
    : null;

  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${item.borderRadius}px`,
        border: `${item.borderWidth}px solid ${borderColor}`,
        background: backgroundColor,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      {textureStyle?.backgroundImage ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            ...textureStyle,
          }}
        />
      ) : null}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '72%',
          height: '72%',
          display: 'grid',
          placeItems: 'center',
          color: iconColor,
          overflow: 'hidden',
        }}
      >
        {item.mode === 'custom'
          ? renderCustomIconArtwork(item, iconColor)
          : renderIcon(item.iconKey, {
            size: size * 0.42,
            strokeWidth: item.iconStrokeWidth,
            fillColor: resolveEditorColor(project, item.iconFillColor),
            style: { color: iconColor },
          })}
      </div>
    </div>
  );
}

function AssetSectionHeader({
  title,
  description,
  onAdd,
}: {
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: '0.18rem' }}>
        <div style={{ color: '#064e3b', fontWeight: 800 }}>{title}</div>
        <div style={{ color: '#0f766e', fontSize: '0.8rem', lineHeight: 1.45 }}>{description}</div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          borderRadius: '999px',
          border: '1px solid rgba(15,118,110,0.14)',
          background: 'rgba(240,253,244,0.94)',
          color: '#065f46',
          padding: '0.55rem 0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <Plus size={14} />
        Add
      </button>
    </div>
  );
}

function ArtReferenceCard({
  item,
  categoryLabel,
  categoryPlaceholder,
  showCategory = true,
  showTags = true,
  showHeader = true,
  collapsible = false,
  namePlaceholder = 'Harbor captain',
  descriptionPlaceholder = 'Describe the silhouette, material language, outfit, or environmental cues we should keep consistent.',
  onChange,
  onRemove,
}: {
  item: EditorArtReference;
  categoryLabel?: string;
  categoryPlaceholder?: string;
  showCategory?: boolean;
  showTags?: boolean;
  showHeader?: boolean;
  collapsible?: boolean;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  onChange: (next: EditorArtReference) => void;
  onRemove: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div style={{ borderRadius: '18px', border: '1px solid rgba(15,118,110,0.1)', background: 'rgba(248,250,252,0.86)', padding: '0.9rem', display: 'grid', gap: '0.75rem' }}>
      {showHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ color: '#064e3b', fontWeight: 700 }}>{item.name.trim() || 'Untitled Asset'}</div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete asset"
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '999px',
              border: '1px solid rgba(239,68,68,0.18)',
              background: 'rgba(254,242,242,0.96)',
              color: '#b91c1c',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: showCategory ? 'minmax(0, 1.2fr) minmax(0, 0.8fr)' : 'minmax(0, 1fr)', gap: '0.75rem' }}>
        {showHeader ? (
          <label style={labelStyle}>
            Name
            <input
              value={item.name}
              onChange={(event) => onChange({ ...item, name: event.target.value })}
              placeholder={namePlaceholder}
              style={inputStyle}
            />
          </label>
        ) : null}
        {showCategory ? (
          <label style={labelStyle}>
            {categoryLabel}
            <input
              value={item.category}
              onChange={(event) => onChange({ ...item, category: event.target.value })}
              placeholder={categoryPlaceholder}
              style={inputStyle}
            />
          </label>
        ) : null}
      </div>

      {!showHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => collapsible ? setIsCollapsed((current) => !current) : undefined}
            aria-label={collapsible ? (isCollapsed ? 'Expand art style' : 'Collapse art style') : undefined}
            aria-expanded={collapsible ? !isCollapsed : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.2rem 0',
              border: 'none',
              background: 'none',
              cursor: collapsible ? 'pointer' : 'default',
              textAlign: 'left',
              color: '#064e3b',
            }}
          >
            <div style={{ minWidth: 0, display: 'grid', gap: '0.12rem', flex: 1 }}>
              <div style={{ color: '#064e3b', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name.trim() || 'Unnamed Style'}
              </div>
            </div>
            {collapsible ? (
              <ChevronDown
                size={16}
                style={{
                  color: '#0d9488',
                  flexShrink: 0,
                  transition: 'transform 180ms ease',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
              />
            ) : null}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete asset"
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '999px',
              border: '1px solid rgba(239,68,68,0.18)',
              background: 'rgba(254,242,242,0.96)',
              color: '#b91c1c',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}

      {!collapsible || !isCollapsed ? (
        <>
          {!showHeader ? (
            <label style={labelStyle}>
              Name
              <input
                value={item.name}
                onChange={(event) => onChange({ ...item, name: event.target.value })}
                placeholder={namePlaceholder}
                style={inputStyle}
              />
            </label>
          ) : null}

          <label style={labelStyle}>
            Description
            <textarea
              value={item.description}
              onChange={(event) => onChange({ ...item, description: event.target.value })}
              placeholder={descriptionPlaceholder}
              style={{ ...textareaStyle, minHeight: '88px' }}
            />
          </label>
        </>
      ) : null}

      {showTags ? (
        <label style={labelStyle}>
          Tags
          <input
            value={formatTagList(item.tags)}
            onChange={(event) => onChange({ ...item, tags: parseTagList(event.target.value) })}
            placeholder="boss, undead, swamp, brass"
            style={inputStyle}
          />
        </label>
      ) : null}
    </div>
  );
}

function IconAssetCard({
  project,
  item,
  onChange,
  onRemove,
  onAssignPaletteColor,
}: {
  project: EditorProject;
  item: EditorIconAsset;
  onChange: (next: EditorIconAsset) => void;
  onRemove: () => void;
  onAssignPaletteColor: (paletteId: string, value: string) => void;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const paletteOptions = listProjectPaletteOptions(project);
  const selectedOption = EDITOR_ICON_OPTIONS.find((option) => option.key === item.iconKey) ?? EDITOR_ICON_OPTIONS[0];
  const displayName = item.name.trim() || (item.mode === 'custom' ? 'Custom Icon' : selectedOption.label) || item.inlineCode.trim() || 'New Icon';
  const filteredOptions = EDITOR_ICON_OPTIONS.filter((option) => {
    const query = iconSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return option.label.toLowerCase().includes(query) || option.key.toLowerCase().includes(query);
  });

  return (
    <div style={{ borderRadius: '18px', border: '1px solid rgba(15,118,110,0.1)', background: 'rgba(248,250,252,0.86)', padding: '0.9rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-expanded={!isCollapsed}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.2rem 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: '#064e3b',
          }}
        >
          <IconArtworkPreview item={item} project={project} size={isCollapsed ? 40 : 48} />
          <div style={{ minWidth: 0, display: 'grid', gap: '0.12rem', flex: 1 }}>
            <div style={{ color: '#064e3b', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            {!isCollapsed ? (
              <div style={{ color: '#0f766e', fontSize: '0.76rem' }}>
                {item.inlineCode.trim() || (item.mode === 'library' ? formatInlineCodeFromIconKey(item.iconKey) : ':custom:')}
              </div>
            ) : null}
          </div>
          <ChevronDown
            size={16}
            style={{
              color: '#0d9488',
              flexShrink: 0,
              transition: 'transform 180ms ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete icon"
          style={{
            width: '34px',
            height: '34px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '999px',
            border: '1px solid rgba(239,68,68,0.18)',
            background: 'rgba(254,242,242,0.96)',
            color: '#b91c1c',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {!isCollapsed ? (
        <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: '0.75rem' }}>
        <label style={labelStyle}>
          Icon Name
          <input
            value={item.name}
            onChange={(event) => onChange({ ...item, name: event.target.value })}
            placeholder="Attack"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Inline Code
          <input
            value={item.inlineCode}
            onChange={(event) => onChange({ ...item, inlineCode: event.target.value })}
            placeholder=":attack:"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 196px', gap: '0.75rem', alignItems: 'stretch' }}>
        <label style={labelStyle}>
          Meaning / Art Notes
          <textarea
            value={item.description}
            onChange={(event) => onChange({ ...item, description: event.target.value })}
            placeholder="What this icon communicates, where it appears, and what visual system it should match."
            style={{ ...textareaStyle, minHeight: '208px' }}
          />
        </label>

        <div style={{ display: 'grid', gap: '0.55rem' }}>
          <span style={labelStyle}>Icon Artwork</span>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(15,118,110,0.14)',
              background: 'rgba(255,255,255,0.94)',
              padding: '0.85rem 0.75rem',
              display: 'grid',
              justifyItems: 'center',
              alignContent: 'center',
              gap: '0.55rem',
              cursor: 'pointer',
              color: '#064e3b',
              minHeight: '208px',
              height: '100%',
            }}
          >
            <IconArtworkPreview item={item} project={project} size={72} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700 }}>
              <span>{item.mode === 'custom' ? 'Custom Icon' : selectedOption.label}</span>
              <ChevronDown size={14} />
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065f46', textAlign: 'center' }}>
              Edit Icon
            </div>
            <div style={{ fontSize: '0.72rem', color: '#0f766e', textAlign: 'center', lineHeight: 1.4 }}>
              Open the icon editor to switch modes, style the tile, or choose from the library.
            </div>
          </button>
        </div>
      </div>

      {isPickerOpen ? (
        <div
          onClick={() => setIsPickerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(6,78,59,0.22)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit icon"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(1320px, calc(100vw - 2rem))',
              height: 'min(860px, calc(100vh - 2rem))',
              borderRadius: '26px',
              border: '1px solid rgba(15,118,110,0.12)',
              background: 'rgba(255,255,255,0.98)',
              boxShadow: '0 32px 70px rgba(15,23,42,0.18)',
              padding: '1.15rem',
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: '1rem',
              overflow: 'visible',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.18rem' }}>
                <div style={{ color: '#064e3b', fontWeight: 800, fontSize: '1.02rem' }}>Edit Icon</div>
                <div style={{ color: '#0f766e', fontSize: '0.82rem' }}>
                  Pick from the shared library and keep this icon asset aligned with your board game visual language.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                aria-label="Close icon editor"
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '999px',
                  border: '1px solid rgba(15,118,110,0.14)',
                  background: 'rgba(248,250,252,0.96)',
                  color: '#065f46',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '1rem', minHeight: 0, alignItems: 'stretch' }}>
              <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', gap: '0.75rem', minHeight: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.28rem', borderRadius: '999px', background: 'rgba(240,253,244,0.92)', width: 'fit-content' }}>
                  {[
                    { id: 'library' as const, label: 'Use Existing Icon' },
                    { id: 'custom' as const, label: 'Completely Custom Icon' },
                  ].map((modeOption) => (
                    <button
                      key={modeOption.id}
                      type="button"
                      onClick={() => onChange({
                        ...item,
                        mode: modeOption.id,
                      })}
                      style={{
                        border: 'none',
                        borderRadius: '999px',
                        padding: '0.55rem 0.9rem',
                        background: item.mode === modeOption.id ? 'linear-gradient(135deg, #0f766e, #14b8a6)' : 'transparent',
                        color: item.mode === modeOption.id ? '#ffffff' : '#065f46',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {modeOption.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    minHeight: 0,
                    borderRadius: '22px',
                    border: '1px solid rgba(15,118,110,0.1)',
                    background: 'rgba(248,250,252,0.84)',
                    padding: '0.9rem',
                    display: 'grid',
                    overflow: 'hidden',
                  }}
                >
                  {item.mode === 'library' ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: 'auto minmax(0, 1fr)',
                        gap: '0.75rem',
                        minHeight: 0,
                      }}
                    >
                      <div style={{ color: '#064e3b', fontWeight: 800, fontSize: '0.9rem' }}>Select From Library</div>
                      <div style={{ display: 'grid', gap: '0.65rem', minHeight: 0 }}>
                        <label style={labelStyle}>
                          Search Icons
                          <input
                            value={iconSearch}
                            onChange={(event) => setIconSearch(event.target.value)}
                            placeholder="Search icons"
                            style={inputStyle}
                          />
                        </label>

                        <div
                          style={{
                            minHeight: 0,
                            overflowY: 'auto',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                            gap: '0.55rem',
                            paddingRight: '0.1rem',
                          }}
                        >
                          {filteredOptions.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => {
                                const shouldSyncName = item.name.trim().length === 0 || item.name === selectedOption.label;
                                const shouldSyncInlineCode = item.inlineCode.trim().length === 0 || item.inlineCode === formatInlineCodeFromIconKey(selectedOption.key);

                                onChange({
                                  ...item,
                                  iconKey: option.key,
                                  name: shouldSyncName ? option.label : item.name,
                                  inlineCode: shouldSyncInlineCode ? formatInlineCodeFromIconKey(option.key) : item.inlineCode,
                                });
                              }}
                              style={{
                                borderRadius: '16px',
                                border: option.key === item.iconKey ? '1px solid rgba(13,148,136,0.45)' : '1px solid rgba(15,118,110,0.1)',
                                background: option.key === item.iconKey ? 'rgba(240,253,250,0.98)' : 'rgba(255,255,255,0.95)',
                                padding: '0.7rem 0.5rem',
                                display: 'grid',
                                justifyItems: 'center',
                                gap: '0.45rem',
                                cursor: 'pointer',
                                color: '#065f46',
                              }}
                            >
                              {renderIcon(option.key, {
                                size: 22,
                                strokeWidth: item.iconStrokeWidth,
                                fillColor: resolveEditorColor(project, item.iconFillColor),
                                style: { color: resolveEditorColor(project, item.iconColor) },
                              })}
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateRows: 'auto minmax(0, 1fr) auto',
                        gap: '0.75rem',
                        minHeight: 0,
                      }}
                    >
                      <div style={{ color: '#064e3b', fontWeight: 800, fontSize: '0.9rem' }}>Custom Icon</div>
                      <label style={{ ...labelStyle, minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
                        SVG Markup Or Glyph
                        <textarea
                          value={item.customSvgMarkup}
                          onChange={(event) => onChange({ ...item, customSvgMarkup: event.target.value })}
                          placeholder="<svg viewBox='0 0 24 24' fill='none' stroke='currentColor'>...</svg>"
                          style={{ ...textareaStyle, minHeight: 0, height: '100%' }}
                        />
                      </label>
                      <div style={{ padding: '0.8rem 0.95rem', borderRadius: '16px', background: 'rgba(239,246,255,0.92)', color: '#155e75', lineHeight: 1.5, fontSize: '0.8rem' }}>
                        Custom icons can use raw SVG or a short glyph. SVG that uses `currentColor` will follow the icon color control automatically.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ color: '#0f766e', fontSize: '0.8rem' }}>
                    {item.mode === 'library'
                      ? `${filteredOptions.length} icon${filteredOptions.length === 1 ? '' : 's'} available`
                      : 'Custom icon mode lets you author your own artwork.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    style={{
                      borderRadius: '999px',
                      border: '1px solid rgba(15,118,110,0.14)',
                      background: 'rgba(240,253,244,0.96)',
                      color: '#065f46',
                      padding: '0.55rem 0.95rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', gap: '0.75rem', minHeight: 0, overflow: 'visible' }}>
                <div
                  style={{
                    borderRadius: '22px',
                    border: '1px solid rgba(15,118,110,0.12)',
                    background: 'linear-gradient(180deg, rgba(240,253,244,0.98), rgba(236,253,245,0.82))',
                    padding: '1rem',
                    display: 'grid',
                    gap: '0.85rem',
                    justifyItems: 'center',
                  }}
                >
                  <IconArtworkPreview item={item} project={project} size={112} />
                  <div style={{ color: '#064e3b', fontWeight: 800, textAlign: 'center' }}>
                    {item.name.trim() || (item.mode === 'custom' ? 'Custom Icon' : selectedOption.label)}
                  </div>
                  <div style={{ color: '#0f766e', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center' }}>
                    {item.inlineCode.trim() || (item.mode === 'library' ? formatInlineCodeFromIconKey(item.iconKey) : ':custom:')}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', minHeight: 0, overflowY: 'auto', paddingRight: '0.1rem', alignContent: 'start' }}>
                  <InspectorAccordion title="Icon Style" compact>
                    <InspectorColorField
                      label="Stroke Color"
                      value={item.iconColor}
                      onChange={(value) => onChange({ ...item, iconColor: value })}
                      palette={paletteOptions}
                      onAssignPaletteColor={onAssignPaletteColor}
                    />
                    <InspectorColorField
                      label="Fill Color"
                      value={item.iconFillColor}
                      onChange={(value) => onChange({ ...item, iconFillColor: value })}
                      palette={paletteOptions}
                      onAssignPaletteColor={onAssignPaletteColor}
                    />
                    <label style={labelStyle}>
                      Thickness
                      <NumericInput
                        min={0.5}
                        max={8}
                        step={0.1}
                        value={item.iconStrokeWidth}
                        onValueChange={(value) => onChange({
                          ...item,
                          iconStrokeWidth: Math.max(0.5, value),
                        })}
                        style={inputStyle}
                      />
                    </label>
                  </InspectorAccordion>

                  <InspectorAppearanceControls
                    scopeLabel="Tile"
                    backgroundLabel="Fill"
                    backgroundValue={item.backgroundColor}
                    onBackgroundChange={(value) => onChange({ ...item, backgroundColor: value })}
                    palette={paletteOptions}
                    onAssignPaletteColor={onAssignPaletteColor}
                    texture={{
                      value: item.backgroundTextureId,
                      onChange: (value) => onChange({ ...item, backgroundTextureId: value }),
                      opacity: item.backgroundTextureOpacity,
                      onOpacityChange: (value) => onChange({ ...item, backgroundTextureOpacity: value }),
                      previewBackground: item.backgroundColor,
                    }}
                    accordionCompact
                    border={{
                      colorValue: item.borderColor,
                      onColorChange: (value) => onChange({ ...item, borderColor: value }),
                      controls: (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                          <label style={labelStyle}>
                            Width
                            <NumericInput
                              min={0}
                              max={24}
                              step={1}
                              value={item.borderWidth}
                              onValueChange={(value) => onChange({
                                ...item,
                                borderWidth: clampNonNegativeNumber(value, item.borderWidth),
                              })}
                              style={inputStyle}
                            />
                          </label>
                          <label style={labelStyle}>
                            Radius
                            <NumericInput
                              min={0}
                              max={999}
                              step={1}
                              value={item.borderRadius}
                              onValueChange={(value) => onChange({
                                ...item,
                                borderRadius: clampNonNegativeNumber(value, item.borderRadius),
                              })}
                              style={inputStyle}
                            />
                          </label>
                        </div>
                      ),
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

        </>
      ) : null}
    </div>
  );
}

export function ArtSection({
  project,
  onUpdateArt,
  onUpdateTheme,
  onAssignPaletteColor,
}: {
  project: EditorProject;
  onUpdateArt: (updater: (art: EditorProject['art']) => EditorProject['art']) => void;
  onUpdateTheme: (value: string) => void;
  onAssignPaletteColor: (paletteId: string, value: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '980px' }}>
      <div style={{ ...panelStyle, display: 'grid', gap: '1rem' }}>
        <p style={sectionTitleStyle}>Art Direction</p>

        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '440px' }}>
          <label style={labelStyle}>
            Theme
            <input
              value={project.art.theme}
              onChange={(event) => onUpdateTheme(event.target.value)}
              placeholder="Clockwork jungle rebellion"
              style={inputStyle}
            />
          </label>
        </div>
      </div>

      <div style={{ ...panelStyle, display: 'grid', gap: '0.9rem' }}>
        <AssetSectionHeader
          title="Defined Art Styles"
          description="Capture the specific styles this project can draw from, mix, or switch between."
          onAdd={() => onUpdateArt((art) => ({
            ...art,
            definedArtStyles: addReferenceAsset(art.definedArtStyles),
          }))}
        />

        {project.art.definedArtStyles.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {project.art.definedArtStyles.map((style) => (
              <ArtReferenceCard
                key={style.id}
                item={{ ...style, category: '', tags: [] }}
                showCategory={false}
                showTags={false}
                showHeader={false}
                collapsible
                namePlaceholder="Painterly storybook"
                descriptionPlaceholder="Describe the visual lane this style represents so it can later be offered as an art-generation option."
                onChange={(next) => onUpdateArt((art) => ({
                  ...art,
                  definedArtStyles: art.definedArtStyles.map((entry) => entry.id === style.id ? { ...next, category: '', tags: [] } : entry),
                }))}
                onRemove={() => onUpdateArt((art) => ({
                  ...art,
                  definedArtStyles: art.definedArtStyles.filter((entry) => entry.id !== style.id),
                }))}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '0.95rem 1rem', borderRadius: '18px', background: 'rgba(248,250,252,0.82)', color: '#0f766e' }}>
            No art styles yet. Add one to define visual lanes like painterly boards, flat icons, or monochrome event cards.
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, display: 'grid', gap: '0.9rem' }}>
        <AssetSectionHeader
          title="Recurring Assets"
          description="Track reusable characters, locations, factions, monsters, props, and other motifs the project should keep consistent."
          onAdd={() => onUpdateArt((art) => ({
            ...art,
            recurringAssets: addReferenceAsset(art.recurringAssets, { category: 'Character' }),
          }))}
        />

        {project.art.recurringAssets.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {project.art.recurringAssets.map((asset) => (
              <ArtReferenceCard
                key={asset.id}
                item={asset}
                categoryLabel="Asset Type"
                categoryPlaceholder="Character, location, monster, relic"
                onChange={(next) => onUpdateArt((art) => ({
                  ...art,
                  recurringAssets: art.recurringAssets.map((entry) => entry.id === asset.id ? next : entry),
                }))}
                onRemove={() => onUpdateArt((art) => ({
                  ...art,
                  recurringAssets: art.recurringAssets.filter((entry) => entry.id !== asset.id),
                }))}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '0.95rem 1rem', borderRadius: '18px', background: 'rgba(248,250,252,0.82)', color: '#0f766e' }}>
            No recurring assets yet. Add the monsters, locations, heroes, and props that need visual continuity across the game.
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, display: 'grid', gap: '0.9rem' }}>
        <AssetSectionHeader
          title="Icons"
          description="Define gameplay icons as durable assets, complete with inline codes for future text and UI placement."
          onAdd={() => onUpdateArt((art) => ({
            ...art,
            icons: addIconAsset(art.icons),
          }))}
        />

        {project.art.icons.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {project.art.icons.map((icon) => (
              <IconAssetCard
                key={icon.id}
                project={project}
                item={icon}
                onChange={(next) => onUpdateArt((art) => ({
                  ...art,
                  icons: art.icons.map((entry) => entry.id === icon.id ? next : entry),
                }))}
                onRemove={() => onUpdateArt((art) => ({
                  ...art,
                  icons: art.icons.filter((entry) => entry.id !== icon.id),
                }))}
                onAssignPaletteColor={onAssignPaletteColor}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '0.95rem 1rem', borderRadius: '18px', background: 'rgba(248,250,252,0.82)', color: '#0f766e' }}>
            No icons yet. Add shared symbols like `:attack:`, `:move:`, or `:vp:` so the system can treat them as reusable board-game primitives later.
          </div>
        )}
      </div>
    </div>
  );
}
