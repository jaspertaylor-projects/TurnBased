import { Fragment, createElement, type CSSProperties, type ReactNode } from 'react';
import { getBoardSurfaceTextureStyle } from '@turnbased/engine-ui';

import { renderIcon } from '../iconography';
import { resolveProjectPaletteColorValue } from '../projectPalette';
import type { EditorIconAsset, EditorProject } from '../types';

export type TextBoxFontFamily = 'sans' | 'serif' | 'display' | 'mono';
export type TextBoxTextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextBoxVerticalAlign = 'start' | 'center' | 'end';

export interface ResolvedTextBoxProperties {
  contentHtml: string;
  fontFamily: TextBoxFontFamily;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  textAlign: TextBoxTextAlign;
  verticalAlign: TextBoxVerticalAlign;
  padding: number;
}

export const TEXT_BOX_FONT_OPTIONS: Array<{ value: TextBoxFontFamily; label: string }> = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'display', label: 'Display' },
  { value: 'mono', label: 'Mono' },
];

export const TEXT_BOX_TEXT_ALIGN_OPTIONS: Array<{ value: TextBoxTextAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

export const TEXT_BOX_VERTICAL_ALIGN_OPTIONS: Array<{ value: TextBoxVerticalAlign; label: string }> = [
  { value: 'start', label: 'Top' },
  { value: 'center', label: 'Middle' },
  { value: 'end', label: 'Bottom' },
];

const FONT_FAMILY_MAP: Record<TextBoxFontFamily, string> = {
  sans: '"Trebuchet MS", "Avenir Next", Avenir, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  display: '"Alegreya Sans SC", "Trebuchet MS", "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
};

const SAFE_TEXT_TAGS = new Set([
  'p',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'br',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
]);

function resolveProjectColor(project: EditorProject, value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return 'transparent';
  }

  return resolveProjectPaletteColorValue(project.settings.colorPalette, value) ?? value;
}

function normalizeIconToken(value: string): string {
  return value
    .trim()
    .replace(/^:+|:+$/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function listIconAliases(item: EditorIconAsset): string[] {
  const aliases = new Set<string>();

  if (item.inlineCode.trim().length > 0) {
    aliases.add(normalizeIconToken(item.inlineCode));
  }
  if (item.name.trim().length > 0) {
    aliases.add(normalizeIconToken(item.name));
  }
  if (item.iconKey.trim().length > 0) {
    aliases.add(normalizeIconToken(item.iconKey));
  }

  return [...aliases];
}

export function getProjectIconToken(item: EditorIconAsset): string {
  const inlineCode = item.inlineCode.trim();
  if (inlineCode.startsWith(':') && inlineCode.endsWith(':') && inlineCode.length > 2) {
    return inlineCode;
  }

  return `:${normalizeIconToken(item.name || item.iconKey || 'icon')}:`;
}

export function findProjectIconAssetByToken(project: EditorProject, token: string): EditorIconAsset | null {
  const normalizedToken = normalizeIconToken(token);
  return project.art.icons.find((item) => listIconAliases(item).includes(normalizedToken)) ?? null;
}

function getDefaultElementStyle(tagName: string): CSSProperties {
  switch (tagName) {
    case 'p':
    case 'div':
      return { margin: '0 0 0.5em 0' };
    case 'blockquote':
      return {
        margin: '0 0 0.6em 0',
        paddingLeft: '0.8em',
        borderLeft: '3px solid rgba(15,118,110,0.16)',
        color: 'rgba(6,78,59,0.86)',
      };
    case 'ul':
    case 'ol':
      return { margin: '0 0 0.6em 0', paddingInlineStart: '1.15em' };
    case 'li':
      return { margin: '0 0 0.18em 0' };
    case 'h1':
      return { margin: '0 0 0.35em 0', fontSize: '1.55em', fontWeight: 800, lineHeight: 1.12 };
    case 'h2':
      return { margin: '0 0 0.35em 0', fontSize: '1.38em', fontWeight: 800, lineHeight: 1.14 };
    case 'h3':
      return { margin: '0 0 0.3em 0', fontSize: '1.22em', fontWeight: 800, lineHeight: 1.16 };
    case 'h4':
      return { margin: '0 0 0.28em 0', fontSize: '1.1em', fontWeight: 700, lineHeight: 1.18 };
    case 'h5':
    case 'h6':
      return { margin: '0 0 0.25em 0', fontSize: '1em', fontWeight: 700, lineHeight: 1.18 };
    default:
      return {};
  }
}

function getSafeInlineStyle(element: HTMLElement, tagName: string): CSSProperties {
  const nextStyle: CSSProperties = {
    ...getDefaultElementStyle(tagName),
  };

  if (element.style.textAlign) {
    nextStyle.textAlign = element.style.textAlign as CSSProperties['textAlign'];
  }
  if (element.style.fontWeight) {
    nextStyle.fontWeight = element.style.fontWeight;
  }
  if (element.style.fontStyle) {
    nextStyle.fontStyle = element.style.fontStyle;
  }
  if (element.style.textDecoration) {
    nextStyle.textDecoration = element.style.textDecoration;
  }
  if (element.style.color) {
    nextStyle.color = element.style.color;
  }

  return nextStyle;
}

function renderCustomIconArtwork(item: EditorIconAsset, color: string, size: number) {
  const trimmedMarkup = item.customSvgMarkup.trim();

  if (!trimmedMarkup) {
    return (
      <span style={{ color, fontSize: `${size * 0.38}px`, fontWeight: 800, lineHeight: 1 }}>
        ?
      </span>
    );
  }

  if (trimmedMarkup.startsWith('<svg')) {
    return (
      <span
        style={{ width: '72%', height: '72%', display: 'inline-grid', placeItems: 'center', color }}
        dangerouslySetInnerHTML={{ __html: trimmedMarkup }}
      />
    );
  }

  return (
    <span style={{ color, fontSize: `${size * 0.5}px`, fontWeight: 800, lineHeight: 1 }}>
      {trimmedMarkup.slice(0, 2)}
    </span>
  );
}

export function ProjectInlineIcon({
  project,
  item,
  size,
}: {
  project: EditorProject;
  item: EditorIconAsset;
  size: number;
}) {
  const backgroundColor = resolveProjectColor(project, item.backgroundColor);
  const borderColor = resolveProjectColor(project, item.borderColor);
  const iconColor = resolveProjectColor(project, item.iconColor);
  const fillColor = resolveProjectColor(project, item.iconFillColor);
  const textureStyle = item.backgroundTextureId !== 'none'
    ? getBoardSurfaceTextureStyle(item.backgroundTextureId, item.backgroundTextureOpacity)
    : null;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: `${size}px`,
        height: `${size}px`,
        marginInline: '0.08em',
        borderRadius: `${Math.min(item.borderRadius, size / 2)}px`,
        border: `${item.borderWidth}px solid ${borderColor}`,
        background: backgroundColor,
        boxSizing: 'border-box',
        overflow: 'hidden',
        verticalAlign: 'middle',
        lineHeight: 0,
      }}
    >
      {textureStyle?.backgroundImage ? (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            ...textureStyle,
          }}
        />
      ) : null}

      <span
        style={{
          position: 'relative',
          zIndex: 1,
          width: '72%',
          height: '72%',
          display: 'inline-grid',
          placeItems: 'center',
          color: iconColor,
          overflow: 'hidden',
        }}
      >
        {item.mode === 'custom'
          ? renderCustomIconArtwork(item, iconColor, size)
          : renderIcon(item.iconKey, {
            size: size * 0.46,
            strokeWidth: item.iconStrokeWidth,
            fillColor,
            style: { color: iconColor },
          })}
      </span>
    </span>
  );
}

function renderTextSegments(
  text: string,
  keyPrefix: string,
  project: EditorProject,
  iconSize: number,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /:([a-z0-9][a-z0-9 _-]*):/gi;
  let lastIndex = 0;
  let match = tokenPattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const tokenValue = match[1] ?? '';
    const iconAsset = findProjectIconAssetByToken(project, tokenValue);
    if (iconAsset) {
      nodes.push(
        <ProjectInlineIcon
          key={`${keyPrefix}:${match.index}:${tokenValue}`}
          project={project}
          item={iconAsset}
          size={iconSize}
        />,
      );
    } else {
      nodes.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
    match = tokenPattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderRichNode(
  node: ChildNode,
  keyPrefix: string,
  project: EditorProject,
  iconSize: number,
): ReactNode {
  if (node.nodeType === globalThis.Node.TEXT_NODE) {
    return (
      <Fragment key={keyPrefix}>
        {renderTextSegments(node.textContent ?? '', keyPrefix, project, iconSize)}
      </Fragment>
    );
  }

  if (node.nodeType !== globalThis.Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = SAFE_TEXT_TAGS.has(element.tagName.toLowerCase()) ? element.tagName.toLowerCase() : 'span';
  const childNodes = Array.from(element.childNodes).map((child, index) => (
    renderRichNode(child, `${keyPrefix}:${index}`, project, iconSize)
  ));
  const props: Record<string, unknown> = {
    key: keyPrefix,
  };
  const elementStyle = getSafeInlineStyle(element, tagName);

  if (Object.keys(elementStyle).length > 0) {
    props.style = elementStyle;
  }

  if (tagName === 'a') {
    const href = element.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#'))) {
      props.href = href;
      props.target = '_blank';
      props.rel = 'noreferrer';
    }
  }

  return createElement(tagName, props, ...childNodes);
}

function renderRichTextContent(project: EditorProject, contentHtml: string, iconSize: number): ReactNode {
  const parser = new DOMParser();
  const document = parser.parseFromString(`<body>${contentHtml}</body>`, 'text/html');

  return document.body.childNodes.length > 0
    ? Array.from(document.body.childNodes).map((node, index) => renderRichNode(node, `text:${index}`, project, iconSize))
    : renderTextSegments(contentHtml, 'text:fallback', project, iconSize);
}

export function resolveTextBoxProperties(properties: Record<string, unknown>): ResolvedTextBoxProperties {
  const fontFamily = properties.fontFamily;
  const textAlign = properties.textAlign;
  const verticalAlign = properties.verticalAlign;

  return {
    contentHtml: typeof properties.contentHtml === 'string' ? properties.contentHtml : '<p>Text box</p>',
    fontFamily: fontFamily === 'serif' || fontFamily === 'display' || fontFamily === 'mono' ? fontFamily : 'sans',
    fontSize: typeof properties.fontSize === 'number' && Number.isFinite(properties.fontSize)
      ? Math.max(10, Math.min(properties.fontSize, 96))
      : 22,
    lineHeight: typeof properties.lineHeight === 'number' && Number.isFinite(properties.lineHeight)
      ? Math.max(1, Math.min(properties.lineHeight, 2.4))
      : 1.4,
    textColor: typeof properties.textColor === 'string' && properties.textColor.trim().length > 0
      ? properties.textColor
      : '#064e3b',
    textAlign: textAlign === 'center' || textAlign === 'right' || textAlign === 'justify' ? textAlign : 'left',
    verticalAlign: verticalAlign === 'start' || verticalAlign === 'end' ? verticalAlign : 'center',
    padding: typeof properties.padding === 'number' && Number.isFinite(properties.padding)
      ? Math.max(0, Math.min(properties.padding, 64))
      : 18,
  };
}

export function TextBoxContent({
  project,
  properties,
  emptyPlaceholder = 'Type some text in the inspector.',
  style,
}: {
  project: EditorProject;
  properties: Record<string, unknown>;
  emptyPlaceholder?: ReactNode;
  style?: CSSProperties;
}) {
  const resolved = resolveTextBoxProperties(properties);
  const resolvedColor = resolveProjectColor(project, resolved.textColor);
  const contentHtml = resolved.contentHtml.trim();
  const iconSize = Math.max(14, Math.min(30, resolved.fontSize * 1.1));

  return (
    <div
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
        padding: `${resolved.padding}px`,
        boxSizing: 'border-box',
        color: resolvedColor,
        fontFamily: FONT_FAMILY_MAP[resolved.fontFamily],
        fontSize: `${resolved.fontSize}px`,
        lineHeight: resolved.lineHeight,
        textAlign: resolved.textAlign,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        ...style,
      }}
    >
      {contentHtml.length > 0 ? (
        <div style={{ width: '100%' }}>
          {renderRichTextContent(project, contentHtml, iconSize)}
        </div>
      ) : (
        <div style={{ width: '100%', color: 'rgba(15,118,110,0.65)', fontStyle: 'italic' }}>
          {emptyPlaceholder}
        </div>
      )}
    </div>
  );
}
