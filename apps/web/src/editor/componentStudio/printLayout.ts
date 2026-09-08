import type { CardStudioRow } from '../cardStudio/types';
import { validateCardRows } from '../cardStudio/model';
import type { ComponentDesignDocument } from '../templateStudio/types';

export interface ComponentPrintOptions {
  faceId?: string;
  duplex?: boolean;
  includeBleed?: boolean;
}
export interface PrintPlacement {
  rowId: string;
  copyNumber: number;
  faceId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  sourceXMm: number;
  sourceYMm: number;
  tile?: { row: number; column: number; rows: number; columns: number };
}
export interface ComponentPrintPage {
  side: 'single' | 'front' | 'back';
  placements: PrintPlacement[];
}
export interface ComponentPrintLayout {
  paperWidthMm: number;
  paperHeightMm: number;
  componentWidthMm: number;
  componentHeightMm: number;
  bleedMm: number;
  overlapMm: number;
  tiled: boolean;
  pages: ComponentPrintPage[];
}

const MARGIN = 10;
const GAP = 3;
export const BOARD_PRINT_OVERLAP_MM = 10;
const MAX_PRINT_PAGES = 500;

/** Actual-size imposition. Back positions mirror across the paper, never the artwork. */
export function buildComponentPrintLayout(
  document: ComponentDesignDocument,
  rows: CardStudioRow[],
  paper: 'a4' | 'letter' = 'a4',
  options: ComponentPrintOptions = {},
): ComponentPrintLayout {
  const errors = validateCardRows(rows);
  if (errors.length) throw new Error(errors[0]);
  const items = rows.flatMap((row) =>
    Array.from({ length: row.copies }, (_, index) => ({ rowId: row.id, copyNumber: index + 1 })),
  );
  if (!items.length) throw new Error('Add a design with at least one copy before printing.');
  const paperWidthMm = paper === 'letter' ? 215.9 : 210;
  const paperHeightMm = paper === 'letter' ? 279.4 : 297;
  const printableWidth = paperWidthMm - MARGIN * 2;
  const printableHeight = paperHeightMm - MARGIN * 2;
  const bleedMm = options.includeBleed ? document.bleedMm : 0;
  const width = document.widthMm + bleedMm * 2;
  const height = document.heightMm + bleedMm * 2;
  if (![width, height].every((size) => Number.isFinite(size) && size > 0))
    throw new Error('The component needs valid physical dimensions.');
  const firstFace = document.faces.find((face) => face.id === options.faceId) ?? document.faces[0];
  if (!firstFace) throw new Error('The template needs a face before printing.');
  if (
    options.faceId &&
    options.faceId !== 'all' &&
    !document.faces.some((face) => face.id === options.faceId)
  )
    throw new Error('That template face no longer exists.');
  if (options.duplex && document.faces.length < 2)
    throw new Error('Add a back face before exporting duplex sheets.');
  const backFace = document.faces.find((face) => face.id !== firstFace.id);
  const faces = options.faceId === 'all' && !options.duplex ? document.faces : [firstFace];
  const pages: ComponentPrintPage[] = [];
  const append = (page: ComponentPrintPage) => {
    if (pages.length >= MAX_PRINT_PAGES)
      throw new Error('This print job exceeds 500 pages. Reduce copies or print one face at a time.');
    pages.push(page);
  };
  const tiled = width > printableWidth || height > printableHeight;
  if (!tiled) {
    const columns = Math.max(1, Math.floor((printableWidth + GAP) / (width + GAP)));
    const rowsPerPage = Math.max(1, Math.floor((printableHeight + GAP) / (height + GAP)));
    const perPage = columns * rowsPerPage;
    const startX = (paperWidthMm - (columns * width + (columns - 1) * GAP)) / 2;
    for (const face of faces) {
      for (let offset = 0; offset < items.length; offset += perPage) {
        const placements = items.slice(offset, offset + perPage).map(
          (item, index): PrintPlacement => ({
            ...item,
            faceId: face.id,
            xMm: startX + (index % columns) * (width + GAP),
            yMm: MARGIN + Math.floor(index / columns) * (height + GAP),
            widthMm: width,
            heightMm: height,
            sourceXMm: 0,
            sourceYMm: 0,
          }),
        );
        append({ side: options.duplex ? 'front' : 'single', placements });
        if (options.duplex)
          append({
            side: 'back',
            placements: placements.map((placement) => ({
              ...placement,
              faceId: backFace!.id,
              xMm: paperWidthMm - placement.xMm - width,
            })),
          });
      }
    }
  } else {
    const columns = Math.max(
      1,
      Math.ceil((width - BOARD_PRINT_OVERLAP_MM) / (printableWidth - BOARD_PRINT_OVERLAP_MM)),
    );
    const rowCount = Math.max(
      1,
      Math.ceil((height - BOARD_PRINT_OVERLAP_MM) / (printableHeight - BOARD_PRINT_OVERLAP_MM)),
    );
    for (const face of faces) {
      for (const item of items) {
        for (let row = 0; row < rowCount; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const sourceX = column * (printableWidth - BOARD_PRINT_OVERLAP_MM);
            const sourceY = row * (printableHeight - BOARD_PRINT_OVERLAP_MM);
            const cropWidth = Math.min(printableWidth, width - sourceX);
            const cropHeight = Math.min(printableHeight, height - sourceY);
            const placement: PrintPlacement = {
              ...item,
              faceId: face.id,
              xMm: MARGIN,
              yMm: MARGIN,
              widthMm: cropWidth,
              heightMm: cropHeight,
              sourceXMm: sourceX,
              sourceYMm: sourceY,
              tile: { row: row + 1, column: column + 1, rows: rowCount, columns },
            };
            append({ side: options.duplex ? 'front' : 'single', placements: [placement] });
            if (options.duplex)
              append({
                side: 'back',
                placements: [
                  {
                    ...placement,
                    faceId: backFace!.id,
                    xMm: paperWidthMm - MARGIN - cropWidth,
                    sourceXMm: width - sourceX - cropWidth,
                  },
                ],
              });
          }
        }
      }
    }
  }
  return {
    paperWidthMm,
    paperHeightMm,
    componentWidthMm: width,
    componentHeightMm: height,
    bleedMm,
    overlapMm: tiled ? BOARD_PRINT_OVERLAP_MM : 0,
    tiled,
    pages,
  };
}
