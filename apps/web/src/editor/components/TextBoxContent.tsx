import { Fragment, cloneElement, createElement, isValidElement, type CSSProperties, type ReactNode } from 'react';

import { resolveProjectPaletteColorValue } from '../projectPalette';
import type { EditorIconAsset, EditorProject } from '../types';
import { IconTile } from './IconTile';

export type TextBoxFontFamily = 'sans' | 'serif' | 'display' | 'mono';
export type TextBoxTextAlign = 'left' | 'center' | 'right';
export type TextBoxVerticalAlign = 'start' | 'center' | 'end';

export interface ResolvedTextBoxProperties {
  contentHtml: string;
  fontFamily: TextBoxFontFamily;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  textAlign: TextBoxTextAlign;
  verticalAlign: TextBoxVerticalAlign;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
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
];

export const TEXT_BOX_VERTICAL_ALIGN_OPTIONS: Array<{ value: TextBoxVerticalAlign; label: string }> = [
  { value: 'start', label: 'Top' },
  { value: 'center', label: 'Middle' },
  { value: 'end', label: 'Bottom' },
];

export const FONT_FAMILY_MAP: Record<TextBoxFontFamily, string> = {
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

export function ProjectInlineIcon({
  project,
  item,
  size,
}: {
  project: EditorProject;
  item: EditorIconAsset;
  size: number;
}) {
  return <IconTile item={item} project={project} size={size} inline />;
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

  if (document.body.childNodes.length === 0) {
    return renderTextSegments(contentHtml, 'text:fallback', project, iconSize);
  }

  const nodes = Array.from(document.body.childNodes).map((node, index) =>
    renderRichNode(node, `text:${index}`, project, iconSize),
  );

  // Strip the bottom margin from the last block element so text can sit flush
  // against the container edge when vertically aligned to bottom with 0 inset.
  // (Flex containers don't collapse margins, so the trailing margin would
  // otherwise prevent the content from reaching the edge.)
  const last = nodes[nodes.length - 1];
  if (last != null && isValidElement<{ style?: CSSProperties }>(last)) {
    const existingStyle = last.props.style;
    nodes[nodes.length - 1] = cloneElement(last, {
      style: { ...existingStyle, marginBottom: 0 },
    });
  }

  return nodes;
}

function clampInset(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(value, 64)) : fallback;
}

function resolveTextBoxInset(properties: Record<string, unknown>): Pick<ResolvedTextBoxProperties, 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'> {
  // Support legacy single `padding` value as a fallback for all sides.
  // Default inset is 0 — 0 should mean zero, no invisible cushion.
  const legacy = typeof properties.padding === 'number' && Number.isFinite(properties.padding) ? properties.padding : 0;
  return {
    paddingTop: clampInset(properties.paddingTop, legacy),
    paddingRight: clampInset(properties.paddingRight, legacy),
    paddingBottom: clampInset(properties.paddingBottom, legacy),
    paddingLeft: clampInset(properties.paddingLeft, legacy),
  };
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
    textAlign: textAlign === 'center' || textAlign === 'right' ? textAlign : 'left',
    verticalAlign: verticalAlign === 'start' || verticalAlign === 'end' ? verticalAlign : 'center',
    ...resolveTextBoxInset(properties),
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
        padding: `${resolved.paddingTop}px ${resolved.paddingRight}px ${resolved.paddingBottom}px ${resolved.paddingLeft}px`,
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
        // `text-box: trim-both cap alphabetic` trims the font's intrinsic
        // ascent/descent (above cap-height and below the alphabetic baseline)
        // so glyphs sit flush against the container walls at inset 0 instead
        // of appearing to have extra padding from the font metrics.
        <div style={{ width: '100%', textBoxTrim: 'trim-both', textBoxEdge: 'cap alphabetic' } as CSSProperties}>
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
