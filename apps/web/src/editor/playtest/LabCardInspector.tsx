import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { LabCard, LabVisualMaterial } from './types';
import { labCardSize, renderLabCard, resolveLabVisual } from './visuals';

export function LabCardInspector({ cards, initialId, visuals, onClose }: {
  cards: LabCard[]; initialId: string; visuals?: LabVisualMaterial; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [face, setFace] = useState<'front' | 'back'>('front');
  const prefix = useId();
  const card = cards.find((item) => item.id === selectedId) ?? cards[0];
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  if (!card) return null;
  const size = labCardSize(card, visuals);
  const authored = resolveLabVisual(card, visuals).authored;
  return <dialog ref={dialog} className="lab-inspector" aria-label="Inspect playtest card" onCancel={onClose} onClose={(event) => { if (!event.currentTarget.open) onClose(); }}>
    <div data-layout="playtestCardInspectorHeader" className="lab-inspector-header">
      <div data-layout="playtestCardInspectorIdentity"><h3>{card.name}</h3><span>{size.width} × {size.height} mm · {authored ? 'Design saved with this session' : 'Reference card'}</span></div>
      <button type="button" className="lab-button" aria-label="Close card inspector" onClick={onClose}><X size={17} /></button>
    </div>
    <div data-layout="playtestCardInspectorTools" className="lab-inspector-tools">
      <label className="lab-field">Card to inspect<select value={card.id} onChange={(event) => setSelectedId(event.target.value)}>{cards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button className="lab-button" type="button" onClick={() => setFace(face === 'front' ? 'back' : 'front')}>{face === 'front' ? 'Show card back' : 'Show card front'}</button>
    </div>
    <div data-layout="playtestCardInspectorFace" className="lab-inspector-face" style={{ aspectRatio: `${size.width} / ${size.height}` }} dangerouslySetInnerHTML={{ __html: renderLabCard(card, visuals, face, `inspect-${prefix}`) }} />
    <p>{card.cost} coins · {card.points} points. The experiment uses these numeric values; descriptive abilities remain reference material.</p>
  </dialog>;
}
