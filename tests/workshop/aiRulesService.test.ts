import { describe, expect, it, vi } from 'vitest';
vi.mock('../../apps/web/src/lib/supabaseClient', () => ({ supabase: {} }));
import { buildRulesRequestBody, parseBrainstormIdeas } from '../../apps/web/src/editor/aiRulesService';
import type { EditorProject, RulesChapter } from '../../apps/web/src/editor/types';

describe('AI rules request and brainstorm recovery', () => {
  it('selected art styles alone contribute rich context in prose and brainstorm modes', () => {
    const chapter = { id: 'setup', title: 'Setup', body: 'Draw a card.' } as RulesChapter;
    const project = { name: 'Game', brief: { name: 'Game', minPlayers: 2, maxPlayers: 4 }, rules: { chapters: [chapter] }, art: { definedArtStyles: [{ name: 'Watercolor', description: 'Soft edges' }, { name: 'Cyberpunk', description: 'Never send when deselected' }] } } as unknown as EditorProject;
    const args = { project, activeChapter: chapter, userPrompt: 'Draft', themes: [], artStyles: ['watercolor'], contextWeights: { rulebook: 70, prompt: 100, chips: 70 }, modelId: 'google/gemini-3-pro-preview', temperature: 1.15 };
    for (const mode of ['draft', 'brainstorm'] as const) {
      const body = buildRulesRequestBody(args, mode);
      expect(body.artStyleDetails).toEqual([{ name: 'Watercolor', description: 'Soft edges' }]);
      expect(body.modelId).toBe('google/gemini-3.1-pro-preview');
      expect(body.temperature).toBe(1.15);
    }
    expect(buildRulesRequestBody({ ...args, artStyles: [] }, 'draft').artStyleDetails).toEqual([]);
  });

  it('cleans quoted loose lists and fences, deduplicates, and bounds name lists', () => {
    expect(parseBrainstormIdeas('```json\n["Cedar", "cedar", "Fern"]\n```')).toEqual(['Cedar', 'Fern']);
    expect(parseBrainstormIdeas('Here are names:\n1. "Cedar City",\n2. \'Fern Town\';\n```')).toEqual(['Cedar City', 'Fern Town']);
    expect(parseBrainstormIdeas(JSON.stringify(Array.from({ length: 30 }, (_, index) => `Name ${index}`)))).toHaveLength(20);
    expect(parseBrainstormIdeas('[null, 12, "", "Valid"]')).toEqual(['Valid']);
  });
});
