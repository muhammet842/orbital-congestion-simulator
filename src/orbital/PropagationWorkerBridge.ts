import type { TrackedObject, OrbitLayer } from '../types';
import type { PropagationResult } from './propagator';

const STRIDE = 10;
const LAYER_NAMES: OrbitLayer[] = ['LEO', 'MEO', 'GEO', 'HEO'];

function decodeBuffer(
  data: Float64Array,
  count: number,
): (PropagationResult | null)[] {
  const out: (PropagationResult | null)[] = new Array(count).fill(null);
  for (let i = 0; i < count; i++) {
    const base = i * STRIDE;
    const layerIdx = data[base + 9];
    if (layerIdx < 0) continue;
    out[i] = {
      positionEci: { x: data[base + 0], y: data[base + 1], z: data[base + 2] },
      velocityEci: { x: data[base + 3], y: data[base + 4], z: data[base + 5] },
      altitudeKm: data[base + 6],
      velocityKmS: data[base + 7],
      inclinationDeg: data[base + 8],
      layer: LAYER_NAMES[layerIdx] ?? 'LEO',
    };
  }
  return out;
}

type WorkerOutMessage =
  | { type: 'ready'; count: number }
  | { type: 'results'; tickMs: number; data: Float64Array };

export class PropagationWorkerBridge {
  private readonly worker: Worker;
  private latestResults: (PropagationResult | null)[] | null = null;
  private workerReady = false;
  private pending = false;
  private queuedTickMs: number | null = null;
  private objectCount = 0;

  constructor() {
    this.worker = new Worker(
      new URL('../workers/propagation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        this.workerReady = true;
      } else if (msg.type === 'results') {
        this.pending = false;
        this.latestResults = decodeBuffer(msg.data, this.objectCount);
        if (this.queuedTickMs !== null) {
          const next = this.queuedTickMs;
          this.queuedTickMs = null;
          this.postPropagate(next);
        }
      }
    };
    this.worker.onerror = (err) => {
      console.error('[PropagationWorker] error:', err);
    };
  }

  init(objects: TrackedObject[]): void {
    this.objectCount = objects.length;
    this.latestResults = null;
    this.workerReady = false;
    this.pending = false;
    this.queuedTickMs = null;
    this.worker.postMessage({
      type: 'init',
      objects: objects.map((o) => ({ line1: o.line1, line2: o.line2 })),
    });
  }

  request(simTimeMs: number): void {
    if (!this.workerReady) return;
    if (this.pending) {
      this.queuedTickMs = simTimeMs;
      return;
    }
    this.postPropagate(simTimeMs);
  }

  getLatestResults(): (PropagationResult | null)[] | null {
    return this.latestResults;
  }

  dispose(): void {
    this.worker.terminate();
  }

  private postPropagate(tickMs: number): void {
    this.pending = true;
    this.queuedTickMs = null;
    this.worker.postMessage({ type: 'propagate', tickMs });
  }
}
