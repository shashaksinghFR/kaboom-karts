import { Vector3 } from "@babylonjs/core/Maths/math";
import { KartVisual } from "./KartVisual";
import { KartInputState } from "../input/InputManager";
import { SCENE_CONFIG } from "../config/constants";

export interface KartTuning {
  maxForwardSpeed: number;
  maxReverseSpeed: number;
  boostMultiplier: number;
  acceleration: number;
  deceleration: number;
  braking: number;
  turnRate: number;
  steeringSmoothing: number;
  driftTurnMultiplier: number;
  lateralFriction: number;
  driftLateralFriction: number;
  maxBankingRoll: number;
}

export const DEFAULT_KART_TUNING: KartTuning = {
  maxForwardSpeed: 28.0,       // ~100 km/h cruising speed
  maxReverseSpeed: 10.0,
  boostMultiplier: 1.4,        // ~140 km/h boost speed
  acceleration: 26.0,
  deceleration: 12.0,
  braking: 35.0,
  turnRate: 2.2,               // Smooth, responsive turn rate
  steeringSmoothing: 8.0,      // Fast & fluid steering interpolation
  driftTurnMultiplier: 1.55,
  lateralFriction: 0.86,       // Solid tire grip
  driftLateralFriction: 0.94,  // Controllable slide on drift
  maxBankingRoll: 0.20,        // Subtle natural roll
};

export interface RampZone {
  position: Vector3; // Center base
  yaw: number;       // Incline direction
  width: number;     // Width (X)
  length: number;    // Length (Z)
  height: number;    // Top height (Y)
}

export class KartController {
  public visual: KartVisual;
  public tuning: KartTuning;

  // Transform state
  public position: Vector3 = new Vector3(0, 0.5, 0);
  public yaw: number = 0; // Heading in radians

  // Velocity state
  public forwardSpeed: number = 0;
  public lateralVelocity: number = 0;
  public verticalVelocity: number = 0;
  public steerSmoothed: number = 0;
  public currentRoll: number = 0;
  public currentPitch: number = 0;
  public isDrifting: boolean = false;
  public isBoosting: boolean = false;
  public isAirborne: boolean = false;

  private arenaRadius: number;
  public static ramps: RampZone[] = [];

  constructor(visual: KartVisual, tuning: KartTuning = DEFAULT_KART_TUNING) {
    this.visual = visual;
    this.tuning = tuning;
    this.arenaRadius = (SCENE_CONFIG.DEFAULT_GROUND_SIZE * 0.95) / 2 - 2.5;
  }

  public update(deltaTime: number, input: KartInputState): void {
    const dt = Math.min(deltaTime, 0.05);

    if (input.resetKart) {
      this.resetToOrigin();
      return;
    }

    this.isDrifting = input.drift;
    this.isBoosting = input.boost && this.forwardSpeed > 2.0;

    const topSpeed = this.isBoosting
      ? this.tuning.maxForwardSpeed * this.tuning.boostMultiplier
      : this.tuning.maxForwardSpeed;

    const accelRate = this.isBoosting
      ? this.tuning.acceleration * 1.45
      : this.tuning.acceleration;

    // 1. Throttle / Acceleration & Braking (Ground or Air)
    if (input.throttle > 0) {
      if (this.forwardSpeed < 0) {
        this.forwardSpeed += this.tuning.braking * dt;
      } else {
        this.forwardSpeed = Math.min(topSpeed, this.forwardSpeed + accelRate * dt);
      }
    } else if (input.throttle < 0) {
      if (this.forwardSpeed > 0) {
        this.forwardSpeed = Math.max(-this.tuning.maxReverseSpeed, this.forwardSpeed - this.tuning.braking * dt);
      } else {
        this.forwardSpeed = Math.max(-this.tuning.maxReverseSpeed, this.forwardSpeed - (this.tuning.acceleration * 0.6) * dt);
      }
    } else {
      // Natural rolling friction
      if (this.forwardSpeed > 0) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - this.tuning.deceleration * dt);
      } else if (this.forwardSpeed < 0) {
        this.forwardSpeed = Math.min(0, this.forwardSpeed + this.tuning.deceleration * dt);
      }
    }

    // 2. Smooth Steering Input
    const targetSteer = input.steer;
    const steerLerpFactor = 1.0 - Math.exp(-this.tuning.steeringSmoothing * dt);
    this.steerSmoothed += (targetSteer - this.steerSmoothed) * steerLerpFactor;

    // Dynamic speed curve
    const speedRatio = Math.min(Math.abs(this.forwardSpeed) / (this.tuning.maxForwardSpeed * 0.4), 1.0);
    const speedDamping = 0.3 + speedRatio * 0.7;
    const reverseSign = this.forwardSpeed < -0.1 ? -1 : 1;

    let effectiveTurnRate = this.tuning.turnRate * speedDamping * reverseSign;
    if (this.isDrifting) {
      effectiveTurnRate *= this.tuning.driftTurnMultiplier;
    }

    if (Math.abs(this.steerSmoothed) > 0.005) {
      this.yaw += this.steerSmoothed * effectiveTurnRate * dt;

      // Impart lateral drift velocity
      if (this.isDrifting && Math.abs(this.forwardSpeed) > 4.0 && !this.isAirborne) {
        this.lateralVelocity += this.steerSmoothed * this.forwardSpeed * 0.38 * dt;
      }
    }

    // 3. Lateral Friction Damping
    const lateralDamping = this.isDrifting
      ? Math.pow(this.tuning.driftLateralFriction, dt * 60)
      : Math.pow(this.tuning.lateralFriction, dt * 60);
    this.lateralVelocity *= lateralDamping;

    // 4. World Position Movement (XZ)
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const forwardMovementX = sinYaw * this.forwardSpeed * dt;
    const forwardMovementZ = cosYaw * this.forwardSpeed * dt;

    const lateralMovementX = cosYaw * this.lateralVelocity * dt;
    const lateralMovementZ = -sinYaw * this.lateralVelocity * dt;

    this.position.x += forwardMovementX + lateralMovementX;
    this.position.z += forwardMovementZ + lateralMovementZ;

    // 5. Ramp Surface & Vertical Jump Physics
    this.processRampAndGravity(dt);

    // 6. Arena Boundary Elastic Containment
    const distFromOrigin = Math.sqrt(this.position.x * this.position.x + this.position.z * this.position.z);
    if (distFromOrigin > this.arenaRadius) {
      const nx = -this.position.x / distFromOrigin;
      const nz = -this.position.z / distFromOrigin;

      this.position.x = -nx * this.arenaRadius;
      this.position.z = -nz * this.arenaRadius;

      this.forwardSpeed *= -0.35;
      this.lateralVelocity *= -0.35;
    }

    // 7. Visual Tilts (Banking Roll & Acceleration Pitch)
    const targetRoll = -this.steerSmoothed * Math.min(Math.abs(this.forwardSpeed) / this.tuning.maxForwardSpeed, 1.0) * this.tuning.maxBankingRoll;
    this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1.0, dt * 8);

    if (!this.isAirborne) {
      let targetPitch = 0;
      if (input.throttle > 0 && this.forwardSpeed > 0) targetPitch = -0.04;
      else if (input.throttle < 0 && this.forwardSpeed > 0) targetPitch = 0.06;
      this.currentPitch += (targetPitch - this.currentPitch) * Math.min(1.0, dt * 8);
    }

    // Synchronize Visual Transforms
    this.visual.rootNode.position.copyFrom(this.position);
    this.visual.rootNode.rotation.y = this.yaw;

    this.visual.setVisualTilts(this.currentRoll, this.currentPitch, !this.isAirborne);
    this.visual.setSteeringVisual(this.steerSmoothed * 0.35);
    this.visual.setWheelSpin(this.forwardSpeed);
    this.visual.update(dt, this.getSpeedKph());
  }

  private processRampAndGravity(dt: number): void {
    const baseHeight = this.visual.baseHoverHeight; // 0.5m
    let onRamp = false;

    // Check ramp interactions
    for (const ramp of KartController.ramps) {
      // Transform local position relative to ramp center
      const dx = this.position.x - ramp.position.x;
      const dz = this.position.z - ramp.position.z;
      const cosRamp = Math.cos(-ramp.yaw);
      const sinRamp = Math.sin(-ramp.yaw);

      const localX = cosRamp * dx - sinRamp * dz;
      const localZ = sinRamp * dx + cosRamp * dz;

      const halfW = ramp.width / 2 + 0.3;
      const halfL = ramp.length / 2;

      // Inside ramp bounding footprint
      if (Math.abs(localX) <= halfW && localZ >= -halfL && localZ <= halfL + 1.0) {
        const progress = Math.max(0, Math.min(1.0, (localZ + halfL) / ramp.length));
        const rampSurfaceY = baseHeight + progress * ramp.height;

        if (this.position.y <= rampSurfaceY + 0.6) {
          onRamp = true;
          this.position.y = rampSurfaceY;
          this.isAirborne = false;
          this.verticalVelocity = 0;

          // Align kart pitch with ramp incline slope
          const inclineAngle = -Math.atan2(ramp.height, ramp.length);
          this.currentPitch = inclineAngle * 0.9;

          // Launch off the top crest at speed!
          if (progress >= 0.96 && this.forwardSpeed > 4.0) {
            this.isAirborne = true;
            this.verticalVelocity = Math.max(7.5, this.forwardSpeed * 0.48);
          }
          break;
        }
      }
    }

    // Free Air-time Gravity & Landing Physics
    if (!onRamp) {
      if (this.isAirborne || this.position.y > baseHeight + 0.05) {
        this.isAirborne = true;
        this.verticalVelocity -= 26.0 * dt; // Gravity
        this.position.y += this.verticalVelocity * dt;

        // Level out pitch gradually while flying
        this.currentPitch += (0 - this.currentPitch) * Math.min(1.0, dt * 3.5);

        // Ground landing check
        if (this.position.y <= baseHeight) {
          this.position.y = baseHeight;
          this.verticalVelocity = 0;
          this.isAirborne = false;
        }
      } else {
        this.position.y = baseHeight;
        this.isAirborne = false;
        this.verticalVelocity = 0;
      }
    }
  }

  public getSpeedKph(): number {
    return Math.round(Math.abs(this.forwardSpeed) * 3.6);
  }

  public resetToOrigin(): void {
    this.position.set(0, this.visual.baseHoverHeight, 0);
    this.forwardSpeed = 0;
    this.lateralVelocity = 0;
    this.verticalVelocity = 0;
    this.steerSmoothed = 0;
    this.yaw = 0;
    this.currentRoll = 0;
    this.currentPitch = 0;
    this.isAirborne = false;
    this.visual.rootNode.position.copyFrom(this.position);
    this.visual.rootNode.rotation.y = this.yaw;
  }
}
