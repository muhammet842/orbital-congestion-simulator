import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS_KM } from '../types';
import { LEO_SHELL_ALTITUDE_KM, leoShellRadius } from './LeoShell';

describe('leoShellRadius', () => {
  it('places the shell at 2,000 km above Earth radius', () => {
    expect(LEO_SHELL_ALTITUDE_KM).toBe(2000);
    expect(leoShellRadius()).toBeCloseTo(1 + 2000 / EARTH_RADIUS_KM, 6);
  });

  it('stays outside Earth and inside typical GPS altitude (~20,200 km)', () => {
    expect(leoShellRadius()).toBeGreaterThan(1);
    expect(leoShellRadius()).toBeLessThan(1 + 20200 / EARTH_RADIUS_KM);
  });
});
