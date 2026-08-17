/**
 * Translucent LEO volume around Earth so the "thin shell" congestion story
 * is visible without opening a panel. Educational marker, not a hard cutoff.
 */

import { BackSide, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { EARTH_RADIUS_KM } from '../types';

/** Conventional LEO ceiling used in this app (~2,000 km altitude). */
export const LEO_SHELL_ALTITUDE_KM = 2000;

export function leoShellRadius(): number {
  return 1 + LEO_SHELL_ALTITUDE_KM / EARTH_RADIUS_KM;
}

export class LeoShell {
  readonly group: Group;
  private readonly fill: Mesh;
  private readonly wire: Mesh;

  constructor() {
    this.group = new Group();
    this.group.name = 'leo-shell';
    const radius = leoShellRadius();
    const geometry = new SphereGeometry(radius, 48, 32);

    this.fill = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        side: BackSide,
      }),
    );
    this.fill.renderOrder = 1;

    this.wire = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        wireframe: true,
      }),
    );
    this.wire.renderOrder = 1;

    this.group.add(this.fill);
    this.group.add(this.wire);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
