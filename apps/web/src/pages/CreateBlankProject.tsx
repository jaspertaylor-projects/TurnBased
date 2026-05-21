import { useState, type KeyboardEvent } from 'react';
import { Brush, Plus, Sparkles, X } from 'lucide-react';

import { AppPageFrame } from '../components/AppPageFrame';
import { buildProjectWithAI } from '../editor/aiBuildService';
import { commitProjectVersion } from '../editor/git';
import { buildPreviewRuntime } from '../editor/runtime';
import { createDefaultRulesBrief, normalizeRulesBuilderBrief } from '../editor/project';
import { saveEditorProject } from '../editor/storage';
import { saveProjectWorkspace } from '../editor/workspace';
import { createWorkspaceFiles } from '../editor/shipping';
import type { RulesBuilderBrief } from '../editor/types';

const PENDING_EDITOR_NOTICE_KEY = 'turnbased.creator.pendingEditorNotice';

const THEME_PRESETS = [
  'Cozy forest',
  'Magical garden',
  'Pirate adventure',
  'Space exploration',
  'Medieval kingdom',
  'Underwater',
  'Dungeon crawl',
  'Wild west',
  'Steampunk',
  'Cyberpunk',
  'Mythology',
  'Cute animals',
  'Haunted house',
  'Cooking',
  'Sports',
  'Post-apocalyptic',
  'Fairy tale',
  'Detective mystery',
];

const ART_STYLE_PRESETS = [
  'Watercolor',
  'Pixel art',
  'Hand-drawn ink',
  'Cartoon',
  'Storybook',
  '3D rendered',
  'Minimalist',
  'Anime',
  'Comic',
  'Vintage poster',
  'Geometric',
  'Photorealistic',
  'Folk art',
  'Chalkboard sketch',
];

function splitBriefField(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function joinBriefField(values: string[]): string {
  return values.join(', ');
}

function addUniqueChip(current: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return current;
  if (current.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }
  return [...current, trimmed];
}

function removeChip(current: string[], value: string): string[] {
  return current.filter((entry) => entry.toLowerCase() !== value.toLowerCase());
}

const chipBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.4rem 0.7rem',
  borderRadius: '999px',
  fontSize: '0.82rem',
  cursor: 'pointer',
  border: '1px solid rgba(15,118,110,0.18)',
  background: 'rgba(255,255,255,0.85)',
  color: '#0f766e',
  lineHeight: 1.2,
  transition: 'background 120ms ease, transform 120ms ease',
} as const;

function ChipPicker({
  legendIcon,
  legend,
  helperText,
  selected,
  presets,
  customPlaceholder,
  onChange,
}: {
  legendIcon: React.ReactNode;
  legend: string;
  helperText: string;
  selected: string[];
  presets: string[];
  customPlaceholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const next = addUniqueChip(selected, draft);
    if (next !== selected) {
      onChange(next);
    }
    setDraft('');
  }

  function handleDraftKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    }
  }

  function togglePreset(preset: string) {
    const isSelected = selected.some((entry) => entry.toLowerCase() === preset.toLowerCase());
    onChange(isSelected ? removeChip(selected, preset) : addUniqueChip(selected, preset));
  }

  const presetsRemaining = presets.filter(
    (preset) => !selected.some((entry) => entry.toLowerCase() === preset.toLowerCase()),
  );

  return (
    <div data-layout="chipPickerRoot" /* container for one chip-picker section (theme or art style) */ style={{ display: 'grid', gap: '0.65rem', padding: '1rem', borderRadius: '20px', background: 'rgba(240,253,244,0.55)', border: '1px solid rgba(16,185,129,0.16)' }}>
      <div data-layout="chipPickerHeader" /* legend + helper text row */ style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#064e3b', fontWeight: 700, fontSize: '0.95rem' }}>
          {legendIcon}
          {legend}
        </span>
        <span style={{ color: '#0f766e', fontSize: '0.82rem' }}>{helperText}</span>
      </div>

      <div data-layout="chipPickerSelectedRow" /* selected chips with × remove buttons */ style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '2rem' }}>
        {selected.length === 0 ? (
          <span style={{ color: 'rgba(15,118,110,0.55)', fontSize: '0.82rem', fontStyle: 'italic', alignSelf: 'center' }}>
            Pick a preset below or type your own.
          </span>
        ) : (
          selected.map((entry) => (
            <span
              key={entry}
              style={{ ...chipBase, background: 'linear-gradient(135deg, #064e3b, #10b981)', color: 'white', borderColor: 'transparent', cursor: 'default' }}
            >
              {entry}
              <button
                type="button"
                onClick={() => onChange(removeChip(selected, entry))}
                aria-label={`Remove ${entry}`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.1rem', height: '1.1rem', borderRadius: '999px', border: 'none', background: 'rgba(255,255,255,0.25)', color: 'white', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      {presetsRemaining.length > 0 && (
        <div data-layout="chipPickerPresetsRow" /* preset chips that can be tapped to add */ style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {presetsRemaining.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => togglePreset(preset)}
              style={{ ...chipBase, border: '1px dashed rgba(15,118,110,0.4)' }}
              onMouseEnter={(event) => {
                (event.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.12)';
              }}
              onMouseLeave={(event) => {
                (event.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.85)';
              }}
            >
              <Plus size={12} />
              {preset}
            </button>
          ))}
        </div>
      )}

      <div data-layout="chipPickerCustomRow" /* free-text input to add a custom chip */ style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleDraftKey}
          placeholder={customPlaceholder}
          style={{ flex: '1 1 auto', padding: '0.6rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.16)', boxSizing: 'border-box', fontSize: '0.88rem', color: '#064e3b', background: 'white' }}
        />
        <button
          type="button"
          onClick={commitDraft}
          disabled={draft.trim().length === 0}
          style={{ padding: '0.55rem 1rem', borderRadius: '12px', border: 'none', background: draft.trim().length === 0 ? 'rgba(15,118,110,0.25)' : 'linear-gradient(135deg, #064e3b, #10b981)', color: 'white', cursor: draft.trim().length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

export const CreateBlankProject = () => {
  const [brief, setBrief] = useState<RulesBuilderBrief>(() => createDefaultRulesBrief());
  const [themes, setThemes] = useState<string[]>([]);
  const [artStyles, setArtStyles] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  async function handleBuildWithAI() {
    setIsBuilding(true);
    setBuildError(null);

    try {
      const merged: RulesBuilderBrief = {
        ...brief,
        theme: joinBriefField(themes),
        artStyle: joinBriefField(artStyles),
      };
      const normalizedBrief = normalizeRulesBuilderBrief(merged);
      const buildResult = await buildProjectWithAI(normalizedBrief);
      const runtime = buildPreviewRuntime(buildResult.project);
      const files = createWorkspaceFiles(buildResult.project, runtime);

      saveEditorProject(buildResult.project);
      saveProjectWorkspace(buildResult.project.id, files);

      const commitResult = await commitProjectVersion(
        buildResult.project,
        runtime,
        buildResult.usedAI ? 'AI generated linked multi-view starter project' : 'Generated linked multi-view starter scaffold',
      );

      saveEditorProject(commitResult.project);
      window.sessionStorage.setItem(
        PENDING_EDITOR_NOTICE_KEY,
        buildResult.usedAI ? 'AI build complete — Rules tab is open and ready to edit.' : 'Workspace ready — Rules tab is open and ready to edit.',
      );
      window.location.hash = `#/editor/${commitResult.project.id}`;
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'The game could not be created right now.');
    } finally {
      setIsBuilding(false);
    }
  }

  const canBuild = !isBuilding && brief.name.trim().length > 0;

  return (
    <AppPageFrame contentStyle={{ maxWidth: '760px', margin: '0 auto', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        data-layout="newGameCard"
        /* primary new-game card: bounded desktop-app surface — header and footer
           stay pinned while the body scrolls internally if presets overflow. */
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '28px',
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(16,185,129,0.14)',
          boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          data-layout="newGameHero"
          /* pinned header: title + intro paragraph */
          style={{ padding: '1.5rem 1.5rem 0 1.5rem', flex: '0 0 auto' }}
        >
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.45rem' }}>
            New Game
          </p>
          <h1 style={{ margin: '0 0 0.6rem 0' }}>Create a game</h1>
          <p style={{ color: '#0f766e', lineHeight: 1.7, margin: 0 }}>
            Give your game a name, pick a few themes and art styles that excite you, and we will open a fresh
            workspace on the Rules tab.
          </p>
        </div>

        <div
          data-layout="newGameScrollBody"
          /* scrollable body: the only region that grows or scrolls. Anything that
             can become long (chip presets, future fields) lives here. */
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '1rem 1.5rem',
            display: 'grid',
            gap: '1.1rem',
          }}
        >
          <label data-layout="newGameNameField" /* game name input wrapper */ style={{ display: 'grid', gap: '0.35rem', color: '#0f766e', fontSize: '0.85rem' }}>
            Game name
            <input
              value={brief.name}
              onChange={(event) => setBrief((current) => ({ ...current, name: event.target.value }))}
              placeholder="New game"
              style={{ padding: '0.8rem 0.95rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.16)', fontSize: '1rem', color: '#064e3b' }}
            />
          </label>

          <ChipPicker
            legendIcon={<Sparkles size={16} />}
            legend="Themes"
            helperText="Pick presets or type your own — mix as many as you want."
            selected={themes}
            presets={THEME_PRESETS}
            customPlaceholder="Add your own theme..."
            onChange={setThemes}
          />

          <ChipPicker
            legendIcon={<Brush size={16} />}
            legend="Art styles"
            helperText="Pick presets or type your own — these guide AI art and the visual feel."
            selected={artStyles}
            presets={ART_STYLE_PRESETS}
            customPlaceholder="Add your own art style..."
            onChange={setArtStyles}
          />

          {buildError && (
            <div data-layout="newGameErrorBanner" /* error feedback after a failed build */ style={{ padding: '0.95rem', borderRadius: '18px', background: 'rgba(254,226,226,0.9)', color: '#991b1b', lineHeight: 1.6 }}>
              {buildError}
            </div>
          )}
        </div>

        <div
          data-layout="newGameSubmitFooter"
          /* pinned footer: submit-button row */
          style={{
            flex: '0 0 auto',
            padding: '1rem 1.5rem 1.5rem 1.5rem',
            borderTop: '1px solid rgba(16,185,129,0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(255,255,255,0.92)',
          }}
        >
          <button
            onClick={handleBuildWithAI}
            disabled={!canBuild}
            style={{ borderRadius: '999px', border: 'none', background: canBuild ? 'linear-gradient(135deg, #064e3b, #10b981)' : 'rgba(16,185,129,0.35)', color: 'white', padding: '0.85rem 1.4rem', fontSize: '0.95rem', fontWeight: 600, cursor: canBuild ? 'pointer' : 'not-allowed' }}
          >
            {isBuilding ? 'Making game...' : 'Make Game'}
          </button>
        </div>
      </div>
    </AppPageFrame>
  );
};
