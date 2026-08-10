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

  // Fixed camera distance and height (adjusted to be closer and lower to ground for better sense of speed)
  public distanceBehind: number = 4.2;
  public heightAbove: number = 1.1;
  public lookAheadOffset: number = 2.0; 
  public rotationLerpSpeed: number = 14.0;

  private isFreeLooking: boolean = false;
  private freeLookTimer: number = 0;
  
  // Custom drag state
  private dragPointerId: number = -1;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

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
      Math.PI / 3.2, // beta
      this.distanceBehind, // radius
      Vector3.Zero(),
      this.scene
    );
    this.chaseCamera.fov = 1.0; // Slightly wider FOV for a better sense of speed
    this.chaseCamera.minZ = 0.1; // Avoid z-fighting
    this.chaseCamera.maxZ = 80000;
    this.chaseCamera.lowerRadiusLimit = this.distanceBehind; // Lock distance exactly
    this.chaseCamera.upperRadiusLimit = this.distanceBehind; 
    this.chaseCamera.lowerBetaLimit = 0.05;
    this.chaseCamera.upperBetaLimit = Math.PI / 2.1; // Prevent going underground
    
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
      
      // Ignore if this is from a mouse and it's not the left click (to prevent right-click interference)
      if (evt.pointerType === "mouse" && evt.buttons !== 1 && pi.type !== 2) return;

      if (pi.type === 1) { // POINTERDOWN
        // Ignore touches on the left side of the screen on mobile to prevent the joystick from hijacking the camera
        if (evt.pointerType === "touch" && clientX < window.innerWidth / 2) return;

        // Only grab free-look if we aren't already free-looking with another pointer
        if (!this.isFreeLooking) {
          this.isFreeLooking = true;
          this.freeLookTimer = 0;
          this.dragPointerId = pointerId;
          this.lastPointerX = clientX;
          this.lastPointerY = clientY;
        }
      } else if (pi.type === 4) { // POINTERMOVE
        if (this.isFreeLooking && this.dragPointerId === pointerId) {
          const dx = clientX - this.lastPointerX;
          const dy = clientY - this.lastPointerY;
          this.lastPointerX = clientX;
          this.lastPointerY = clientY;
          
          this.chaseCamera.alpha -= dx * 0.005;
          this.chaseCamera.beta -= dy * 0.005;
          
          // Clamp beta manually to prevent flipping
          this.chaseCamera.beta = Math.max(0.05, Math.min(Math.PI / 2.1, this.chaseCamera.beta));
        }
      } else if (pi.type === 2 || pi.type === 8) { // POINTERUP or POINTEROUT
        if (this.isFreeLooking && this.dragPointerId === pointerId) {
          this.isFreeLooking = false;
          this.dragPointerId = -1;
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
      // We purposefully DO NOT attachControl for chaseCamera to avoid conflicts with our custom drag logic
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

  public update(deltaTime: number, kart: KartController): void {
    const dt = Math.min(deltaTime, 0.05);

    if (this.currentMode === CameraMode.ORBIT) {
      // Keep orbit camera target centered on kart position
      this.orbitCamera.target.copyFrom(kart.position);
      return;
    }

    // Chase Camera update:
    // Smoothly follow the kart's position
    const targetLook = new Vector3(
      kart.position.x,
      kart.position.y + 0.6,
      kart.position.z
    );
    this.chaseCamera.target = Vector3.Lerp(this.chaseCamera.target, targetLook, 1.0 - Math.exp(-this.rotationLerpSpeed * dt));

    // Auto-Return to default behind-car perspective if not free-looking
    if (!this.isFreeLooking) {
      this.freeLookTimer += dt;
      if (this.freeLookTimer > 1.0) { // Wait 1 second before snapping back
        let targetAlpha = -kart.yaw - Math.PI / 2;
        let targetBeta = Math.PI / 2.3; // Low to the ground angle

        // Normalize alpha to find shortest rotation path
        let currentAlpha = this.chaseCamera.alpha;
        while (currentAlpha - targetAlpha > Math.PI) targetAlpha += Math.PI * 2;
        while (targetAlpha - currentAlpha > Math.PI) targetAlpha -= Math.PI * 2;

        const lerpFactor = 1.0 - Math.exp(-this.rotationLerpSpeed * 0.25 * dt); // Smooth return speed
        
        this.chaseCamera.alpha += (targetAlpha - this.chaseCamera.alpha) * lerpFactor;
        this.chaseCamera.beta += (targetBeta - this.chaseCamera.beta) * lerpFactor;
        this.chaseCamera.radius += (this.distanceBehind - this.chaseCamera.radius) * lerpFactor;
      }
    }

    // Dynamic FOV speed effect (kept minimal to avoid warping distance perception)
    const speedRatio = Math.min(Math.abs(kart.forwardSpeed) / (kart.tuning.maxForwardSpeed * kart.tuning.boostMultiplier), 1.0);
    const targetFov = 0.85 + speedRatio * 0.05;
    this.chaseCamera.fov += (targetFov - this.chaseCamera.fov) * dt * 4;
  }
}
