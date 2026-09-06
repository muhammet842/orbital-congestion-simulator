import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { getConjunctionLabelPositions } from './ConjunctionVerification';
import type { ConjunctionEvent, TrackedObject } from '../types';

export class ConjunctionLabels {
  readonly root: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly lineA: SVGLineElement;
  private readonly lineB: SVGLineElement;
  private readonly labelA: HTMLDivElement;
  private readonly labelB: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'conjunction-labels';
    this.root.hidden = true;

    const svgNS = 'http://www.w3.org/2000/svg';
    this.svg = document.createElementNS(svgNS, 'svg');
    this.svg.classList.add('conjunction-labels__svg');

    this.lineA = document.createElementNS(svgNS, 'line');
    this.lineB = document.createElementNS(svgNS, 'line');
    this.lineA.classList.add('conjunction-labels__leader', 'conjunction-labels__leader--a');
    this.lineB.classList.add('conjunction-labels__leader', 'conjunction-labels__leader--b');
    this.svg.append(this.lineA, this.lineB);

    this.labelA = document.createElement('div');
    this.labelB = document.createElement('div');
    this.labelA.className = 'conjunction-label conjunction-label--a';
    this.labelB.className = 'conjunction-label conjunction-label--b';

    this.root.append(this.svg, this.labelA, this.labelB);
    container.appendChild(this.root);
  }

  update(
    conjunction: ConjunctionEvent | null,
    objects: TrackedObject[],
    date: Date,
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
  ): void {
    if (!conjunction) {
      this.reset();
      return;
    }

    const layout = getConjunctionLabelPositions(conjunction, objects, date, camera, renderer);
    if (!layout || !layout.screenA.visible || !layout.screenB.visible) {
      this.root.hidden = true;
      return;
    }

    this.root.hidden = false;
    this.labelA.textContent = layout.nameA;
    this.labelB.textContent = layout.nameB;

    this.labelA.style.left = `${layout.labelA.x}px`;
    this.labelA.style.top = `${layout.labelA.y}px`;
    this.labelB.style.left = `${layout.labelB.x}px`;
    this.labelB.style.top = `${layout.labelB.y}px`;

    const anchorA = { x: layout.labelA.x + this.labelA.offsetWidth * 0.85, y: layout.labelA.y + 28 };
    const anchorB = { x: layout.labelB.x + 8, y: layout.labelB.y + 28 };

    this.lineA.setAttribute('x1', String(anchorA.x));
    this.lineA.setAttribute('y1', String(anchorA.y));
    this.lineA.setAttribute('x2', String(layout.screenA.x));
    this.lineA.setAttribute('y2', String(layout.screenA.y));

    this.lineB.setAttribute('x1', String(anchorB.x));
    this.lineB.setAttribute('y1', String(anchorB.y));
    this.lineB.setAttribute('x2', String(layout.screenB.x));
    this.lineB.setAttribute('y2', String(layout.screenB.y));
  }

  reset(): void {
    this.root.hidden = true;
    this.labelA.textContent = '';
    this.labelB.textContent = '';
    this.lineA.setAttribute('x1', '0');
    this.lineA.setAttribute('y1', '0');
    this.lineA.setAttribute('x2', '0');
    this.lineA.setAttribute('y2', '0');
    this.lineB.setAttribute('x1', '0');
    this.lineB.setAttribute('y1', '0');
    this.lineB.setAttribute('x2', '0');
    this.lineB.setAttribute('y2', '0');
  }
}
