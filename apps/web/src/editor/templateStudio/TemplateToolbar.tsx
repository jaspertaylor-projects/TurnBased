import { Download, Grid2X2, LayoutTemplate, Plus, Redo2, Ruler, Undo2, Upload } from 'lucide-react';
import type { ComponentDesignDocument, TemplateFace } from './types';
import { renderDesignSvg } from './render';
import { downloadFile, fileStem } from '../exports/download';

interface TemplateToolbarProps {
  document: ComponentDesignDocument;
  face: TemplateFace;
  title: string;
  previewData: Record<string, string>;
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
  guides: boolean;
  grid: boolean;
  onBack?: () => void;
  onOpenLibrary: () => void;
  onSelectFace: (id: string) => void;
  onManageFaces: () => void;
  onToggleGuides: () => void;
  onToggleGrid: () => void;
  onImport: () => void;
  onNotice: (notice: string) => void;
}

export function TemplateToolbar({
  document,
  face,
  title,
  previewData,
  history,
  guides,
  grid,
  onBack,
  onOpenLibrary,
  onSelectFace,
  onManageFaces,
  onToggleGuides,
  onToggleGrid,
  onImport,
  onNotice,
}: TemplateToolbarProps) {
  return (
    <div data-layout="templateTopToolbar" className="template-top-toolbar">
      <div data-layout="templateHistoryTools" className="template-toolbar-group">
        {onBack && <button onClick={onBack}>Back</button>}
        <button
          aria-label="Undo template change"
          title="Undo · Ctrl/Cmd Z"
          disabled={!history.canUndo}
          onClick={history.undo}
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label="Redo template change"
          title="Redo · Ctrl/Cmd Shift Z"
          disabled={!history.canRedo}
          onClick={history.redo}
        >
          <Redo2 size={16} />
        </button>
        <i />
        <button className="template-text-button" onClick={() => onOpenLibrary()}>
          <LayoutTemplate size={15} />
          Layouts
        </button>
      </div>
      <div data-layout="templateFaceSelector" className="template-face-selector">
        {document.faces.map((item) => (
          <button key={item.id} aria-pressed={face.id === item.id} onClick={() => onSelectFace(item.id)}>
            {item.name}
          </button>
        ))}
        <button
          aria-label="Manage template faces"
          title="Manage faces"
          onClick={() => {
            onManageFaces();
          }}
        >
          <Plus size={13} />
        </button>
      </div>
      <div data-layout="templateFileTools" className="template-toolbar-group">
        <button
          aria-pressed={guides}
          aria-label="Toggle print guides"
          title="Print guides"
          onClick={() => onToggleGuides()}
        >
          <Ruler size={16} />
        </button>
        <button
          aria-pressed={grid}
          aria-label="Toggle canvas grid"
          title="Canvas grid"
          onClick={() => onToggleGrid()}
        >
          <Grid2X2 size={16} />
        </button>
        <i />
        <button title="Import a reusable template" aria-label="Import template" onClick={() => onImport()}>
          <Upload size={16} />
        </button>
        <button
          title="Download reusable template"
          aria-label="Download template"
          onClick={() => {
            downloadFile(
              `${fileStem(title)}-template.json`,
              JSON.stringify({ format: 'turnbased-component-template', version: 1, document }, null, 2),
            );
            onNotice('Reusable template downloaded with every face and layer.');
          }}
        >
          <Download size={16} />
        </button>
        <button
          className="template-text-button"
          onClick={() =>
            downloadFile(
              `${fileStem(title)}-${fileStem(face.name)}.svg`,
              renderDesignSvg(document, { faceId: face.id, data: previewData }),
              'image/svg+xml',
            )
          }
        >
          SVG
        </button>
      </div>
    </div>
  );
}
