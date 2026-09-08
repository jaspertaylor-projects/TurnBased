import { renderToStaticMarkup } from 'react-dom/server';
import type { EditorIconAsset, EditorProject } from '../types';
import { renderIcon } from '../iconography';
import { resolveProjectPaletteColorValue } from '../projectPalette';
import { safeTemplateColor, templateNumber } from '../templateStudio/safety';
import { escapeHtml } from './download';

function color(project: EditorProject, value: string, fallback: string): string {
  return safeTemplateColor(resolveProjectPaletteColorValue(project.settings.colorPalette, value), fallback);
}

/** Custom SVG is an isolated image, never active markup in the exported page. */
function customSvgImage(markup: string, ink: string): string | null {
  if (markup.length > 100_000 || !/^<svg[\s>]/i.test(markup) || !/<\/svg>\s*$/i.test(markup)) return null;
  // Conservatively reject active/resource-bearing SVG. Ordinary vector paths,
  // shapes and text remain useful without copying scripts or network references.
  if (
    /<(?:!|\?)|<(?:script|foreignObject|iframe|object|embed|image|use|style|a|animate\w*|set)\b/i.test(
      markup,
    ) ||
    /\bon[\w-]+\s*=|\b(?:href|src|style)\s*=|url\s*\(|&(?:#|[a-z])|\\/i.test(markup)
  )
    return null;
  const svg = /\bxmlns\s*=/.test(markup)
    ? markup
    : markup.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  const coloredSvg = svg.replace(/^<svg/i, `<svg style="color:${ink}"`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coloredSvg)}`;
}

function preview(project: EditorProject, icon: EditorIconAsset): string {
  const ink = color(project, icon.iconColor, '#234b34');
  const background = color(project, icon.backgroundColor, '#ffffff');
  const border = color(project, icon.borderColor, '#b9c5af');
  const scale = templateNumber(icon.iconScale, 1, 0.3, 1.5);
  const style = `background:${background};border:${templateNumber(icon.borderWidth, 1, 0, 20) * 0.64}px solid ${border};border-radius:${templateNumber(icon.borderRadius, 20, 0, 50) * 0.64}px;color:${ink}`;
  let artwork: string;
  if (icon.mode !== 'custom') {
    artwork = renderToStaticMarkup(
      renderIcon(icon.iconKey, {
        size: 64 * 0.42 * scale,
        strokeWidth: templateNumber(icon.iconStrokeWidth, 1, 0.5, 20),
        fillColor: color(project, icon.iconFillColor, 'transparent'),
        style: { color: ink },
      }),
    );
  } else {
    const markup = icon.customSvgMarkup.trim();
    if (markup.startsWith('<')) {
      const source = customSvgImage(markup, ink);
      artwork = source
        ? `<img alt="" src="${escapeHtml(source)}" style="width:${72 * scale}%;height:${72 * scale}%;object-fit:contain">`
        : '<span class="icon-preview-unavailable">Preview unavailable</span>';
    } else {
      const glyph =
        Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(markup.slice(0, 128)))
          .slice(0, 2)
          .map((part) => part.segment)
          .join('') || '?';
      artwork = `<span class="icon-glyph">${escapeHtml(glyph)}</span>`;
    }
  }
  return `<span class="icon-preview" aria-hidden="true" style="${style}">${artwork}</span>`;
}

export function renderRulebookIconography(project: EditorProject): string {
  if (!project.art.icons.length) return '<p class="meta">No icon definitions added yet.</p>';
  return `<ul class="icon-legend">${project.art.icons
    .map((icon) => {
      const name = icon.name.trim() || icon.iconKey || 'Untitled icon';
      const token = icon.inlineCode.trim();
      return `<li class="icon-entry">${preview(project, icon)}<div data-layout="printedIconDefinition"><strong>${escapeHtml(name)}</strong>${token ? ` <code>${escapeHtml(token)}</code>` : ''}<div class="prose" data-layout="printedIconDescription">${escapeHtml(icon.description)}</div></div></li>`;
    })
    .join('')}</ul>`;
}
