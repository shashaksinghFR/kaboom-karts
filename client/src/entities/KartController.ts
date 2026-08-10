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
  maxForwardSpeed: 26.0,       // Reduced slightly for better control (~94 km/h)
  maxReverseSpeed: 10.0,
  boostMultiplier: 1.35,       // ~127 km/h boosted speed
  acceleration: 30.0,          // Responsive, smooth acceleration
  deceleration: 14.0,          // Natural rolling friction
  braking: 45.0,               // High-response braking
  turnRate: 1.7,               // Reduced sensitivity as requested
  steeringSmoothing: 12.0,     // Direct zero-lag steering response
  driftTurnMultiplier: 1.60,   // Power-slide rotation
  lateralFriction: 0.86,       // Solid high-speed asphalt grip
  driftLateralFriction: 0.93,  // Smooth lateral drift slide
  maxBankingRoll: 0.20,        // Dynamic chassis lean
};

export class KartController {
  public visual: KartVisual;
  public tuning: KartTuning;

  // Transform state
  public position: Vector3 = new Vector3(0, 0.5, 0);
  public yaw: number = 0; // Heading in radians

  // Velocity state
  public forwardSpeed: number = 0;
  public lateralVelocity: number = 0;
  public verticalVelocity: number = 0; // Added for gravity
  public steerSmoothed: number = 0;
  public currentRoll: number = 0;
  public currentPitch: number = 0;
  public isDrifting: boolean = false;
  public isBoosting: boolean = false;

  // Boost Energy System (2s duration max, 10s full refill)
  public readonly maxBoostDuration: number = 2.0;
  public boostRemaining: number = 2.0;
  public readonly boostRechargeTime: number = 10.0;

  constructor(visual: KartVisual, tuning: KartTuning = DEFAULT_KART_TUNING) {
    this.visual = visual;
    this.tuning = tuning;
  }

  public getBoostRatio(): number {
    return Math.max(0, Math.min(1.0, this.boostRemaining / this.maxBoostDuration));
  }

  public update(deltaTime: number, input: KartInputState): void {
    const dt = Math.min(deltaTime, 0.05);

    if (input.resetKart) {
      this.resetToOrigin();
      return;
    }

    this.isDrifting = input.drift;

    // Boost uses 2-second tank, refilling in 10 seconds
    const wantsBoost = input.boost && this.forwardSpeed > 1.5 && this.boostRemaining > 0.05;
    if (wantsBoost) {
      this.isBoosting = true;
      this.boostRemaining = Math.max(0, this.boostRemaining - dt);
    } else {
      this.isBoosting = false;
      // Refill 2 seconds of boost over 10 seconds (0.2s per second)
      this.boostRemaining = Math.min(
        this.maxBoostDuration,
        this.boostRemaining + (this.maxBoostDuration / this.boostRechargeTime) * dt
      );
    }

    const topSpeed = this.isBoosting
      ? this.tuning.maxForwardSpeed * this.tuning.boostMultiplier
      : this.tuning.maxForwardSpeed;

    const accelRate = this.isBoosting
      ? this.tuning.acceleration * 1.4
      : this.tuning.acceleration;

    // 1. Throttle / Acceleration & Braking
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
      if (this.isDrifting && Math.abs(this.forwardSpeed) > 4.0) {
        this.lateralVelocity += this.steerSmoothed * this.forwardSpeed * 0.38 * dt;
      }
    }

    // 3. Lateral Friction Damping
    const lateralDamping = this.isDrifting
      ? Math.pow(this.tuning.driftLateralFriction, dt * 60)
      : Math.pow(this.tuning.lateralFriction, dt * 60);
    this.lateralVelocity *= lateralDamping;

    // 4. World Position Movement & 3D Collisions
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    const forwardMovementX = sinYaw * this.forwardSpeed * dt;
    const forwardMovementZ = cosYaw * this.forwardSpeed * dt;

    const lateralMovementX = cosYaw * this.lateralVelocity * dt;
    const lateralMovementZ = -sinYaw * this.lateralVelocity * dt;

    // Apply gravity
    this.verticalVelocity -= 25.0 * dt; // Strong gravity to stick to slopes
    
    // Max fall speed terminal velocity
    if (this.verticalVelocity < -40) this.verticalVelocity = -40;

    const verticalMovementY = this.verticalVelocity * dt;

    const movementVector = new Vector3(
      forwardMovementX + lateralMovementX,
      verticalMovementY,
      forwardMovementZ + lateralMovementZ
    );

    const oldY = this.visual.rootNode.position.y;
    
    // Core BabylonJS collision integration
    this.visual.rootNode.moveWithCollisions(movementVector);
    
    const newY = this.visual.rootNode.position.y;

    // Detect if we hit the ground (if our actual Y is higher than our expected free-fall Y)
    if (newY > oldY + verticalMovementY + 0.001) {
      this.verticalVelocity = 0; // Grounded
    }

    // Sync logic position to the physics-resolved position
    this.position.copyFrom(this.visual.rootNode.position);

    // 6. Visual Tilts (Banking Roll & Acceleration Pitch)
    const targetRoll = -this.steerSmoothed * Math.min(Math.abs(this.forwardSpeed) / this.tuning.maxForwardSpeed, 1.0) * this.tuning.maxBankingRoll;
    this.currentRoll += (targetRoll - this.currentRoll) * Math.min(1.0, dt * 8);

    let targetPitch = 0;
    if (input.throttle > 0 && this.forwardSpeed > 0) targetPitch = -0.04;
    else if (input.throttle < 0 && this.forwardSpeed > 0) targetPitch = 0.06;
    this.currentPitch += (targetPitch - this.currentPitch) * Math.min(1.0, dt * 8);

    // Synchronize Visual Transforms
    this.visual.rootNode.position.copyFrom(this.position);
    this.visual.rootNode.rotation.y = this.yaw;

    this.visual.setVisualTilts(this.currentRoll, this.currentPitch, true);
    this.visual.setSteeringVisual(this.steerSmoothed * 0.35);
    this.visual.setWheelSpin(this.forwardSpeed);
    this.visual.update(dt, this.getSpeedKph());
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
    this.visual.rootNode.position.copyFrom(this.position);
    this.visual.rootNode.rotation.y = this.yaw;
  }
}
