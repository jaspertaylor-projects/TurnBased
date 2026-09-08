import { supabase } from "../../lib/supabaseClient";
import { resolveRulesWriterModel } from "../aiModelCatalog";
import type { EditorProject } from "../types";
import type { CardStudioState } from "./types";
import { validateAITableEdits, type AITableTarget } from "./aiTableModel";

export function buildAITableRequest(
  project: EditorProject,
  studio: CardStudioState,
  target: AITableTarget,
  prompt: string,
  modelId: string,
) {
  if (!prompt.trim() || prompt.length > 4000)
    throw new Error("Describe the change in 1–4,000 characters.");
  if (target.rowIds.length > 100)
    throw new Error(
      "AI can edit up to 100 cells at once. Select a single cell in larger columns.",
    );
  if (studio.rows.length > 200)
    throw new Error(
      "AI table context supports up to 200 designs. Split this table into smaller components first.",
    );
  const body = {
    target,
    prompt: prompt.trim(),
    modelId: resolveRulesWriterModel(modelId),
    rows: studio.rows.map(
      ({ id, title, body, cost, category, copies, customFields }) => ({
        id,
        title,
        body,
        cost,
        category,
        copies,
        customFields: target.field.startsWith("custom:")
          ? {
              ...customFields,
              [target.field.slice(7)]:
                customFields[target.field.slice(7)] ?? "",
            }
          : customFields,
      }),
    ),
    game: {
      name: project.brief.name || project.name,
      theme: project.brief.theme || project.art.theme,
      rules: [
        ...project.rules.chapters.map((chapter) => `${chapter.title}\n${chapter.body}`),
        project.rules.rulesText,
        project.rules.designerNotes && `Designer notes\n${project.rules.designerNotes}`,
        ...project.rules.customComponents.map(component => `${component.name}\n${component.description}`),
      ].filter(Boolean).join("\n\n"),
    },
  };
  if (new TextEncoder().encode(JSON.stringify(body)).length > 256_000)
    throw new Error(
      "The rules and table exceed the AI context limit. Shorten the context or split the component before trying again.",
    );
  return body;
}
export async function generateAITableEdits(
  project: EditorProject,
  studio: CardStudioState,
  target: AITableTarget,
  prompt: string,
  modelId: string,
  signal: AbortSignal,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous)
    throw new Error("Sign in to use AI table editing.");
  if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
  const { data, error } = await supabase.functions.invoke("ai-card-table", {
    body: buildAITableRequest(project, studio, target, prompt, modelId),
    signal,
  });
  if (error) {
    let message = error.message;
    try {
      const response = (error as { context?: Response }).context;
      const detail = await response?.clone().json();
      if (typeof detail?.error === "string") message = detail.error;
      else if (typeof detail?.message === "string") message = detail.message;
    } catch {
      /* Keep the transport error when no JSON body is available. */
    }
    throw new Error(message || "AI table editing is unavailable.");
  }
  if (!data?.success) throw new Error(data?.error || 'AI returned no table suggestions.');
  if (data?.field !== target.field)
    throw new Error(
      "AI returned edits for a different field. Nothing was changed.",
    );
  return {
    edits: validateAITableEdits(data?.edits, target),
    model: typeof data?.model === "string" ? data.model : modelId,
  };
}
