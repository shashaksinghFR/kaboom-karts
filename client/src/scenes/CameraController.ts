import {
  Scene,
  ArcRotateCamera,
  UniversalCamera,
  Vector3,
} from "@babylonjs/core";
import { KartController } from "../entities/KartController";
import { CAMERA_CONFIG } from "../config/constants";

export enum CameraMode {
  CHASE = "CHASE",
  ORBIT = "ORBIT",
}

export class CameraController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private orbitCamera: ArcRotateCamera;
  private chaseCamera: ArcRotateCamera;
  private currentMode: CameraMode = CameraMode.CHASE;

  // Fixed camera distance and height (adjusted to be slightly closer and lower)
  public distanceBehind: number = 5.0;
  public heightAbove: number = 1.8;
  public lookAheadOffset: number = 2.0;
  public rotationLerpSpeed: number = 14.0;

  private isFreeLooking: boolean = false;
  private freeLookTimer: number = 0;

  // Custom drag state
  private dragPointerId: number = -1;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  // Bound reference so we can add/remove the same fn
  private handlePointerRelease = (evt: PointerEvent) => {
    // Only reset if this release/cancel belongs to the pointer we're tracking,
    // OR if we don't know (safety net) — better to un-stick than stay frozen.
    if (this.dragPointerId === -1 || this.dragPointerId === evt.pointerId) {
      this.isFreeLooking = false;
      this.dragPointerId = -1;
      try {
        this.canvas.releasePointerCapture(evt.pointerId);
      } catch {
        /* no-op: capture may already be released */
      }
    }
  };

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    // CRITICAL for mobile: without this, the browser intercepts touch drags
    // as scroll/zoom gestures instead of passing clean pointermove events.
    this.canvas.style.touchAction = "none";

    // Safety-net listeners: Babylon's onPointerObservable does not reliably
    // surface pointercancel/pointerout, so a drag that ends off-canvas can
    // leave isFreeLooking stuck "true" forever, silently blocking all future
    // drags on both PC and mobile. These catch that case directly.
    this.canvas.addEventListener("pointercancel", this.handlePointerRelease);
    this.canvas.addEventListener("pointerup", this.handlePointerRelease);
    this.canvas.addEventListener("lostpointercapture", this.handlePointerRelease);

    // 1. Orbit Camera (for inspecting the car and 360 overview)
    this.orbitCamera = new ArcRotateCamera(
      "OrbitCamera",
      CAMERA_CONFIG.ALPHA,
      CAMERA_CONFIG.BETA,
      5.5,
      new Vector3(0, 0.8, 0),
      this.scene
    );
    this.orbitCamera.lowerRadiusLimit = 3.0;
    this.orbitCamera.upperRadiusLimit = 16.0;
    this.orbitCamera.lowerBetaLimit = 0.2;
    this.orbitCamera.upperBetaLimit = Math.PI / 2.05;
    this.orbitCamera.minZ = 1.0;
    this.orbitCamera.maxZ = 80000;

    // 2. Third-Person Chase Camera (Free-Look enabled)
    this.chaseCamera = new ArcRotateCamera(
      "ChaseCamera",
      -Math.PI / 2, // alpha
      Math.PI / 2.8, // beta
      5.0, // radius
      Vector3.Zero(),
      this.scene
    );
    this.chaseCamera.fov = 1.0;
    this.chaseCamera.minZ = 0.1;
    this.chaseCamera.maxZ = 80000;
    this.chaseCamera.lowerRadiusLimit = 3.5;
    this.chaseCamera.upperRadiusLimit = 8.0;
    this.chaseCamera.lowerBetaLimit = 0.05;
    this.chaseCamera.upperBetaLimit = Math.PI / 2.1;

    // Disable default Babylon controls to perfectly handle multi-touch manually
    this.chaseCamera.detachControl();

    // Setup custom free-look multi-touch pointer detection
    this.scene.onPointerObservable.add((pi) => {
      if (this.currentMode !== CameraMode.CHASE) return;

      const evt = pi.event as PointerEvent;
      if (!evt) return;

      const pointerId = evt.pointerId;
      const clientX = evt.clientX;
      const clientY = evt.clientY;

      if (evt.pointerType === "mouse" && evt.buttons !== 1 && pi.type !== 2) return;

      if (pi.type === 1) {
        // POINTERDOWN
        if (evt.pointerType === "touch" && clientX < window.innerWidth / 2) return;

        if (!this.isFreeLooking) {
          this.isFreeLooking = true;
          this.freeLookTimer = 0;
          this.dragPointerId = pointerId;
          this.lastPointerX = clientX;
          this.lastPointerY = clientY;

          // Lock this pointer to the canvas so drag continues even if the
          // finger/cursor moves outside canvas bounds mid-swipe.
          try {
            this.canvas.setPointerCapture(pointerId);
          } catch {
            /* no-op: some browsers/pointer types don't support capture */
          }
        }
      } else if (pi.type === 4) {
        // POINTERMOVE
        if (this.isFreeLooking && this.dragPointerId === pointerId) {
          const dx = clientX - this.lastPointerX;
          const dy = clientY - this.lastPointerY;
          this.lastPointerX = clientX;
          this.lastPointerY = clientY;

          this.chaseCamera.alpha -= dx * 0.005;
          this.chaseCamera.beta -= dy * 0.005;

          this.chaseCamera.beta = Math.max(0.05, Math.min(Math.PI / 2.1, this.chaseCamera.beta));
        }
      } else if (pi.type === 2) {
        // POINTERUP (also handled by the window-level safety net above)
        if (this.isFreeLooking && this.dragPointerId === pointerId) {
          this.isFreeLooking = false;
          this.dragPointerId = -1;
          try {
            this.canvas.releasePointerCapture(pointerId);
          } catch {
            /* no-op */
          }
        }
      }
    });

    // Default to Chase Camera
    this.setMode(CameraMode.CHASE);
  }

  public setMode(mode: CameraMode): void {
    this.currentMode = mode;
    if (mode === CameraMode.CHASE) {
      this.orbitCamera.detachControl();
      this.scene.activeCamera = this.chaseCamera;
      this.isFreeLooking = false;
      this.dragPointerId = -1;
    } else {
      this.orbitCamera.attachControl(this.canvas, true);
      this.scene.activeCamera = this.orbitCamera;
    }
  }

  public toggleMode(): CameraMode {
    const nextMode = this.currentMode === CameraMode.CHASE ? CameraMode.ORBIT : CameraMode.CHASE;
    this.setMode(nextMode);
    return nextMode;
  }

  public getMode(): CameraMode {
    return this.currentMode;
  }

  public dispose(): void {
    this.canvas.removeEventListener("pointercancel", this.handlePointerRelease);
    this.canvas.removeEventListener("pointerup", this.handlePointerRelease);
    this.canvas.removeEventListener("lostpointercapture", this.handlePointerRelease);
  }

  public update(deltaTime: number, kart: KartController): void {
    const dt = Math.min(deltaTime, 0.05);

    if (this.currentMode === CameraMode.ORBIT) {
      this.orbitCamera.target.copyFrom(kart.position);
      return;
    }

    const targetLook = new Vector3(
      kart.position.x,
      kart.position.y + 0.6,
      kart.position.z
    );
    this.chaseCamera.target = Vector3.Lerp(this.chaseCamera.target, targetLook, 1.0 - Math.exp(-this.rotationLerpSpeed * dt));

    if (!this.isFreeLooking) {
      this.freeLookTimer += dt;
      if (this.freeLookTimer > 1.0) {
        let targetAlpha = -kart.yaw - Math.PI / 2;
        let targetBeta = Math.PI / 2.8;

        let currentAlpha = this.chaseCamera.alpha;
        while (currentAlpha - targetAlpha > Math.PI) targetAlpha += Math.PI * 2;
        while (targetAlpha - currentAlpha > Math.PI) targetAlpha -= Math.PI * 2;

        const lerpFactor = 1.0 - Math.exp(-this.rotationLerpSpeed * 0.25 * dt);

        this.chaseCamera.alpha += (targetAlpha - this.chaseCamera.alpha) * lerpFactor;
        this.chaseCamera.beta += (targetBeta - this.chaseCamera.beta) * lerpFactor;
        this.chaseCamera.radius += (this.distanceBehind - this.chaseCamera.radius) * lerpFactor;
      }
    }

    const speedRatio = Math.min(Math.abs(kart.forwardSpeed) / (kart.tuning.maxForwardSpeed * kart.tuning.boostMultiplier), 1.0);
    const targetFov = 0.85 + speedRatio * 0.05;
    this.chaseCamera.fov += (targetFov - this.chaseCamera.fov) * dt * 4;
  }
}