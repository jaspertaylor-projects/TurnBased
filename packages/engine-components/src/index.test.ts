import { describe, expect, it } from 'vitest';
import {
  createComponentInstanceId,
  createPlayerId,
} from '@turnbased/shared-types';

import {
  builtInCatalog,
  createComponentInstance,
  getBuiltInComponentManifest,
  listAuthorableBuiltInComponents,
  listBuiltInComponents,
  validateComponentOccupancy,
  validateComponentPlacement,
  validateComponentTree,
} from './index';

describe('engine-components catalog', () => {
  it('exposes the full built-in catalog grouped across categories', () => {
    const allComponents = listBuiltInComponents();
    const collectionComponents = listBuiltInComponents('collection');
    const authorableComponents = listAuthorableBuiltInComponents();

    expect(allComponents.map((component) => component.type)).toContain('text-box');
    expect(allComponents.map((component) => component.type)).toContain('card');
    expect(collectionComponents.map((component) => component.type)).toEqual([
      'deck',
      'hand',
      'discard',
      'bag',
    ]);
    expect(authorableComponents.map((component) => component.type)).toEqual([
      'board',
      'card',
      'space',
      'hex-grid',
      'square-grid',
      'track',
      'text-box',
      'deck',
      'piece',
      'token',
      'image-area',
      'network',
    ]);
  });

  it('creates typed instances from defaults and validates placement rules', () => {
    const board = createComponentInstance(getBuiltInComponentManifest('board'), {
      instanceId: createComponentInstanceId('board_root'),
      properties: {
        width: 3,
        height: 3,
      },
    });
    const space = createComponentInstance(getBuiltInComponentManifest('space'), {
      instanceId: createComponentInstanceId('space_a1'),
      parentId: board.instanceId,
      placement: {
        slotId: 'surface',
        index: 0,
        coordinates: { x: 0, y: 0 },
      },
    });
    // Pieces are root-level templates, not children of spaces.
    const piece = createComponentInstance(getBuiltInComponentManifest('piece'), {
      instanceId: createComponentInstanceId('piece_red'),
      bindings: {
        ownerId: createPlayerId('player_red'),
      },
    });

    expect(board.properties.label).toBe('Board');
    expect(board.notes).toBe('');
    expect(space.properties.label).toBe('Space');
    expect(piece.properties.size).toBe('medium');
    expect(getBuiltInComponentManifest('text-box').propertiesSchema.parse({}).fontSize).toBe(22);

    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('space'),
        getBuiltInComponentManifest('board'),
      ).valid,
    ).toBe(true);
    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('card'),
        null,
    ).valid,
    ).toBe(false);
    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('text-box'),
        getBuiltInComponentManifest('board'),
      ).valid,
    ).toBe(true);
    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('card'),
        getBuiltInComponentManifest('deck'),
      ).valid,
    ).toBe(true);
    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('card'),
        getBuiltInComponentManifest('board'),
      ).valid,
    ).toBe(false);
    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('image-area'),
        getBuiltInComponentManifest('card'),
      ).valid,
    ).toBe(true);
  });

  it('accepts reusable cell appearance properties on grid components', () => {
    const grid = createComponentInstance(getBuiltInComponentManifest('square-grid'), {
      instanceId: createComponentInstanceId('grid_square'),
      properties: {
        cellBackground: 'rgba(240,253,244,0.92)',
        cellTextureId: 'wood',
        cellTextureOpacity: 0.45,
        cellBorderColor: 'rgba(15,118,110,0.28)',
        cellBorderWidth: 3,
        cellBorderRadius: 12,
      },
    });

    expect(grid.properties.cellBackground).toBe('rgba(240,253,244,0.92)');
    expect(grid.properties.cellTextureId).toBe('wood');
    expect(grid.properties.cellTextureOpacity).toBe(0.45);
    expect(grid.properties.cellBorderColor).toBe('rgba(15,118,110,0.28)');
    expect(grid.properties.cellBorderWidth).toBe(3);
    expect(grid.properties.cellBorderRadius).toBe(12);
  });

  it('allows leaf decorations in spaces while still enforcing score-track limits', () => {
    const ownerA = createPlayerId('player_a');
    const ownerB = createPlayerId('player_b');
    const spaceRules = validateComponentOccupancy(getBuiltInComponentManifest('space'), {
      occupantTypes: ['text-box', 'image-area'],
      occupantRoles: ['leaf', 'leaf'],
      occupantOwnerIds: [ownerA, ownerB],
    });
    const scoreTrackRules = validateComponentOccupancy(getBuiltInComponentManifest('score-track'), {
      occupantTypes: ['token', 'token'],
      occupantRoles: ['leaf', 'leaf'],
      occupantOwnerIds: [ownerA, ownerA],
    });

    expect(spaceRules.valid).toBe(true);
    expect(scoreTrackRules.valid).toBe(false);
    expect(scoreTrackRules.issues.map((issue) => issue.code)).toContain(
      'occupancy_per_player_limit_exceeded',
    );
  });

  it('validates a composed board and card-game player area without custom templates', () => {
    const playerOneId = createPlayerId('player_1');
    const playerTwoId = createPlayerId('player_2');

    const board = createComponentInstance(getBuiltInComponentManifest('board'), {
      instanceId: createComponentInstanceId('board_root'),
      children: [
        createComponentInstanceId('space_1'),
        createComponentInstanceId('space_2'),
        createComponentInstanceId('score_track'),
      ],
      properties: {
        width: 2,
        height: 1,
      },
    });
    const spaceOne = createComponentInstance(getBuiltInComponentManifest('space'), {
      instanceId: createComponentInstanceId('space_1'),
      parentId: board.instanceId,
      placement: {
        slotId: 'surface',
        index: 0,
        coordinates: { x: 0, y: 0 },
      },
    });
    const spaceTwo = createComponentInstance(getBuiltInComponentManifest('space'), {
      instanceId: createComponentInstanceId('space_2'),
      parentId: board.instanceId,
      placement: {
        slotId: 'surface',
        index: 1,
        coordinates: { x: 1, y: 0 },
      },
    });
    // Pieces and tokens are root-level templates, not children of spaces or
    // score-tracks. The engine setup function places them into starting zones.
    const pieceOne = createComponentInstance(getBuiltInComponentManifest('piece'), {
      instanceId: createComponentInstanceId('piece_1'),
      bindings: {
        ownerId: playerOneId,
      },
    });
    const pieceTwo = createComponentInstance(getBuiltInComponentManifest('piece'), {
      instanceId: createComponentInstanceId('piece_2'),
      bindings: {
        ownerId: playerTwoId,
      },
    });
    const scoreTrack = createComponentInstance(getBuiltInComponentManifest('score-track'), {
      instanceId: createComponentInstanceId('score_track'),
      parentId: board.instanceId,
      placement: {
        slotId: 'surface',
        index: 2,
      },
    });
    const scoreMarkerOne = createComponentInstance(getBuiltInComponentManifest('token'), {
      instanceId: createComponentInstanceId('score_marker_1'),
      bindings: {
        ownerId: playerOneId,
      },
    });
    const scoreMarkerTwo = createComponentInstance(getBuiltInComponentManifest('token'), {
      instanceId: createComponentInstanceId('score_marker_2'),
      bindings: {
        ownerId: playerTwoId,
      },
    });
    const playerArea = createComponentInstance(getBuiltInComponentManifest('zone'), {
      instanceId: createComponentInstanceId('player_area'),
      children: [
        createComponentInstanceId('hand_1'),
        createComponentInstanceId('deck_1'),
        createComponentInstanceId('discard_1'),
        createComponentInstanceId('bag_1'),
        createComponentInstanceId('counter_1'),
      ],
      properties: {
        label: 'Player Area',
        isShared: false,
      },
      bindings: {
        ownerId: playerOneId,
      },
    });
    const hand = createComponentInstance(getBuiltInComponentManifest('hand'), {
      instanceId: createComponentInstanceId('hand_1'),
      parentId: playerArea.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
    });
    const deck = createComponentInstance(getBuiltInComponentManifest('deck'), {
      instanceId: createComponentInstanceId('deck_1'),
      parentId: playerArea.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
    });
    const discard = createComponentInstance(getBuiltInComponentManifest('discard'), {
      instanceId: createComponentInstanceId('discard_1'),
      parentId: playerArea.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
    });
    const bag = createComponentInstance(getBuiltInComponentManifest('bag'), {
      instanceId: createComponentInstanceId('bag_1'),
      parentId: playerArea.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
    });
    const counter = createComponentInstance(getBuiltInComponentManifest('counter'), {
      instanceId: createComponentInstanceId('counter_1'),
      parentId: playerArea.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
      properties: {
        label: 'Gold',
        value: 3,
      },
    });

    const result = validateComponentTree(
      {
        [board.instanceId]: board,
        [spaceOne.instanceId]: spaceOne,
        [spaceTwo.instanceId]: spaceTwo,
        [pieceOne.instanceId]: pieceOne,
        [pieceTwo.instanceId]: pieceTwo,
        [scoreTrack.instanceId]: scoreTrack,
        [scoreMarkerOne.instanceId]: scoreMarkerOne,
        [scoreMarkerTwo.instanceId]: scoreMarkerTwo,
        [playerArea.instanceId]: playerArea,
        [hand.instanceId]: hand,
        [deck.instanceId]: deck,
        [discard.instanceId]: discard,
        [bag.instanceId]: bag,
        [counter.instanceId]: counter,
      },
      builtInCatalog,
    );

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
