import { Scene, ShadowGenerator, Vector3 } from "@babylonjs/core";
import { RemoteKartVisual } from "./RemoteKartVisual";
import { Missile } from "./Missile";
import { ExplosionEffect } from "../effects/ExplosionEffect";

export class RemoteKartManager {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator | null = null;
  private remoteKarts: Map<string, RemoteKartVisual> = new Map();
  private remoteMissiles: Map<string, Missile> = new Map();
  private remoteExplosions: ExplosionEffect[] = [];

  constructor(scene: Scene, shadowGenerator?: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator || null;
  }

  public syncPlayers(playersMap: any, localSessionId: string): void {
    const activeSessionIds = new Set<string>();

    playersMap.forEach((player: any, sessionId: string) => {
      // Skip local player
      if (sessionId === localSessionId) return;

      activeSessionIds.add(sessionId);

      const chosenModelIndex = player.kartModelIndex ?? player.slotIndex ?? 0;

      let remoteKart = this.remoteKarts.get(sessionId);
      if (!remoteKart) {
        // Spawn new remote opponent
        remoteKart = new RemoteKartVisual(
          this.scene,
          player.name || "Opponent",
          player.colorIndex ?? 0,
          chosenModelIndex,
          player.isHost || false,
          this.shadowGenerator || undefined,
          player.team
        );
        this.remoteKarts.set(sessionId, remoteKart);
        console.log(`🏎️ Spawned remote opponent: ${player.name} (${sessionId}) - Model #${chosenModelIndex + 1} - Team: ${player.team || "FFA"}`);
      } else {
        // If player swapped their locked-in vehicle in lobby, update their 3D model
        if (remoteKart.modelIndex !== chosenModelIndex) {
          remoteKart.loadKartModel(chosenModelIndex);
        }
        if (remoteKart.colorIndex !== player.colorIndex || remoteKart.team !== player.team) {
          remoteKart.setPlayerColor(player.colorIndex ?? 0, player.team);
        }
      }

      // Update target transforms and live speed
      remoteKart.targetPosition.set(player.x, player.y, player.z);
      remoteKart.targetYaw = player.yaw;
      remoteKart.targetPitch = player.pitch;
      remoteKart.targetRoll = player.roll;
      remoteKart.speedKph = player.speedKph || 0;
      remoteKart.setHealth(player.health);
    });

    // Remove departed players
    this.remoteKarts.forEach((remoteKart, sessionId) => {
      if (!activeSessionIds.has(sessionId)) {
        console.log(`🚪 Disposing remote kart: ${remoteKart.playerName}`);
        remoteKart.dispose();
        this.remoteKarts.delete(sessionId);
      }
    });
  }

  public handleMissileFired(data: {
    id: string;
    ownerSessionId: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
  }, localSessionId: string): void {
    // Only spawn visual missile if fired by another player
    if (data.ownerSessionId !== localSessionId) {
      const missile = new Missile(
        this.scene,
        new Vector3(data.x, data.y, data.z),
        data.yaw,
        data.speed || 55
      );
      this.remoteMissiles.set(data.id, missile);
    }
  }

  public handleMissileExploded(data: {
    missileId?: string;
    x: number;
    y: number;
    z: number;
  }): void {
    if (data.missileId && this.remoteMissiles.has(data.missileId)) {
      const missile = this.remoteMissiles.get(data.missileId);
      missile?.destroy();
      this.remoteMissiles.delete(data.missileId);
    }

    const explosion = new ExplosionEffect(
      this.scene,
      new Vector3(data.x, data.y, data.z)
    );
    this.remoteExplosions.push(explosion);
  }

  public update(deltaTime: number): void {
    // Update remote opponent interpolations & trails
    this.remoteKarts.forEach((kart) => kart.update(deltaTime));

    // Update remote missiles
    this.remoteMissiles.forEach((missile, id) => {
      missile.update(deltaTime, (impactPos) => {
        const explosion = new ExplosionEffect(this.scene, impactPos);
        this.remoteExplosions.push(explosion);
      });
      if (missile.isDead) {
        this.remoteMissiles.delete(id);
      }
    });

    // Update remote explosions
    for (let i = this.remoteExplosions.length - 1; i >= 0; i--) {
      const exp = this.remoteExplosions[i];
      exp.update(deltaTime);
      if (exp.isFinished) {
        this.remoteExplosions.splice(i, 1);
      }
    }
  }

  public getOpponentHitTargets(): { sessionId: string; position: Vector3; radius: number }[] {
    const targets: { sessionId: string; position: Vector3; radius: number }[] = [];
    this.remoteKarts.forEach((kart, sessionId) => {
      targets.push({
        sessionId,
        position: kart.rootNode.position,
        radius: 1.8,
      });
    });
    return targets;
  }

  public getOpponentColliders(): { sessionId: string; position: Vector3; radius: number }[] {
    const colliders: { sessionId: string; position: Vector3; radius: number }[] = [];
    this.remoteKarts.forEach((kart, sessionId) => {
      colliders.push({
        sessionId,
        position: kart.rootNode.position,
        radius: 1.45,
      });
    });
    return colliders;
  }

  public dispose(): void {
    this.remoteKarts.forEach((k) => k.dispose());
    this.remoteMissiles.forEach((m) => m.destroy());
    this.remoteExplosions.forEach((e) => e.dispose());
    this.remoteKarts.clear();
    this.remoteMissiles.clear();
    this.remoteExplosions = [];
  }
}
