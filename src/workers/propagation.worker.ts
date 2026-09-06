

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  type EciVec3,
  type SatRec,
} from 'satellite.js';

function classifyLayer(altKm: number, ecco: number): number {
  if (ecco > 0.25) return 3; 
  if (altKm < 2000) return 0; 
  if (altKm < 35786 * 0.9) return 1; 
  if (Math.abs(altKm - 35786) < 500) return 2; 
  return 3; 
}

const STRIDE = 10;

interface InitObject {
  line1: string;
  line2: string;
}

type WorkerInMessage =
  | { type: 'init'; objects: InitObject[] }
  | { type: 'propagate'; tickMs: number };

let satrecs: SatRec[] = [];

let bufA = new Float64Array(0);
let bufB = new Float64Array(0);
let useBufA = true;

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    satrecs = msg.objects.map((o) => twoline2satrec(o.line1, o.line2));
    const len = satrecs.length * STRIDE;
    bufA = new Float64Array(len);
    bufB = new Float64Array(len);
    useBufA = true;
    self.postMessage({ type: 'ready', count: satrecs.length });
    return;
  }

  if (msg.type === 'propagate') {
    const date = new Date(msg.tickMs);
    const gst = gstime(date);
    const buf = useBufA ? bufA : bufB;

    for (let i = 0; i < satrecs.length; i++) {
      const base = i * STRIDE;
      const result = propagate(satrecs[i], date);

      if (!result || !result.position || !result.velocity) {
        buf[base + 9] = -1;
        continue;
      }

      const pos = result.position as EciVec3<number>;
      const vel = result.velocity as EciVec3<number>;
      const geo = eciToGeodetic(pos, gst);
      const altKm = geo.height;
      const vx = vel.x, vy = vel.y, vz = vel.z;
      const velKms = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const inclDeg = ((satrecs[i].inclo ?? 0) * 180) / Math.PI;
      const ecco = satrecs[i].ecco ?? 0;

      buf[base + 0] = pos.x;
      buf[base + 1] = pos.y;
      buf[base + 2] = pos.z;
      buf[base + 3] = vx;
      buf[base + 4] = vy;
      buf[base + 5] = vz;
      buf[base + 6] = altKm;
      buf[base + 7] = velKms;
      buf[base + 8] = inclDeg;
      buf[base + 9] = classifyLayer(altKm, ecco);
    }

    
    const transfer = buf.buffer;
    (self as unknown as Worker).postMessage(
      { type: 'results', tickMs: msg.tickMs, data: buf },
      [transfer],
    );

    
    
    if (useBufA) {
      bufA = new Float64Array(satrecs.length * STRIDE);
    } else {
      bufB = new Float64Array(satrecs.length * STRIDE);
    }
    useBufA = !useBufA;
  }
};
