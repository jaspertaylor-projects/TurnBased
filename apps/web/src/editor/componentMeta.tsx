import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Blocks,
  Box,
  Circle,
  CircleDot,
  CreditCard,
  GitBranch,
  Grid2x2,
  Hand,
  Hash,
  Hexagon,
  Image,
  LayoutPanelTop,
  Package,
  Rows3,
  Square,
  Type,
  Trophy,
} from 'lucide-react';

export const CATEGORY_LABELS: Record<string, string> = {
  container: 'Boards & Zones',
  entity: 'Pieces & Tokens',
  collection: 'Collections',
  counter: 'Counters',
};

const COMPONENT_ICONS: Record<string, LucideIcon> = {
  container: LayoutPanelTop,
  board: LayoutPanelTop,
  tile: Square,
  card: CreditCard,
  grid: Grid2x2,
  space: Box,
  zone: Rows3,
  track: Rows3,
  'text-box': Type,
  'image-area': Image,
  network: GitBranch,
  'hex-grid': Hexagon,
  'square-grid': Grid2x2,
  'checkerboard-grid': Grid2x2,
  entity: Blocks,
  piece: Circle,
  token: CircleDot,
  collection: Package,
  deck: Package,
  discard: Package,
  bag: Package,
  hand: Hand,
  counter: Hash,
  score: Trophy,
  'score-track': Trophy,
};

export function getComponentIcon(key: string | null | undefined): LucideIcon {
  return COMPONENT_ICONS[key ?? ''] ?? Blocks;
}

export function renderComponentIcon(
  key: string | null | undefined,
  props: {
    size?: number;
    strokeWidth?: number;
    style?: CSSProperties;
  } = {},
) {
  const Icon = getComponentIcon(key);
  return <Icon size={props.size ?? 18} strokeWidth={props.strokeWidth ?? 2} style={props.style} />;
}
