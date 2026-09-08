import type { AIRulesContextWeights, AIRulesMode } from './aiRulesService';

export interface AIDraftState {
  chapterId: string;
  prompt: string;
  mode: AIRulesMode;
  loading: boolean;
  error: string | null;
  /* The themes and art styles from the project brief that should be sent
     as grounding for this Generate. Initialized from brief.theme /
     brief.artStyle (all on by default) when the panel opens; the user can
     toggle individual chips off to focus a generation on a subset. */
  selectedThemes: string[];
  selectedArtStyles: string[];
  /* The full lists from the project — kept on the draft so AIAssistPanel
     can render every chip (selected or not) without re-deriving from the
     project each render. */
  availableThemes: string[];
  availableArtStyles: string[];
  contextWeights: AIRulesContextWeights;
  /* OpenRouter temperature for this generation. Persisted alongside the
     other context controls so the user's tuning sticks across openings.
     Edge function default kicks in when this is undefined (0.85 for
     brainstorm, 0.6 for prose). Slider exposes the 0–1.5 range. */
  temperature: number;
  /* OpenRouter model slug for this generation. Initialized from the
     project's rulesWriter setting when the panel opens, then overridable
     per-run via the model picker. Persisted on the draft so the choice
     sticks across openings. */
  modelId: string;
  /* Result list from a Brainstorm Generate. Populated by RulesSection.runAI
     when mode === 'brainstorm'; rendered as click-to-copy chips inside the
     AI panel. Cleared when the user switches modes or runs another non-
     brainstorm generation. */
  brainstormResults: string[];
}
