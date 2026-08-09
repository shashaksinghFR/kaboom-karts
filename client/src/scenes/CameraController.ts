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

  // Close-up arcade chase camera parameters
  public distanceBehind: number = 4.8;  // Close to the car
  public heightAbove: number = 2.1;     // Lower, dynamic angle
  public lookAheadOffset: number = 3.2; // Forward perspective
  public rotationLerpSpeed: number = 14.0;

  private isFreeLooking: boolean = false;
  private freeLookTimer: number = 0;

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

    // 2. Third-Person Chase Camera (Free-Look enabled)
    this.chaseCamera = new ArcRotateCamera(
      "ChaseCamera",
      -Math.PI / 2, // alpha
      Math.PI / 3.2, // beta
      this.distanceBehind, // radius
      Vector3.Zero(),
      this.scene
    );
    this.chaseCamera.fov = 0.90;
    this.chaseCamera.minZ = 0.1;
    this.chaseCamera.maxZ = 400;
    this.chaseCamera.lowerRadiusLimit = 2.5;
    this.chaseCamera.upperRadiusLimit = 15.0;
    this.chaseCamera.lowerBetaLimit = 0.05;
    this.chaseCamera.upperBetaLimit = Math.PI / 1.8;
    this.chaseCamera.panningSensibility = 0; // Disable panning, only rotation

    // Setup free-look pointer detection
    this.scene.onPointerObservable.add((pi) => {
      if (this.currentMode === CameraMode.CHASE) {
        if (pi.type === 1) { // POINTERDOWN
          this.isFreeLooking = true;
          this.freeLookTimer = 0;
        } else if (pi.type === 2) { // POINTERUP
          this.isFreeLooking = false;
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
      this.chaseCamera.attachControl(this.canvas, true);
      this.scene.activeCamera = this.chaseCamera;
      this.isFreeLooking = false;
    } else {
      this.chaseCamera.detachControl();
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
      kart.position.y + 0.9,
      kart.position.z
    );
    this.chaseCamera.target = Vector3.Lerp(this.chaseCamera.target, targetLook, 1.0 - Math.exp(-this.rotationLerpSpeed * dt));

    // Auto-Return to default behind-car perspective if not free-looking
    if (!this.isFreeLooking) {
      this.freeLookTimer += dt;
      if (this.freeLookTimer > 0.4) { // Delay before snapping back
        let targetAlpha = -kart.yaw - Math.PI / 2;
        let targetBeta = Math.PI / 3.2;

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

    // Dynamic FOV speed effect
    const speedRatio = Math.min(Math.abs(kart.forwardSpeed) / (kart.tuning.maxForwardSpeed * kart.tuning.boostMultiplier), 1.0);
    const targetFov = 0.90 + speedRatio * 0.12;
    this.chaseCamera.fov += (targetFov - this.chaseCamera.fov) * dt * 6;
  }
}
