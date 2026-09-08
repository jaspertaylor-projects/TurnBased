import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { escapeTemplateMarkup } from '../templateStudio/safety';
import type { LabCard, LabGameState, LabVisualMaterial } from './types';
import { createLabTableLayout, fitLabTable, placeLabCards } from './tableLayout';
import { labCardSize, renderLabCard } from './visuals';

function useArtworkUrls(visuals?: LabVisualMaterial) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const allocated: string[] = [];
    const sources = Object.values(visuals?.assets ?? {}).filter((source) => /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(source));
    void Promise.all(sources.map(async (source) => {
      try {
        // Decode local data URLs once; SVG copies share the resulting object URL.
        const blob = await (await fetch(source)).blob();
        if (!active) return null;
        const url = URL.createObjectURL(blob);
        allocated.push(url);
        return [source, url] as const;
      } catch { return null; }
    })).then((entries) => { if (active) setUrls(Object.fromEntries(entries.filter((entry) => entry !== null))); });
    return () => { active = false; allocated.forEach((url) => URL.revokeObjectURL(url)); };
  }, [visuals]);
  return urls;
}

export function LabBoard({ cards, visuals, state, marketSlots, canPlay, legalIds, onBuy, onInspect, onCollection }: {
  cards: LabCard[]; visuals?: LabVisualMaterial; state: LabGameState; marketSlots: number;
  canPlay: boolean; legalIds: Set<string>; onBuy: (id: string) => void;
  onInspect: (id: string) => void; onCollection: (seat: 0 | 1) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  const prefix = `lab-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const artworkUrls = useArtworkUrls(visuals);
  const layout = useMemo(() => createLabTableLayout(cards, visuals, marketSlots), [cards, visuals, marketSlots]);
  const fit = fitLabTable(layout, Math.max(0, bounds.width - 20), Math.max(0, bounds.height - 20));
  const placements = placeLabCards(layout, state, cards, visuals);
  const visibleIds = placements.map((placed) => placed.cardId).join('\n');
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const symbols = cards.flatMap((card, index) => {
    if (!visibleIds.split('\n').includes(card.id)) return [];
    const size = labCardSize(card, visuals);
    return (['front', 'back'] as const).map((face) => {
      const id = `${prefix}-${index}-${face}`;
      let svg = renderLabCard(card, visuals, face, id);
      for (const source of Object.values(visuals?.assets ?? {})) {
        if (source.startsWith('data:image/')) svg = svg.replaceAll(`href="${escapeTemplateMarkup(source)}"`, `href="${artworkUrls[source] ?? ''}"`);
      }
      const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
      return `<symbol id="${id}" viewBox="0 0 ${size.width} ${size.height}">${inner}</symbol>`;
    }).join('');
  }).join('');

  return <div ref={viewport} className="lab-board-viewport" data-layout="playtestBoardViewport">
    <svg width="0" height="0" aria-hidden="true" className="lab-board-symbols"><defs dangerouslySetInnerHTML={{ __html: symbols }} /></svg>
    <div className="lab-board-fit" data-layout="playtestBoardFit" style={{ width: fit.width, height: fit.height }}>
      <div className="lab-wood-board" data-layout="playtestPhysicalBoard" data-mm-width={layout.width} data-mm-height={layout.height} data-scale={fit.scale} style={{ width: layout.width, height: layout.height, transform: `scale(${fit.scale})` }}>
        <div data-layout="playtestOpponentZone" className="lab-board-zone" style={{ top: 5, height: layout.cardHeight + 29 }} />
        <div data-layout="playtestMarketZone" className="lab-board-zone market" style={{ top: layout.marketY - 22, height: layout.cardHeight + 30 }} />
        <div data-layout="playtestChallengerZone" className="lab-board-zone" style={{ top: layout.challengerY - 22, height: layout.cardHeight + 30 }} />
        <button className="lab-board-label" style={{ top: 11 }} onClick={() => onCollection(1)} disabled={!state.players[1].acquired.length} aria-label="Review opponent collection">OPPONENT · {state.players[1].acquired.length} ACQUIRED{state.players[1].acquired.length > 12 ? ' · LATEST 12 SHOWN' : ''}</button>
        <span className="lab-board-label" style={{ top: layout.marketY - 15 }}>SHARED MARKET</span>
        <span className="lab-board-label pile" style={{ top: layout.marketY - 15 }}>DRAW PILE · {state.drawPile.length}</span>
        <button className="lab-board-label" style={{ top: layout.challengerY - 15 }} onClick={() => onCollection(0)} disabled={!state.players[0].acquired.length} aria-label="Review challenger collection">YOUR CARDS · {state.players[0].acquired.length} ACQUIRED{state.players[0].acquired.length > 12 ? ' · LATEST 12 SHOWN' : ''}</button>
        {!state.players[1].acquired.length && <span className="lab-board-empty" style={{ top: 26 + layout.cardHeight / 2 }}>The opponent's purchases will collect here</span>}
        {!state.players[0].acquired.length && <span className="lab-board-empty" style={{ top: layout.challengerY + layout.cardHeight / 2 }}>Your next discovery belongs here</span>}
        {placements.map((placed) => {
          const card = cards.find((item) => item.id === placed.cardId)!;
          const index = cards.indexOf(card);
          const isMarket = placed.zone === 'market';
          const isDraw = placed.zone === 'draw';
          const affordable = canPlay && legalIds.has(`buy:${card.id}`);
          return <div key={`${placed.zone}-${placed.index}`} className={`lab-board-card ${placed.zone}`} data-layout="playtestPlacedCard" data-card-id={isDraw ? undefined : card.id} data-zone={placed.zone} data-mm-width={placed.width} data-mm-height={placed.height} style={{ left: placed.x, top: placed.y, width: placed.width, height: placed.height }}>
            {isDraw ? <div className="lab-physical-card draw" data-layout="playtestDrawBack" aria-label={`${state.drawPile.length} cards in draw pile; representative card back`}><svg viewBox={`0 0 ${placed.width} ${placed.height}`} aria-hidden="true"><use href={`#${prefix}-${index}-back`} /></svg></div> : <button type="button" className={`lab-physical-card${isMarket && affordable ? ' affordable' : ''}`} disabled={isMarket && !affordable} onClick={() => isMarket ? onBuy(`buy:${card.id}`) : onInspect(card.id)} aria-label={isMarket ? `Buy ${card.name} for ${card.cost} coins, gain ${card.points} points` : `Inspect acquired ${card.name}`}><svg viewBox={`0 0 ${placed.width} ${placed.height}`} aria-hidden="true"><use href={`#${prefix}-${index}-front`} /></svg></button>}
            {isMarket && <button className="lab-card-inspect" type="button" onClick={() => onInspect(card.id)} aria-label={`Inspect ${card.name}`}>Inspect · {card.cost} coins / {card.points} pts</button>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}
