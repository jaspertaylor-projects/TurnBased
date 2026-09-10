import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Download, Layers3, Loader2, Package, RefreshCw, Store, Unlink } from 'lucide-react';
import type { EditorProject } from '../types';
import type { ProductDetailResponse } from '../supplierCatalog';
import { fetchProductDetail } from '../supplierCatalog';
import { listProjectDesignSets } from '../componentStudio/model';
import { migrateCardTemplate, rowTemplateData } from '../templateStudio/model';
import { renderDesignSvg } from '../templateStudio/render';
import { buildProductionPlan, type ProductionRow } from './orderPlan';
import { SupplierMatchDialog } from './SupplierMatchDialog';
import { unlinkSupplierMatch } from './supplierMatch';
import { createSupplierPackage, downloadSupplierBlob } from './package';
import './production.css';

const dollars = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function PurchaseSummary({ row }: { row: ProductionRow }) {
  const purchase = row.purchase;
  if (purchase.totalUnits === null) return <span className="production-muted">Confirm pack quantity with supplier</span>;
  return <span><strong>{purchase.totalUnits} {purchase.unit}{purchase.totalUnits === 1 ? '' : 's'}</strong>
    {purchase.unitsPerPack !== null && purchase.unitsPerPack > 1 && <small>{purchase.unitsPerPack} pieces per {purchase.unit}</small>}
    {!!purchase.overagePhysical && <small>{purchase.overagePhysical} spare pieces from pack sizes</small>}</span>;
}

export function OrderPanel({ project, onChange }: { project: EditorProject; onChange: (project: EditorProject) => void }) {
  const [copiesText, setCopiesText] = useState('1');
  const copies = Number(copiesText);
  const validCopies = Number.isSafeInteger(copies) && copies >= 1 && copies <= 1000;
  const [details, setDetails] = useState<Record<string, ProductDetailResponse>>({});
  const [catalogErrors, setCatalogErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [matching, setMatching] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sets = useMemo(() => listProjectDesignSets(project), [project]);
  const slugs = JSON.stringify([...new Set(sets.flatMap((set) => {
    const slug = set.instanceId ? project.instances[set.instanceId]?.properties.catalogSlug : null;
    return typeof slug === 'string' && slug ? [slug] : [];
  }))].sort());
  useEffect(() => {
    let active = true;
    const requested = JSON.parse(slugs) as string[];
    setLoading(true); setCatalogErrors([]); setDetails({});
    void Promise.allSettled(requested.map(async (slug) => [slug, await fetchProductDetail(slug)] as const)).then((results) => {
      if (!active) return;
      const found: Record<string, ProductDetailResponse> = {}, failures: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') found[result.value[0]] = result.value[1];
        else failures.push(requested[index]);
      });
      setDetails(found); setCatalogErrors(failures); setLoading(false);
    });
    return () => { active = false; };
  }, [slugs, refresh]);
  const plan = useMemo(() => buildProductionPlan(project, validCopies ? copies : 1, details), [project, validCopies, copies, details]);
  const match = sets.find((set) => set.id === matching);
  const activeRows = plan.rows.filter((row) => row.status !== 'empty');
  const matchedCount = activeRows.filter((row) => row.productSlug && row.variantId).length;
  const blockers = [...plan.issues, ...activeRows.flatMap((row) => row.issues)].filter((issue) => issue.severity === 'blocking');
  const knownPrices = activeRows.filter((row) => row.estimate.amount !== null).length;
  const canExport = validCopies && activeRows.length > 0 && !loading && !busy && !blockers.length;

  async function exportPackage() {
    if (!canExport) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const snapshot = structuredClone(project);
      const result = await createSupplierPackage(snapshot, plan, setProgress);
      downloadSupplierBlob(snapshot.name, result.blob);
      setNotice(`Supplier package downloaded: ${result.artworkFaces} artwork faces, copy map, rulebook and editable backup. Open START-HERE.html for the next steps.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not prepare the supplier package.'); }
    finally { setBusy(false); setProgress(''); }
  }

  return <section className="production-workbench" aria-label="Prepare supplier order">
    {/* A stationary introduction keeps the destination and game-copy quantity visible. */}
    <header className="production-heading">
      <div data-layout="productionIntroduction"><span className="production-eyebrow">THE PIECES OF YOUR NEXT PROTOTYPE</span><h2>Build your box, piece by piece.</h2><p>Choose where each component is made. Gather the artwork, then confirm the order with your supplier.</p></div>
      <label className="production-copy-count">Game copies<input aria-label="Game copies to order" type="number" min={1} max={1000} step={1} value={copiesText} onChange={(event) => setCopiesText(event.target.value)} disabled={busy} /></label>
    </header>
    {/* The component list scrolls inside the workbench while the export footer stays pinned. */}
    <div data-layout="productionContents" className="production-body">
      <div data-layout="productionSteps" className="production-steps"><span><Store size={16} /><strong>1</strong> Match every piece</span><span><Layers3 size={16} /><strong>2</strong> Prepare the artwork</span><span><Package size={16} /><strong>3</strong> Confirm at supplier checkout</span></div>
      <div data-layout="productionInventorySummary" className="production-summary"><strong>{matchedCount} of {activeRows.length} components matched</strong><span>{plan.totalPhysical ?? 'Check'} pieces · {plan.providers.length} supplier{plan.providers.length === 1 ? '' : 's'}</span><button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading || busy} aria-label="Refresh supplier details"><RefreshCw size={14} />{loading ? 'Checking catalog…' : 'Refresh catalog'}</button></div>
      {!validCopies && <p className="production-error" role="alert">Choose a whole number from 1 to 1,000 game copies.</p>}
      {!!catalogErrors.length && <p className="production-error" role="alert">Some supplier details could not be loaded. Retry the catalog before exporting this order.</p>}
      {!sets.length && <div className="production-empty" data-layout="productionEmpty"><Package size={42} /><h3>Your box is waiting for its first piece.</h3><p>Create cards, coins or another component in Components, then match it here.</p></div>}
      <div data-layout="productionComponentList" className="production-list">
        {plan.rows.map((row) => {
          const set = sets.find((item) => item.id === row.designSetId)!;
          const template = set.studio.template.document ?? migrateCardTemplate(set.studio.template);
          const previewRow = set.studio.rows.find((item) => item.copies > 0) ?? set.studio.rows[0];
          return <article className="production-component" key={row.designSetId} aria-label={`Supplier for ${row.name}`}>
            <div data-layout="productionComponentPreview" className="production-preview" aria-hidden="true" dangerouslySetInnerHTML={{ __html: renderDesignSvg(template, { data: previewRow ? rowTemplateData(previewRow) : {}, idPrefix: `supplier-preview-${row.designSetId}` }) }} />
            <div data-layout="productionComponentDetails" className="production-component-details"><div data-layout="productionComponentTitle" className="production-component-title"><h3>{row.name}</h3><span className={`production-badge ${row.productSlug && row.variantId ? 'matched' : ''}`}>{row.status === 'empty' ? 'No copies' : row.productSlug && row.variantId ? <><Check size={11} />Supplier chosen</> : 'Choose a supplier'}</span></div><p>{row.copiesPerGame ?? 'Check quantity'} per game · {row.designCount} design{row.designCount === 1 ? '' : 's'} · {row.widthMm} × {row.heightMm} mm</p>
              {row.productSlug ? <><strong className="production-provider-name">{row.supplier}</strong><span>{row.productTitle}</span><small>{row.variantTitle}</small><small>{row.productionType === 'stock' ? 'Stock piece · supplied appearance; your template is a home-print alternative' : row.productionType === 'printable' ? 'Custom printed · upload your own artwork' : 'Custom printing needs supplier confirmation'}</small></> : <span className="production-muted">Match this design to a physical product and finish.</span>}
              {row.issues.length > 0 && <details className="production-issues"><summary>{row.issues.some((issue) => issue.severity === 'blocking') ? 'Resolve before export' : 'Review with your supplier'} · {row.issues.length} {row.issues.length === 1 ? 'note' : 'notes'}</summary><ul>{row.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></details>}
            </div>
            <div data-layout="productionComponentPurchase" className="production-purchase"><PurchaseSummary row={row} /><strong className="production-price">{row.estimate.amount === null ? 'Price at supplier' : dollars(row.estimate.amount)}</strong><small>{row.estimate.amount === null ? 'Final price confirmed before payment' : 'Cached materials estimate'}</small>{row.catalogDate && <small>Catalog: {new Date(row.catalogDate).toLocaleDateString()}</small>}</div>
            <div data-layout="productionComponentActions" className="production-component-actions"><button type="button" className="production-button" disabled={busy} onClick={() => setMatching(row.designSetId)}>{row.productSlug ? 'Change supplier' : 'Choose supplier'}</button>{row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Open product <ArrowUpRight size={13} /></a>}{row.instanceId && row.productSlug && <button type="button" className="production-unlink" disabled={busy} onClick={() => onChange(unlinkSupplierMatch(project, row.instanceId!))}><Unlink size={12} />Unlink</button>}</div>
          </article>;
        })}
      </div>
      {plan.issues.filter((issue) => issue.severity === 'blocking').map((issue, index) => <p key={index} className="production-error" role="alert">{issue.message}</p>)}
      <aside className="production-handoff" aria-label="What happens at the supplier"><Package size={25} /><div data-layout="productionHandoffExplanation"><h3>From artwork to something you can hold.</h3><p>Your package includes 300 dpi fronts and backs, copy counts, a rulebook and an editable backup. At the supplier, upload the artwork, review the proof, and confirm payment and delivery.</p><p>Printed rulebooks, packaging and extra supplies need their own arrangements unless listed above. Shipping, tax and provider fees are confirmed at checkout{plan.providers.length > 1 ? '; different suppliers may ship separately' : ''}.</p></div></aside>
    </div>
    {/* A pinned footer keeps export progress and unresolved-order status in view. */}
    <footer className="production-footer"><div data-layout="productionOrderTotal"><strong>{knownPrices ? `${dollars(plan.estimate.knownSubtotal)} ${plan.estimate.complete ? 'estimated materials' : 'known materials'}` : 'Supplier confirms the total'}</strong><span>{knownPrices && !plan.estimate.complete ? `${activeRows.length - knownPrices} component price${activeRows.length - knownPrices === 1 ? '' : 's'} still to confirm · ` : ''}Shipping, tax and provider fees excluded</span></div><div data-layout="productionExportFeedback" className="production-feedback" role={error ? 'alert' : 'status'}>{error || progress || notice || (blockers.length ? 'Match all components and resolve the notes to prepare the order.' : 'Ready to package your designs. No order has been placed.')}</div><button type="button" className="production-button primary" onClick={() => void exportPackage()} disabled={!canExport}>{busy ? <Loader2 size={16} className="production-spinner" /> : <Download size={16} />}{busy ? 'Preparing files…' : 'Download supplier package'}</button></footer>
    {match && <SupplierMatchDialog project={project} design={match} onChange={onChange} onClose={() => setMatching(null)} />}
  </section>;
}
