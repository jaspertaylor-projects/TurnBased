import { useEffect, useRef, type ReactNode } from 'react';
import { AlignCenter, AlignCenterHorizontal, AlignEndHorizontal, AlignLeft, AlignRight, AlignStartHorizontal, Bold, Italic, Underline } from 'lucide-react';
import type { PaletteColorOption } from '@turnbased/engine-ui';

import { NumericInput } from '../../components/NumericInput';
import { inputStyle, labelStyle } from '../styles';
import type { EditorProject } from '../types';
import { InspectorAccordion, InspectorColorField } from './InspectorControls';
import {
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
      title={title}
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
  const resolved = resolveTextBoxProperties(properties);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== resolved.contentHtml) {
      editorRef.current.innerHTML = resolved.contentHtml;
    }
  }, [resolved.contentHtml]);

  function syncEditorHtml() {
    onUpdateProperties((current) => ({
      ...current,
      contentHtml: editorRef.current?.innerHTML ?? '',
    }));
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function applyCommand(command: string) {
    focusEditor();
    document.execCommand(command, false);
    syncEditorHtml();
  }

  function insertToken(token: string) {
    focusEditor();
    document.execCommand('insertText', false, token);
    syncEditorHtml();
  }

  return (
    <>
      <InspectorAccordion title="Text" defaultOpen>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncEditorHtml}
            onBlur={syncEditorHtml}
            style={{
              minHeight: '128px',
              borderRadius: '12px',
              border: '1px solid rgba(15,118,110,0.12)',
              background: 'rgba(255,255,255,0.96)',
              padding: '0.7rem 0.8rem',
              color: '#064e3b',
              fontSize: '0.92rem',
              lineHeight: 1.45,
              outline: 'none',
              overflowY: 'auto',
            }}
          />

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
            <CommandButton title="Bold (Ctrl/Cmd+B)" onClick={() => applyCommand('bold')}>
              <Bold size={15} />
            </CommandButton>
            <CommandButton title="Italic (Ctrl/Cmd+I)" onClick={() => applyCommand('italic')}>
              <Italic size={15} />
            </CommandButton>
            <CommandButton title="Underline (Ctrl/Cmd+U)" onClick={() => applyCommand('underline')}>
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
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#0f766e' }}>Inset</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.35rem' }}>
              <label style={labelStyle}>
                Top
                <NumericInput
                  value={resolved.paddingTop}
                  min={0}
                  max={64}
                  step={1}
                  onValueChange={(value) => onUpdateProperties((current) => ({
                    ...current,
                    paddingTop: value,
                  }))}
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
                  onValueChange={(value) => onUpdateProperties((current) => ({
                    ...current,
                    paddingRight: value,
                  }))}
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
                  onValueChange={(value) => onUpdateProperties((current) => ({
                    ...current,
                    paddingBottom: value,
                  }))}
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
                  onValueChange={(value) => onUpdateProperties((current) => ({
                    ...current,
                    paddingLeft: value,
                  }))}
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
