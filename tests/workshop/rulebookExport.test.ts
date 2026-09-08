import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../apps/web/src/editor/project';
import type { EditorIconAsset } from '../../apps/web/src/editor/types';
import { createRulebookHtml } from '../../apps/web/src/editor/exports/rulebook';

function icon(overrides: Partial<EditorIconAsset> = {}): EditorIconAsset {
  return {
    id: 'leaf',
    mode: 'library',
    name: 'Leaf',
    iconKey: 'leaf',
    iconColor: 'palette:primary',
    iconFillColor: 'transparent',
    iconStrokeWidth: 2,
    iconScale: 1,
    backgroundColor: '#ffffff',
    backgroundTextureId: 'none',
    backgroundTextureOpacity: 0,
    borderColor: '#234b34',
    borderWidth: 1,
    borderRadius: 20,
    customSvgMarkup: '',
    inlineCode: ':leaf:',
    description: 'Gain one leaf.\nSpend leaves to grow.',
    tags: [],
    ...overrides,
  };
}

describe('printed rulebook iconography', () => {
  it('includes the shared icon definitions and previews while preserving authored chapter prose', () => {
    const project = createBlankProject('Woodland');
    project.settings.colorPalette.primary = '#125634';
    project.rules.chapters = [
      { id: 'icons', title: 'Iconography', kind: 'iconography', body: 'Read these symbols before play.' },
    ];
    project.art.icons = [
      icon(),
      icon({
        id: 'custom',
        mode: 'custom',
        name: 'Custom acorn',
        inlineCode: ':acorn:',
        description: 'Collect one acorn.',
        customSvgMarkup: '<svg viewBox="0 0 24 24"><path d="M2 2L22 22" stroke="currentColor"/></svg>',
      }),
      icon({ id: 'glyph', mode: 'custom', name: 'Garden', customSvgMarkup: '🌻' }),
    ];

    const html = createRulebookHtml(project);
    expect(html).toContain('<ul class="icon-legend">');
    expect(html.match(/<li class="icon-entry">/g)).toHaveLength(3);
    expect(html).toContain('<strong>Leaf</strong> <code>:leaf:</code>');
    expect(html).toContain('Gain one leaf.\nSpend leaves to grow.');
    expect(html).toContain('Read these symbols before play.');
    expect(html).toContain('lucide-leaf');
    expect(html).toContain('color:#125634');
    expect(html).toContain('<span class="icon-glyph">🌻</span>');
    const encodedSvg = html.match(/src="data:image\/svg\+xml;charset=utf-8,([^"]+)"/)?.[1];
    expect(encodedSvg).toBeTruthy();
    const decodedSvg = decodeURIComponent(encodedSvg!);
    expect(decodedSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(decodedSvg).toContain('style="color:#125634"');
    expect(decodedSvg).toContain('<path d="M2 2L22 22" stroke="currentColor"/>');
    expect(html).not.toContain('<path d="M2 2L22 22"');
  });

  it('escapes authored text and rejects active or externally loaded custom SVG while keeping definitions', () => {
    const project = createBlankProject('<script>game()</script>');
    project.rules.chapters = [
      { id: 'icons', title: 'Icons <b>legend</b>', kind: 'iconography', body: '<script>body()</script>' },
    ];
    const unsafeSvg = [
      '<svg onload="attack()"></svg>',
      '<svg><script>attack()</script></svg>',
      '<svg><image href="https://malicious.example/image"/></svg>',
      '<svg><foreignObject><p>attack()</p></foreignObject></svg>',
      '<svg><style>@import "https://malicious.example/style";</style></svg>',
      '<svg><path fill="url(https://malicious.example/paint)"/></svg>',
      '<svg><text>&#x3c;script</text></svg>',
    ];
    project.art.icons = unsafeSvg.map((customSvgMarkup, index) =>
      icon({
        id: `unsafe-${index}`,
        mode: 'custom',
        name: '<img src=x onerror=attack()>',
        inlineCode: '<danger>',
        description: 'Use <b>care</b> & attention.',
        iconColor: 'url(https://malicious.example/color)',
        customSvgMarkup,
      }),
    );

    const html = createRulebookHtml(project);
    expect(html.match(/<span class="icon-preview-unavailable">/g)).toHaveLength(unsafeSvg.length);
    expect(html).toContain('&lt;img src=x onerror=attack()&gt;');
    expect(html).toContain('<code>&lt;danger&gt;</code>');
    expect(html).toContain('Use &lt;b&gt;care&lt;/b&gt; &amp; attention.');
    expect(html).toContain('&lt;script&gt;body()&lt;/script&gt;');
    expect(html).not.toMatch(/<script\b|<foreignObject\b|<img\b|malicious\.example|data:image\/svg/i);
  });

  it('handles empty legends and keeps explicitly standard chapters independent of shared iconography', () => {
    const project = createBlankProject('Author choices');
    project.rules.chapters = [
      { id: 'icons', title: 'Symbols', kind: 'iconography', body: 'Icons coming soon.' },
    ];
    expect(createRulebookHtml(project)).toContain('No icon definitions added yet.');
    expect(createRulebookHtml(project)).toContain('Icons coming soon.');

    project.art.icons = [icon()];
    project.rules.chapters = [
      { id: 'authored', title: 'Iconography', kind: 'standard', body: 'An independently authored legend.' },
    ];
    const html = createRulebookHtml(project);
    expect(html).toContain('An independently authored legend.');
    expect(html).not.toContain('<ul class="icon-legend">');
  });
});
