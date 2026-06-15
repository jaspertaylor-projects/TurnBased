import type { AIImagePromptContextOption } from './AIImageGenerationModal';
import type { EditorProject } from '../types';

/**
 * Build the list of project art-direction context options (theme + defined art
 * styles) offered in the AI image generator. Shared by the Art studio and the
 * board-surface ImageInspector so both expose the same, user-visible context
 * toggles instead of baking hidden style guidance into the prompt.
 */
export function buildImagePromptContextOptions(project: EditorProject): AIImagePromptContextOption[] {
  const options: AIImagePromptContextOption[] = [];

  const theme = project.art.theme.trim() || project.brief.theme.trim();
  if (theme.length > 0) {
    options.push({ id: 'project-theme', kind: 'theme', label: theme, value: theme });
  }

  const briefStyle = project.brief.artStyle.trim();
  if (briefStyle.length > 0) {
    options.push({ id: 'brief-art-style', kind: 'style', label: briefStyle, value: briefStyle });
  }

  project.art.definedArtStyles.forEach((style) => {
    const label = style.name.trim() || 'Untitled style';
    const description = style.description.trim();
    options.push({
      id: `style-${style.id}`,
      kind: 'style',
      label,
      value: description.length > 0 ? description : label,
    });
  });

  return options;
}
