import { describe, expect, it } from 'vitest';
import { GLOBE_PICK_RADIUS_PX, pickClosestScreenIndex } from './screenPick';

const W = 200;
const H = 200;

describe('pickClosestScreenIndex', () => {
  it('selects a marker the pointer is sitting on', () => {
    expect(
      pickClosestScreenIndex(
        [{ index: 3, ndcX: 0.1, ndcY: -0.2, ndcZ: 0.4 }],
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
        [{ index: 1, ndcX: 0, ndcY: 0, ndcZ: 0.5 }],
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
        [{ index: 1, ndcX: 0, ndcY: 0, ndcZ: 0.5 }],
        ndcOffset,
        0,
        W,
        H,
      ),
    ).toBeNull();
  });

  it('picks the nearer on-screen marker when two are in range', () => {
    expect(
      pickClosestScreenIndex(
        [
          { index: 1, ndcX: 0.08, ndcY: 0, ndcZ: 0.2 },
          { index: 2, ndcX: 0.02, ndcY: 0, ndcZ: 0.9 },
        ],
        0,
        0,
        W,
        H,
      ),
    ).toBe(2);
  });

  it('breaks pixel ties with camera depth', () => {
    expect(
      pickClosestScreenIndex(
        [
          { index: 8, ndcX: 0, ndcY: 0, ndcZ: 0.9 },
          { index: 9, ndcX: 0, ndcY: 0, ndcZ: 0.1 },
        ],
        0,
        0,
        W,
        H,
      ),
    ).toBe(9);
  });

  it('skips markers behind the camera', () => {
    expect(
      pickClosestScreenIndex(
        [{ index: 4, ndcX: 0, ndcY: 0, ndcZ: 1.2 }],
        0,
        0,
        W,
        H,
      ),
    ).toBeNull();
  });
});
