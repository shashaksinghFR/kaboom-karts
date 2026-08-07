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
  private chaseCamera: UniversalCamera;
  private currentMode: CameraMode = CameraMode.CHASE;

  // Chase camera parameters
  public distanceBehind: number = 7.5;
  public heightAbove: number = 3.2;
  public lookAheadOffset: number = 2.0;
  public positionLerpSpeed: number = 10.0;
  public rotationLerpSpeed: number = 12.0;

  private currentCameraPos: Vector3 = new Vector3(0, 5, -10);
  private currentLookTarget: Vector3 = new Vector3(0, 1, 0);

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    // 1. Orbit Camera (for inspecting the car and 360 overview)
    this.orbitCamera = new ArcRotateCamera(
      "OrbitCamera",
      CAMERA_CONFIG.ALPHA,
      CAMERA_CONFIG.BETA,
      CAMERA_CONFIG.RADIUS,
      CAMERA_CONFIG.TARGET,
      this.scene
    );
    this.orbitCamera.lowerRadiusLimit = CAMERA_CONFIG.LOWER_RADIUS_LIMIT;
    this.orbitCamera.upperRadiusLimit = CAMERA_CONFIG.UPPER_RADIUS_LIMIT;
    this.orbitCamera.lowerBetaLimit = CAMERA_CONFIG.LOWER_BETA_LIMIT;
    this.orbitCamera.upperBetaLimit = CAMERA_CONFIG.UPPER_BETA_LIMIT;

    // 2. Third-Person Chase Camera (for high-speed arcade driving)
    this.chaseCamera = new UniversalCamera(
      "ChaseCamera",
      new Vector3(0, 5, -10),
      this.scene
    );
    this.chaseCamera.fov = 0.85;
    this.chaseCamera.minZ = 0.1;
    this.chaseCamera.maxZ = 300;

    // Default to Chase Camera
    this.setMode(CameraMode.CHASE);
  }

  public setMode(mode: CameraMode): void {
    this.currentMode = mode;
    if (mode === CameraMode.CHASE) {
      this.orbitCamera.detachControl();
      this.scene.activeCamera = this.chaseCamera;
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
    // Compute target position behind kart based on kart's yaw
    const sinYaw = Math.sin(kart.yaw);
    const cosYaw = Math.cos(kart.yaw);

    // Behind vector = (-sinYaw, 0, -cosYaw)
    const desiredPos = new Vector3(
      kart.position.x - sinYaw * this.distanceBehind,
      kart.position.y + this.heightAbove,
      kart.position.z - cosYaw * this.distanceBehind
    );

    // Look ahead target: slightly ahead of the kart in facing direction
    const desiredLookTarget = new Vector3(
      kart.position.x + sinYaw * this.lookAheadOffset,
      kart.position.y + 1.2,
      kart.position.z + cosYaw * this.lookAheadOffset
    );

    // Smooth interpolation (Lerp)
    const posLerpFactor = 1.0 - Math.exp(-this.positionLerpSpeed * dt);
    const targetLerpFactor = 1.0 - Math.exp(-this.rotationLerpSpeed * dt);

    this.currentCameraPos = Vector3.Lerp(this.currentCameraPos, desiredPos, posLerpFactor);
    this.currentLookTarget = Vector3.Lerp(this.currentLookTarget, desiredLookTarget, targetLerpFactor);

    this.chaseCamera.position.copyFrom(this.currentCameraPos);
    this.chaseCamera.setTarget(this.currentLookTarget);

    // Dynamic FOV speed effect (widescreen high-speed rush)
    const speedRatio = Math.min(Math.abs(kart.forwardSpeed) / (kart.tuning.maxForwardSpeed * kart.tuning.boostMultiplier), 1.0);
    const targetFov = 0.85 + speedRatio * 0.15;
    this.chaseCamera.fov += (targetFov - this.chaseCamera.fov) * dt * 5;
  }
}
