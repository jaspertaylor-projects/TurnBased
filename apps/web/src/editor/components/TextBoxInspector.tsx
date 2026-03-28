import { useEffect, useRef, type ReactNode } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Underline } from 'lucide-react';
import type { PaletteColorOption } from '@turnbased/engine-ui';

import { NumericInput } from '../../components/NumericInput';
import { inputStyle, labelStyle } from '../styles';
import type { EditorProject } from '../types';
import { InspectorAccordion, InspectorColorField } from './InspectorControls';
import {
  ProjectInlineIcon,
  TEXT_BOX_FONT_OPTIONS,
  TEXT_BOX_VERTICAL_ALIGN_OPTIONS,
  TextBoxContent,
  getProjectIconToken,
  resolveTextBoxProperties,
} from './TextBoxContent';

const compactInputStyle = {
  ...inputStyle,
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
};

function formatCommandLabel(value: string): string {
  if (value === 'start') {
    return 'Top';
  }

  if (value === 'end') {
    return 'Bottom';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <CommandButton title="Bold (Ctrl/Cmd+B)" onClick={() => applyCommand('bold')}>
              <Bold size={15} />
            </CommandButton>
            <CommandButton title="Italic (Ctrl/Cmd+I)" onClick={() => applyCommand('italic')}>
              <Italic size={15} />
            </CommandButton>
            <CommandButton title="Underline (Ctrl/Cmd+U)" onClick={() => applyCommand('underline')}>
              <Underline size={15} />
            </CommandButton>
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
            <CommandButton title="Justify" active={resolved.textAlign === 'justify'} onClick={() => onUpdateProperties((current) => ({
              ...current,
              textAlign: 'justify',
            }))}>
              <AlignJustify size={15} />
            </CommandButton>
          </div>

          <div
            style={{
              color: '#0f766e',
              fontSize: '0.76rem',
              lineHeight: 1.45,
            }}
          >
            Rich text shortcuts work here. Use <code>:icon_name:</code> tokens or tap a project icon below to insert one.
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncEditorHtml}
            onBlur={syncEditorHtml}
            style={{
              minHeight: '148px',
              borderRadius: '14px',
              border: '1px solid rgba(15,118,110,0.12)',
              background: 'rgba(255,255,255,0.96)',
              padding: '0.8rem 0.9rem',
              color: '#064e3b',
              lineHeight: 1.45,
              outline: 'none',
              overflowY: 'auto',
            }}
          />
        </div>
      </InspectorAccordion>

      <InspectorAccordion title="Typography">
        <div style={{ display: 'grid', gap: '0.6rem' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.6rem' }}>
            <label style={labelStyle}>
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
                style={compactInputStyle}
              />
            </label>
            <label style={labelStyle}>
              Line Height
              <NumericInput
                value={resolved.lineHeight}
                min={1}
                max={2.4}
                step={0.1}
                onValueChange={(value) => onUpdateProperties((current) => ({
                  ...current,
                  lineHeight: value,
                }))}
                style={compactInputStyle}
              />
            </label>
            <label style={labelStyle}>
              Padding
              <NumericInput
                value={resolved.padding}
                min={0}
                max={64}
                step={1}
                onValueChange={(value) => onUpdateProperties((current) => ({
                  ...current,
                  padding: value,
                }))}
                style={compactInputStyle}
              />
            </label>
          </div>

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

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ ...labelStyle, gap: '0.45rem' }}>
              Vertical Align
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {TEXT_BOX_VERTICAL_ALIGN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdateProperties((current) => ({
                    ...current,
                    verticalAlign: option.value,
                  }))}
                  style={{
                    borderRadius: '999px',
                    border: option.value === resolved.verticalAlign ? '1px solid rgba(13,148,136,0.4)' : '1px solid rgba(15,118,110,0.12)',
                    background: option.value === resolved.verticalAlign ? 'rgba(240,253,250,0.98)' : 'rgba(255,255,255,0.94)',
                    color: option.value === resolved.verticalAlign ? '#0f766e' : '#065f46',
                    padding: '0.42rem 0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {formatCommandLabel(option.value)}
                </button>
              ))}
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

      <InspectorAccordion title="Rendered Preview">
        <div
          style={{
            minHeight: '128px',
            borderRadius: '16px',
            border: '1px solid rgba(15,118,110,0.12)',
            background: 'rgba(255,255,255,0.94)',
            overflow: 'hidden',
          }}
        >
          <TextBoxContent project={project} properties={properties} />
        </div>
      </InspectorAccordion>
    </>
  );
}
