

import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { EARTH_RADIUS_KM } from '../types';

export const LEO_SHELL_ALTITUDE_KM = 2000;

export const LEO_SHELL_INNER_ALTITUDE_KM = 400;

export function leoShellRadius(altitudeKm = LEO_SHELL_ALTITUDE_KM): number {
  return 1 + altitudeKm / EARTH_RADIUS_KM;
}

function equatorRing(radius: number, opacity: number): LineLoop {
  const segments = 160;
  const positions = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * radius;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(a) * radius;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const line = new LineLoop(
    geometry,
    new LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  line.renderOrder = 2;
  return line;
}

function rimHalo(radius: number): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(0x67e8f9) },
      uOpacity: { value: 0.42 },
    },
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      void main() {
        vec3 n = normalize(vViewNormal);
        vec3 v = normalize(-vViewPosition);
        float rim = pow(1.0 - abs(dot(n, v)), 3.2);
        float alpha = uOpacity * rim;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: BackSide,
    blending: AdditiveBlending,
  });
  material.customProgramCacheKey = () => 'leo-shell-rim-v1';

  const mesh = new Mesh(new SphereGeometry(radius, 64, 48), material);
  mesh.renderOrder = 1;
  return mesh;
}

export class LeoShell {
  readonly group: Group;

  constructor() {
    this.group = new Group();
    this.group.name = 'leo-shell';

    const outer = leoShellRadius(LEO_SHELL_ALTITUDE_KM);
    const inner = leoShellRadius(LEO_SHELL_INNER_ALTITUDE_KM);

    this.group.add(rimHalo(outer));
    this.group.add(equatorRing(outer, 0.28));
    this.group.add(equatorRing(inner, 0.14));
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
