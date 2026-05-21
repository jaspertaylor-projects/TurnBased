import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AlignCenter, AlignCenterHorizontal, AlignEndHorizontal, AlignLeft, AlignRight, AlignStartHorizontal, Bold, Italic, Link as LinkIcon, Underline, Unlink } from 'lucide-react';
import type { PaletteColorOption } from '@turnbased/engine-ui';

import { NumericInput } from '../../components/NumericInput';
import { resolveProjectPaletteColorValue } from '../projectPalette';
import { inputStyle, labelStyle } from '../styles';
import type { EditorProject } from '../types';
import { InspectorAccordion, InspectorColorField } from './InspectorControls';
import {
  FONT_FAMILY_MAP,
  ProjectInlineIcon,
  TEXT_BOX_FONT_OPTIONS,
  getProjectIconToken,
  resolveTextBoxProperties,
} from './TextBoxContent';

const compactInputStyle = {
  ...inputStyle,
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
};

function CommandButton({
  title,
  active = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Preserve the editor's selection when clicking toolbar buttons —
      // otherwise mousedown on the button moves focus away from the
      // contentEditable and the caller has to restore it manually.
      onMouseDown={(e) => e.preventDefault()}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '34px',
        height: '34px',
        borderRadius: '10px',
        border: active ? '1px solid rgba(13,148,136,0.4)' : '1px solid rgba(15,118,110,0.12)',
        background: active ? 'rgba(240,253,250,0.98)' : 'rgba(255,255,255,0.94)',
        color: active ? '#0f766e' : '#065f46',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function TextBoxInspector({
  project,
  properties,
  paletteOptions,
  onAssignProjectPaletteColor,
  onUpdateProperties,
}: {
  project: EditorProject;
  properties: Record<string, unknown>;
  paletteOptions: readonly PaletteColorOption[];
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
  onUpdateProperties: (updater: (properties: Record<string, unknown>) => Record<string, unknown>) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  // Last selection range inside the editor. Tracked so toolbar / icon-insert
  // buttons can restore the caret position the user had before clicking,
  // otherwise clicks blur the editor and execCommand has nowhere to act.
  const lastRangeRef = useRef<Range | null>(null);
  const resolved = resolveTextBoxProperties(properties);
  const resolvedColor = resolveProjectPaletteColorValue(project.settings.colorPalette, resolved.textColor) ?? resolved.textColor;

  // Seed the contentEditable once on mount. Subsequent edits flow user →
  // onInput → parent state, so we must NOT write resolved.contentHtml back
  // into innerHTML on every render — that re-parses the DOM and collapses
  // the selection to the start mid-typing. If the selection changes (parent
  // swaps to a different text-box), the parent already keys this component
  // by instance id, so this effectively re-runs on instance change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = resolved.contentHtml;
    }
  }, []);

  // Toolbar toggle state (bold/italic/underline). Browsers expose this via
  // the legacy queryCommandState API which is still the simplest source of
  // truth that also accounts for pure-mouse-selection changes.
  const [formatState, setFormatState] = useState<{ bold: boolean; italic: boolean; underline: boolean }>({
    bold: false,
    italic: false,
    underline: false,
  });

  useEffect(() => {
    function refreshFormatState() {
      const active = document.activeElement;
      const editor = editorRef.current;
      if (!editor || active !== editor) return;
      try {
        setFormatState({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
        });
      } catch {
        // Some browsers throw on detached selection; ignore.
      }
    }

    function captureSelection() {
      const sel = window.getSelection();
      const editor = editorRef.current;
      if (!editor || !sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        lastRangeRef.current = range.cloneRange();
        refreshFormatState();
      }
    }

    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, []);

  function syncEditorHtml() {
    onUpdateProperties((current) => ({
      ...current,
      contentHtml: editorRef.current?.innerHTML ?? '',
    }));
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = lastRangeRef.current;
    if (range && editor.contains(range.commonAncestorContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  function applyCommand(command: string) {
    restoreSelection();
    document.execCommand(command, false);
    // Capture the new range after the command runs so follow-up commands keep
    // operating on the same selection.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      lastRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    syncEditorHtml();
    // Reflect the new toggle state immediately; selectionchange may not fire
    // if the selection didn't move.
    try {
      setFormatState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    } catch { /* ignore */ }
  }

  function insertToken(token: string) {
    restoreSelection();
    document.execCommand('insertText', false, token);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      lastRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    syncEditorHtml();
  }

  // Link-all-sides toggle for the inset group. When on, editing any side
  // writes the same value to all four — matches how most CSS inset editors
  // work (Figma, DevTools, etc.) and avoids the common case of entering the
  // same number four times.
  const [insetLinked, setInsetLinked] = useState<boolean>(
    () => resolved.paddingTop === resolved.paddingRight
      && resolved.paddingRight === resolved.paddingBottom
      && resolved.paddingBottom === resolved.paddingLeft,
  );

  function updateInset(side: 'top' | 'right' | 'bottom' | 'left', value: number) {
    onUpdateProperties((current) => {
      if (insetLinked) {
        return {
          ...current,
          paddingTop: value,
          paddingRight: value,
          paddingBottom: value,
          paddingLeft: value,
        };
      }
      return {
        ...current,
        [`padding${side.charAt(0).toUpperCase() + side.slice(1)}`]: value,
      };
    });
  }

  return (
    <>
      <InspectorAccordion title="Text" defaultOpen>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {/* True WYSIWYG preview — mirrors TextBoxContent's typography
              (font, size, color, alignment, leading-trim) so creators edit
              in the same visual context the board will render in. A faint
              outer frame keeps the edit target discoverable without adding
              fake padding. */}
          <div
            style={{
              position: 'relative',
              minHeight: '128px',
              maxHeight: '260px',
              overflow: 'auto',
              borderRadius: '12px',
              border: '1px solid rgba(15,118,110,0.12)',
              background: 'rgba(255,255,255,0.96)',
              padding: `${resolved.paddingTop}px ${resolved.paddingRight}px ${resolved.paddingBottom}px ${resolved.paddingLeft}px`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: resolved.verticalAlign === 'start'
                ? 'flex-start'
                : resolved.verticalAlign === 'end'
                  ? 'flex-end'
                  : 'center',
              boxSizing: 'border-box',
            }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncEditorHtml}
              onBlur={syncEditorHtml}
              style={{
                width: '100%',
                outline: 'none',
                color: resolvedColor,
                fontFamily: FONT_FAMILY_MAP[resolved.fontFamily],
                fontSize: `${resolved.fontSize}px`,
                lineHeight: resolved.lineHeight,
                textAlign: resolved.textAlign,
                overflowWrap: 'anywhere',
                textBoxTrim: 'trim-both',
                textBoxEdge: 'cap alphabetic',
              } as CSSProperties}
            />
          </div>

          {project.art.icons.length > 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.4 }}>
              Use <code style={{ background: 'rgba(15,118,110,0.06)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>:icon_name:</code> to insert project icons.
            </div>
          ) : null}
        </div>
      </InspectorAccordion>

      <InspectorAccordion title="Typography & Alignment" defaultOpen>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-end' }}>
            <CommandButton title="Bold (Ctrl/Cmd+B)" active={formatState.bold} onClick={() => applyCommand('bold')}>
              <Bold size={15} />
            </CommandButton>
            <CommandButton title="Italic (Ctrl/Cmd+I)" active={formatState.italic} onClick={() => applyCommand('italic')}>
              <Italic size={15} />
            </CommandButton>
            <CommandButton title="Underline (Ctrl/Cmd+U)" active={formatState.underline} onClick={() => applyCommand('underline')}>
              <Underline size={15} />
            </CommandButton>
            <div style={{ width: '1px', alignSelf: 'stretch', background: 'rgba(15,118,110,0.15)', margin: '0 0.1rem' }} />
            <label style={{ ...labelStyle, flex: 1, minWidth: 0 }}>
              Size
              <NumericInput
                value={resolved.fontSize}
                min={10}
                max={96}
                step={1}
                onValueChange={(value) => onUpdateProperties((current) => ({
                  ...current,
                  fontSize: value,
                }))}
                style={{ ...compactInputStyle, padding: '0.48rem 0.5rem' }}
              />
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: 0 }}>
              Height
              <NumericInput
                value={resolved.lineHeight}
                min={1}
                max={2.4}
                step={0.1}
                onValueChange={(value) => onUpdateProperties((current) => ({
                  ...current,
                  lineHeight: value,
                }))}
                style={{ ...compactInputStyle, padding: '0.48rem 0.5rem' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <CommandButton title="Align left" active={resolved.textAlign === 'left'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              textAlign: 'left',
            }))}>
              <AlignLeft size={15} />
            </CommandButton>
            <CommandButton title="Align center" active={resolved.textAlign === 'center'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              textAlign: 'center',
            }))}>
              <AlignCenter size={15} />
            </CommandButton>
            <CommandButton title="Align right" active={resolved.textAlign === 'right'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              textAlign: 'right',
            }))}>
              <AlignRight size={15} />
            </CommandButton>
            <div style={{ width: '1px', height: '20px', background: 'rgba(15,118,110,0.15)', margin: '0 0.1rem' }} />
            <CommandButton title="Align top" active={resolved.verticalAlign === 'start'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              verticalAlign: 'start',
            }))}>
              <AlignStartHorizontal size={15} />
            </CommandButton>
            <CommandButton title="Align middle" active={resolved.verticalAlign === 'center'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              verticalAlign: 'center',
            }))}>
              <AlignCenterHorizontal size={15} />
            </CommandButton>
            <CommandButton title="Align bottom" active={resolved.verticalAlign === 'end'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              verticalAlign: 'end',
            }))}>
              <AlignEndHorizontal size={15} />
            </CommandButton>
          </div>

          <label style={labelStyle}>
            Font Family
            <select
              value={resolved.fontFamily}
              onChange={(event) => onUpdateProperties((current) => ({
                ...current,
                fontFamily: event.target.value,
              }))}
              style={compactInputStyle}
            >
              {TEXT_BOX_FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <InspectorColorField
            label="Text Color"
            value={resolved.textColor}
            onChange={(value) => onUpdateProperties((current) => ({
              ...current,
              textColor: value,
            }))}
            palette={paletteOptions}
            onAssignPaletteColor={onAssignProjectPaletteColor}
          />

          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#0f766e' }}>Inset</span>
              <button
                type="button"
                onClick={() => setInsetLinked((v) => !v)}
                title={insetLinked ? 'Unlink sides (edit individually)' : 'Link sides (edit all at once)'}
                aria-label={insetLinked ? 'Unlink inset sides' : 'Link inset sides'}
                aria-pressed={insetLinked}
                data-testid="inset-link-toggle"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  border: insetLinked ? '1px solid rgba(13,148,136,0.4)' : '1px solid rgba(15,118,110,0.12)',
                  background: insetLinked ? 'rgba(240,253,250,0.98)' : 'rgba(255,255,255,0.94)',
                  color: insetLinked ? '#0f766e' : '#065f46',
                  cursor: 'pointer',
                }}
              >
                {insetLinked ? <LinkIcon size={13} /> : <Unlink size={13} />}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.35rem' }}>
              <label style={labelStyle}>
                Top
                <NumericInput
                  value={resolved.paddingTop}
                  min={0}
                  max={64}
                  step={1}
                  onValueChange={(value) => updateInset('top', value)}
                  style={compactInputStyle}
                />
              </label>
              <label style={labelStyle}>
                Right
                <NumericInput
                  value={resolved.paddingRight}
                  min={0}
                  max={64}
                  step={1}
                  onValueChange={(value) => updateInset('right', value)}
                  style={compactInputStyle}
                />
              </label>
              <label style={labelStyle}>
                Bottom
                <NumericInput
                  value={resolved.paddingBottom}
                  min={0}
                  max={64}
                  step={1}
                  onValueChange={(value) => updateInset('bottom', value)}
                  style={compactInputStyle}
                />
              </label>
              <label style={labelStyle}>
                Left
                <NumericInput
                  value={resolved.paddingLeft}
                  min={0}
                  max={64}
                  step={1}
                  onValueChange={(value) => updateInset('left', value)}
                  style={compactInputStyle}
                />
              </label>
            </div>
          </div>
        </div>
      </InspectorAccordion>

      {project.art.icons.length > 0 ? (
        <InspectorAccordion title="Project Icons">
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ color: '#0f766e', fontSize: '0.76rem', lineHeight: 1.45 }}>
              Click an icon token to insert it at the cursor position.
            </div>
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {project.art.icons.map((icon) => {
                const token = getProjectIconToken(icon);

                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => insertToken(token)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      width: '100%',
                      borderRadius: '14px',
                      border: '1px solid rgba(15,118,110,0.12)',
                      background: 'rgba(255,255,255,0.96)',
                      padding: '0.55rem 0.65rem',
                      color: '#064e3b',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                      <ProjectInlineIcon project={project} item={icon} size={28} />
                      <span style={{ display: 'grid', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {icon.name || token}
                        </span>
                        <span style={{ color: '#0f766e', fontSize: '0.76rem' }}>{token}</span>
                      </span>
                    </span>
                    <span style={{ color: '#0f766e', fontSize: '0.76rem', fontWeight: 700 }}>Insert</span>
                  </button>
                );
              })}
            </div>
          </div>
        </InspectorAccordion>
      ) : null}

    </>
  );
}
