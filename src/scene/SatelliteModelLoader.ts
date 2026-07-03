import {
  Box3,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TrackedObject } from '../types';
import {
  modelPathForKey,
  resolveModelKey,
  type ModelAssetKey,
} from './modelResolver';

/** Max dimension in scene units (Earth radius = 1). ~25 km at orbit scale. */
export const TARGET_MODEL_SIZE = 0.004;

const FALLBACK_COLORS: Record<ModelAssetKey, number> = {
  iss: 0xcccccc,
  cargo_capsule: 0xffcc44,
  cubesat: 0x66ccff,
  sat_leo: 0x88ddff,
  debris: 0x886655,
};

/** Shared GLB used when a type-specific model file is missing. */
const SHARED_MODEL_PATH = '/models/sat_leo.glb';

interface ModelPrototype {
  scene: Group;
  normalizedScale: number;
}

class SatelliteModelLoader {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<ModelAssetKey, ModelPrototype>();
  private readonly loading = new Map<ModelAssetKey, Promise<ModelPrototype>>();
  private sharedGltf: ModelPrototype | null = null;
  private sharedGltfLoading: Promise<ModelPrototype | null> | null = null;

  async preloadForObjects(objects: TrackedObject[]): Promise<void> {
    const keys = new Set<ModelAssetKey>();
    for (const obj of objects) {
      if (obj.category === 'debris') continue;
      keys.add(resolveModelKey(obj));
    }
    await Promise.all([...keys].map((key) => this.ensureLoaded(key)));
  }

  async ensureLoaded(key: ModelAssetKey): Promise<ModelPrototype> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const pending = this.loading.get(key);
    if (pending) return pending;

    const promise = this.loadModel(key);
    this.loading.set(key, promise);
    try {
      const prototype = await promise;
      this.cache.set(key, prototype);
      return prototype;
    } finally {
      this.loading.delete(key);
    }
  }

  clone(key: ModelAssetKey): Group {
    const prototype = this.cache.get(key);
    if (!prototype) {
      return this.buildWrapper(this.createFallbackScene(key), 1);
    }

    const model = prototype.scene.clone(true);
    model.traverse((child) => {
      if (child instanceof Mesh) {
        child.frustumCulled = false;
      }
    });

    return this.buildWrapper(model, prototype.normalizedScale);
  }

  private buildWrapper(model: Group, normalizedScale: number): Group {
    const wrapper = new Group();
    wrapper.add(model);
    wrapper.userData.baseScale = normalizedScale;
    wrapper.scale.setScalar(normalizedScale);
    return wrapper;
  }

  private async loadModel(key: ModelAssetKey): Promise<ModelPrototype> {
    const path = modelPathForKey(key);

    try {
      return this.parseGltf(await this.loader.loadAsync(path));
    } catch (err) {
      console.warn(`[SatelliteModelLoader] Missing ${path} — trying ${SHARED_MODEL_PATH}.`, err);

      if (path !== SHARED_MODEL_PATH) {
        const shared = await this.loadSharedGltf();
        if (shared) return shared;
      }

      console.warn(`[SatelliteModelLoader] Using primitive fallback for "${key}".`);
      const scene = this.createFallbackScene(key);
      centerAtOrigin(scene);
      return { scene, normalizedScale: measureTargetScale(scene) };
    }
  }

  private async loadSharedGltf(): Promise<ModelPrototype | null> {
    if (this.sharedGltf) return this.sharedGltf;
    if (this.sharedGltfLoading) return this.sharedGltfLoading;

    this.sharedGltfLoading = this.loader
      .loadAsync(SHARED_MODEL_PATH)
      .then((gltf) => {
        this.sharedGltf = this.parseGltf(gltf);
        return this.sharedGltf;
      })
      .catch((err) => {
        console.warn(`[SatelliteModelLoader] Shared model not found at ${SHARED_MODEL_PATH}.`, err);
        return null;
      })
      .finally(() => {
        this.sharedGltfLoading = null;
      });

    return this.sharedGltfLoading;
  }

  private parseGltf(gltf: { scene: Group }): ModelPrototype {
    const scene = gltf.scene as Group;
    scene.traverse((child) => {
      if (child instanceof Mesh) {
        child.frustumCulled = false;
      }
    });
    centerAtOrigin(scene);
    return { scene, normalizedScale: measureTargetScale(scene) };
  }

  private createFallbackScene(key: ModelAssetKey): Group {
    const group = new Group();
    group.add(
      new Mesh(
        new IcosahedronGeometry(1, 1),
        new MeshStandardMaterial({
          color: FALLBACK_COLORS[key],
          roughness: 0.65,
          metalness: 0.25,
          toneMapped: false,
        }),
      ),
    );
    return group;
  }
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
