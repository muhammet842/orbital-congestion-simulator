import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getDebrisUpdateStride, getPropagationResults } from '../orbital/propagationBatch';
import { PropagationWorkerBridge } from '../orbital/PropagationWorkerBridge';
import { getSubSatelliteScenePoints } from '../orbital/coordinates';
import { propagateObject } from '../orbital/propagator';
import { getDayNightState } from './dayNight';
import { Earth } from './Earth';
import { OrbitalMeshes } from './OrbitalMeshes';
import { SatelliteFootprint } from './SatelliteFootprint';
import { SelectionMarker } from './SelectionMarker';
import { CameraFly } from './CameraFly';
import { matchesSearchQuery, selectObject, clearObjectSelection, getSimulationTime, getState, advanceSimulationTime, subscribe } from '../state/appState';
import type { TrackedObject } from '../types';

const GLOBE_CAMERA_NEAR = 0.001;

export class SceneManager {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly earth: Earth;
  readonly sunLight: DirectionalLight;
  private orbitalMeshes: OrbitalMeshes | null = null;
  private readonly propWorker: PropagationWorkerBridge;
  private readonly selectionMarker: SelectionMarker;
  private readonly satelliteFootprint: SatelliteFootprint;
  private readonly cameraFly: CameraFly;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private lastFrameTime = performance.now();
  private animationId = 0;
  private readonly canvasContainer: HTMLElement;
  private readonly debugMode: boolean;
  private fpsElement: HTMLElement | null = null;
  private fpsFrames = 0;
  private fpsLastUpdate = performance.now();
  private debrisFrameCounter = 0;
  private lastFramedSelectionIndex: number | null = null;
  private clickAnchor: { x: number; y: number } | null = null;
  private pointerDragged = false;
  private readonly clickDragThresholdPx = 5;

  constructor(container: HTMLElement) {
    this.canvasContainer = container;
    this.debugMode = new URLSearchParams(window.location.search).has('debug');
    this.scene = new Scene();
    this.scene.background = new Color('#050510');
    this.camera = new PerspectiveCamera(45, 1, GLOBE_CAMERA_NEAR, 1000);
    this.camera.position.set(0, 0, 4.5);
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    if (this.debugMode) {
      this.fpsElement = document.createElement('div');
      this.fpsElement.className = 'fps-counter';
      this.fpsElement.textContent = 'FPS: —';
      container.appendChild(this.fpsElement);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.screenSpacePanning = false;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = 10;

    this.scene.add(new AmbientLight(0x1a2040, 0.28));
    this.scene.add(new HemisphereLight(0x3a5080, 0x0a0812, 0.14));
    this.sunLight = new DirectionalLight(0xfff4e8, 2.6);
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.add(this.sunLight, this.sunLight.target);

    this.earth = new Earth();
    this.scene.add(this.earth.mesh);
    this.selectionMarker = new SelectionMarker();
    this.scene.add(this.selectionMarker.group);
    this.satelliteFootprint = new SatelliteFootprint();
    this.scene.add(this.satelliteFootprint.group);
    this.cameraFly = new CameraFly();
    this.propWorker = new PropagationWorkerBridge();

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.clickAnchor = { x: event.clientX, y: event.clientY };
      this.pointerDragged = false;
    });
    window.addEventListener('pointermove', (event) => {
      if (!this.clickAnchor || this.pointerDragged) return;
      if (Math.hypot(event.clientX - this.clickAnchor.x, event.clientY - this.clickAnchor.y) > this.clickDragThresholdPx) this.pointerDragged = true;
    });
    window.addEventListener('pointerup', () => { this.clickAnchor = null; });
    this.renderer.domElement.addEventListener('click', (event) => this.onClick(event));
    window.addEventListener('resize', () => this.onResize());
    subscribe(() => this.onStateChange());
    this.onResize();
    this.applyDayNight(getSimulationTime());
  }

  initOrbitalMeshes(objects: TrackedObject[]): void {
    this.orbitalMeshes = OrbitalMeshes.create(objects);
    this.scene.add(this.orbitalMeshes.group);
    this.propWorker.init(objects);
  }

  start(): void {
    const loop = (now: number): void => {
      this.animationId = requestAnimationFrame(loop);
      this.tick(now);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  private onStateChange(): void {
    const { selectedIndex, objects } = getState();
    if (selectedIndex != null && selectedIndex !== this.lastFramedSelectionIndex && !this.cameraFly.isActive()) {
      const object = objects[selectedIndex];
      const propagation = object ? propagateObject(object.satrec, getSimulationTime()) : null;
      const subSatellite = propagation ? getSubSatelliteScenePoints(propagation.positionEci, propagation.altitudeKm) : null;
      if (propagation && subSatellite) this.cameraFly.frameSelectedOnGlobe(this.camera, this.controls, subSatellite.nadirWorld, propagation.altitudeKm);
      this.lastFramedSelectionIndex = selectedIndex;
    } else if (selectedIndex == null) {
      this.lastFramedSelectionIndex = null;
    }
  }

  private applyDayNight(simTime: Date): void {
    const { sunPosition, sunDirection } = getDayNightState(simTime);
    this.sunLight.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
    this.earth.update(simTime, sunDirection);
  }

  private updateFps(now: number): void {
    if (!this.fpsElement) return;
    this.fpsFrames++;
    if (now - this.fpsLastUpdate >= 1000) {
      this.fpsElement.textContent = `FPS: ${Math.round((this.fpsFrames * 1000) / (now - this.fpsLastUpdate))}`;
      this.fpsFrames = 0;
      this.fpsLastUpdate = now;
    }
  }

  private tick(now: number): void {
    const state = getState();
    const deltaMs = now - this.lastFrameTime;
    this.lastFrameTime = now;
    if (state.time.mode === 'historical' && state.time.playing) {
      advanceSimulationTime(new Date(state.time.current.getTime() + deltaMs * state.time.speed));
    }

    const currentState = getState();
    const simTime = getSimulationTime();
    const timeSpeed = currentState.time.mode === 'historical' ? currentState.time.speed : 1;
    this.applyDayNight(simTime);
    this.propWorker.request(simTime.getTime());
    const propagations = this.propWorker.getLatestResults() ?? getPropagationResults(currentState.objects, simTime, timeSpeed);
    const debrisStride = getDebrisUpdateStride(timeSpeed);
    const skipPointsUpdate = this.debrisFrameCounter++ % debrisStride !== 0;

    if (this.orbitalMeshes) {
      this.orbitalMeshes.updatePositions(
        currentState.objects,
        propagations,
        currentState.selectedIndex,
        currentState.layerFilters,
        currentState.searchQuery,
        this.camera.position,
        simTime.getTime(),
        {
          skipPointsUpdate,
          colorByFunction: currentState.colorByFunction,
          altitudeFilter: currentState.altitudeFilter,
          inclinationFilter: currentState.inclinationFilter,
          categoryFilter: currentState.categoryFilter,
        },
      );
    }

    this.satelliteFootprint.update(currentState.selectedIndex, currentState.objects, simTime);
    this.selectionMarker.update(currentState.selectedIndex, currentState.objects, simTime);
    const flying = this.cameraFly.update(this.camera, this.controls, now);
    if (!flying) {
      this.controls.update();
      if (this.controls.target.lengthSq() > 1e-8) this.controls.target.set(0, 0, 0);
    }
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
    this.updateFps(now);
  }

  private onClick(event: MouseEvent): void {
    if (!this.orbitalMeshes || this.pointerDragged) {
      this.pointerDragged = false;
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objectIndex = this.orbitalMeshes.pickObjectIndex(this.raycaster, this.camera, this.pointer, rect.width, rect.height);
    if (objectIndex == null) {
      clearObjectSelection();
      return;
    }
    const state = getState();
    const object = state.objects[objectIndex];
    const propagation = object ? propagateObject(object.satrec, getSimulationTime()) : null;
    if (object && propagation && state.layerFilters[propagation.layer] && (state.categoryFilter === 'all' || object.category === state.categoryFilter) && matchesSearchQuery(object, state.searchQuery)) selectObject(objectIndex);
  }

  private onResize(): void {
    const { clientWidth, clientHeight } = this.canvasContainer;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }
}
