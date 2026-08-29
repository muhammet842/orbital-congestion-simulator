import { describe, expect, it } from 'vitest';
import {
  GLOBE_PICK_RADIUS_PX,
  GLOBE_PICK_STACK_SLACK_PX,
  pickClosestScreenIndex,
} from './screenPick';

const W = 200;
const H = 200;

describe('pickClosestScreenIndex', () => {
  it('selects a marker the pointer is sitting on', () => {
    expect(
      pickClosestScreenIndex(
        [{ index: 3, ndcX: 0.1, ndcY: -0.2, ndcZ: 0.4, radial: 1.2 }],
        0.1,
        -0.2,
        W,
        H,
      ),
    ).toBe(3);
  });

  it('still selects when the click is within the pixel radius', () => {
    // 10 px right of center on a 200 px canvas → NDC delta 0.1
    expect(
      pickClosestScreenIndex(
        [{ index: 1, ndcX: 0, ndcY: 0, ndcZ: 0.5, radial: 1.2 }],
        10 / (W * 0.5),
        0,
        W,
        H,
      ),
    ).toBe(1);
  });

  it('ignores clicks outside the pixel radius', () => {
    const ndcOffset = (GLOBE_PICK_RADIUS_PX + 8) / (W * 0.5);
    expect(
      pickClosestScreenIndex(
        [{ index: 1, ndcX: 0, ndcY: 0, ndcZ: 0.5, radial: 1.2 }],
        ndcOffset,
        0,
        W,
        H,
      ),
    ).toBeNull();
  });

  it('prefers a higher-orbit sat over a denser LEO neighbour a few px closer', () => {
    // GEO slightly off-cursor; LEO 2 px closer on screen but lower orbit.
    expect(
      pickClosestScreenIndex(
        [
          { index: 1, ndcX: 0.08, ndcY: 0, ndcZ: 0.9, radial: 6.6 },
          { index: 2, ndcX: 0.02, ndcY: 0, ndcZ: 0.2, radial: 1.15 },
        ],
        0,
        0,
        W,
        H,
      ),
    ).toBe(1);
  });

  it('breaks equal-orbit ties with screen distance', () => {
    expect(
      pickClosestScreenIndex(
        [
          { index: 8, ndcX: 0.05, ndcY: 0, ndcZ: 0.4, radial: 1.2 },
          { index: 9, ndcX: 0, ndcY: 0, ndcZ: 0.5, radial: 1.2 },
        ],
        0,
        0,
        W,
        H,
      ),
    ).toBe(9);
  });

  it('breaks equal-orbit equal-pixel ties with camera depth', () => {
    expect(
      pickClosestScreenIndex(
        [
          { index: 8, ndcX: 0, ndcY: 0, ndcZ: 0.9, radial: 1.2 },
          { index: 9, ndcX: 0, ndcY: 0, ndcZ: 0.1, radial: 1.2 },
        ],
        0,
        0,
        W,
        H,
      ),
    ).toBe(9);
  });

  it('does not let a distant high-orbit sat steal a clear LEO click', () => {
    const farNdc = (GLOBE_PICK_STACK_SLACK_PX + 6) / (W * 0.5);
    expect(
      pickClosestScreenIndex(
        [
          { index: 1, ndcX: 0, ndcY: 0, ndcZ: 0.3, radial: 1.15 },
          { index: 2, ndcX: farNdc, ndcY: 0, ndcZ: 0.8, radial: 6.6 },
        ],
        0,
        0,
        W,
        H,
      ),
    ).toBe(1);
  });

  it('skips markers behind the camera', () => {
    expect(
      pickClosestScreenIndex(
        [{ index: 4, ndcX: 0, ndcY: 0, ndcZ: 1.2, radial: 6.6 }],
        0,
        0,
        W,
        H,
      ),
    ).toBeNull();
  });
});
