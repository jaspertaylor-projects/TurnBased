import type { CardStudioState } from '../cardStudio/types';
import type { TemplateComponentKind } from '../templateStudio/types';

export interface ProjectDesignSet {
  id: string;
  instanceId: string | null;
  name: string;
  kind: TemplateComponentKind;
  studio: CardStudioState;
}

export const COMPONENT_FAMILIES: Array<{
  kind: TemplateComponentKind;
  label: string;
  singular: string;
  description: string;
}> = [
  {
    kind: 'card',
    label: 'Cards',
    singular: 'Deck of cards',
    description: 'A table of ideas, one shared design, a whole deck.',
  },
  {
    kind: 'board',
    label: 'Boards',
    singular: 'Game board',
    description: 'Build a place for your game to unfold.',
  },
  {
    kind: 'token',
    label: 'Tokens',
    singular: 'Token set',
    description: 'Little markers with a big job to do.',
  },
  {
    kind: 'tile',
    label: 'Tiles',
    singular: 'Tile set',
    description: 'Mix, match, and make a world piece by piece.',
  },
  {
    kind: 'mat',
    label: 'Mats',
    singular: 'Player mat',
    description: 'Give every player a place at the table.',
  },
  {
    kind: 'piece',
    label: 'Pieces',
    singular: 'Game pieces',
    description: 'Pawns, standees, and characters to move your game.',
  },
];
