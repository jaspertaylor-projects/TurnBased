import { useState } from 'react';
import { Ruler, Unlink, PackageOpen, ArrowUpRight } from 'lucide-react';
import type { EditorProject } from '../types';
import type { ProjectDesignSet } from './types';
import { SupplierMatchDialog } from '../production/SupplierMatchDialog';
import { safeSupplierUrl, unlinkSupplierMatch } from '../production/supplierMatch';

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
  const [matching, setMatching] = useState(false);
  const instance = design.instanceId ? project.instances[design.instanceId] : null;
  const properties = instance?.properties;
  const tied = Boolean(properties?.catalogSlug && properties?.catalogVariantId);
  const source = tied ? safeSupplierUrl(properties?.catalogSourceUrl) : null;
  const stock = properties?.catalogProductionType === 'stock';
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
          <>
            <p>
              <strong>{String(properties?.catalogProductTitle || properties?.catalogSlug)}</strong>
              <br />
              {String(properties?.catalogVariantTitle || '')}
            </p>
            {stock && (
              <p className="component-muted">
                Stock part: the supplier’s appearance applies. Your artwork will not be printed on this part.
              </p>
            )}
            {source && (
              <p>
                <a href={source} target="_blank" rel="noopener noreferrer">
                  View supplier product
                </a>
              </p>
            )}
            <button
              className="component-button"
              onClick={() => onChange(unlinkSupplierMatch(project, design.id))}
            >
              <Unlink size={14} />
              Unlink supplier
            </button>
          </>
        )}
      </article>
      <article className="component-detail-card">
        <PackageOpen size={23} />
        <h2>Choose physical materials</h2>
        <p className="component-muted">
          Browse printed cards, boards, tokens, and tiles, or choose ready-made coins and pieces. Review the
          product and variant before linking it to your game.
        </p>
        <button className="component-button" onClick={() => setMatching(true)}>
          {tied ? 'Change supplier match' : 'Match supplier product'}
        </button>
      </article>
      <article className="component-detail-card">
        <h2>Artwork and table placement</h2>
        <p className="component-muted">
          The Template editor designs printed faces. Table placement keeps your existing spaces, tracks, and
          component relationships together.
        </p>
        {design.instanceId ? (
          <button className="component-button" onClick={() => onOpenPlacement(design.instanceId!)}>
            Open table placement <ArrowUpRight size={14} />
          </button>
        ) : (
          <p className="component-muted">
            Save a change to this original deck to give it a place in Components.
          </p>
        )}
      </article>
      {matching && (
        <SupplierMatchDialog
          key={design.id}
          project={project}
          design={design}
          onChange={onChange}
          onClose={() => setMatching(false)}
        />
      )}
    </section>
  );
}
