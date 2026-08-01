import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { GLTFLoader as GLTFLoaderType } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TrackedObject } from '../types';
import {
  isBundledModelKey,
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

/** Shared model key used when a type-specific GLB file is missing. */
const SHARED_MODEL_KEY: ModelAssetKey = 'sat_leo';

interface ModelPrototype {
  scene: Group;
  normalizedScale: number;
}

class SatelliteModelLoader {
  private loaderPromise: Promise<GLTFLoaderType> | null = null;
  private readonly cache = new Map<ModelAssetKey, ModelPrototype>();
  private readonly loading = new Map<ModelAssetKey, Promise<ModelPrototype>>();

  /**
   * GLTFLoader pulls in a fair amount of parsing logic that's only needed
   * once a model actually starts loading — importing it lazily keeps it out
   * of the main entry chunk so the app shell (globe, controls, UI) doesn't
   * wait on its parse/eval cost.
   */
  private async getLoader(): Promise<GLTFLoaderType> {
    if (!this.loaderPromise) {
      this.loaderPromise = import('three/examples/jsm/loaders/GLTFLoader.js').then(
        (mod) => new mod.GLTFLoader(),
      );
    }
    return this.loaderPromise;
  }

  /**
   * Warms the model cache without blocking the caller. Used for the initial
   * app boot: the 3D scene should render immediately from instanced points,
   * not wait on network round-trips for GLB files that only matter once an
   * object is actually selected.
   */
  warmCache(keys: ModelAssetKey[]): void {
    for (const key of keys) {
      void this.ensureLoaded(key).catch((err) => {
        console.warn(`[SatelliteModelLoader] Warm-up failed for "${key}".`, err);
      });
    }
  }

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

    // Non-bundled keys intentionally use procedural silhouettes — no 404 spam.
    if (!path || !isBundledModelKey(key)) {
      const scene = this.createFallbackScene(key);
      centerAtOrigin(scene);
      return { scene, normalizedScale: measureTargetScale(scene) };
    }

    try {
      const loader = await this.getLoader();
      return this.parseGltf(await loader.loadAsync(path));
    } catch (err) {
      console.warn(`[SatelliteModelLoader] Failed to load ${path}.`, err);

      if (key !== SHARED_MODEL_KEY) {
        try {
          console.warn(`[SatelliteModelLoader] Falling back to shared model for "${key}".`);
          return await this.ensureLoaded(SHARED_MODEL_KEY);
        } catch {
          // Shared model unavailable either — fall through to the primitive.
        }
      }

      console.warn(`[SatelliteModelLoader] Using primitive fallback for "${key}".`);
      const scene = this.createFallbackScene(key);
      centerAtOrigin(scene);
      return { scene, normalizedScale: measureTargetScale(scene) };
    }
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
    return buildFallbackShape(key);
  }
}

/**
 * Procedural silhouettes for model keys that are not in BUNDLED_MODEL_KEYS
 * (and as a last-resort fallback if a bundled GLB fails to load). Each key gets
 * a distinct low-poly shape so stations, cargo, cubesats, debris and LEO sats
 * stay visually distinct. Add a file under public/models/ and list the key in
 * BUNDLED_MODEL_KEYS to prefer a real GLB.
 */
function buildFallbackShape(key: ModelAssetKey): Group {
  switch (key) {
    case 'iss':
      return buildStationShape();
    case 'cargo_capsule':
      return buildCapsuleShape();
    case 'cubesat':
      return buildCubesatShape();
    case 'debris':
      return buildDebrisShape();
    case 'sat_leo':
    default:
      return buildGenericSatelliteShape(key);
  }
}

function fallbackMaterial(key: ModelAssetKey): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: FALLBACK_COLORS[key],
    roughness: 0.65,
    metalness: 0.25,
    toneMapped: false,
  });
}

function panelMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x1c3a5e,
    roughness: 0.35,
    metalness: 0.55,
    toneMapped: false,
  });
}

/** ISS-style station: habitat truss with a pair of large solar array wings. */
function buildStationShape(): Group {
  const group = new Group();
  const body = fallbackMaterial('iss');
  const panels = panelMaterial();

  const truss = new Mesh(new CylinderGeometry(0.18, 0.18, 2.6, 8), body);
  truss.rotation.z = Math.PI / 2;
  group.add(truss);

  const module = new Mesh(new CylinderGeometry(0.32, 0.32, 0.9, 8), body);
  module.rotation.z = Math.PI / 2;
  group.add(module);

  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(0.06, 1.5, 0.6), panels);
    wing.position.set(side * 1.5, 0, 0);
    group.add(wing);
  }

  return group;
}

/** Cargo/crew capsule: cylindrical service module with a tapered nose cone. */
function buildCapsuleShape(): Group {
  const group = new Group();
  const body = fallbackMaterial('cargo_capsule');

  const service = new Mesh(new CylinderGeometry(0.4, 0.4, 1.1, 12), body);
  group.add(service);

  const nose = new Mesh(new ConeGeometry(0.4, 0.6, 12), body);
  nose.position.y = 0.85;
  group.add(nose);

  return group;
}

/** Cubesat: compact rectangular bus, optionally with small deployed panels. */
function buildCubesatShape(): Group {
  const group = new Group();
  const body = fallbackMaterial('cubesat');
  const panels = panelMaterial();

  group.add(new Mesh(new BoxGeometry(0.7, 1.0, 0.7), body));

  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(0.05, 0.9, 0.35), panels);
    wing.position.set(side * 0.6, 0, 0);
    group.add(wing);
  }

  return group;
}

/** Generic satellite bus: boxy body with a pair of solar panel wings. */
function buildGenericSatelliteShape(key: ModelAssetKey): Group {
  const group = new Group();
  const body = fallbackMaterial(key);
  const panels = panelMaterial();

  group.add(new Mesh(new BoxGeometry(0.8, 0.8, 1.1), body));

  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(0.08, 1.6, 0.6), panels);
    wing.position.set(side * 1.1, 0, 0);
    group.add(wing);
  }

  const dish = new Mesh(new ConeGeometry(0.35, 0.3, 12, 1, true), panels);
  dish.rotation.x = Math.PI;
  dish.position.z = 0.75;
  group.add(dish);

  return group;
}

/** Irregular fragment: jittered icosahedron vertices read as tumbling debris. */
function buildDebrisShape(): Group {
  const group = new Group();
  const geometry = new IcosahedronGeometry(1, 0);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i++) {
    // Deterministic per-vertex jitter (no Math.random) so the shape is stable
    // across re-instantiation instead of changing every reload.
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const jitter = 0.28 * (seed - Math.floor(seed) - 0.5);
    position.setX(i, position.getX(i) * (1 + jitter));
    position.setY(i, position.getY(i) * (1 + jitter * 0.8));
    position.setZ(i, position.getZ(i) * (1 + jitter * 1.2));
  }
  geometry.computeVertexNormals();

  group.add(new Mesh(geometry, fallbackMaterial('debris')));
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
