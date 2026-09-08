import type { EditorProject } from './types';

export function touchProject(project: EditorProject): EditorProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
  };
}
