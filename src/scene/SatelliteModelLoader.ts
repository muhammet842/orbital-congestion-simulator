import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ModelAssetKey } from './modelResolver';

export const TARGET_MODEL_SIZE = 0.004;

const FALLBACK_COLORS: Record<ModelAssetKey, number> = {
  iss: 0xcccccc,
  cargo_capsule: 0xffcc44,
  cubesat: 0x66ccff,
  sat_leo: 0x88ddff,
  debris: 0x886655,
};

interface ModelPrototype {
  scene: Group;
  normalizedScale: number;
}

class SatelliteModelLoader {
  private readonly cache = new Map<ModelAssetKey, ModelPrototype>();

  ensureLoaded(key: ModelAssetKey): ModelPrototype {
    const cached = this.cache.get(key);
    if (cached) return cached;
    
    const scene = buildSimpleShape(key);
    centerAtOrigin(scene);
    const prototype = { scene, normalizedScale: measureTargetScale(scene) };
    this.cache.set(key, prototype);
    return prototype;
  }

  clone(key: ModelAssetKey): Group {
    const prototype = this.ensureLoaded(key);
    const model = prototype.scene.clone(true);
    model.traverse((child) => {
      if (child instanceof Mesh) {
        child.frustumCulled = false;
      }
    });

    const wrapper = new Group();
    wrapper.add(model);
    wrapper.userData.baseScale = prototype.normalizedScale;
    wrapper.scale.setScalar(prototype.normalizedScale);
    return wrapper;
  }
}

function buildSimpleShape(key: ModelAssetKey): Group {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: FALLBACK_COLORS[key],
    roughness: 0.65,
    metalness: 0.25,
    toneMapped: false,
  });

  switch (key) {
    case 'iss':
    case 'cargo_capsule':
    case 'sat_leo': {
      const body = new Mesh(new BoxGeometry(0.9, 0.5, 1.2), material);
      group.add(body);
      const panelMat = new MeshStandardMaterial({
        color: 0x1c3a5e, roughness: 0.35, metalness: 0.55, toneMapped: false,
      });
      for (const side of [-1, 1]) {
        const wing = new Mesh(new BoxGeometry(0.08, 1.4, 0.5), panelMat);
        wing.position.set(side * 1.0, 0, 0);
        group.add(wing);
      }
      break;
    }
    case 'cubesat':
      group.add(new Mesh(new BoxGeometry(0.8, 0.8, 0.8), material));
      break;
    case 'debris':
    default:
      group.add(new Mesh(new SphereGeometry(0.6, 8, 6), material));
      break;
  }

  return group;
}

function centerAtOrigin(root: Group): void {
  const box = new Box3().setFromObject(root);
  const center = box.getCenter(new Vector3());
  root.position.sub(center);
}

function measureTargetScale(root: Group): number {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  return TARGET_MODEL_SIZE / maxDim;
}

export const satelliteModelLoader = new SatelliteModelLoader();
