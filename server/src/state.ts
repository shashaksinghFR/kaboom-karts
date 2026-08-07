import { MapSchema, Schema, type } from "@colyseus/schema";
import type { FighterAction, Facing, MatchPhase } from "../../shared/contracts.js";

// Legacy 2D fighter state
export class PlayerState extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") facing: Facing = "right";
  @type("string") action: FighterAction = "idle";
  @type("number") health = 100;
  @type("number") roundsWon = 0;
  @type("boolean") ready = false;
  @type("boolean") rematch = false;
  @type("boolean") disconnected = false;
}

export class FightRoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("string") roomCode = "";
  @type("string") matchPhase: MatchPhase = "waiting";
  @type("number") roundNumber = 1;
  @type("number") roundTimer = 60;
  @type("number") phaseEndsAt = 0;
  @type("string") winnerId = "";
  @type("string") statusText = "Waiting for an opponent";
}

// 3D Kart Battle Arena State
export class KartPlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") slotIndex = 0;
  @type("number") colorIndex = 0;
  @type("boolean") isHost = false;
  @type("boolean") isReady = false;

  // 3D Transform & Physics Telemetry
  @type("number") x = 0;
  @type("number") y = 0.5;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("number") pitch = 0;
  @type("number") roll = 0;
  @type("number") steerVisual = 0;
  @type("number") speedKph = 0;
  @type("boolean") isDrifting = false;
  @type("boolean") isBoosting = false;

  // Combat stats
  @type("number") health = 100;
  @type("number") score = 0;
  @type("boolean") eliminated = false;
  @type("boolean") disconnected = false;
}

export class NetworkMissileState extends Schema {
  @type("string") id = "";
  @type("string") ownerSessionId = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("number") speed = 55;
  @type("number") createdAt = 0;
}

export class KartRoomState extends Schema {
  @type({ map: KartPlayerState }) players = new MapSchema<KartPlayerState>();
  @type({ map: NetworkMissileState }) missiles = new MapSchema<NetworkMissileState>();
  @type("string") roomCode = "";
  @type("string") matchPhase = "lobby"; // "lobby" | "countdown" | "playing" | "gameover"
  @type("number") countdownTimer = 3;
  @type("number") roundTimer = 180;
  @type("string") winnerId = "";
  @type("string") winnerName = "";
  @type("number") minPlayers = 2;
  @type("number") maxPlayers = 10;
}
