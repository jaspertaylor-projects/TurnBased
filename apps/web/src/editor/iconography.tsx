import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Blocks,
  Castle,
  Compass,
  Crown,
  Flame,
  Gem,
  Leaf,
  Shield,
  Sparkles,
  Swords,
  UserRound,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  blocks: Blocks,
  castle: Castle,
  compass: Compass,
  crown: Crown,
  flame: Flame,
  gem: Gem,
  leaf: Leaf,
  shield: Shield,
  sparkles: Sparkles,
  swords: Swords,
  user: UserRound,
};

export function getIconComponent(iconKey: string | null | undefined): LucideIcon {
  return ICONS[iconKey ?? ''] ?? UserRound;
}

export function renderIcon(
  iconKey: string | null | undefined,
  props: {
    size?: number;
    strokeWidth?: number;
    style?: CSSProperties;
  } = {},
) {
  const Icon = getIconComponent(iconKey);
  return <Icon size={props.size ?? 18} strokeWidth={props.strokeWidth ?? 2} style={props.style} />;
}
