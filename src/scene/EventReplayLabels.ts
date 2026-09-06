import type { PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import type { EventType } from '../ui/EventCards';

const GM = 398600;           
const EARTH_RADIUS_KM = 6371;

function projectToScreen(
  pos: Vector3,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
): { x: number; y: number; visible: boolean } {
  const ndc = pos.clone().project(camera);
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  return {
    x: (ndc.x + 1) * 0.5 * w,
    y: (1 - ndc.y) * 0.5 * h,
    
    visible: ndc.z > 0 && ndc.z < 1,
  };
}

function altKmFromScenePos(pos: Vector3): number {
  return Math.max(0, (pos.length() - 1) * EARTH_RADIUS_KM);
}

function orbitalVelocityKmS(altKm: number): number {
  return Math.sqrt(GM / (EARTH_RADIUS_KM + altKm));
}

const EVENT_TYPE_META: Record<EventType, { typeA: string; typeB: string; iconA: string; iconB: string }> = {
  collision: { typeA: 'Satellite', typeB: 'Satellite',    iconA: '🛰', iconB: '🛰' },
  asat:      { typeA: 'Satellite', typeB: 'Interceptor',  iconA: '🛰', iconB: '⚡' },
  docking:   { typeA: 'Spacecraft', typeB: 'Target',      iconA: '🚀', iconB: '🛰' },
  breakup:   { typeA: 'Satellite', typeB: '',             iconA: '🛰', iconB: '' },
};

function buildPanelHTML(
  name: string,
  icon: string,
  type: string,
  altKm: number,
  velKmS: number,
): string {
  return `
    <div class="era-lp__header">
      <span class="era-lp__icon">${icon}</span>
      <span class="era-lp__name">${name}</span>
    </div>
    <div class="era-lp__row">
      <span class="era-lp__key">Type</span>
      <span class="era-lp__val">${type}</span>
    </div>
    <div class="era-lp__row">
      <span class="era-lp__key">Altitude</span>
      <span class="era-lp__val">${Math.round(altKm)} km</span>
    </div>
    <div class="era-lp__row">
      <span class="era-lp__key">Velocity</span>
      <span class="era-lp__val">${velKmS.toFixed(1)} km/s</span>
    </div>
  `;
}

export class EventReplayLabels {
  readonly root: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly lineA: SVGLineElement;
  private readonly lineB: SVGLineElement;
  private readonly panelA: HTMLDivElement;
  private readonly panelB: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'era-labels';
    this.root.hidden = true;

    const svgNS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(svgNS, 'svg');
    this.svg.classList.add('era-labels__svg');

    this.lineA = document.createElementNS(svgNS, 'line');
    this.lineB = document.createElementNS(svgNS, 'line');
    this.lineA.classList.add('era-labels__leader', 'era-labels__leader--a');
    this.lineB.classList.add('era-labels__leader', 'era-labels__leader--b');
    this.svg.append(this.lineA, this.lineB);

    this.panelA = document.createElement('div');
    this.panelB = document.createElement('div');
    this.panelA.className = 'era-lp era-lp--a';
    this.panelB.className = 'era-lp era-lp--b';

    this.root.append(this.svg, this.panelA, this.panelB);
    container.appendChild(this.root);
  }

  
  update(
    posA: Vector3 | null,
    posB: Vector3 | null,
    nameA: string,
    nameB: string | null,
    eventType: EventType,
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    impactFlash: number,
  ): void {
    if (!posA || impactFlash > 0.6) {
      this.root.hidden = true;
      return;
    }

    const screenA = projectToScreen(posA, camera, renderer);
    if (!screenA.visible) {
      this.root.hidden = true;
      return;
    }

    this.root.hidden = false;

    const meta = EVENT_TYPE_META[eventType] ?? EVENT_TYPE_META.collision;
    const altA = altKmFromScenePos(posA);
    const velA = orbitalVelocityKmS(altA);
    this.panelA.innerHTML = buildPanelHTML(nameA, meta.iconA, meta.typeA, altA, velA);
    this.panelA.hidden = false;

    
    const W = this.panelA.offsetWidth  || 170;
    const H = this.panelA.offsetHeight || 90;
    const LEAD = 28; 

    const pAX = screenA.x - W - LEAD;
    const pAY = screenA.y - H - LEAD;
    this.panelA.style.left = `${pAX}px`;
    this.panelA.style.top  = `${pAY}px`;

    
    const anchorAX = pAX + W;
    const anchorAY = pAY + H;
    this.setLine(this.lineA, anchorAX, anchorAY, screenA.x, screenA.y);

    
    if (posB) {
      const screenB = projectToScreen(posB, camera, renderer);
      if (screenB.visible) {
        const altB = altKmFromScenePos(posB);
        const type   = meta.typeB;
        const icon   = meta.iconB;
        
        const velB   = eventType === 'asat'
          ? Math.min(9.5, orbitalVelocityKmS(altB) * 1.2)
          : orbitalVelocityKmS(altB);
        const label  = nameB ?? (eventType === 'asat' ? 'ASAT MISSILE' : 'OBJECT B');

        this.panelB.innerHTML = buildPanelHTML(label, icon, type, altB, velB);
        this.panelB.hidden = false;

        const HB = this.panelB.offsetHeight || 90;

        
        const pBX = screenB.x + LEAD;
        const pBY = screenB.y - HB - LEAD;
        this.panelB.style.left = `${pBX}px`;
        this.panelB.style.top  = `${pBY}px`;

        
        const anchorBX = pBX;
        const anchorBY = pBY + HB;
        this.setLine(this.lineB, anchorBX, anchorBY, screenB.x, screenB.y);
      } else {
        this.hideB();
      }
    } else {
      this.hideB();
    }
  }

  hide(): void {
    this.root.hidden = true;
  }

  private hideB(): void {
    this.panelB.hidden = true;
    this.setLine(this.lineB, 0, 0, 0, 0);
  }

  private setLine(
    line: SVGLineElement,
    x1: number, y1: number,
    x2: number, y2: number,
  ): void {
    line.setAttribute('x1', String(Math.round(x1)));
    line.setAttribute('y1', String(Math.round(y1)));
    line.setAttribute('x2', String(Math.round(x2)));
    line.setAttribute('y2', String(Math.round(y2)));
  }
}
