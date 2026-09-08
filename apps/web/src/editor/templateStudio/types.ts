/** Artwork coordinates and dimensions are millimeters; text sizes are points. */
export type TemplateComponentKind = 'card' | 'board' | 'token' | 'tile' | 'mat' | 'piece';
export type TemplateLayerType = 'text' | 'image' | 'shape' | 'grid' | 'track';
export type TemplateTrimShape = 'rectangle' | 'ellipse' | 'hexagon';

export interface TemplateLayerBase {
  id: string;
  name: string;
  type: TemplateLayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface TemplateTextLayer extends TemplateLayerBase {
  type: 'text';
  content: string;
  fontFamily: 'serif' | 'sans' | 'mono';
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  italic: boolean;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  autoFit: 'shrink' | 'clip';
}

export interface TemplateImageLayer extends TemplateLayerBase {
  type: 'image';
  source: string;
  fit: 'cover' | 'contain' | 'stretch';
  radius: number;
}

export interface TemplateShapeLayer extends TemplateLayerBase {
  type: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line' | 'polygon' | 'path';
  radius: number;
  /** Polygon points and SVG path data use the layer's local 0..100 coordinate space. */
  points: string;
  pathData: string;
}

export interface TemplateGridLayer extends TemplateLayerBase {
  type: 'grid';
  gridType: 'square' | 'hex';
  rows: number;
  columns: number;
  gap: number;
  labels: boolean;
  startAt: number;
}

export interface TemplateTrackLayer extends TemplateLayerBase {
  type: 'track';
  trackShape: 'linear' | 'ring';
  spaces: number;
  labels: boolean;
  startAt: number;
}

export type TemplateLayer =
  | TemplateTextLayer
  | TemplateImageLayer
  | TemplateShapeLayer
  | TemplateGridLayer
  | TemplateTrackLayer;

export interface TemplateFace {
  id: string;
  name: string;
  background: string;
  layers: TemplateLayer[];
}

export interface ComponentDesignDocument {
  schemaVersion: 1;
  widthMm: number;
  heightMm: number;
  trimShape: TemplateTrimShape;
  cornerRadiusMm: number;
  bleedMm: number;
  safeMm: number;
  gridMm: number;
  snapToGrid: boolean;
  faces: TemplateFace[];
}

export interface TemplateRenderOptions {
  faceId?: string;
  data?: Record<string, string>;
  showGuides?: boolean;
  includeBleed?: boolean;
  idPrefix?: string;
}
