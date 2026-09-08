export function escapeTemplateMarkup(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

export function safeTemplateImage(value: string): string {
  const source = value.trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(source)) return source;
  try {
    const url = new URL(source);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function safeTemplateColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return /^(?:#[a-f\d]{3}|#[a-f\d]{4}|#[a-f\d]{6}|#[a-f\d]{8}|none|transparent)$/i.test(color) ||
    /^(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/i.test(color)
    ? color
    : fallback;
}

export function safeTemplatePath(value: unknown): string {
  return typeof value === "string" &&
    value.length <= 30_000 &&
    /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]*$/.test(value)
    ? value
    : "";
}

export function safeTemplatePoints(value: unknown): string {
  return typeof value === "string" && value.length <= 10_000 && /^[\d\s.,eE+-]*$/.test(value) ? value : "";
}

export function resolveTemplateText(content: string, data: Record<string, string> = {}): string {
  return content.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, field: string) => {
    const name = field.trim();
    return Object.hasOwn(data, name) && typeof data[name] === "string" ? data[name] : "";
  });
}

export function templateNumber(value: unknown, fallback: number, min: number, max: number): number {
  const candidate = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Number.isFinite(candidate) ? candidate : min));
}

export function templateString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}
