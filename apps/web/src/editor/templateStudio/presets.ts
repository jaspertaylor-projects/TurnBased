import type { CardTemplate } from "../cardStudio/types";
import type {
  ComponentDesignDocument,
  TemplateComponentKind,
  TemplateFace,
  TemplateLayer,
  TemplateLayerType,
} from "./types";
import { templateLayerDefaults } from "./layers";

const COLORS: Record<string, [string, string, string]> = {
  woodland: ["#fbf3dd", "#193e31", "#a46e38"],
  storybook: ["#f6edfc", "#3b2850", "#9467b8"],
  modern: ["#f9faf7", "#153c3b", "#d29645"],
};

function documentBase(widthMm: number, heightMm: number): ComponentDesignDocument {
  return {
    schemaVersion: 1,
    widthMm,
    heightMm,
    trimShape: "rectangle",
    cornerRadiusMm: 2.5,
    bleedMm: 3,
    safeMm: 3,
    gridMm: 1,
    snapToGrid: true,
    faces: [],
  };
}

function builder(document: ComponentDesignDocument, face: TemplateFace) {
  return (type: TemplateLayerType, id: string, name: string, patch: Partial<TemplateLayer>) => {
    const layer = { ...templateLayerDefaults(type, document, id), ...patch, id, name, type } as TemplateLayer;
    face.layers.push(layer);
    return layer;
  };
}

/** Old preset coordinates are converted into individually editable millimeter layers. */
export function buildCardPreset(template: CardTemplate): ComponentDesignDocument {
  const document = documentBase(template.widthMm, template.heightMm);
  const s = template.widthMm / 315;
  document.cornerRadiusMm = 14 * s;
  const h = template.heightMm / s;
  const { background, foreground, accent } = template;
  const front: TemplateFace = { id: "front", name: "Front", background, layers: [] };
  const add = builder(document, front);
  const shape = (
    id: string,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    patch: Partial<TemplateLayer> = {},
  ) =>
    add("shape", id, name, {
      x: x * s,
      y: y * s,
      width: width * s,
      height: height * s,
      fill: "none",
      stroke: accent,
      strokeWidth: s,
      ...patch,
    });
  const text = (
    id: string,
    name: string,
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    patch: Partial<TemplateLayer> = {},
  ) =>
    add("text", id, name, {
      content,
      x: x * s,
      y: y * s,
      width: width * s,
      height: height * s,
      fill: foreground,
      stroke: "none",
      fontFamily: "sans",
      fontSize: (size * s * 72) / 25.4,
      lineHeight: 1.28,
      ...patch,
    });
  shape("card-outline", "Card outline", 0.5, 0.5, 314, h - 1, { radius: 14 * s });
  if (template.preset === "modern") {
    shape("title-banner", "Title banner", 0, 0, 315, 80, { fill: foreground, stroke: "none", radius: 0 });
    shape("footer-band", "Footer band", 0, h - 43, 315, 28, {
      fill: accent,
      stroke: "none",
      opacity: 0.15,
      radius: 0,
    });
  } else {
    shape("inner-border", "Inner border", 11, 11, 293, h - 22, {
      radius: (template.preset === "storybook" ? 25 : 8) * s,
      strokeWidth: (template.preset === "storybook" ? 2 : 1) * s,
    });
    shape("heading-rule", "Heading divider", 20, 70, 275, 0.1, { shape: "line", opacity: 0.55 });
    shape("footer-rule", "Footer divider", 26, h - 49, 263, 0.1, { shape: "line", opacity: 0.55 });
    if (template.preset === "woodland") {
      shape("top-stem", "Upper botanical stem", 16, 17, 41, 35, {
        shape: "path",
        pathData: "M0 100Q39 9 100 0",
        fill: "none",
        strokeWidth: 0.2,
      });
      shape("top-leaf", "Upper botanical flourish", 16, 17, 41, 35, {
        shape: "path",
        pathData: "M15 54Q7 0 49 20Q54 57 15 54",
        fill: accent,
        strokeWidth: 0.2,
      });
      shape("bottom-stem", "Lower botanical stem", 258, h - 52, 41, 35, {
        shape: "path",
        pathData: "M100 0Q61 91 0 100",
        fill: "none",
        strokeWidth: 0.2,
      });
      shape("bottom-leaf", "Lower botanical flourish", 258, h - 52, 41, 35, {
        shape: "path",
        pathData: "M83 46Q90 100 49 80Q44 43 83 46",
        fill: accent,
        strokeWidth: 0.2,
      });
    }
  }
  text(
    "card-title",
    "Card title",
    `{{${template.titleField}}}`,
    template.preset === "modern" ? 28 : 30,
    28,
    199,
    39,
    22,
    {
      fontWeight: "bold",
      fontFamily: template.preset === "modern" ? "sans" : "serif",
      fill: template.preset === "modern" ? background : foreground,
    },
  );
  shape("badge-circle", "Cost badge", 247, 27, 40, 40, { shape: "ellipse", fill: accent, stroke: "none" });
  text("badge-text", "Badge value", `{{${template.badgeField}}}`, 247, 32, 40, 25, 20, {
    fill: background,
    fontWeight: "bold",
    align: "center",
  });
  const artH = h * 0.32;
  if (template.showArt) {
    shape("art-wash", "Illustration wash", 26, 87, 263, artH, {
      fill: foreground,
      stroke: "none",
      opacity: 0.09,
      radius: 0,
    });
    shape(
      "art-moon",
      "Illustration moon",
      26 + 263 * 0.76 - artH * 0.16,
      87 + artH * 0.11,
      artH * 0.32,
      artH * 0.32,
      { shape: "ellipse", fill: accent, stroke: "none", opacity: 0.5 },
    );
    shape("art-hills", "Illustration hills", 26, 87, 263, artH, {
      shape: "path",
      pathData: "M0 82Q25 33 55 88Q80 51 100 73V100H0Z",
      fill: foreground,
      stroke: "none",
      opacity: 0.12,
    });
    [0.13, 0.34, 0.6, 0.88].forEach((position, index) => {
      const treeH = artH * (index % 2 ? 0.76 : 0.57);
      shape(
        `art-tree-${index + 1}`,
        `Forest tree ${index + 1}`,
        26 + position * 263 - treeH * 0.29,
        87 + artH - treeH,
        treeH * 0.58,
        treeH * 0.72,
        {
          shape: "polygon",
          points: "50,0 100,100 0,100",
          fill: foreground,
          stroke: "none",
          opacity: index % 2 ? 0.75 : 0.38,
        },
      );
      shape(
        `art-trunk-${index + 1}`,
        `Tree trunk ${index + 1}`,
        26 + position * 263,
        87 + artH - treeH * 0.6,
        0.1,
        treeH * 0.6,
        { shape: "line", stroke: accent, strokeWidth: 3 * s },
      );
    });
    shape("art-path", "Forest path", 26, 87, 263, artH, {
      shape: "path",
      pathData: "M50 100Q68 85 52 65",
      stroke: background,
      strokeWidth: 10 * s,
      opacity: 0.6,
    });
    add("image", "card-art", "Card artwork", {
      x: 26 * s,
      y: 87 * s,
      width: 263 * s,
      height: artH * s,
      source: "{{artUrl}}",
      fill: "none",
      stroke: "none",
      radius: 0,
    });
  }
  const bodyY = template.showArt ? 102 + artH : 98;
  text(
    "card-body",
    "Rules & flavor",
    `{{${template.bodyField}}}`,
    30,
    bodyY,
    255,
    h - bodyY - 58,
    template.bodyFontSize,
    { fontFamily: template.preset === "storybook" ? "serif" : "sans" },
  );
  text("card-footer", "Card category", `{{${template.footerField}}}`, 30, h - 40, 255, 23, 12, {
    fontWeight: "bold",
  });
  const back: TemplateFace = { id: "back", name: "Back", background: foreground, layers: [] };
  const backAdd = builder(document, back);
  backAdd("shape", "back-border", "Back border", {
    x: 3,
    y: 3,
    width: template.widthMm - 6,
    height: template.heightMm - 6,
    fill: "none",
    stroke: accent,
    strokeWidth: 0.5,
    radius: 2,
  });
  backAdd("shape", "back-emblem", "Back emblem", {
    x: template.widthMm * 0.25,
    y: template.heightMm * 0.2,
    width: template.widthMm * 0.5,
    height: template.widthMm * 0.5,
    shape: "ellipse",
    fill: "none",
    stroke: accent,
    strokeWidth: 0.7,
  });
  backAdd("text", "back-title", "Game name", {
    x: 6,
    y: template.heightMm * 0.62,
    width: template.widthMm - 12,
    height: 14,
    content: "YOUR GAME",
    align: "center",
    fontWeight: "bold",
    fill: background,
    fontSize: 14,
  });
  document.faces = [front, back];
  return document;
}

export function buildTemplatePreset(
  kind: TemplateComponentKind,
  preset = "woodland",
): ComponentDesignDocument {
  const colors = Object.hasOwn(COLORS, preset) ? COLORS[preset] : COLORS.woodland;
  if (kind === "card")
    return buildCardPreset({
      preset: ["woodland", "storybook", "modern"].includes(preset)
        ? (preset as CardTemplate["preset"])
        : "woodland",
      background: colors[0],
      foreground: colors[1],
      accent: colors[2],
      widthMm: 63,
      heightMm: 88,
      titleField: "title",
      bodyField: "body",
      badgeField: "cost",
      footerField: "category",
      bodyFontSize: 18,
      showArt: true,
    });
  const sizes: Record<Exclude<TemplateComponentKind, "card">, [number, number]> = {
    board: [300, 300],
    token: [32, 32],
    tile: [75, 75],
    mat: [240, 140],
    piece: [24, 36],
  };
  const [width, height] = sizes[kind];
  const doc = documentBase(width, height);
  const front: TemplateFace = { id: "front", name: "Front", background: colors[0], layers: [] };
  const add = builder(doc, front);
  const text = (
    id: string,
    name: string,
    content: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
  ) =>
    add("text", id, name, {
      content,
      x,
      y,
      width: w,
      height: h,
      fontSize: size,
      fill: colors[1],
      align: "center",
      verticalAlign: "middle",
      fontWeight: "bold",
    });
  add("shape", "surface-border", "Surface border", {
    x: 3,
    y: 3,
    width: width - 6,
    height: height - 6,
    fill: "none",
    stroke: colors[2],
    strokeWidth: 0.6,
    radius: 2,
  });
  if (kind === "board") {
    doc.safeMm = 8;
    doc.gridMm = 5;
    text("board-title", "Board title", "{{title}}", 15, 12, 270, 22, 26);
    add("grid", "board-spaces", "Woodland play spaces", {
      x: 18,
      y: 48,
      width: 264,
      height: 204,
      rows: 6,
      columns: 8,
      gap: 2,
      fill: "#e7eddb",
      stroke: "#8da779",
      strokeWidth: 0.4,
    });
    add("track", "board-score", "Score track", {
      x: 18,
      y: 268,
      width: 264,
      height: 15,
      spaces: 15,
      startAt: 0,
      fill: colors[0],
      stroke: colors[2],
    });
  } else if (kind === "token") {
    doc.trimShape = "ellipse";
    doc.safeMm = 2;
    doc.bleedMm = 2;
    front.layers[0] = {
      ...front.layers[0],
      type: "shape",
      shape: "ellipse",
      radius: 0,
      points: "",
      pathData: "",
    };
    text("token-value", "Token value", "1", 5, 6, 22, 20, 28);
  } else if (kind === "tile") {
    doc.trimShape = "hexagon";
    doc.safeMm = 5;
    front.layers[0] = {
      ...front.layers[0],
      type: "shape",
      shape: "polygon",
      radius: 0,
      points: "25,0 75,0 100,50 75,100 25,100 0,50",
      pathData: "",
    };
    add("shape", "tile-land", "Landmark", {
      x: 22,
      y: 13,
      width: 31,
      height: 33,
      shape: "polygon",
      points: "50,0 100,100 0,100",
      fill: colors[1],
      stroke: "none",
    });
    text("tile-title", "Tile name", "{{title}}", 15, 50, 45, 12, 13);
  } else if (kind === "mat") {
    doc.safeMm = 6;
    doc.gridMm = 5;
    text("mat-title", "Player mat title", "{{title}}", 12, 10, 216, 20, 22);
    add("grid", "mat-slots", "Card & resource spaces", {
      x: 15,
      y: 40,
      width: 210,
      height: 63,
      rows: 1,
      columns: 4,
      gap: 5,
      fill: "#e6ecd9",
      stroke: colors[2],
      labels: false,
    });
    add("track", "mat-track", "Resource track", {
      x: 15,
      y: 114,
      width: 210,
      height: 12,
      spaces: 12,
      fill: colors[0],
      stroke: colors[2],
    });
  } else {
    doc.safeMm = 1.5;
    doc.bleedMm = 1;
    add("shape", "piece-emblem", "Piece emblem", {
      x: 6,
      y: 7,
      width: 12,
      height: 12,
      shape: "ellipse",
      fill: colors[1],
      stroke: "none",
    });
    text("piece-value", "Piece value", "1", 4, 21, 16, 10, 14);
  }
  const back: TemplateFace = { id: "back", name: "Back", background: colors[1], layers: [] };
  const backAdd = builder(doc, back);
  backAdd("text", "back-name", "Back label", {
    x: width * 0.1,
    y: height * 0.35,
    width: width * 0.8,
    height: height * 0.3,
    content: "YOUR GAME",
    fill: colors[0],
    fontSize: Math.max(8, Math.min(30, width / 5)),
    align: "center",
    verticalAlign: "middle",
    fontWeight: "bold",
  });
  doc.faces = [front, back];
  return doc;
}
