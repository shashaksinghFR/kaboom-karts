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

  // Close-up arcade chase camera parameters
  public distanceBehind: number = 4.8;  // Close to the car
  public heightAbove: number = 2.1;     // Lower, dynamic angle
  public lookAheadOffset: number = 3.2; // Forward perspective
  public positionLerpSpeed: number = 14.0;
  public rotationLerpSpeed: number = 14.0;

  private currentCameraPos: Vector3 = new Vector3(0, 3, -6);
  private currentLookTarget: Vector3 = new Vector3(0, 1, 0);

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

    // 2. Third-Person Chase Camera (close-up arcade view)
    this.chaseCamera = new UniversalCamera(
      "ChaseCamera",
      new Vector3(0, 3, -6),
      this.scene
    );
    this.chaseCamera.fov = 0.90;
    this.chaseCamera.minZ = 0.1;
    this.chaseCamera.maxZ = 400;

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
    const sinYaw = Math.sin(kart.yaw);
    const cosYaw = Math.cos(kart.yaw);

    // Position tightly behind kart based on heading
    const desiredPos = new Vector3(
      kart.position.x - sinYaw * this.distanceBehind,
      kart.position.y + this.heightAbove,
      kart.position.z - cosYaw * this.distanceBehind
    );

    // Look ahead target: slightly ahead of the kart in facing direction
    const desiredLookTarget = new Vector3(
      kart.position.x + sinYaw * this.lookAheadOffset,
      kart.position.y + 0.9,
      kart.position.z + cosYaw * this.lookAheadOffset
    );

    // Smooth interpolation (Lerp)
    const posLerpFactor = 1.0 - Math.exp(-this.positionLerpSpeed * dt);
    const targetLerpFactor = 1.0 - Math.exp(-this.rotationLerpSpeed * dt);

    this.currentCameraPos = Vector3.Lerp(this.currentCameraPos, desiredPos, posLerpFactor);
    this.currentLookTarget = Vector3.Lerp(this.currentLookTarget, desiredLookTarget, targetLerpFactor);

    this.chaseCamera.position.copyFrom(this.currentCameraPos);
    this.chaseCamera.setTarget(this.currentLookTarget);

    // Dynamic FOV speed effect
    const speedRatio = Math.min(Math.abs(kart.forwardSpeed) / (kart.tuning.maxForwardSpeed * kart.tuning.boostMultiplier), 1.0);
    const targetFov = 0.90 + speedRatio * 0.12;
    this.chaseCamera.fov += (targetFov - this.chaseCamera.fov) * dt * 6;
  }
}
