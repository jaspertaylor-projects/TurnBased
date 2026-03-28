import { Children, cloneElement, isValidElement } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
type LucideIconName = keyof typeof LucideIcons;

function formatEditorIconLabel(key: string): string {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const EDITOR_ICON_LIBRARY: ReadonlyArray<{
  key: string;
  iconName: LucideIconName;
  label?: string;
}> = [
  { key: 'blocks', iconName: 'Blocks' },
  { key: 'castle', iconName: 'Castle' },
  { key: 'compass', iconName: 'Compass' },
  { key: 'crown', iconName: 'Crown' },
  { key: 'flame', iconName: 'Flame' },
  { key: 'gem', iconName: 'Gem' },
  { key: 'leaf', iconName: 'Leaf' },
  { key: 'shield', iconName: 'Shield' },
  { key: 'sparkles', iconName: 'Sparkles' },
  { key: 'swords', iconName: 'Swords' },
  { key: 'user', iconName: 'UserRound', label: 'Hero' },
  { key: 'book_open', iconName: 'BookOpen' },
  { key: 'scroll', iconName: 'Scroll' },
  { key: 'scroll_text', iconName: 'ScrollText' },
  { key: 'map', iconName: 'Map' },
  { key: 'map_pinned', iconName: 'MapPinned' },
  { key: 'map_pin', iconName: 'MapPin' },
  { key: 'pin', iconName: 'Pin' },
  { key: 'mountain', iconName: 'Mountain' },
  { key: 'trees', iconName: 'Trees' },
  { key: 'tent', iconName: 'Tent' },
  { key: 'landmark', iconName: 'Landmark' },
  { key: 'tower_control', iconName: 'TowerControl' },
  { key: 'church', iconName: 'Church' },
  { key: 'building_2', iconName: 'Building2', label: 'Building' },
  { key: 'warehouse', iconName: 'Warehouse' },
  { key: 'factory', iconName: 'Factory' },
  { key: 'construction', iconName: 'Construction' },
  { key: 'skull', iconName: 'Skull' },
  { key: 'ghost', iconName: 'Ghost' },
  { key: 'bug', iconName: 'Bug' },
  { key: 'rat', iconName: 'Rat' },
  { key: 'rabbit', iconName: 'Rabbit' },
  { key: 'fish', iconName: 'Fish' },
  { key: 'bird', iconName: 'Bird' },
  { key: 'bone', iconName: 'Bone' },
  { key: 'coins', iconName: 'Coins' },
  { key: 'backpack', iconName: 'Backpack' },
  { key: 'package', iconName: 'Package' },
  { key: 'key', iconName: 'Key' },
  { key: 'lock', iconName: 'Lock' },
  { key: 'door_open', iconName: 'DoorOpen' },
  { key: 'flag', iconName: 'Flag' },
  { key: 'target', iconName: 'Target' },
  { key: 'crosshair', iconName: 'Crosshair' },
  { key: 'trophy', iconName: 'Trophy' },
  { key: 'medal', iconName: 'Medal' },
  { key: 'star', iconName: 'Star' },
  { key: 'shield_plus', iconName: 'ShieldPlus' },
  { key: 'shield_alert', iconName: 'ShieldAlert' },
  { key: 'heart', iconName: 'Heart' },
  { key: 'heart_pulse', iconName: 'HeartPulse' },
  { key: 'eye', iconName: 'Eye' },
  { key: 'eye_off', iconName: 'EyeOff' },
  { key: 'hand', iconName: 'Hand' },
  { key: 'hand_helping', iconName: 'HandHelping' },
  { key: 'hand_coins', iconName: 'HandCoins' },
  { key: 'users', iconName: 'Users' },
  { key: 'bot', iconName: 'Bot' },
  { key: 'person_standing', iconName: 'PersonStanding' },
  { key: 'dice_1', iconName: 'Dice1' },
  { key: 'dice_2', iconName: 'Dice2' },
  { key: 'dice_3', iconName: 'Dice3' },
  { key: 'dice_4', iconName: 'Dice4' },
  { key: 'dice_5', iconName: 'Dice5' },
  { key: 'dice_6', iconName: 'Dice6' },
  { key: 'dices', iconName: 'Dices' },
  { key: 'circle_dashed', iconName: 'CircleDashed' },
  { key: 'circle_dot', iconName: 'CircleDot' },
  { key: 'hexagon', iconName: 'Hexagon' },
  { key: 'puzzle', iconName: 'Puzzle' },
  { key: 'orbit', iconName: 'Orbit' },
  { key: 'route', iconName: 'Route' },
  { key: 'waypoints', iconName: 'Waypoints' },
  { key: 'move_right', iconName: 'MoveRight' },
  { key: 'move_up_right', iconName: 'MoveUpRight' },
  { key: 'footprints', iconName: 'Footprints' },
  { key: 'timer', iconName: 'Timer' },
  { key: 'clock_3', iconName: 'Clock3' },
  { key: 'hourglass', iconName: 'Hourglass' },
  { key: 'zap', iconName: 'Zap' },
  { key: 'sun', iconName: 'Sun' },
  { key: 'moon', iconName: 'Moon' },
  { key: 'cloud', iconName: 'Cloud' },
  { key: 'cloud_lightning', iconName: 'CloudLightning' },
  { key: 'snowflake', iconName: 'Snowflake' },
  { key: 'droplets', iconName: 'Droplets' },
  { key: 'waves', iconName: 'Waves' },
  { key: 'ship_wheel', iconName: 'ShipWheel' },
  { key: 'anchor', iconName: 'Anchor' },
  { key: 'sailboat', iconName: 'Sailboat' },
  { key: 'ship', iconName: 'Ship' },
  { key: 'train_track', iconName: 'TrainTrack' },
  { key: 'rocket', iconName: 'Rocket' },
  { key: 'pickaxe', iconName: 'Pickaxe' },
  { key: 'hammer', iconName: 'Hammer' },
  { key: 'anvil', iconName: 'Anvil' },
  { key: 'sword', iconName: 'Sword' },
  { key: 'cross', iconName: 'Cross' },
  { key: 'milestone', iconName: 'Milestone' },
  { key: 'wheat', iconName: 'Wheat' },
  { key: 'flower_2', iconName: 'Flower2', label: 'Flower' },
  { key: 'sprout', iconName: 'Sprout' },
  { key: 'badge_alert', iconName: 'BadgeAlert' },
  { key: 'badge_check', iconName: 'BadgeCheck' },
  { key: 'badge_help', iconName: 'BadgeHelp' },
  { key: 'bell', iconName: 'Bell' },
  { key: 'bell_ring', iconName: 'BellRing' },
  { key: 'binary', iconName: 'Binary' },
  { key: 'bomb', iconName: 'Bomb' },
  { key: 'brain', iconName: 'Brain' },
  { key: 'briefcase', iconName: 'Briefcase' },
  { key: 'bug_off', iconName: 'BugOff' },
  { key: 'cake_slice', iconName: 'CakeSlice' },
  { key: 'car', iconName: 'Car' },
  { key: 'caravan', iconName: 'Caravan' },
  { key: 'chart_column', iconName: 'ChartColumn' },
  { key: 'circle_gauge', iconName: 'CircleGauge' },
  { key: 'clapperboard', iconName: 'Clapperboard' },
  { key: 'clipboard_list', iconName: 'ClipboardList' },
  { key: 'cloud_moon', iconName: 'CloudMoon' },
  { key: 'cpu', iconName: 'Cpu' },
  { key: 'diamond', iconName: 'Diamond' },
  { key: 'disc', iconName: 'Disc' },
  { key: 'drama', iconName: 'Drama' },
  { key: 'drum', iconName: 'Drum' },
  { key: 'ferris_wheel', iconName: 'FerrisWheel' },
  { key: 'fingerprint', iconName: 'Fingerprint' },
  { key: 'focus', iconName: 'Focus' },
  { key: 'gamepad_2', iconName: 'Gamepad2', label: 'Gamepad' },
  { key: 'gavel', iconName: 'Gavel' },
  { key: 'glasses', iconName: 'Glasses' },
  { key: 'globe', iconName: 'Globe' },
  { key: 'graduation_cap', iconName: 'GraduationCap' },
  { key: 'handshake', iconName: 'Handshake' },
  { key: 'hard_hat', iconName: 'HardHat' },
  { key: 'headset', iconName: 'Headset' },
  { key: 'joystick', iconName: 'Joystick' },
  { key: 'lamp_desk', iconName: 'LampDesk' },
  { key: 'lightbulb', iconName: 'Lightbulb' },
  { key: 'locate_fixed', iconName: 'LocateFixed' },
  { key: 'luggage', iconName: 'Luggage' },
  { key: 'magnet', iconName: 'Magnet' },
  { key: 'microscope', iconName: 'Microscope' },
  { key: 'mouse_pointer_2', iconName: 'MousePointer2', label: 'Pointer' },
  { key: 'music_2', iconName: 'Music2', label: 'Music' },
  { key: 'paw_print', iconName: 'PawPrint' },
  { key: 'piggy_bank', iconName: 'PiggyBank' },
  { key: 'pizza', iconName: 'Pizza' },
  { key: 'plane', iconName: 'Plane' },
];

export const EDITOR_ICON_OPTIONS = EDITOR_ICON_LIBRARY.map((entry) => ({
  key: entry.key,
  label: entry.label ?? formatEditorIconLabel(entry.key),
}));

const ICONS: Record<string, LucideIcon> = Object.fromEntries(
  EDITOR_ICON_LIBRARY.map((entry) => [entry.key, LucideIcons[entry.iconName] as LucideIcon]),
) as Record<string, LucideIcon>;

const FILLABLE_SVG_TAGS = new Set([
  'path',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'rect',
]);

function applyFillToFillableSvgChildren(node: ReactNode, fillColor: string): ReactNode {
  if (!isValidElement(node)) {
    return node;
  }

  const element = node as {
    type: unknown;
    props: {
      children?: ReactNode;
    };
  };
  const nextProps: Record<string, unknown> = {};

  if (typeof element.type === 'string' && FILLABLE_SVG_TAGS.has(element.type)) {
    nextProps.fill = fillColor;
  }

  if (element.props.children !== undefined) {
    nextProps.children = Children.map(element.props.children, (child) => applyFillToFillableSvgChildren(child, fillColor));
  }

  return cloneElement(node, nextProps);
}

export function getIconComponent(iconKey: string | null | undefined): LucideIcon {
  return ICONS[iconKey ?? ''] ?? (LucideIcons.UserRound as LucideIcon);
}

export function renderIcon(
  iconKey: string | null | undefined,
  props: {
    size?: number;
    strokeWidth?: number;
    fillColor?: string;
    style?: CSSProperties;
  } = {},
) {
  const Icon = getIconComponent(iconKey);
  const iconElement = <Icon size={props.size ?? 18} strokeWidth={props.strokeWidth ?? 2} fill={props.fillColor} style={props.style} />;

  if (!props.fillColor || props.fillColor === 'rgba(0,0,0,0)') {
    return iconElement;
  }

  return applyFillToFillableSvgChildren(iconElement, props.fillColor);
}
