import { useState, type KeyboardEvent } from 'react';
import { Brush, ChevronDown, Plus, Sparkles, X } from 'lucide-react';

import { AppPageFrame } from '../components/AppPageFrame';
import { NumericInput } from '../components/NumericInput';
import { buildProjectWithAI } from '../editor/aiBuildService';
import { commitProjectVersion, syncProjectWorkspace } from '../editor/git';
import { buildPreviewRuntime } from '../editor/runtime';
import { createDefaultRulesBrief, normalizeRulesBuilderBrief } from '../editor/project';
import { saveEditorProject } from '../editor/storage';
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

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

      <div data-layout="chipPickerCustomRow" /* free-text input + Add button + View suggestions toggle, all on top */ style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleDraftKey}
          placeholder={customPlaceholder}
          style={{ flex: '1 1 220px', minWidth: 0, padding: '0.6rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(15,118,110,0.16)', boxSizing: 'border-box', fontSize: '0.88rem', color: '#064e3b', background: 'white' }}
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
        <button
          type="button"
          onClick={() => setSuggestionsOpen((prev) => !prev)}
          aria-expanded={suggestionsOpen}
          style={{
            padding: '0.55rem 0.85rem',
            borderRadius: '12px',
            border: '1px solid rgba(15,118,110,0.3)',
            background: suggestionsOpen ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.85)',
            color: '#0f766e',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.82rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Sparkles size={13} />
          {suggestionsOpen ? 'Hide suggestions' : 'View suggestions'}
          <ChevronDown size={14} style={{ transition: 'transform 160ms ease', transform: suggestionsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>
      </div>

      <div data-layout="chipPickerSelectedRow" /* selected chips with × remove buttons */ style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '2rem' }}>
        {selected.length === 0 ? (
          <span style={{ color: 'rgba(15,118,110,0.55)', fontSize: '0.82rem', fontStyle: 'italic', alignSelf: 'center' }}>
            Type your own above, or view suggestions for ideas.
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

      {suggestionsOpen && presetsRemaining.length > 0 && (
        <div data-layout="chipPickerPresetsRow" /* preset chips revealed by View suggestions */ style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', padding: '0.65rem 0.7rem', background: 'rgba(255,255,255,0.6)', borderRadius: '14px', border: '1px dashed rgba(16,185,129,0.22)' }}>
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

      {suggestionsOpen && presetsRemaining.length === 0 && (
        <p style={{ margin: 0, color: 'rgba(15,118,110,0.6)', fontSize: '0.82rem', fontStyle: 'italic' }}>
          You have already picked every suggested option — type your own above to add more.
        </p>
      )}
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

      await saveEditorProject(buildResult.project);
      await syncProjectWorkspace(buildResult.project, runtime);

      const commitResult = await commitProjectVersion(
        buildResult.project,
        runtime,
        buildResult.usedAI ? 'AI generated linked multi-view starter project' : 'Generated linked multi-view starter scaffold',
      );

      await saveEditorProject(commitResult.project);
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
          /* pinned header: tinted background + bottom border so the scrollable
             body below reads as a distinct region the user is working inside. */
          style={{
            flex: '0 0 auto',
            padding: '1.4rem 1.5rem 1.1rem 1.5rem',
            background: 'linear-gradient(180deg, rgba(236,253,245,0.9) 0%, rgba(220,252,231,0.7) 100%)',
            borderBottom: '1px solid rgba(16,185,129,0.18)',
          }}
        >
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0f766e', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
            New Game
          </p>
          <h1 style={{ margin: 0 }}>Create a game</h1>
        </div>

        <div
          data-layout="newGameScrollBody"
          /* scrollable body: the only region that grows or scrolls. Anything that
             can become long (chip presets, future fields) lives here. Right
             padding is bumped to give the cozy scrollbar (index.css) a visible
             gutter away from the form fields. */
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '1rem 1rem 1rem 1.5rem',
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

          <div data-layout="newGamePlayersField" /* players range — small inline editor; brief stores min/max */ style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#0f766e', fontSize: '0.85rem', fontWeight: 700 }}>Players</span>
            <NumericInput
              min={1}
              max={6}
              value={brief.minPlayers}
              onValueChange={(value) => setBrief((current) => {
                const nextMin = Math.max(1, Math.min(6, value));
                return {
                  ...current,
                  minPlayers: Math.min(nextMin, current.maxPlayers),
                  maxPlayers: Math.max(nextMin, current.maxPlayers),
                };
              })}
              style={{ width: '70px', padding: '0.55rem 0.7rem', borderRadius: '10px', border: '1px solid rgba(15,118,110,0.16)', textAlign: 'center', color: '#064e3b' }}
            />
            <span style={{ color: 'rgba(15,118,110,0.7)', fontSize: '0.85rem' }}>to</span>
            <NumericInput
              min={1}
              max={6}
              value={brief.maxPlayers}
              onValueChange={(value) => setBrief((current) => {
                const nextMax = Math.max(1, Math.min(6, value));
                return {
                  ...current,
                  minPlayers: Math.min(current.minPlayers, nextMax),
                  maxPlayers: Math.max(current.minPlayers, nextMax),
                };
              })}
              style={{ width: '70px', padding: '0.55rem 0.7rem', borderRadius: '10px', border: '1px solid rgba(15,118,110,0.16)', textAlign: 'center', color: '#064e3b' }}
            />
            <span style={{ color: 'rgba(15,118,110,0.55)', fontSize: '0.78rem', fontStyle: 'italic' }}>
              You can change this later in the Stats tab.
            </span>
          </div>

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
