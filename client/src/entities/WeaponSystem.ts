import { Scene, Vector3 } from "@babylonjs/core";
import { Missile } from "./Missile";
import { ExplosionEffect } from "../effects/ExplosionEffect";
import { KartController } from "./KartController";

export class WeaponSystem {
  private scene: Scene;
  private missiles: Missile[] = [];
  private explosions: ExplosionEffect[] = [];

  // Weapon Tunables
  public cooldownDuration: number = 2.0; // 2.0 seconds cooldown as requested
  public cooldownTimer: number = 0;       // Seconds remaining until ready
  public missileSpeed: number = 90.0;     // Fast high-velocity rocket m/s

  constructor(scene: Scene, cooldownDuration: number = 2.0) {
    this.scene = scene;
    this.cooldownDuration = cooldownDuration;
    this.cooldownTimer = 0;
  }

  public getActiveMissileCount(): number {
    return this.missiles.length;
  }

  public update(
    deltaTime: number,
    fireRequested: boolean,
    kart: KartController
  ): void {
    // 1. Tick Cooldown Timer
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - deltaTime);
    }

    // 2. Handle Fire Input
    if (fireRequested && this.canFire()) {
      this.fireMissile(kart);
    }

    // 3. Update Active Missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const missile = this.missiles[i];
      missile.update(deltaTime, (impactPos: Vector3) => {
        this.spawnExplosion(impactPos);
      });

      if (missile.isDead) {
        this.missiles.splice(i, 1);
      }
    }

    // 4. Update Active Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      explosion.update(deltaTime);
      if (explosion.isFinished) {
        this.explosions.splice(i, 1);
      }
    }
  }

  public checkCollision(targetPosition: Vector3, radius: number): string | null {
    for (let i = 0; i < this.missiles.length; i++) {
      const missile = this.missiles[i];
      if (missile.isDead) continue;

      const dist = Vector3.Distance(missile.position, targetPosition);
      if (dist <= radius) {
        // Direct hit!
        const hitPos = missile.position.clone();
        missile.destroy();
        this.spawnExplosion(hitPos);
        this.missiles.splice(i, 1);
        return `hit_${Date.now()}`;
      }
    }
    return null;
  }

  public canFire(): boolean {
    return this.cooldownTimer <= 0;
  }

  public fireMissile(kart: KartController): void {
    if (!this.canFire()) return;

    // Trigger 3.0s cooldown
    this.cooldownTimer = this.cooldownDuration;

    // Calculate spawn position at the front hood of the car (+1.75m forward, +0.55m height)
    const sinYaw = Math.sin(kart.yaw);
    const cosYaw = Math.cos(kart.yaw);
    const forwardOffset = 1.75;
    const heightOffset = 0.55;

    const spawnPos = new Vector3(
      kart.position.x + sinYaw * forwardOffset,
      kart.position.y + heightOffset,
      kart.position.z + cosYaw * forwardOffset
    );

    // Instantiate missile
    const missile = new Missile(
      this.scene,
      spawnPos,
      kart.yaw,
      this.missileSpeed
    );
    this.missiles.push(missile);

    console.log(`🚀 Missile fired! Cooldown: ${this.cooldownDuration}s`);
  }

  public spawnExplosion(position: Vector3): void {
    const explosion = new ExplosionEffect(this.scene, position);
    this.explosions.push(explosion);
  }

  public getCooldownRemaining(): number {
    return Math.max(0, this.cooldownTimer);
  }

  public getCooldownProgress(): number {
    if (this.cooldownDuration <= 0) return 1.0;
    return 1.0 - this.cooldownTimer / this.cooldownDuration;
  }

  public isReady(): boolean {
    return this.cooldownTimer <= 0;
  }

  public dispose(): void {
    this.missiles.forEach((m) => m.destroy());
    this.explosions.forEach((e) => e.dispose());
    this.missiles = [];
    this.explosions = [];
  }
}
