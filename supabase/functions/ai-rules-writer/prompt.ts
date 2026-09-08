import { isRecord, toFiniteNumber } from "./protocol.ts";
import { buildWholeRulebookPrompt } from './rulebookPrompt.ts';

function trimText(value: unknown, max = 8000): string {
  if (typeof value !== "string") return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n[…truncated]`;
}

interface ChapterContext {
  title: string;
  body: string;
}

interface ContextWeights {
  rulebook: number;
  prompt: number;
  chips: number;
}

const DEFAULT_CONTEXT_WEIGHTS: ContextWeights = {
  rulebook: 70,
  prompt: 100,
  chips: 70,
};

function normalizeChapter(value: unknown): ChapterContext | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title : "";
  const body = typeof value.body === "string" ? value.body : "";
  if (!title.trim() && !body.trim()) return null;
  return { title, body };
}

interface ArtStyleDetail {
  name: string;
  description: string;
}

function normalizeArtStyleDetail(value: unknown): ArtStyleDetail | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description = typeof value.description === "string"
    ? value.description.trim()
    : "";
  if (!name && !description) return null;
  return { name, description };
}

function clampWeight(value: unknown, fallback: number): number {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeContextWeights(value: unknown): ContextWeights {
  if (!isRecord(value)) return DEFAULT_CONTEXT_WEIGHTS;
  return {
    rulebook: clampWeight(value.rulebook, DEFAULT_CONTEXT_WEIGHTS.rulebook),
    prompt: clampWeight(value.prompt, DEFAULT_CONTEXT_WEIGHTS.prompt),
    chips: clampWeight(value.chips, DEFAULT_CONTEXT_WEIGHTS.chips),
  };
}

/**
 * Minimum project metadata (game name + player count) that frames every
 * generation. Hidden only when the user has muted BOTH the rulebook and
 * the project flavor — that combination signals "I want a prompt-only
 * response" and even the game name can leak vibe (see "No Honor"
 * → grimdark drift).
 */
function buildProjectMetaLines(payload: {
  gameName: string;
  playerMin: number;
  playerMax: number;
  weights: ContextWeights;
}): string[] {
  if (payload.weights.chips <= 0 && payload.weights.rulebook <= 0) {
    return [
      "PROJECT CONTEXT: intentionally withheld by user weighting (rulebook=0 and chips=0). Do not invent a project tone; follow ONLY the user prompt below.",
    ];
  }
  return [
    `GAME NAME: ${payload.gameName || "Untitled game"}`,
    `PLAYER COUNT: ${payload.playerMin}-${payload.playerMax}`,
  ];
}

/** USER GUIDANCE block — returns '' when the prompt slider is at 0 or the user typed nothing. */
function buildPromptSection(userPrompt: string, weight: number): string {
  if (!userPrompt || weight <= 0) return "";
  return `USER GUIDANCE (weight ${weight}/100):\n${userPrompt}`;
}

/** RULEBOOK block — returns '' at weight 0. Truncation gets more aggressive as the weight drops. */
function buildRulebookSection(
  chapters: ChapterContext[],
  activeIndex: number,
  weight: number,
): string {
  if (weight <= 0) return "";
  const bodyLimit = weight >= 70 ? 2000 : weight >= 35 ? 900 : 300;
  const parts: string[] = [
    `RULEBOOK SO FAR (weight ${weight}/100, all sections in order):`,
  ];
  chapters.forEach((chapter, index) => {
    const marker = index === activeIndex
      ? " ← YOU ARE WRITING THIS SECTION"
      : "";
    const body = chapter.body.trim()
      ? trimText(chapter.body, bodyLimit)
      : "(empty)";
    parts.push("");
    parts.push(
      `### ${index + 1}. ${chapter.title || "Untitled section"}${marker}`,
    );
    parts.push(body);
  });
  return parts.join("\n");
}

/**
 * PROJECT FLAVOR block — themes + art styles + the longer art-direction
 * paragraphs from the Art studio. Returns '' at weight 0 or when the brief
 * has nothing flavor-relevant to share.
 */
function buildChipsSection(
  theme: string,
  artStyle: string,
  artStyleDetails: ArtStyleDetail[],
  weight: number,
): string {
  if (weight <= 0) return "";
  const hasContent = theme.trim().length > 0 || artStyle.trim().length > 0 ||
    artStyleDetails.length > 0;
  if (!hasContent) return "";
  const parts: string[] = [`PROJECT FLAVOR (weight ${weight}/100):`];
  if (theme.trim()) parts.push(`  THEMES: ${theme}`);
  if (artStyle.trim()) parts.push(`  ART STYLES: ${artStyle}`);
  if (artStyleDetails.length > 0) {
    parts.push(
      "  ART DIRECTION (from the Art studio — match the language and references when describing visuals):",
    );
    artStyleDetails.forEach((style) => {
      const name = style.name || "Untitled style";
      const desc = style.description
        ? ` — ${trimText(style.description, 500)}`
        : "";
      parts.push(`    - ${name}${desc}`);
    });
  }
  return parts.join("\n");
}

/**
 * Order the three weighted sections (prompt, rulebook, chips) by their
 * slider values, descending. Sections at weight 0 — or with no content —
 * are filtered out. The result is the order the model sees them; higher
 * weights commit the model to that framing first.
 *
 * Stable tie-break order: prompt → rulebook → chips when two sliders
 * sit at the same value. That keeps the user's explicit guidance ahead
 * of project metadata on a fresh project where chips defaults equal
 * rulebook defaults.
 */
function orderWeightedSections(
  sections: {
    name: "prompt" | "rulebook" | "chips";
    weight: number;
    text: string;
  }[],
): string[] {
  const tieOrder: Record<"prompt" | "rulebook" | "chips", number> = {
    prompt: 0,
    rulebook: 1,
    chips: 2,
  };
  return sections
    .filter((s) => s.text.length > 0)
    .sort((a, b) =>
      (b.weight - a.weight) || (tieOrder[a.name] - tieOrder[b.name])
    )
    .map((s) => s.text);
}

export function buildRulesPrompt(body: Record<string, unknown>) {
  if (body.mode === 'rulebook') return buildWholeRulebookPrompt(body);
  const gameName = typeof body.gameName === "string" ? body.gameName : "";
  const theme = typeof body.theme === "string" ? body.theme : "";
  const artStyle = typeof body.artStyle === "string" ? body.artStyle : "";
  const playerMin = toFiniteNumber(body.playerMin) ?? 2;
  const playerMax = toFiniteNumber(body.playerMax) ?? 4;
  const chapters = Array.isArray(body.chapters)
    ? body.chapters.map(normalizeChapter).filter((c): c is ChapterContext =>
      c !== null
    )
    : [];
  const artStyleDetails = Array.isArray(body.artStyleDetails)
    ? body.artStyleDetails.map(normalizeArtStyleDetail).filter((
      d,
    ): d is ArtStyleDetail => d !== null)
    : [];
  const activeChapterTitle = typeof body.activeChapterTitle === "string"
    ? body.activeChapterTitle
    : "";
  const activeChapterBody = typeof body.activeChapterBody === "string"
    ? body.activeChapterBody
    : "";
  const activeIndex = chapters.findIndex((c) =>
    c.title === activeChapterTitle && c.body === activeChapterBody
  );
  const userPrompt = typeof body.userPrompt === "string"
    ? body.userPrompt.trim()
    : "";
  const contextWeights = normalizeContextWeights(body.contextWeights);
  const mode = body.mode === "rewrite"
    ? "rewrite"
    : body.mode === "expand"
    ? "expand"
    : body.mode === "brainstorm"
    ? "brainstorm"
    : "draft";
  // User-driven temperature override. Clamp to a sane LLM range; an
  // unsupplied or non-finite value falls back to the mode-specific
  // default further below.
  const requestedTemperature = toFiniteNumber(body.temperature);
  const clientTemperature = requestedTemperature !== null
    ? Math.max(0, Math.min(2, requestedTemperature))
    : null;

  if (!activeChapterTitle.trim()) {
    throw new Error("Active chapter title is required");
  }

  const resolvedChapters = activeIndex >= 0
    ? chapters
    : [...chapters, { title: activeChapterTitle, body: activeChapterBody }];
  const resolvedActiveIndex = activeIndex >= 0
    ? activeIndex
    : resolvedChapters.length - 1;

  const projectMetaLines = buildProjectMetaLines({
    gameName,
    playerMin,
    playerMax,
    weights: contextWeights,
  });

  const activeBodyTrim = activeChapterBody.trim();
  const hasExistingBody = activeBodyTrim.length > 0;

  let modeInstruction: string;
  if (mode === "brainstorm") {
    modeInstruction = [
      "MODE: BRAINSTORM — produce a list of short candidates, typically names.",
      'Return ONLY a JSON array of 20 strings, no preamble, no markdown fences, no trailing prose. Example shape: ["First idea", "Second idea", "Third idea"].',
      "Each entry should be SHORT — at most a few words, ideally just a name or short phrase. No descriptions, no explanations inside the entries.",
      "Make the 20 entries varied — mix tones, syllable counts, vibes — so the user has real choice. Avoid duplicates and near-duplicates.",
      "Use the GENERATION PRIORITIES above to decide how strongly to honor the user prompt, theme/style tags, and existing rulebook — they're listed in the order the model should weight them, highest first. If the prompt has the highest weight, its style constraints win over the project flavor.",
      'If the user prompt names a kind of thing (e.g. "city names", "faction names", "starter items"), brainstorm that specifically.',
      "Follow the user prompt as written. If it names a specific reference (a city, franchise, era, aesthetic, mood), match that reference faithfully rather than the keywords in its name.",
    ].join("\n");
  } else if (mode === "rewrite" && hasExistingBody) {
    modeInstruction = [
      `MODE: REWRITE the existing "${activeChapterTitle}" section.`,
      "You MUST preserve every concrete rule, term, value, and named entity from the existing draft verbatim.",
      "You MAY ONLY change wording, sentence structure, paragraph order, and flow.",
      "DO NOT add new rules, new examples, new entities, or new content beyond what the existing draft already says.",
      "DO NOT shorten by dropping rules; if you reorganize, every rule still appears somewhere.",
      "Length should stay within ±15% of the existing draft. Word count target: roughly the same as the input.",
      "",
      "EXISTING TEXT TO REWRITE (output a cleaner version that says the same things):",
      activeBodyTrim,
    ].join("\n");
  } else if (mode === "expand" && hasExistingBody) {
    modeInstruction = [
      `MODE: EXPAND the existing "${activeChapterTitle}" section.`,
      "You MUST include the existing draft's text VERBATIM, word-for-word — every sentence currently in it must appear in your output unchanged.",
      "AFTER reproducing the existing text, ADD new material: missing details, clarifying examples, edge cases, an illustrative scenario, or a quick reference list.",
      "The output should be noticeably LONGER than the input — typically 1.5× to 2.5× the length.",
      "Do not contradict any existing rule. New material must be consistent with what is already there.",
      "",
      "EXISTING TEXT TO PRESERVE AND BUILD ON:",
      activeBodyTrim,
    ].join("\n");
  } else {
    // `draft` mode, or fallback when expand/rewrite were chosen but the
    // section is empty. Ignore any existing body so the user gets a
    // genuine fresh start instead of a near-duplicate.
    modeInstruction = [
      `MODE: FRESH DRAFT of the "${activeChapterTitle}" section.`,
      "IGNORE any text currently in this section. Write a clean, original first draft from scratch, grounded in the rulebook context above (themes, art direction, sibling sections, user guidance).",
      "Do not include or paraphrase the current body — it is a placeholder being replaced wholesale.",
      "Target a focused first draft: 2-4 short paragraphs unless the user asks for more.",
    ].join("\n");
  }

  // Order the weighted sources by their current slider values so the model
  // reads them highest-first. The priority block enumerates the same
  // ordering so the model can see the numbers alongside the sections.
  const orderedWeights = [
    {
      name: "prompt" as const,
      label: "User prompt",
      value: contextWeights.prompt,
    },
    {
      name: "rulebook" as const,
      label: "Rulebook so far",
      value: contextWeights.rulebook,
    },
    {
      name: "chips" as const,
      label: "Theme/style tags",
      value: contextWeights.chips,
    },
  ].sort((a, b) => b.value - a.value);

  const priorityBlock = [
    "GENERATION PRIORITIES (0 = ignore, 100 = decisive). Sources are listed in priority order — the first one wins on conflict:",
    ...orderedWeights.map((entry) => `- ${entry.label}: ${entry.value}/100`),
    "At 0, treat that source as intentionally disabled. Higher-weighted sources override lower-weighted ones.",
  ].join("\n");

  const weightedSections = orderWeightedSections([
    {
      name: "prompt",
      weight: contextWeights.prompt,
      text: buildPromptSection(userPrompt, contextWeights.prompt),
    },
    {
      name: "rulebook",
      weight: contextWeights.rulebook,
      text: buildRulebookSection(
        resolvedChapters,
        resolvedActiveIndex,
        contextWeights.rulebook,
      ),
    },
    {
      name: "chips",
      weight: contextWeights.chips,
      text: buildChipsSection(
        theme,
        artStyle,
        artStyleDetails,
        contextWeights.chips,
      ),
    },
  ]);

  const responseFormatInstruction = mode === "brainstorm"
    ? "For brainstorm mode, return ONLY the JSON array requested by the task. No preamble, no markdown, no closing remarks."
    : "Return ONLY the body text for the requested section. No preamble, no closing remarks, no JSON.";

  // System-prompt rules that ground the model in project flavor are
  // CONDITIONAL on the user's weights. With chips=0 the model must not
  // evoke unstated themes; with rulebook=0 it must not mimic an unseen
  // voice. Leaving these in unconditionally is what makes a brainstorm
  // run drift toward project-vibe defaults even when the user dialed the
  // flavor sliders to zero.
  const systemRules: string[] = [
    "You are a co-designer helping a game creator write the rulebook for their tabletop board game.",
    'Write in clean, modern board-game-rulebook prose — concise, instructive, second-person ("you"), and unambiguous.',
  ];
  if (contextWeights.rulebook > 0) {
    systemRules.push(
      "Match the tone and any terminology already established in other sections of the rulebook.",
    );
  }
  if (contextWeights.chips > 0) {
    systemRules.push(
      'GROUND every reference to setting, characters, factions, locations, and visual flavor in the project\'s THEMES, ART STYLES, and ART DIRECTION listed in the context block. If the themes say "Cozy forest, Magical garden" the prose should evoke that, not generic fantasy.',
    );
  }
  if (contextWeights.rulebook <= 0 && contextWeights.chips <= 0) {
    systemRules.push(
      "The user has explicitly muted both project flavor (chips=0) and the rest of the rulebook (rulebook=0). Treat this as a clean-slate brainstorm/draft driven ONLY by the user prompt. Do NOT infer a tone, setting, genre, or aesthetic from the game name, chapter title, or any prior context — invent only from what the user prompt says.",
    );
  }
  systemRules.push(
    "Respect the GENERATION PRIORITIES from the user message. User guidance with a higher weight can override project flavor; project flavor with a 0 chip weight should not influence the answer.",
    "PLACEHOLDER CONVENTION: any angle-bracket token containing a short hyphenated descriptor — e.g. <city-name>, <faction>, <character-archetype>, <sacred-item>, <evil-trinket>, <ritual-name> — is a placeholder. REPLACE each with a single specific value that fits the game's themes. The angle-bracket marker text must not appear in your output; only the chosen replacement does. Read the descriptor inside the brackets as a hint about what kind of thing to invent. (Do not treat real HTML/markup tokens like </p> or self-closing slashes as placeholders.)",
    "NEVER restate the section title in your output — the heading is already shown above your text.",
    "NEVER use markdown headings (#, ##) or fenced code blocks. Plain paragraphs only, with occasional bulleted lists where they aid clarity.",
    responseFormatInstruction,
  );
  const systemPrompt = systemRules.join("\n");

  // Single canonical assembly: priority numbers first, project metadata
  // second, then the weighted sections in slider-DESC order, then the
  // task. No special-case branching for "prompt at 100" — the ordering
  // step places the highest-weighted source first in the supplied context.
  const userMessageParts: string[] = [priorityBlock, ""];
  if (projectMetaLines.length > 0) {
    userMessageParts.push(...projectMetaLines, "");
  }
  for (const section of weightedSections) {
    userMessageParts.push(section, "");
  }
  userMessageParts.push("---", "", `TASK: ${modeInstruction}`);
  const userMessage = userMessageParts.join("\n");

  return {
    systemPrompt,
    userMessage,
    activeChapterTitle,
    mode,
    contextWeights,
    chapterCount: resolvedChapters.length,
    temperature: clientTemperature ?? (mode === "brainstorm" ? 0.85 : 0.6),
  };
}
