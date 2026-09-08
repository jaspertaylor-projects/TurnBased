import type { LabCard, LabGameState, LabVisualMaterial } from './types';
import { labCardSize } from './visuals';

export interface LabTableLayout {
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
  marketY: number;
  challengerY: number;
  opponentY: number;
}
export interface LabCardPlacement {
  cardId: string;
  zone: 'market' | 'challenger' | 'opponent' | 'draw';
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function createLabTableLayout(cards: LabCard[], visuals: LabVisualMaterial | undefined, slots: number): LabTableLayout {
  const sizes = cards.map((card) => labCardSize(card, visuals));
  const cardWidth = Math.max(1, ...sizes.map((size) => size.width));
  const cardHeight = Math.max(1, ...sizes.map((size) => size.height));
  return { width: (Math.max(1, slots) + 1) * cardWidth + Math.max(1, slots) * 8 + 36,
    height: cardHeight * 3 + 100, cardWidth, cardHeight,
    opponentY: 26, marketY: cardHeight + 56, challengerY: cardHeight * 2 + 86 };
}

/** A single mm→screen scale fits the whole table, preserving every relative size. */
export function fitLabTable(layout: Pick<LabTableLayout, 'width' | 'height'>, width: number, height: number) {
  const scale = Math.max(0, Math.min(Math.max(0, width) / layout.width, Math.max(0, height) / layout.height));
  return { scale, width: layout.width * scale, height: layout.height * scale };
}

export function placeLabCards(layout: LabTableLayout, state: LabGameState, cards: LabCard[], visuals?: LabVisualMaterial): LabCardPlacement[] {
  const placements: LabCardPlacement[] = [];
  const add = (id: string, zone: LabCardPlacement['zone'], index: number, x: number, y: number) => {
    const card = cards.find((candidate) => candidate.id === id);
    if (!card) return;
    const size = labCardSize(card, visuals);
    placements.push({ cardId: id, zone, index, x: x + (layout.cardWidth - size.width) / 2, y: y + (layout.cardHeight - size.height) / 2, ...size });
  };
  state.market.forEach((id, index) => add(id, 'market', index, 18 + index * (layout.cardWidth + 8), layout.marketY));
  // A representative back never exposes the identity of the next hidden card.
  if (state.drawPile.length && cards[0]) add(cards[0].id, 'draw', 0, layout.width - layout.cardWidth - 18, layout.marketY);
  state.players.forEach((player, seat) => {
    const visible = player.acquired.slice(-12);
    const step = Math.min(layout.cardWidth + 6, (layout.width - 36 - layout.cardWidth) / Math.max(1, visible.length - 1));
    visible.forEach((id, index) => add(id, seat === 0 ? 'challenger' : 'opponent', player.acquired.length - visible.length + index, 18 + index * step, seat === 0 ? layout.challengerY : layout.opponentY));
  });
  return placements;
}
