import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../apps/web/src/editor/project';
import { normalizeRules } from '../../apps/web/src/editor/rulebookStorage';
import {
  buildInitialAIDraft,
  loadAIAssistDraft,
  saveAIAssistDraft,
  snapshotFromDraft,
} from '../../apps/web/src/editor/aiAssistDraftStorage';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('rulebook chapter migration', () => {
  it('adds iconography for an empty legacy placeholder while retaining authored glossary prose and explicit chapter kinds', () => {
    const project = createBlankProject('My rulebook');
    const rules = normalizeRules({
      ...project.rules,
      chapters: [
        { id: 'empty-glossary', title: 'Glossary', body: '', kind: 'standard' },
        { id: 'authored-glossary', title: 'Glossary', body: 'Acorns are your currency.', kind: 'standard' },
        {
          id: 'custom-iconography',
          title: 'Iconography',
          body: 'Designer-written legend.',
          kind: 'standard',
        },
        { id: 'custom-components', title: 'Components', body: 'An authored list.', kind: 'standard' },
        { id: 'old-components', title: 'Components', body: '' },
      ],
    });
    expect(rules.chapters.map(({ id, title, kind, body }) => ({ id, title, kind, body }))).toEqual([
      { id: 'empty-glossary', title: 'Iconography', body: '', kind: 'iconography' },
      { id: 'authored-glossary', title: 'Glossary', body: 'Acorns are your currency.', kind: 'standard' },
      { id: 'custom-iconography', title: 'Iconography', body: 'Designer-written legend.', kind: 'standard' },
      { id: 'custom-components', title: 'Components', body: 'An authored list.', kind: 'standard' },
      { id: 'old-components', title: 'Components', body: '', kind: 'components' },
    ]);
    expect(normalizeRules(rules)).toEqual(rules);
    expect(createBlankProject('New game').rules.chapters.at(-1)?.kind).toBe('iconography');
  });
});

describe('per-project AI assist drafts', () => {
  it('restores only the persistent controls, reconciles current tags, and safely adapts modes for empty sections', () => {
    const project = createBlankProject('Draft controls');
    project.brief.theme = 'Woodland, City';
    project.brief.artStyle = 'Watercolor';
    const chapter = { ...project.rules.chapters[0], body: 'An existing rule.' };
    const state = {
      ...buildInitialAIDraft(project, chapter),
      prompt: 'Add a concrete example',
      mode: 'rewrite' as const,
      selectedThemes: ['woodland', 'Removed tag'],
      selectedArtStyles: [],
      temperature: 1.15,
      contextWeights: { rulebook: 30, prompt: 70, chips: 15 },
      loading: true,
      error: 'Transient error',
      brainstormResults: ['Temporary idea'],
    };
    saveAIAssistDraft(project.id, snapshotFromDraft(state));
    const restored = buildInitialAIDraft(project, chapter);
    expect(restored).toMatchObject({
      prompt: state.prompt,
      mode: 'rewrite',
      temperature: 1.15,
      contextWeights: state.contextWeights,
      selectedThemes: ['Woodland'],
      selectedArtStyles: [],
      loading: false,
      error: null,
      brainstormResults: [],
    });
    expect(buildInitialAIDraft(project, { ...chapter, body: '' }).mode).toBe('draft');
    expect(buildInitialAIDraft(createBlankProject('Another project'), chapter).prompt).toBe('');
  });

  it('tolerates blocked reads and corrupt storage and clamps persisted numeric controls', () => {
    const key = 'turnbased.creator.aiAssistDraft.example';
    window.localStorage.setItem(
      key,
      JSON.stringify({
        prompt: 'Saved',
        mode: 'unknown',
        temperature: 7,
        contextWeights: { rulebook: -12, prompt: 190, chips: 'wrong' },
        selectedThemes: ['  Forest ', 'forest', 12],
        selectedArtStyles: [],
      }),
    );
    expect(loadAIAssistDraft('example')).toMatchObject({
      prompt: 'Saved',
      mode: 'draft',
      temperature: 1.5,
      contextWeights: { rulebook: 0, prompt: 100 },
      selectedThemes: ['Forest'],
    });
    window.localStorage.setItem(key, '{not JSON');
    expect(loadAIAssistDraft('example')).toBeNull();
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    expect(loadAIAssistDraft('example')).toBeNull();
    expect(() =>
      buildInitialAIDraft(createBlankProject('Restricted storage'), {
        id: 'one',
        title: 'Concept',
        body: '',
      }),
    ).not.toThrow();
  });
});
