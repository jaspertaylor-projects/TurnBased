import { Ruler, Unlink, PackageOpen, ArrowUpRight } from 'lucide-react';
import type { EditorProject } from '../types';
import type { ComponentInstanceModel } from '@turnbased/engine-components';
import { CatalogPicker } from '../sections/visuals/CatalogPicker';
import type { ProjectDesignSet } from './types';
import { setProjectComponentDesign } from './model';
import { useUserSettings } from '../../userSettings';

export function ComponentPhysicalPanel({
  project,
  design,
  onChange,
  onOpenPlacement,
}: {
  project: EditorProject;
  design: ProjectDesignSet;
  onChange: (project: EditorProject) => void;
  onOpenPlacement: (id: string) => void;
}) {
  const { preferredUnits } = useUserSettings();
  const instance = design.instanceId ? project.instances[design.instanceId] : null;
  if (!instance || !design.instanceId) return null;
  const id = design.instanceId;
  const tied = Boolean(instance.properties.catalogSlug && instance.properties.catalogVariantId);
  const supportedCatalog = ['board', 'tile', 'deck'].includes(instance.componentType);
  function updateInstance(updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) {
    const next = updater(instance!);
    const updated = { ...project, instances: { ...project.instances, [id]: next } };
    const width = Number(next.properties.physicalWidthMm);
    const height = Number(next.properties.physicalHeightMm);
    const document = design.studio.template.document;
    if (document && width > 0 && height > 0) {
      onChange(
        setProjectComponentDesign(updated, id, {
          ...design.studio,
          template: {
            ...design.studio.template,
            widthMm: width,
            heightMm: height,
            document: { ...document, widthMm: width, heightMm: height },
          },
        }),
      );
    } else onChange(updated);
  }
  return (
    <section className="component-physical" aria-label="Physical component settings">
      <article className="component-detail-card">
        <Ruler size={23} />
        <h2>Made to fit your game.</h2>
        <p>
          {design.studio.template.widthMm} × {design.studio.template.heightMm} mm ·{' '}
          {design.studio.rows.reduce((sum, row) => sum + row.copies, 0)} copies
        </p>
        <p className="component-muted">
          Change the size, shape, bleed, and safe area in the Template editor. Every design uses the same
          physical dimensions. Changing size clears an existing supplier match.
        </p>
        <p className="component-muted">
          {tied
            ? 'This component is linked to a supplier product.'
            : 'This is a custom prototype. A supplier match is optional while you design.'}
        </p>
        {tied && (
          <button
            className="component-button"
            onClick={() =>
              updateInstance((item) => ({
                ...item,
                properties: {
                  ...item.properties,
                  catalogSlug: '',
                  catalogVariantId: '',
                  catalogProductTitle: '',
                  catalogVariantTitle: '',
                },
              }))
            }
          >
            <Unlink size={14} />
            Unlink supplier
          </button>
        )}
      </article>
      <article className="component-detail-card">
        <PackageOpen size={23} />
        <h2>Choose physical materials</h2>
        {supportedCatalog ? (
          <CatalogPicker
            componentType={instance.componentType as 'board' | 'tile' | 'deck'}
            instanceId={id}
            instance={instance}
            preferredUnits={preferredUnits}
            onUpdateComponent={(_id, updater) => updateInstance(updater)}
          />
        ) : (
          <p className="component-muted">
            Use household pieces for an early playtest. Supplier matching for this component family is not
            available here yet.
          </p>
        )}
      </article>
      <article className="component-detail-card">
        <h2>Artwork and table placement</h2>
        <p className="component-muted">
          The Template editor designs printed faces. Table placement keeps your existing spaces, tracks, and
          component relationships together.
        </p>
        <button className="component-button" onClick={() => onOpenPlacement(id)}>
          Open table placement <ArrowUpRight size={14} />
        </button>
      </article>
    </section>
  );
}
