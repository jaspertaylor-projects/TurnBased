import { useState } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';

import { NumericInput } from '../../../components/NumericInput';
import { InspectorAccordion, InspectorAppearanceControls, InspectorColorField } from '../../components/InspectorControls';
import { EDITOR_ICON_OPTIONS, renderIcon } from '../../iconography';
import { listProjectPaletteOptions } from '../../projectPalette';
import { inputStyle, labelStyle, textareaStyle } from '../../styles';
import type { EditorIconAsset, EditorProject } from '../../types';
import { clampNonNegativeNumber, formatInlineCodeFromIconKey, resolveEditorColor } from './artUtils';
import { IconArtworkPreview } from './IconArtworkPreview';

export function IconAssetCard({
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
                    <label style={labelStyle}>
                      Icon Scale
                      <NumericInput
                        min={0.3}
                        max={1.5}
                        step={0.05}
                        value={item.iconScale ?? 1}
                        onValueChange={(value) => onChange({
                          ...item,
                          iconScale: Math.max(0.3, Math.min(1.5, value)),
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
