import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS_KM } from '../types';
import {
  LEO_SHELL_ALTITUDE_KM,
  LEO_SHELL_INNER_ALTITUDE_KM,
  leoShellRadius,
} from './LeoShell';

describe('leoShellRadius', () => {
  it('places the outer rim at 2,000 km above Earth radius', () => {
    expect(LEO_SHELL_ALTITUDE_KM).toBe(2000);
    expect(leoShellRadius()).toBeCloseTo(1 + 2000 / EARTH_RADIUS_KM, 6);
  });

  it('keeps the inner tick below the LEO ceiling and above the surface', () => {
    expect(LEO_SHELL_INNER_ALTITUDE_KM).toBeLessThan(LEO_SHELL_ALTITUDE_KM);
    expect(leoShellRadius(LEO_SHELL_INNER_ALTITUDE_KM)).toBeGreaterThan(1);
    expect(leoShellRadius(LEO_SHELL_INNER_ALTITUDE_KM)).toBeLessThan(leoShellRadius());
  });

  it('stays outside Earth and inside typical GPS altitude (~20,200 km)', () => {
    expect(leoShellRadius()).toBeGreaterThan(1);
    expect(leoShellRadius()).toBeLessThan(1 + 20200 / EARTH_RADIUS_KM);
  });
});
