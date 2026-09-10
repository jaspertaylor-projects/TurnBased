import type { RawEntry } from './types';

export const SCOREPADS: RawEntry[] = [
  // ----- Score pads (category: scorepads) -----
  {
    group: 'scorepad',
    identity: 'ScorePad',
    displayName: 'Small Score Pad (Color)',
    widthIn: 3.5,
    heightIn: 5.5,
    pages: 40,
    priceTiers: [
      { minCopies: 1, costEach: 7.0 },
      { minCopies: 100, costEach: 4.3 },
    ],
    confidence: 'high',
  },
  {
    group: 'scorepad',
    identity: 'ScorePad',
    displayName: 'Medium Score Pad (Color)',
    widthIn: 4.5,
    heightIn: 8,
    pages: 40,
    priceTiers: [
      { minCopies: 1, costEach: 7.0 },
      { minCopies: 100, costEach: 4.3 },
    ],
    confidence: 'high',
  },
  {
    group: 'scorepad',
    identity: 'ScorePad',
    displayName: 'Large Score Pad (Color)',
    widthIn: 8,
    heightIn: 10,
    pages: 40,
    priceTiers: [
      { minCopies: 1, costEach: 9.6 },
      { minCopies: 100, costEach: 7.2 },
    ],
    confidence: 'high',
  },
];
