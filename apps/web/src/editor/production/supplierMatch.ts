import type { EditorProject } from '../types';
import type { ProjectDesignSet } from '../componentStudio/types';
import type { CatalogProduct, ProductVariant } from '../supplierCatalog';
import type { TemplateTrimShape } from '../templateStudio/types';
import { siteLabel } from '../supplierCatalog';
import {
  listProjectDesignSets,
  materializeLegacyDesign,
  setProjectComponentDesign,
} from '../componentStudio/model';
import { migrateCardTemplate } from '../templateStudio/model';
import { resizeTemplateDocument } from '../templateStudio/resize';

export type CatalogProductionType = 'printable' | 'stock' | 'unverified';
export type SupplierMatchMode = 'fit-template' | 'link-only' | 'stock-part';
export interface SupplierMatchTarget {
  projectId: string;
  designId: string;
  fingerprint: string;
}
export interface SupplierMatchSelection {
  product: CatalogProduct;
  variant: ProductVariant;
  mode: SupplierMatchMode;
}

export function safeSupplierUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function classifyCatalogProduct(product: {
  slug: string;
  sourceUrl?: string | null;
}): CatalogProductionType {
  const safe = safeSupplierUrl(product.sourceUrl);
  const url = safe ? new URL(safe) : null;
  const host = url?.hostname.replace(/^www\./, '');
  if (host === 'thegamecrafter.com') {
    if (product.slug.startsWith('tgc-print-') && url?.pathname.startsWith('/make/')) return 'printable';
    if (url?.pathname.startsWith('/parts/')) return 'stock';
  }
  if (host === 'boardgamesmaker.com' && url?.pathname.startsWith('/print/')) return 'printable';
  return 'unverified';
}

export function supplierProductUrl(
  product: Pick<CatalogProduct, 'slug' | 'sourceUrl'>,
  variant?: ProductVariant,
): string | null {
  const base = safeSupplierUrl(product.sourceUrl);
  if (
    base &&
    new URL(base).hostname.replace(/^www\./, '') === 'thegamecrafter.com' &&
    product.slug.startsWith('tgc-print-')
  ) {
    const identity = variant?.options.find(
      (option) => option.optionKey.split(':')[0] === 'api_identity',
    )?.optionValue;
    if (identity && /^[A-Za-z0-9_-]+$/.test(identity))
      return `https://www.thegamecrafter.com/make/products/${identity}`;
  }
  return base;
}

export function supplierDimensions(variant: ProductVariant): { widthMm: number; heightMm: number } | null {
  const face =
    variant.layoutConstraints.find((item) => item.faceKey === 'front') ?? variant.layoutConstraints[0];
  const widthMm = Number(face?.widthMm);
  const heightMm = Number(face?.heightMm);
  return widthMm > 0 && heightMm > 0 && Number.isFinite(widthMm) && Number.isFinite(heightMm)
    ? { widthMm, heightMm }
    : null;
}

export function supplierTrimShape(shape: string | null | undefined): TemplateTrimShape | null {
  if (shape === 'circle' || shape === 'ellipse' || shape === 'oval') return 'ellipse';
  if (shape === 'hexagon' || shape === 'hex') return 'hexagon';
  if (shape === 'square' || shape === 'rectangle' || shape === 'rounded-rectangle' || !shape)
    return 'rectangle';
  return null;
}

const MATCH_KEYS = [
  'catalogSlug',
  'catalogVariantId',
  'catalogProductTitle',
  'catalogVariantTitle',
  'catalogSourceUrl',
  'catalogSupplierId',
  'catalogSupplierName',
  'catalogProductionType',
  'catalogMatchMode',
  'catalogWidthMm',
  'catalogHeightMm',
  'catalogShape',
  'catalogOptions',
  'catalogMatchedAt',
] as const;

/** Only changes to the selected component invalidate a review; edits elsewhere remain intact. */
export function supplierMatchTarget(project: EditorProject, design: ProjectDesignSet): SupplierMatchTarget {
  const instance = design.instanceId ? project.instances[design.instanceId] : null;
  return {
    projectId: project.id,
    designId: design.id,
    fingerprint: JSON.stringify({ studio: design.studio, instance }),
  };
}

export function currentSupplierMatchTarget(
  project: EditorProject,
  target: SupplierMatchTarget,
): ProjectDesignSet {
  const design = listProjectDesignSets(project).find((item) => item.id === target.designId);
  if (project.id !== target.projectId || !design)
    throw new Error('This component is no longer available. Close this dialog and open the component again.');
  if (supplierMatchTarget(project, design).fingerprint !== target.fingerprint)
    throw new Error(
      'This component changed while you were choosing a supplier. Close and reopen to review its latest design.',
    );
  return design;
}

export function applySupplierMatch(
  project: EditorProject,
  target: SupplierMatchTarget,
  selection: SupplierMatchSelection,
): EditorProject {
  const design = currentSupplierMatchTarget(project, target);
  const { product, variant, mode } = selection;
  if (!product.slug || !variant.id) throw new Error('Choose a product and variant first.');
  const productionType = classifyCatalogProduct(product);
  const dimensions = supplierDimensions(variant);
  const shape = supplierTrimShape(product.shape);
  if (productionType === 'stock' && mode !== 'stock-part')
    throw new Error('Stock parts use the supplier’s appearance, not your printed artwork.');
  if (productionType !== 'stock' && mode === 'stock-part')
    throw new Error('Only a stock product can be matched as a stock part.');
  if (
    mode === 'fit-template' &&
    (productionType !== 'printable' ||
      !dimensions ||
      !shape ||
      dimensions.widthMm > 2000 ||
      dimensions.heightMm > 2000 ||
      dimensions.widthMm < 1 ||
      dimensions.heightMm < 1)
  )
    throw new Error(
      'A printable product with supported dimensions and shape is required to fit the template.',
    );
  const materialized = design.instanceId
    ? { project, instanceId: design.instanceId }
    : materializeLegacyDesign(project);
  let next = materialized.project;
  const id = materialized.instanceId;
  if (mode === 'fit-template' && dimensions && shape) {
    const document = design.studio.template.document ?? migrateCardTemplate(design.studio.template);
    const resized = {
      ...resizeTemplateDocument(document, dimensions.widthMm, dimensions.heightMm, true),
      trimShape: shape,
    };
    next = setProjectComponentDesign(next, id, {
      ...design.studio,
      template: { ...design.studio.template, ...dimensions, document: resized },
    });
  }
  // Set match metadata after resizing: ordinary manual size edits invalidate an old match.
  const instance = next.instances[id];
  return {
    ...next,
    instances: {
      ...next.instances,
      [id]: {
        ...instance,
        properties: {
          ...instance.properties,
          catalogSlug: product.slug,
          catalogVariantId: variant.id,
          catalogProductTitle: product.customTitle || product.title,
          catalogVariantTitle: variant.title,
          catalogSourceUrl: supplierProductUrl(product, variant) ?? '',
          catalogSupplierId: product.supplierId ?? '',
          catalogSupplierName: siteLabel(product),
          catalogProductionType: productionType,
          catalogMatchMode: mode,
          catalogWidthMm: dimensions?.widthMm ?? null,
          catalogHeightMm: dimensions?.heightMm ?? null,
          catalogShape: product.shape ?? '',
          catalogOptions: variant.options.map((option) => ({
            group: option.optionGroup,
            key: option.optionKey,
            value: option.optionValue,
          })),
          catalogMatchedAt: new Date().toISOString(),
        },
      },
    },
  };
}

export function unlinkSupplierMatch(project: EditorProject, designId: string): EditorProject {
  const instance = project.instances[designId];
  if (!instance) return project;
  const properties = { ...instance.properties };
  for (const key of MATCH_KEYS) delete properties[key];
  return { ...project, instances: { ...project.instances, [designId]: { ...instance, properties } } };
}
