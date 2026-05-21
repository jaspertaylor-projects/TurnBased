import { useEffect, useRef } from 'react';

import { FONT_FAMILY_MAP, resolveTextBoxProperties } from '../../components/TextBoxContent';
import { resolveProjectPaletteColorValue } from '../../projectPalette';
import type { EditorProject } from '../../types';

/**
 * A contentEditable inline text editor shown when double-clicking a text-box
 * on the board canvas. Commits changes via onSave (Escape) or onBlur.
 */
export function InlineTextBoxEditor({
  project,
  properties,
  onSave,
  onBlur,
}: {
  project: EditorProject;
  properties: Record<string, unknown>;
  onSave: (html: string) => void;
  onBlur: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const resolved = resolveTextBoxProperties(properties);
  const resolvedColor = resolveProjectPaletteColorValue(project.settings.colorPalette, resolved.textColor) ?? resolved.textColor;

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = resolved.contentHtml;
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => onBlur(editorRef.current?.innerHTML ?? '')}
      onKeyDown={(e) => {
        // Escape to commit and exit
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onSave(editorRef.current?.innerHTML ?? '');
        }
        // Prevent move/delete shortcuts from bubbling to the board
        e.stopPropagation();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: resolved.verticalAlign === 'start'
          ? 'flex-start'
          : resolved.verticalAlign === 'end'
            ? 'flex-end'
            : 'center',
        padding: `${resolved.paddingTop}px ${resolved.paddingRight}px ${resolved.paddingBottom}px ${resolved.paddingLeft}px`,
        boxSizing: 'border-box',
        color: resolvedColor,
        fontFamily: FONT_FAMILY_MAP[resolved.fontFamily],
        fontSize: `${resolved.fontSize}px`,
        lineHeight: resolved.lineHeight,
        textAlign: resolved.textAlign,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        outline: 'none',
        cursor: 'text',
      }}
    />
  );
}
