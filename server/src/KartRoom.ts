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

    this.onMessage("setGameMode", (client, data: { gameMode: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (player?.isHost && this.state.matchPhase === "lobby") {
        const mode = data.gameMode === "team" ? "team" : "ffa";
        this.state.gameMode = mode;
        this.updatePlayerTeams();
        console.log(`🎮 Room ${this.state.roomCode} game mode set to: ${mode.toUpperCase()}`);
      }
    });

    this.onMessage("selectKart", (client, data: { kartModelIndex: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.matchPhase === "lobby") {
        const requestedIdx = Math.max(0, Math.min(9, Math.floor(data.kartModelIndex)));
        
        // Enforce exclusive kart locking: check if another racer already locked in this kart
        let isTakenByOther = false;
        let takenByName = "";
        this.state.players.forEach((otherPlayer, otherSessionId) => {
          if (otherSessionId !== client.sessionId && otherPlayer.kartModelIndex === requestedIdx) {
            isTakenByOther = true;
            takenByName = otherPlayer.name;
          }
        });

        if (isTakenByOther) {
          client.send("error", { message: `This kart is already locked in by ${takenByName}! Please select a different kart.` });
        } else {
          player.kartModelIndex = requestedIdx;
          console.log(`🏎️ ${player.name} (${client.sessionId}) locked in Kart Model #${requestedIdx + 1}`);
        }
      }
    });

    this.onMessage("switchSlot", (client, data: { targetSlotIndex: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && this.state.matchPhase === "lobby") {
        const targetSlot = Math.max(0, Math.min(9, Math.floor(data.targetSlotIndex)));

        // Check if target slot is occupied by another racer
        let isOccupied = false;
        let occupiedByName = "";
        this.state.players.forEach((otherPlayer, otherSessionId) => {
          if (otherSessionId !== client.sessionId && otherPlayer.slotIndex === targetSlot) {
            isOccupied = true;
            occupiedByName = otherPlayer.name;
          }
        });

        if (isOccupied) {
          client.send("error", { message: `Slot ${targetSlot + 1} is already occupied by ${occupiedByName}.` });
        } else {
          player.slotIndex = targetSlot;
          if (this.state.gameMode === "team") {
            player.team = targetSlot < 5 ? "blue" : "red";
            player.colorIndex = player.team === "blue" ? 0 : 5;
          } else {
            player.team = "none";
            player.colorIndex = targetSlot;
          }
          console.log(`🔀 ${player.name} (${client.sessionId}) switched to Slot #${targetSlot + 1} (Team: ${player.team})`);
        }
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

        // Friendly Fire Immunity check in 5v5 Team Battle mode
        if (this.state.gameMode === "team" && shooter && target) {
          if (shooter.team === target.team && shooter.team !== "none") {
            console.log(`🛡️ Friendly fire blocked between teammates: ${shooter.name} (${shooter.team}) -> ${target.name}`);
            return;
          }
        }

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

  private updatePlayerTeams() {
    this.state.players.forEach((p) => {
      if (this.state.gameMode === "team") {
        p.team = p.slotIndex < 5 ? "blue" : "red";
        // Slot 0-4 get Blue trail (index 0 / cyan), Slot 5-9 get Red trail (index 5 / red)
        p.colorIndex = p.team === "blue" ? 0 : 5;
      } else {
        p.team = "none";
        p.colorIndex = p.slotIndex;
      }
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const existingSlots = new Set<number>();
    const existingKarts = new Set<number>();
    this.state.players.forEach((p) => {
      existingSlots.add(p.slotIndex);
      existingKarts.add(p.kartModelIndex);
    });

    // Find first available slot (0 to 9)
    let slotIndex = 0;
    for (let i = 0; i < this.maxClients; i++) {
      if (!existingSlots.has(i)) {
        slotIndex = i;
        break;
      }
    }

    // Find first available free kart model (0 to 9)
    let kartModelIndex = slotIndex;
    for (let i = 0; i < this.maxClients; i++) {
      if (!existingKarts.has(i)) {
        kartModelIndex = i;
        break;
      }
    }

    const isHost = this.state.players.size === 0;
    const player = new KartPlayerState();
    player.id = client.sessionId;
    player.name = (options.name?.trim() || `Racer ${slotIndex + 1}`).substring(0, 16);
    player.slotIndex = slotIndex;
    player.kartModelIndex = kartModelIndex;
    player.isHost = isHost;
    player.isReady = isHost; // Host is auto-ready

    if (this.state.gameMode === "team") {
      player.team = slotIndex < 5 ? "blue" : "red";
      player.colorIndex = player.team === "blue" ? 0 : 5;
    } else {
      player.team = "none";
      player.colorIndex = slotIndex;
    }

    // Calculate initial spawn position (Opposite ends of the arena like football goalposts)
    const isSideA = slotIndex % 2 === 0;
    const sideIdx = Math.floor(slotIndex / 2); // 0, 1, 2, 3, 4 per side

    if (this.state.gameMode === "team") {
      const isBlue = slotIndex < 5;
      const teamIdx = isBlue ? slotIndex : slotIndex - 5;
      player.x = isBlue ? -110 : 110; // Opposite ends on X axis
      player.y = 15.0;
      player.z = (teamIdx - 2) * 12; // Spread along Z axis
      player.yaw = isBlue ? Math.PI / 2 : -Math.PI / 2; // Face the center
    } else {
      // FFA: Half on one end, half on the other end, facing center
      player.x = isSideA ? -110 : 110;
      player.y = 15.0;
      player.z = (sideIdx - 2) * 15; // Spread along Z axis
      player.yaw = isSideA ? Math.PI / 2 : -Math.PI / 2; // Face the center
    }

    this.state.players.set(client.sessionId, player);

    console.log(`👤 ${player.name} joined room ${this.state.roomCode} (Slot ${slotIndex + 1}, Team: ${player.team}, Host: ${isHost}, Model #${player.kartModelIndex + 1})`);
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

    // Reset health & Spawns
    this.state.players.forEach((p) => {
      p.health = 100;
      p.eliminated = false;
      const isSideA = p.slotIndex % 2 === 0;
      const sideIdx = Math.floor(p.slotIndex / 2);

      if (this.state.gameMode === "team") {
        const isBlue = p.slotIndex < 5;
        const teamIdx = isBlue ? p.slotIndex : p.slotIndex - 5;
        p.x = isBlue ? -110 : 110; // Opposite ends on X axis
        p.y = 15.0;
        p.z = (teamIdx - 2) * 12; // Spread along Z axis
        p.yaw = isBlue ? Math.PI / 2 : -Math.PI / 2; // Face the center
      } else {
        // FFA: Half on one end, half on the other end, facing center
        p.x = isSideA ? -110 : 110;
        p.y = 15.0;
        p.z = (sideIdx - 2) * 15; // Spread along Z axis
        p.yaw = isSideA ? Math.PI / 2 : -Math.PI / 2; // Face the center
      }
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
    if (this.state.gameMode === "team") {
      let blueAlive = 0;
      let redAlive = 0;
      let blueTotal = 0;
      let redTotal = 0;

      this.state.players.forEach((p) => {
        if (p.slotIndex < 5) {
          blueTotal++;
          if (!p.eliminated) blueAlive++;
        } else {
          redTotal++;
          if (!p.eliminated) redAlive++;
        }
      });

      if (blueTotal > 0 && redTotal > 0) {
        if (blueAlive === 0 && redAlive > 0) {
          this.state.matchPhase = "gameover";
          this.state.winningTeam = "red";
          this.state.winnerName = "TEAM RED";
          this.state.winnerId = "team_red";
          console.log(`🏆 Match Over! TEAM RED VICTORY!`);
        } else if (redAlive === 0 && blueAlive > 0) {
          this.state.matchPhase = "gameover";
          this.state.winningTeam = "blue";
          this.state.winnerName = "TEAM BLUE";
          this.state.winnerId = "team_blue";
          console.log(`🏆 Match Over! TEAM BLUE VICTORY!`);
        }
      } else {
        const activePlayers = Array.from(this.state.players.values()).filter((p) => !p.eliminated);
        if (activePlayers.length <= 1 && this.state.players.size >= 2) {
          const winner = activePlayers[0];
          this.state.matchPhase = "gameover";
          this.state.winnerId = winner?.id || "";
          this.state.winnerName = winner?.name || "No Winner";
          this.state.winningTeam = winner ? (winner.slotIndex < 5 ? "blue" : "red") : "";
        }
      }
    } else {
      const activePlayers = Array.from(this.state.players.values()).filter((p) => !p.eliminated);
      if (activePlayers.length <= 1 && this.state.players.size >= 2) {
        const winner = activePlayers[0];
        this.state.matchPhase = "gameover";
        this.state.winnerId = winner?.id || "";
        this.state.winnerName = winner?.name || "No Winner";
        this.state.winningTeam = "";
        console.log(`🏆 Match Over! Winner: ${this.state.winnerName}`);
      }
    }
  }

  private resetToLobby() {
    this.state.matchPhase = "lobby";
    this.state.winnerId = "";
    this.state.winnerName = "";
    this.state.winningTeam = "";
    this.state.missiles.clear();
    this.state.players.forEach((p) => {
      p.isReady = p.isHost;
      p.health = 100;
      p.eliminated = false;
    });
    console.log(`🔄 Room ${this.state.roomCode} reset to lobby`);
  }
}
