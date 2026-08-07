import { Room, Client } from "colyseus";
import { KartRoomState, KartPlayerState, NetworkMissileState } from "./state.js";
import { createCode, registerCode, releaseCode } from "./roomCodes.js";

export class KartRoom extends Room<KartRoomState> {
  maxClients = 10;
  private autoCountdownInterval: any = null;

  onCreate(options: { roomCode?: string; code?: string; isPrivate?: boolean }) {
    this.setState(new KartRoomState());

    // Generate or use assigned 4-6 char room code
    const code = (options.roomCode || options.code || createCode()).toUpperCase();
    this.state.roomCode = code;
    this.setMetadata({ roomCode: code });
    registerCode(code, this.roomId);

    console.log(`🏁 KartRoom created [${this.roomId}] with Room Code: ${code}`);

    // Register Message Handlers
    this.onMessage("toggleReady", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.matchPhase === "lobby") {
        player.isReady = !player.isReady;
        console.log(`Player ${player.name} (${client.sessionId}) ready: ${player.isReady}`);
      }
    });

    this.onMessage("startGame", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player?.isHost && this.state.matchPhase === "lobby") {
        if (this.state.players.size >= this.state.minPlayers) {
          this.startCountdown();
        } else {
          client.send("error", { message: `Need at least ${this.state.minPlayers} players to start.` });
        }
      }
    });

    this.onMessage("playerTransform", (client, data: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      roll: number;
      steerVisual: number;
      speedKph: number;
      isDrifting: boolean;
      isBoosting: boolean;
    }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.eliminated) {
        player.x = data.x;
        player.y = data.y;
        player.z = data.z;
        player.yaw = data.yaw;
        player.pitch = data.pitch;
        player.roll = data.roll;
        player.steerVisual = data.steerVisual;
        player.speedKph = data.speedKph;
        player.isDrifting = data.isDrifting;
        player.isBoosting = data.isBoosting;
      }
    });

    this.onMessage("fireMissile", (client, data: {
      id: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      speed: number;
    }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.eliminated && this.state.matchPhase === "playing") {
        const missile = new NetworkMissileState();
        missile.id = data.id || `${client.sessionId}_${Date.now()}`;
        missile.ownerSessionId = client.sessionId;
        missile.x = data.x;
        missile.y = data.y;
        missile.z = data.z;
        missile.yaw = data.yaw;
        missile.speed = data.speed || 55;
        missile.createdAt = Date.now();

        this.state.missiles.set(missile.id, missile);

        // Broadcast missile spawn event with owner info
        this.broadcast("missileFired", {
          id: missile.id,
          ownerSessionId: client.sessionId,
          x: missile.x,
          y: missile.y,
          z: missile.z,
          yaw: missile.yaw,
          speed: missile.speed,
        });
      }
    });

    this.onMessage("missileHit", (client, data: {
      missileId: string;
      targetSessionId?: string;
      impactX: number;
      impactY: number;
      impactZ: number;
    }) => {
      // Remove missile from active state
      if (data.missileId) {
        this.state.missiles.delete(data.missileId);
      }

      // Broadcast explosion effect to all clients
      this.broadcast("missileExploded", {
        missileId: data.missileId,
        x: data.impactX,
        y: data.impactY,
        z: data.impactZ,
      });

      // Apply damage if hit an opponent
      if (data.targetSessionId && this.state.matchPhase === "playing") {
        const target = this.state.players.get(data.targetSessionId);
        const shooter = this.state.players.get(client.sessionId);

        if (target && !target.eliminated) {
          target.health = Math.max(0, target.health - 35);
          console.log(`💥 ${target.name} hit by ${shooter?.name || "missile"}! Health: ${target.health}`);

          if (target.health <= 0) {
            target.eliminated = true;
            if (shooter && shooter !== target) {
              shooter.score += 1;
            }
            this.broadcast("playerEliminated", {
              eliminatedId: target.id,
              eliminatedName: target.name,
              killerId: shooter?.id,
              killerName: shooter?.name,
            });

            this.checkVictoryCondition();
          }
        }
      }
    });

    this.onMessage("rematch", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player?.isHost && this.state.matchPhase === "gameover") {
        this.resetToLobby();
      }
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const existingSlots = new Set<number>();
    this.state.players.forEach((p) => existingSlots.add(p.slotIndex));

    // Find first available slot (0 to 9)
    let slotIndex = 0;
    for (let i = 0; i < this.maxClients; i++) {
      if (!existingSlots.has(i)) {
        slotIndex = i;
        break;
      }
    }

    const isHost = this.state.players.size === 0;
    const player = new KartPlayerState();
    player.id = client.sessionId;
    player.name = (options.name?.trim() || `Racer ${slotIndex + 1}`).substring(0, 16);
    player.slotIndex = slotIndex;
    player.colorIndex = slotIndex; // 1-to-1 matching distinct color
    player.isHost = isHost;
    player.isReady = isHost; // Host is auto-ready

    // Calculate circular spawn position (radius 22m)
    const angle = (slotIndex / this.maxClients) * Math.PI * 2;
    player.x = Math.sin(angle) * 22;
    player.y = 0.5;
    player.z = Math.cos(angle) * 22;
    player.yaw = angle + Math.PI; // Face inwards towards center

    this.state.players.set(client.sessionId, player);

    console.log(`👤 ${player.name} joined room ${this.state.roomCode} (Slot ${slotIndex + 1}, Host: ${isHost})`);
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const wasHost = player?.isHost;
    this.state.players.delete(client.sessionId);

    console.log(`🚪 ${player?.name || client.sessionId} left room ${this.state.roomCode}`);

    // If host left, reassign host to the next remaining player
    if (wasHost && this.state.players.size > 0) {
      const nextPlayer = this.state.players.values().next().value;
      if (nextPlayer) {
        nextPlayer.isHost = true;
        nextPlayer.isReady = true;
        console.log(`👑 New host assigned: ${nextPlayer.name}`);
      }
    }

    if (this.state.matchPhase === "playing") {
      this.checkVictoryCondition();
    }
  }

  onDispose() {
    releaseCode(this.state.roomCode);
    if (this.autoCountdownInterval) {
      clearInterval(this.autoCountdownInterval);
    }
    console.log(`🧹 KartRoom [${this.roomId}] disposed`);
  }

  private startCountdown() {
    this.state.matchPhase = "countdown";
    this.state.countdownTimer = 5;

    // Reset health & spawns
    this.state.players.forEach((p) => {
      p.health = 100;
      p.eliminated = false;
      const angle = (p.slotIndex / this.maxClients) * Math.PI * 2;
      p.x = Math.sin(angle) * 22;
      p.y = 0.5;
      p.z = Math.cos(angle) * 22;
      p.yaw = angle + Math.PI;
    });

    this.autoCountdownInterval = setInterval(() => {
      this.state.countdownTimer -= 1;
      if (this.state.countdownTimer <= 0) {
        clearInterval(this.autoCountdownInterval);
        this.state.matchPhase = "playing";
        this.state.roundTimer = 180;
        console.log(`🚀 Match started in room ${this.state.roomCode}!`);
      }
    }, 1000);
  }

  private checkVictoryCondition() {
    const activePlayers: KartPlayerState[] = [];
    this.state.players.forEach((p) => {
      if (!p.eliminated) {
        activePlayers.push(p);
      }
    });

    if (activePlayers.length <= 1 && this.state.players.size >= 2) {
      const winner = activePlayers[0];
      this.state.matchPhase = "gameover";
      this.state.winnerId = winner?.id || "";
      this.state.winnerName = winner?.name || "No Winner";
      console.log(`🏆 Match Over! Winner: ${this.state.winnerName}`);
    }
  }

  private resetToLobby() {
    this.state.matchPhase = "lobby";
    this.state.winnerId = "";
    this.state.winnerName = "";
    this.state.missiles.clear();
    this.state.players.forEach((p) => {
      p.isReady = p.isHost;
      p.health = 100;
      p.eliminated = false;
    });
    console.log(`🔄 Room ${this.state.roomCode} reset to lobby`);
  }
}
