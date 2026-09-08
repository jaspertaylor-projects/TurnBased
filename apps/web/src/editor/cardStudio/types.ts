export type CardTemplatePreset = "woodland" | "storybook" | "modern";

export interface CardStudioRow {
  id: string;
  title: string;
  body: string;
  cost: string;
  category: string;
  copies: number;
  artUrl: string;
  customFields: Record<string, string>;
}

export interface CardTemplate {
  preset: CardTemplatePreset;
  background: string;
  foreground: string;
  accent: string;
  widthMm: number;
  heightMm: number;
  titleField: string;
  bodyField: string;
  badgeField: string;
  footerField: string;
  bodyFontSize: number;
  showArt: boolean;
}

export interface GeneratedCard {
  id: string;
  sourceRowId: string;
  name: string;
  body: string;
  cost: string;
  category: string;
  artUrl: string;
  copyNumber: number;
  fields: Record<string, string>;
}

export interface CardStudioState {
  schemaVersion: 1;
  rows: CardStudioRow[];
  customColumns: string[];
  template: CardTemplate;
  generated?: {
    generatedAt: string;
    sourceFingerprint: string;
    cards: Array<Pick<GeneratedCard, "id" | "sourceRowId" | "copyNumber">>;
  };
}

export interface CardImportResult {
  rows: CardStudioRow[];
  customColumns: string[];
  errors: string[];
}
