import { describe, expect, it } from 'vitest';
import {
  createComponentInstanceId,
  createPlayerId,
} from '@turnbased/shared-types';

import {
  builtInCatalog,
  createComponentInstance,
  getBuiltInComponentManifest,
  listBuiltInComponents,
  validateComponentOccupancy,
  validateComponentPlacement,
  validateComponentTree,
} from './index';

describe('engine-components catalog', () => {
  it('exposes the full built-in catalog grouped across categories', () => {
    const allComponents = listBuiltInComponents();
    const collectionComponents = listBuiltInComponents('collection');

    expect(allComponents).toHaveLength(12);
    expect(collectionComponents.map((component) => component.type)).toEqual([
      'deck',
      'hand',
      'discard',
      'bag',
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
    const piece = createComponentInstance(getBuiltInComponentManifest('piece'), {
      instanceId: createComponentInstanceId('piece_red'),
      parentId: space.instanceId,
      bindings: {
        ownerId: createPlayerId('player_red'),
      },
    });

    expect(board.properties.label).toBe('Board');
    expect(space.properties.terrain).toBe('plain');
    expect(piece.properties.size).toBe('medium');

    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('space'),
        getBuiltInComponentManifest('board'),
      ).valid,
    ).toBe(true);
    expect(
      validateComponentPlacement(
        getBuiltInComponentManifest('deck'),
        getBuiltInComponentManifest('space'),
      ).valid,
    ).toBe(false);
  });

  it('enforces occupancy defaults for spaces and score tracks', () => {
    const ownerA = createPlayerId('player_a');
    const ownerB = createPlayerId('player_b');
    const spaceRules = validateComponentOccupancy(getBuiltInComponentManifest('space'), {
      occupantTypes: ['piece', 'token'],
      occupantCategories: ['entity', 'entity'],
      occupantOwnerIds: [ownerA, ownerB],
    });
    const scoreTrackRules = validateComponentOccupancy(getBuiltInComponentManifest('score-track'), {
      occupantTypes: ['token', 'token'],
      occupantCategories: ['entity', 'entity'],
      occupantOwnerIds: [ownerA, ownerA],
    });

    expect(spaceRules.valid).toBe(false);
    expect(spaceRules.issues.map((issue) => issue.code)).toContain('occupancy_capacity_exceeded');
    expect(spaceRules.issues.map((issue) => issue.code)).toContain('occupancy_mixed_types_not_allowed');
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
      children: [createComponentInstanceId('piece_1')],
      placement: {
        slotId: 'surface',
        index: 0,
        coordinates: { x: 0, y: 0 },
      },
    });
    const spaceTwo = createComponentInstance(getBuiltInComponentManifest('space'), {
      instanceId: createComponentInstanceId('space_2'),
      parentId: board.instanceId,
      children: [createComponentInstanceId('piece_2')],
      placement: {
        slotId: 'surface',
        index: 1,
        coordinates: { x: 1, y: 0 },
      },
    });
    const pieceOne = createComponentInstance(getBuiltInComponentManifest('piece'), {
      instanceId: createComponentInstanceId('piece_1'),
      parentId: spaceOne.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
    });
    const pieceTwo = createComponentInstance(getBuiltInComponentManifest('piece'), {
      instanceId: createComponentInstanceId('piece_2'),
      parentId: spaceTwo.instanceId,
      bindings: {
        ownerId: playerTwoId,
      },
    });
    const scoreTrack = createComponentInstance(getBuiltInComponentManifest('score-track'), {
      instanceId: createComponentInstanceId('score_track'),
      parentId: board.instanceId,
      children: [
        createComponentInstanceId('score_marker_1'),
        createComponentInstanceId('score_marker_2'),
      ],
      placement: {
        slotId: 'surface',
        index: 2,
      },
    });
    const scoreMarkerOne = createComponentInstance(getBuiltInComponentManifest('token'), {
      instanceId: createComponentInstanceId('score_marker_1'),
      parentId: scoreTrack.instanceId,
      bindings: {
        ownerId: playerOneId,
      },
      placement: {
        trackPosition: 3,
      },
    });
    const scoreMarkerTwo = createComponentInstance(getBuiltInComponentManifest('token'), {
      instanceId: createComponentInstanceId('score_marker_2'),
      parentId: scoreTrack.instanceId,
      bindings: {
        ownerId: playerTwoId,
      },
      placement: {
        trackPosition: 4,
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
