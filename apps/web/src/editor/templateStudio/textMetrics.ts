import type { TemplateTextLayer } from "./types";

type Typography = Pick<
  TemplateTextLayer,
  "fontFamily" | "fontWeight" | "italic"
>;
const MARK = /\p{Mark}/u;
const ZERO_WIDTH = new Set(["\u200b", "\u200c", "\u200d", "\u2060", "\ufe0e", "\ufe0f"]);

/** Keep accents and joined emoji with their base when a long word must wrap. */
function clusters(value: string): string[] {
  const result: string[] = [];
  for (const point of value) {
    const code = point.codePointAt(0)!;
    if (
      result.length &&
      (MARK.test(point) ||
        ZERO_WIDTH.has(point) ||
        (code >= 0x1f3fb && code <= 0x1f3ff) ||
        result.at(-1)!.endsWith("\u200d"))
    ) {
      result[result.length - 1] += point;
    } else result.push(point);
  }
  return result;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f000 && code <= 0x1faff) ||
    code >= 0x20000
  );
}

// Conservative advances in em for Georgia/Arial and their common fallbacks.
// Measuring in the browser would make downloaded/agent-rendered SVGs depend on
// which fonts happened to be loaded. These bounds also account for broad glyphs.
function pointWidth(point: string, mono: boolean): number {
  if (MARK.test(point) || ZERO_WIDTH.has(point)) return 0;
  const code = point.codePointAt(0)!;
  if (isWide(code)) return mono ? 1.3 : 1.2;
  if (mono) return 0.65;
  const latin = point.normalize("NFD")[0];
  if (/\s/.test(latin)) return 0.34;
  if (latin === "W") return 1.16;
  if (latin === "M") return 1.1;
  if (latin === "m") return 1.03;
  if (latin === "w") return 0.94;
  if (/[CGOQ]/.test(latin)) return 0.91;
  if (/[ABDHKNPRUVXY]/.test(latin)) return 0.86;
  if (/[EFLSZT]/.test(latin)) return 0.77;
  if (latin === "I") return 0.43;
  if (latin === "J") return 0.61;
  if (/[ijl]/.test(latin)) return 0.37;
  if (/[frt]/.test(latin)) return 0.49;
  if (/[a-z]/.test(latin)) return 0.67;
  if (/[0-9]/.test(latin)) return 0.69;
  if (/[.,'`]/.test(latin)) return 0.34;
  if (/[:;!|]/.test(latin)) return 0.4;
  if (/[()[\]{}\-/\\]/.test(latin)) return 0.55;
  if (/[@%&]/.test(latin)) return 1.14;
  if (/[_+=#$*?"<>]/.test(latin)) return 0.8;
  return 1.2;
}

function clusterWidth(cluster: string, font: Typography): number {
  const points = Array.from(cluster).map((point) =>
    pointWidth(point, font.fontFamily === "mono"),
  );
  const width = cluster.includes("\u200d")
    ? Math.max(0, ...points)
    : points.reduce((sum, value) => sum + value, 0);
  return (
    width * (font.fontWeight === "bold" ? 1.06 : 1) * (font.italic ? 1.04 : 1)
  );
}

export function templateTextWidthEm(value: string, font: Typography): number {
  return clusters(value).reduce(
    (sum, cluster) => sum + clusterWidth(cluster, font),
    0,
  );
}

/** Wrap by estimated physical advances, including words wider than the box. */
export function wrapTemplateText(
  value: string,
  widthEm: number,
  font: Typography,
): string[] {
  const limit = Math.max(0.001, widthEm);
  const space = templateTextWidthEm(" ", font);
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let line = "";
      let width = 0;
      const flush = () => {
        if (line) lines.push(line);
        line = "";
        width = 0;
      };
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const wordWidth = templateTextWidthEm(word, font);
        if (line && width + space + wordWidth <= limit) {
          line += ` ${word}`;
          width += space + wordWidth;
          continue;
        }
        flush();
        if (wordWidth <= limit) {
          line = word;
          width = wordWidth;
          continue;
        }
        for (const cluster of clusters(word)) {
          const nextWidth = clusterWidth(cluster, font);
          if (line && width + nextWidth > limit) flush();
          line += cluster;
          width += nextWidth;
        }
      }
      if (line || !lines.length) lines.push(line);
      return lines;
    });
}
