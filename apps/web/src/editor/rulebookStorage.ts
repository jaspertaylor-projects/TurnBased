import type { EditorProject, RulesChapter } from './types';
import { createBlankChapter, createDefaultRulesChapters } from './project';

export function normalizeRules(rules: EditorProject['rules'] | undefined): EditorProject['rules'] {
  const safe = rules ?? ({} as Partial<EditorProject['rules']>);
  const legacyChapters = Array.isArray(safe.chapters) ? safe.chapters : [];

  // Migration: if no chapters but legacy rulesText is present, lift it into a
  // single "Rules" chapter so existing projects don't appear empty after the
  // rulebook switch. If both are empty, seed the 7 default chapters.
  let chapters: RulesChapter[] = legacyChapters
    .filter((chapter) => chapter && typeof chapter.id === 'string')
    .map((chapter) => {
      const title = typeof chapter.title === 'string' ? chapter.title : 'Untitled Chapter';
      // Stored projects from before the components-chapter migration won't have
      // a `kind` field — infer it from the title so the catalog picker shows up.
      const storedKind = (chapter as { kind?: unknown }).kind;
      const body = typeof chapter.body === 'string' ? chapter.body : '';
      const emptyGlossary =
        title.trim().toLowerCase() === 'glossary' &&
        !body.trim() &&
        (storedKind === undefined || storedKind === 'standard');
      const normalizedTitle = emptyGlossary ? 'Iconography' : title;
      const titleKey = normalizedTitle.trim().toLowerCase();
      const kind: RulesChapter['kind'] = emptyGlossary
        ? 'iconography'
        : storedKind === 'standard' || storedKind === 'components' || storedKind === 'iconography'
          ? storedKind
          : titleKey === 'components'
            ? 'components'
            : titleKey === 'iconography'
              ? 'iconography'
              : 'standard';
      return {
        id: chapter.id,
        title: normalizedTitle,
        body,
        kind,
      };
    });

  if (chapters.length === 0) {
    if (typeof safe.rulesText === 'string' && safe.rulesText.trim().length > 0) {
      const seeded = createBlankChapter('Rules');
      chapters = [{ ...seeded, body: safe.rulesText, kind: 'standard' }];
    } else {
      chapters = createDefaultRulesChapters();
    }
  }

  const rawCustom = Array.isArray((safe as { customComponents?: unknown }).customComponents)
    ? (safe as { customComponents: unknown[] }).customComponents
    : [];
  const customComponents = rawCustom
    .filter(
      (entry): entry is { id?: unknown; name?: unknown; description?: unknown } =>
        typeof entry === 'object' && entry !== null,
    )
    .map((entry, index) => ({
      id:
        typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id
          : `custom_component_${index + 1}`,
      name: typeof entry.name === 'string' ? entry.name : '',
      description: typeof entry.description === 'string' ? entry.description : '',
    }));

  return {
    rulesText: typeof safe.rulesText === 'string' ? safe.rulesText : '',
    designerNotes: typeof safe.designerNotes === 'string' ? safe.designerNotes : '',
    chapters,
    customComponents,
  };
}
