# ADR 0003 — Engine Override Policy

## Status

**Accepted** — 2026-03-11

## Context

Creators have varying levels of expertise. Some want simple drag-and-drop game creation. Others want to write custom logic. A few want to modify engine-level behavior. We need a tiered system that supports all three without compromising the default experience.

## Decision

**Three tiers of engine customization, each with explicit trade-offs.**

### Tier 1 — Standard Mode (Default)

- Official engine only.
- Full compatibility guarantees.
- Full AI assistance quality.
- Marketplace-ready path.
- Recommended for most creators.

**What creators can do:**
- Use all built-in components.
- Write declarative rules (setup, turn structure, scoring, win conditions, triggers).
- Use expression language for conditions and formulas.
- Configure visibility, turn order, and priority policies.

### Tier 2 — Advanced Extension Mode

- Custom rules and extension hooks.
- Still supported and compatible.
- Full AI assistance (agents understand extension hooks).
- Marketplace-ready when within documented boundaries.

**What creators can do (in addition to Standard):**
- Register custom predicates and target generators.
- Implement custom scoring/resolution helpers.
- Create custom derived views.
- Provide custom AI hints and strategy profiles.
- Define custom interaction affordance policies.

**Guardrails:**
- Extensions run through documented hook interfaces.
- Extensions cannot modify core reducer behavior.
- Extensions are validated against the hook contract.

### Tier 3 — Experimental Engine Override Mode

- Explicit warning required on activation.
- Reduced support guarantees.
- Possible AI/tooling degradation (agents may not understand custom engine forks).
- Possible marketplace restriction initially.
- Requires irreversible per-project opt-in or strong confirmation flow.

**What creators can do (in addition to Advanced):**
- Edit engine-adjacent behavior.
- Override default trigger resolution.
- Override default priority rules.
- Override default visibility projection.
- Attach custom middleware to the reducer pipeline.

**Guardrails:**
- Clear UI warnings at activation time.
- Project is permanently marked as experimental.
- Marketplace reviewers can see the experimental flag.
- Platform may decline to guarantee save-game compatibility across engine updates.

## Project-level flag

```typescript
interface ProjectCapabilities {
  mode: 'standard' | 'advanced' | 'experimental';
  activatedAt?: string;       // ISO timestamp when mode was upgraded
  acknowledgedWarnings?: string[]; // warning IDs the creator acknowledged
}
```

## Consequences

### Benefits

- Mainstream creators get a safe, well-supported path.
- Advanced creators can extend without hacking internals.
- Power users can go deep with explicit trade-off acknowledgment.
- Marketplace quality is protected by tiered eligibility.
- AI agents can adjust behavior based on project mode.

### Drawbacks

- More complexity in the mode system → keep UI simple with progressive disclosure.
- Experimental projects may create support burden → mitigate with clear disclaimers.

### Risks

- Mode boundaries may be hard to enforce at the code level → use the hook interface pattern and document clearly what is/isn't overridable.
- Creators may activate experimental mode without understanding consequences → require explicit multi-step confirmation.

## References

- GEMINI.md: Engine Override Policy section
- GEMINI.md: Engine Layers section
- GEMINI.md: Phase 20 tasks
