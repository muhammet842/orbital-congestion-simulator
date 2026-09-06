
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { eciToScene } from '../orbital/coordinates';
import { getGmstRad } from './dayNight';
import type { HistoricalEvent } from '../ui/EventCards';
import type { EventType } from '../ui/EventCards';
import { EVENT_REPLAY_REWIND_MS } from '../state/appState';

const DOT_RADIUS = 0.005;

interface ParsedObjects {
  nameA: string;
  nameB: string | null;
  
  initialPosA: Vector3;
  
  initialPosB: Vector3 | null;
  
  collisionScene: Vector3;
  
  startTimeMs: number;
  
  initialSeparationKm: number;
  
  eventType: EventType;
}

function geoToScene(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  date: Date,
): Vector3 {
  const DEG = Math.PI / 180;
  const r = 6371 + altKm;
  const gmst = getGmstRad(date);
  const eciLonRad = lonDeg * DEG + gmst;
  const latRad = latDeg * DEG;
  const eciX = r * Math.cos(latRad) * Math.cos(eciLonRad);
  const eciY = r * Math.cos(latRad) * Math.sin(eciLonRad);
  const eciZ = r * Math.sin(latRad);
  const scene = eciToScene(eciX, eciY, eciZ);
  return new Vector3(scene.x, scene.y, scene.z);
}

function orbitalBacktrack(
  collisionGeo: { latDeg: number; lonDeg: number; altKm: number },
  inclinationDeg: number,
  ascending: boolean,
  rewindMs: number,
  startDate: Date,
): Vector3 {
  const DEG = Math.PI / 180;
  const GM = 398600; 
  const R = 6371 + collisionGeo.altKm;
  const v = Math.sqrt(GM / R);          
  const arcRad = (v * rewindMs / 1000) / R; 

  const lat1 = collisionGeo.latDeg * DEG;
  const lon1 = collisionGeo.lonDeg * DEG;
  const I    = inclinationDeg * DEG;

  
  
  const sinAz = Math.min(1, Math.abs(Math.cos(I) / Math.cos(lat1)));
  const azimuth = Math.asin(sinAz); 

  
  
  
  
  
  
  
  const prograde = inclinationDeg <= 90;
  let bearing: number;
  if (ascending) {
    bearing = prograde ? azimuth : -azimuth;
  } else {
    bearing = prograde ? Math.PI - azimuth : Math.PI + azimuth;
  }
  
  const backBearing = bearing + Math.PI;

  
  const sinLat2 = Math.sin(lat1) * Math.cos(arcRad) +
                  Math.cos(lat1) * Math.sin(arcRad) * Math.cos(backBearing);
  
  const clampedSinLat2 = Math.max(-Math.sin(I), Math.min(Math.sin(I), sinLat2));
  const lat2 = Math.asin(clampedSinLat2);

  
  
  const atan2Num = Math.sin(backBearing) * Math.sin(arcRad) * Math.cos(lat1);
  const atan2Den = Math.cos(arcRad) - Math.sin(lat1) * Math.sin(lat2);
  const lon2 = Math.abs(atan2Den) < 1e-9 && Math.abs(atan2Num) < 1e-9
    ? lon1  
    : lon1 + Math.atan2(atan2Num, atan2Den);

  return geoToScene(lat2 / DEG, lon2 / DEG, collisionGeo.altKm, startDate);
}

function slerp(from: Vector3, to: Vector3, t: number): Vector3 {
  const rFrom = from.length();
  const rTo   = to.length();
  if (rFrom < 1e-10 || rTo < 1e-10) return from.clone().lerp(to, t);

  const fromDir = from.clone().normalize();
  const toDir   = to.clone().normalize();

  const cosTheta = Math.max(-1, Math.min(1, fromDir.dot(toDir)));
  const theta = Math.acos(cosTheta);

  
  const radius = rFrom + (rTo - rFrom) * t;

  
  
  if (theta < 1e-6) {
    return fromDir.lerp(toDir, t).normalize().multiplyScalar(radius);
  }

  const sinTheta = Math.sin(theta);
  const scale0   = Math.sin((1 - t) * theta) / sinTheta;
  const scale1   = Math.sin(t       * theta) / sinTheta;

  return fromDir.clone().multiplyScalar(scale0)
    .add(toDir.clone().multiplyScalar(scale1))
    .normalize()
    .multiplyScalar(radius);
}

function buildApproachArc(from: Vector3, to: Vector3, segments = 48): BufferGeometry {
  const pts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = slerp(from, to, t);
    pts.push(p.x, p.y, p.z);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

const DEBRIS_COUNT = 160;

const DEBRIS_FADE_REAL_MS = 5_000;

const DEBRIS_SPREAD = 0.024;

class DebrisCloud {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly velocities: Vector3[];
  private spawnWallMs: number | null = null;
  private originRadius = 1;

  constructor(color: number) {
    this.positions = new Float32Array(DEBRIS_COUNT * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.positions, 3));
    const mat = new PointsMaterial({
      color,
      size: 0.0038,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new Points(geo, mat);
    this.points.visible = false;

    this.velocities = Array.from({ length: DEBRIS_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const speed = DEBRIS_SPREAD * (0.2 + Math.random() * 0.8);
      return new Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      );
    });
  }

  spawn(origin: Vector3): void {
    this.spawnWallMs  = Date.now();
    this.originRadius = origin.length();
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      this.positions[i * 3]     = origin.x;
      this.positions[i * 3 + 1] = origin.y;
      this.positions[i * 3 + 2] = origin.z;
    }
    (this.points.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    this.points.visible = true;
  }

  
  tick(origin: Vector3): void {
    if (this.spawnWallMs === null) return;
    const elapsed = Date.now() - this.spawnWallMs; 
    if (elapsed < 0) { this.points.visible = false; return; }

    const t = elapsed / 1000; 
    const r = this.originRadius;

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const vel = this.velocities[i];
      const px = origin.x + vel.x * t;
      const py = origin.y + vel.y * t;
      const pz = origin.z + vel.z * t;
      const len = Math.sqrt(px * px + py * py + pz * pz);
      const s   = r / len;
      this.positions[i * 3]     = px * s;
      this.positions[i * 3 + 1] = py * s;
      this.positions[i * 3 + 2] = pz * s;
    }
    (this.points.geometry.attributes.position as BufferAttribute).needsUpdate = true;

    const fade = 1 - Math.min(1, elapsed / DEBRIS_FADE_REAL_MS);
    (this.points.material as PointsMaterial).opacity = fade * 0.95;
    this.points.visible = fade > 0.005;
  }

  reset(): void {
    this.spawnWallMs = null;
    this.points.visible = false;
    (this.points.material as PointsMaterial).opacity = 0;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}

export class EventReplayVisuals {
  readonly group: Group;

  private readonly trailA: Line;
  private readonly trailB: Line;
  private readonly dotA: Mesh;
  private readonly dotB: Mesh;
  private readonly dotImpact: Mesh;
  private readonly debrisCloud: DebrisCloud;
  private debrisTriggered = false;

  private parsed: ParsedObjects | null = null;
  private activeEventId = '';

  constructor() {
    this.group = new Group();
    this.group.renderOrder = 3;

    this.trailA = new Line(
      new BufferGeometry(),
      new LineDashedMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.7,
        dashSize: 0.0006,
        gapSize: 0.0003,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.trailB = new Line(
      new BufferGeometry(),
      new LineDashedMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.7,
        dashSize: 0.0006,
        gapSize: 0.0003,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    const dotGeo = new SphereGeometry(DOT_RADIUS, 12, 8);

    this.dotA = new Mesh(
      dotGeo,
      new MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 1.0,
        blending: AdditiveBlending,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.dotB = new Mesh(
      dotGeo,
      new MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 1.0,
        blending: AdditiveBlending,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.dotImpact = new Mesh(
      new SphereGeometry(DOT_RADIUS * 1.4, 12, 8),
      new MeshBasicMaterial({
        color: 0xff4422,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        toneMapped: false,
        depthWrite: false,
      }),
    );

    this.group.add(this.trailA, this.trailB, this.dotA, this.dotB, this.dotImpact);

    
    this.debrisCloud = new DebrisCloud(0xff7722);
    this.group.add(this.debrisCloud.points);

    this.group.visible = false;
  }

  setup(
    event: HistoricalEvent,
    collisionTimeMs: number,
  ): void {
    const eventId = event.id;
    if (this.activeEventId === eventId) return;
    this.dispose();

    const { collisionGeo, approachA, approachB, objectB } = event;

    
    const collisionDate = new Date(collisionTimeMs);
    const collisionScene = geoToScene(
      collisionGeo.latDeg,
      collisionGeo.lonDeg,
      collisionGeo.altKm,
      collisionDate,
    );

    
    const startTimeMs = collisionTimeMs - EVENT_REPLAY_REWIND_MS;
    const startDate   = new Date(startTimeMs);

    const initialPosA = orbitalBacktrack(
      collisionGeo,
      approachA.inclinationDeg,
      approachA.ascending,
      EVENT_REPLAY_REWIND_MS,
      startDate,
    );

    let initialPosB: Vector3 | null = null;
    let initialSeparationKm = 0;

    const eType = event.eventType ?? 'collision';

    if (approachB && objectB) {
      
      initialPosB = orbitalBacktrack(
        collisionGeo,
        approachB.inclinationDeg,
        approachB.ascending,
        EVENT_REPLAY_REWIND_MS,
        startDate,
      );

      
      
      initialSeparationKm = initialPosA.distanceTo(initialPosB) * 6371;
    } else if (eType === 'asat') {
      
      initialPosB = collisionScene.clone().normalize(); 
      initialSeparationKm = 0;
    } else {
      
      initialPosB = null;
      initialSeparationKm = 0;
    }

    this.parsed = {
      nameA: event.objectA.name,
      nameB: event.objectB?.name ?? null,
      initialPosA,
      initialPosB,
      collisionScene,
      startTimeMs,
      initialSeparationKm,
      eventType: eType,
    };

    
    this.debrisTriggered = false;
    this.debrisCloud.reset();

    
    (this.debrisCloud.points.material as PointsMaterial).color.setHex(
      eType === 'docking' ? 0x44ffcc : 0xff7722,
    );

    
    this.trailA.geometry.dispose();
    this.trailA.geometry = buildApproachArc(initialPosA, collisionScene);
    this.trailA.computeLineDistances();
    (this.trailA.material as LineDashedMaterial).opacity = 0.6;
    this.trailA.visible = true;

    if (initialPosB) {
      this.trailB.geometry.dispose();
      this.trailB.geometry = buildApproachArc(initialPosB, collisionScene);
      this.trailB.computeLineDistances();
      (this.trailB.material as LineDashedMaterial).opacity = 0.6;
      this.trailB.visible = true;
    } else {
      this.trailB.visible = false;
    }

    
    (this.dotImpact.material as MeshBasicMaterial).color.setHex(
      eType === 'docking' ? 0x44ff88 : 0xff4422,
    );

    this.activeEventId = eventId;
    this.group.visible = true;
  }

  tick(
    simTime: Date,
    collisionTimeMs: number,
  ): { posA: Vector3; posB: Vector3 | null; impactFlash: number } | null {
    if (!this.parsed) return null;

    const { initialPosA, initialPosB, collisionScene, startTimeMs } = this.parsed;

    
    const totalMs = collisionTimeMs - startTimeMs; 
    const elapsed = simTime.getTime() - startTimeMs;
    const progress = Math.max(0, Math.min(1, elapsed / totalMs));

    
    const posA = slerp(initialPosA, collisionScene, progress);
    this.dotA.position.copy(posA);
    this.dotA.visible = true;

    
    let posB: Vector3 | null = null;
    if (initialPosB) {
      posB = slerp(initialPosB, collisionScene, progress);
      this.dotB.position.copy(posB);
      this.dotB.visible = true;
    } else {
      this.dotB.visible = false;
    }

    
    
    
    (this.trailA.material as LineDashedMaterial).opacity = 0.65;
    this.trailA.visible = true;
    (this.trailB.material as LineDashedMaterial).opacity = 0.65;
    this.trailB.visible = initialPosB !== null;

    
    
    const msAfterCollision = -(collisionTimeMs - simTime.getTime());
    const FLASH_WINDOW_MS = 30_000;
    let impactFlash = 0;
    if (progress >= 1 || (msAfterCollision >= 0 && msAfterCollision < FLASH_WINDOW_MS)) {
      impactFlash = 1 - Math.min(1, msAfterCollision / FLASH_WINDOW_MS);
      const mat = this.dotImpact.material as MeshBasicMaterial;
      mat.opacity = impactFlash;
      this.dotImpact.position.copy(posA);
      this.dotImpact.visible = true;
    } else {
      this.dotImpact.visible = false;
    }

    
    
    if (msAfterCollision >= 0 && this.parsed.eventType !== 'docking') {
      if (!this.debrisTriggered) {
        this.debrisTriggered = true;
        this.debrisCloud.spawn(posA);
      }
      this.debrisCloud.tick(posA);
    } else if (msAfterCollision < 0) {
      
      if (this.debrisTriggered) {
        this.debrisTriggered = false;
        this.debrisCloud.reset();
      }
    }

    return { posA, posB, impactFlash };
  }

  getNames(): { nameA: string; nameB: string | null } | null {
    if (!this.parsed) return null;
    return { nameA: this.parsed.nameA, nameB: this.parsed.nameB };
  }

  
  getInitialSeparationKm(): number {
    return this.parsed?.initialSeparationKm ?? 0;
  }

  
  getCollisionScene(): Vector3 | null {
    return this.parsed?.collisionScene ?? null;
  }

  dispose(): void {
    this.trailA.geometry.dispose();
    this.trailA.geometry = new BufferGeometry();
    this.trailB.geometry.dispose();
    this.trailB.geometry = new BufferGeometry();
    this.debrisCloud.reset();
    this.debrisTriggered = false;
    this.parsed = null;
    this.activeEventId = '';
    this.group.visible = false;
    this.dotImpact.visible = false;
  }
}
