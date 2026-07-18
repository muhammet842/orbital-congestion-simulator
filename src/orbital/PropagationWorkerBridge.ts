/**
 * PropagationWorkerBridge
 *
 * Main-thread façade for the propagation Web Worker.
 *
 * Usage
 * ─────
 *   const bridge = new PropagationWorkerBridge();
 *   bridge.init(objects);                      // call once when TLE data loads
 *   // every frame:
 *   bridge.request(simTime.getTime(), speed);  // fire-and-forget
 *   const results = bridge.getLatestResults(); // null until first reply
 *
 * When the Worker is still computing the previous frame, the bridge queues
 * only the LATEST requested tickMs and replays it the moment the Worker is
 * free — so the main thread always uses the most recent available data.
 *
 * If the Worker hasn't returned its first result yet, getLatestResults()
 * returns null; callers should fall back to synchronous propagation for that
 * frame only.
 */

import type { TrackedObject, OrbitLayer } from '../types';
import type { PropagationResult } from './propagator';
import { quantizeSimulationTimeMs } from './propagationBatch';

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
  /** Queued tick to send as soon as the Worker finishes current job. */
  private queuedTickMs: number | null = null;
  private lastProcessedTickMs = NaN;
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
        return;
      }
      if (msg.type === 'results') {
        this.pending = false;
        this.lastProcessedTickMs = msg.tickMs;
        this.latestResults = decodeBuffer(msg.data, this.objectCount);

        // If a newer request was queued while the Worker was busy, send it now.
        if (
          this.queuedTickMs !== null &&
          this.queuedTickMs !== this.lastProcessedTickMs
        ) {
          this.dispatchToWorker(this.queuedTickMs);
          this.queuedTickMs = null;
        }
      }
    };
    this.worker.onerror = (err) => {
      console.error('[PropagationWorker] error:', err);
    };
  }

  /**
   * Send TLE data to the Worker once the object list is known.
   * Must be called again if the object list is replaced.
   */
  init(objects: TrackedObject[]): void {
    this.objectCount = objects.length;
    this.latestResults = null;
    this.workerReady = false;
    this.pending = false;
    this.queuedTickMs = null;
    this.lastProcessedTickMs = NaN;
    this.worker.postMessage({
      type: 'init',
      objects: objects.map((o) => ({ line1: o.line1, line2: o.line2 })),
    });
  }

  /**
   * Request propagation for a given sim time + speed.
   * The tick is quantized (mirrors propagationBatch logic) to avoid
   * redundant recomputes at fast time warp.
   * Non-blocking — result arrives via the internal message handler.
   */
  request(simTimeMs: number, speed: number): void {
    if (!this.workerReady) return;
    const tickMs = quantizeSimulationTimeMs(simTimeMs, speed);
    if (tickMs === this.lastProcessedTickMs) return;

    if (this.pending) {
      // Worker is busy — queue this tick so it runs as soon as possible.
      this.queuedTickMs = tickMs;
      return;
    }

    this.dispatchToWorker(tickMs);
  }

  /**
   * Returns the last decoded results, or null on the very first frame
   * before any Worker reply has arrived.
   */
  getLatestResults(): (PropagationResult | null)[] | null {
    return this.latestResults;
  }

  dispose(): void {
    this.worker.terminate();
  }

  private dispatchToWorker(tickMs: number): void {
    this.pending = true;
    this.queuedTickMs = null;
    this.worker.postMessage({ type: 'propagate', tickMs });
  }
}
