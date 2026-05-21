import type { BuiltInComponentType, ComponentManifest } from './types';
import { primaryComponentTypes, type ComponentManifestDefinition } from './catalog-helpers';
import { spatialManifests } from './catalog-spatial';
import { collectionManifests } from './catalog-collections';
import { entityManifests } from './catalog-entities';
import { counterManifests } from './catalog-counters';

// Manifests are ordered to match the original catalog key order, which affects
// listAuthorableBuiltInComponents() output order (tested in index.test.ts).
const manifests: Record<BuiltInComponentType, ComponentManifestDefinition> = {
  board: spatialManifests.board,
  tile: spatialManifests.tile,
  card: entityManifests.card,
  space: spatialManifests.space,
  'hex-grid': spatialManifests['hex-grid'],
  'square-grid': spatialManifests['square-grid'],
  'checkerboard-grid': spatialManifests['checkerboard-grid'],
  track: spatialManifests.track,
  'text-box': counterManifests['text-box'],
  zone: counterManifests.zone,
  deck: collectionManifests.deck,
  hand: collectionManifests.hand,
  discard: collectionManifests.discard,
  bag: collectionManifests.bag,
  piece: entityManifests.piece,
  token: entityManifests.token,
  counter: counterManifests.counter,
  'score-track': counterManifests['score-track'],
  'image-area': entityManifests['image-area'],
  network: counterManifests.network,
};

export const builtInComponentCatalog = Object.fromEntries(
  Object.entries(manifests).map(([type, manifest]) => [
    type,
    {
      ...manifest,
      authoring: {
        discoverability: primaryComponentTypes.has(type as BuiltInComponentType) ? 'primary' : 'hidden',
      },
    },
  ]),
) as Record<BuiltInComponentType, ComponentManifest>;
