import type {
  ActionLogEntry,
  CanonicalAction,
  CanonicalActionTemplate,
  DomainEvent,
  Entity,
  GameState,
  PhaseDefinition,
  PlayerState,
  PriorityPolicy,
  TriggerRegistration,
  TriggerResolution,
  TriggerType,
  Zone,
} from '@turnbased/engine-core';
import type { PlayerId, Visibility } from '@turnbased/shared-types';

export type RulePrimitive = string | number | boolean | null;

export interface RuleExpressionReference {
  kind: 'expression';
  expression: string;
}

export type RuleValueTemplate =
  | RulePrimitive
  | RuleExpressionReference
  | RuleValueTemplate[]
  | {
      [key: string]: RuleValueTemplate;
    };

export type RuleValueMap = Record<string, RuleValueTemplate>;

export interface RuleHookReference {
  name: string;
  args?: RuleValueMap;
}

export interface DeclarativeActionTemplate
  extends Omit<CanonicalActionTemplate, 'payload'> {
  payload: RuleValueMap;
}

export type RulePlayerScope = 'all' | 'active' | 'specific';

export interface RulePlayerSelector {
  scope: RulePlayerScope;
  playerIds?: PlayerId[];
  includeEliminated?: boolean;
}

export interface SetupRule {
  id: string;
  description?: string;
  order?: number;
  players?: RulePlayerSelector;
  when?: string;
  predicateHook?: RuleHookReference;
  actions?: DeclarativeActionTemplate[];
  actionHook?: RuleHookReference;
}

export interface DeclarativeStepRule {
  name: string;
  autoAdvance: boolean;
  requiresPlayerAction: boolean;
  onEnter?: DeclarativeActionTemplate[];
  onExit?: DeclarativeActionTemplate[];
}

export interface DeclarativePhaseRule {
  name: string;
  steps: DeclarativeStepRule[];
  onEnter?: DeclarativeActionTemplate[];
  onExit?: DeclarativeActionTemplate[];
}

export interface TurnStructureRule {
  phases: DeclarativePhaseRule[];
  priorityPolicy?: PriorityPolicy;
}

export type TriggerControllerScope = 'all' | 'specific';

export interface TriggerControllerSelector {
  scope: TriggerControllerScope;
  playerIds?: PlayerId[];
}

export interface DeclarativeTriggerRule {
  id: string;
  description?: string;
  type: TriggerType;
  event: DomainEvent['type'] | '*';
  controller: TriggerControllerSelector;
  when?: string;
  predicateHook?: RuleHookReference;
  actions?: DeclarativeActionTemplate[];
  actionHook?: RuleHookReference;
  priority?: number;
  resolution?: TriggerResolution;
  once?: boolean;
  phase?: string;
  prompt?: string;
  sourceEntityId?: string;
}

export type ScoringRuleMode = 'add' | 'set';

export interface ScoringRule {
  id: string;
  description?: string;
  players?: RulePlayerSelector;
  when?: string;
  predicateHook?: RuleHookReference;
  mode?: ScoringRuleMode;
  value?: string;
  scoringHook?: RuleHookReference;
}

export type WinConditionOutcome = 'win' | 'draw';

export interface WinConditionRule {
  id: string;
  description?: string;
  priority?: number;
  when?: string;
  predicateHook?: RuleHookReference;
  winnerExpression?: string;
  outcome?: WinConditionOutcome;
  winConditionHook?: RuleHookReference;
}

export type VisibilityViewerScope =
  | 'all'
  | 'none'
  | 'owner'
  | 'controller'
  | 'specific';

export interface VisibilityRuleMatch {
  ids?: string[];
  types?: string[];
  componentTypes?: string[];
  tags?: string[];
  ownerScope?: 'any' | 'viewer' | 'active_player';
}

export interface VisibilityDefaultRule {
  id: string;
  description?: string;
  target: 'entity' | 'zone';
  visibility: Visibility;
  viewers?: VisibilityViewerScope;
  playerIds?: PlayerId[];
  match?: VisibilityRuleMatch;
  when?: string;
  predicateHook?: RuleHookReference;
  visibilityHook?: RuleHookReference;
}

export interface RulebookDefinition {
  rulesText?: string;
  setup?: SetupRule[];
  turnStructure?: TurnStructureRule;
  scoring?: ScoringRule[];
  winConditions?: WinConditionRule[];
  triggers?: DeclarativeTriggerRule[];
  visibilityDefaults?: VisibilityDefaultRule[];
}

export interface RuleEvaluationRuntime {
  state: GameState;
  previousState?: GameState;
  event?: DomainEvent;
  player?: PlayerState;
  viewerId?: PlayerId | null;
  entity?: Entity;
  zone?: Zone;
  controllerId?: PlayerId;
  variables?: Record<string, unknown>;
}

export interface RuleCompileOptions {
  hooks?: RuleHookRegistry;
  timestampStart?: number;
}

export interface SetupRuleEvaluation {
  ruleId: string;
  playerId: PlayerId | null;
  actions: CanonicalAction[];
}

export interface ScoringRuleEvaluation {
  ruleId: string;
  playerId: PlayerId;
  mode: ScoringRuleMode;
  value: number;
}

export interface ScoringEvaluationResult {
  applied: ScoringRuleEvaluation[];
  totals: Record<string, number>;
}

export interface WinConditionEvaluation {
  ruleId: string;
  matched: boolean;
  outcome: WinConditionOutcome;
  winnerId: PlayerId | PlayerId[] | null;
}

export interface VisibilityRuleApplication {
  ruleId: string;
  target: 'entity' | 'zone';
  targetId: string;
  viewerId: PlayerId | null;
  visible: boolean;
  visibility: Visibility;
}

export interface VisibilityEvaluationResult {
  viewerId: PlayerId | null;
  entityVisibility: Record<string, boolean>;
  zoneVisibility: Record<string, boolean>;
  applied: VisibilityRuleApplication[];
}

export interface CompiledRulebookArtifacts {
  rulesText?: string;
  setupActions: CanonicalAction[];
  setupEvaluations: SetupRuleEvaluation[];
  phases: PhaseDefinition[];
  priorityPolicy?: PriorityPolicy;
  triggers: TriggerRegistration[];
}

export interface RuleHookContextBase extends RuleEvaluationRuntime {
  args: Record<string, unknown>;
  ruleId: string;
  evaluateExpression: (expression: string) => unknown;
}

export interface RulePredicateHook {
  name: string;
  evaluate: (context: RuleHookContextBase) => boolean;
}

export interface RuleActionBuilderHook {
  name: string;
  buildActions: (
    context: RuleHookContextBase,
  ) => CanonicalActionTemplate | CanonicalActionTemplate[];
}

export interface RuleScoringHook {
  name: string;
  computeScore: (context: RuleHookContextBase & { player: PlayerState }) => number;
}

export interface RuleWinConditionHookResult {
  matched: boolean;
  winnerId: PlayerId | PlayerId[] | null;
  outcome?: WinConditionOutcome;
}

export interface RuleWinConditionHook {
  name: string;
  evaluate: (context: RuleHookContextBase) => RuleWinConditionHookResult | null;
}

export interface RuleVisibilityHook {
  name: string;
  isVisible: (
    context: RuleHookContextBase & {
      entity?: Entity;
      zone?: Zone;
      viewerId: PlayerId | null;
    },
  ) => boolean;
}

export interface RuleTargetGeneratorHook {
  name: string;
  generateTargets: (context: RuleHookContextBase) => string[];
}

export interface RuleDerivedViewHook {
  name: string;
  compute: (context: RuleHookContextBase) => Record<string, unknown>;
}

export interface RuleAIHintHook {
  name: string;
  generateHints: (context: RuleHookContextBase) => Record<string, unknown>;
}

export interface RuleAffordancePolicyHook {
  name: string;
  computeAffordances: (context: RuleHookContextBase) => Record<string, unknown>;
}

export interface RuleHookRegistryInput {
  predicates?: RulePredicateHook[];
  actionBuilders?: RuleActionBuilderHook[];
  scoring?: RuleScoringHook[];
  winConditions?: RuleWinConditionHook[];
  visibility?: RuleVisibilityHook[];
  targetGenerators?: RuleTargetGeneratorHook[];
  derivedViews?: RuleDerivedViewHook[];
  aiHints?: RuleAIHintHook[];
  affordancePolicies?: RuleAffordancePolicyHook[];
}

export interface RuleHookRegistry {
  predicates: Record<string, RulePredicateHook>;
  actionBuilders: Record<string, RuleActionBuilderHook>;
  scoring: Record<string, RuleScoringHook>;
  winConditions: Record<string, RuleWinConditionHook>;
  visibility: Record<string, RuleVisibilityHook>;
  targetGenerators: Record<string, RuleTargetGeneratorHook>;
  derivedViews: Record<string, RuleDerivedViewHook>;
  aiHints: Record<string, RuleAIHintHook>;
  affordancePolicies: Record<string, RuleAffordancePolicyHook>;
}

export interface RuleCompilationRuntime extends RuleCompileOptions {
  state: GameState;
}

export interface TurnStructureCompilation {
  phases: PhaseDefinition[];
  priorityPolicy?: PriorityPolicy;
}

export interface PhaseActionCompilationContext {
  actionLogEntries: ActionLogEntry[];
  nextTimestamp: number;
}
