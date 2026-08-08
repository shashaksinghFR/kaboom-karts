import { Client, Room } from "colyseus.js";

export interface PlayerNetData {
  id: string;
  name: string;
  slotIndex: number;
  colorIndex: number;
  kartModelIndex: number;
  team?: "blue" | "red" | "none";
  isHost: boolean;
  isReady: boolean;
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
  health: number;
  score: number;
  eliminated: boolean;
}

export class NetworkClient {
  private client: Client;
  public room: Room<any> | null = null;
  public localSessionId: string = "";
  public roomCode: string = "";
  public isHost: boolean = false;

  private serverWsUrl: string;
  private serverHttpUrl: string;

  // Event Listeners
  public onRoomJoined?: (room: Room<any>) => void;
  public onStateChanged?: (state: any) => void;
  public onPlayerJoined?: (player: PlayerNetData, key: string) => void;
  public onPlayerLeft?: (player: PlayerNetData, key: string) => void;
  public onMissileFired?: (data: any) => void;
  public onMissileExploded?: (data: any) => void;
  public onPlayerEliminated?: (data: any) => void;
  public onError?: (error: string) => void;

  constructor() {
    const envUrl = (import.meta as any).env?.VITE_SERVER_URL;
    const envHost = (import.meta as any).env?.VITE_SERVER_HOST;
    const isHttps = window.location.protocol === "https:";
    const wsProto = isHttps ? "wss:" : "ws:";
    const httpProto = isHttps ? "https:" : "http:";

    if (envUrl) {
      this.serverHttpUrl = envUrl.replace(/^wss?:/, httpProto);
      this.serverWsUrl = envUrl.replace(/^https?:/, wsProto);
    } else if (envHost) {
      this.serverHttpUrl = `${httpProto}//${envHost}`;
      this.serverWsUrl = `${wsProto}//${envHost}`;
    } else if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      const devPort = (import.meta as any).env?.VITE_SERVER_PORT || "2567";
      this.serverHttpUrl = `http://localhost:${devPort}`;
      this.serverWsUrl = `ws://localhost:${devPort}`;
    } else {
      // Production deployed host
      this.serverHttpUrl = window.location.origin;
      this.serverWsUrl = `${wsProto}//${window.location.host}`;
    }

    console.log(`🌐 Connecting to Colyseus Server at: ${this.serverWsUrl}`);
    this.client = new Client(this.serverWsUrl);
  }

  public async createRoom(playerName: string): Promise<Room<any>> {
    try {
      // Step 1: Request room code from server API
      const res = await fetch(`${this.serverHttpUrl}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Failed to generate room code from server.");
      }

      const data = await res.json();
      const roomCode = data.roomCode;
      this.roomCode = roomCode;

      // Step 2: Join the created room via Colyseus
      this.room = await this.client.joinById(data.roomId, {
        name: playerName,
        roomCode,
      });

      this.localSessionId = this.room.sessionId;
      this.setupRoomListeners(this.room);

      console.log(`🏁 Room created [${roomCode}] ID: ${this.room.roomId}`);
      return this.room;
    } catch (err: any) {
      console.error("Error creating room:", err);
      this.onError?.(err.message || "Failed to create room");
      throw err;
    }
  }

  public async joinRoomByCode(roomCode: string, playerName: string): Promise<Room<any>> {
    try {
      const code = roomCode.trim().toUpperCase();

      // Step 1: Resolve room code
      const res = await fetch(`${this.serverHttpUrl}/rooms/${code}`);
      if (!res.ok) {
        throw new Error(`Room code "${code}" not found or room has expired.`);
      }

      const data = await res.json();
      this.roomCode = code;

      // Step 2: Join resolved roomId
      this.room = await this.client.joinById(data.roomId, {
        name: playerName,
        roomCode: code,
      });

      this.localSessionId = this.room.sessionId;
      this.setupRoomListeners(this.room);

      console.log(`👤 Joined room [${code}]`);
      return this.room;
    } catch (err: any) {
      console.error("Error joining room:", err);
      this.onError?.(err.message || "Failed to join room");
      throw err;
    }
  }

  private setupRoomListeners(room: Room<any>): void {
    this.onRoomJoined?.(room);

    room.onStateChange((state) => {
      if (!state) return;
      if (state.players) {
        const me = state.players.get(this.localSessionId);
        if (me) {
          this.isHost = me.isHost;
        }
      }
      this.onStateChanged?.(state);
    });

    room.onStateChange.once((state) => {
      if (state?.players?.onAdd) {
        state.players.onAdd((player: any, key: string) => {
          this.onPlayerJoined?.(player, key);
        });
      }
      if (state?.players?.onRemove) {
        state.players.onRemove((player: any, key: string) => {
          this.onPlayerLeft?.(player, key);
        });
      }
    });

    room.onMessage("missileFired", (data) => {
      this.onMissileFired?.(data);
    });

    room.onMessage("missileExploded", (data) => {
      this.onMissileExploded?.(data);
    });

    room.onMessage("playerEliminated", (data) => {
      this.onPlayerEliminated?.(data);
    });

    room.onMessage("error", (data) => {
      this.onError?.(data.message);
    });
  }

  public toggleReady(): void {
    if (this.room) {
      this.room.send("toggleReady");
    }
  }

  public switchSlot(targetSlotIndex: number): void {
    if (this.room) {
      this.room.send("switchSlot", { targetSlotIndex });
    }
  }

  public selectKart(kartModelIndex: number): void {
    if (this.room) {
      this.room.send("selectKart", { kartModelIndex });
    }
  }

  public setGameMode(gameMode: "ffa" | "team"): void {
    if (this.room && this.isHost) {
      this.room.send("setGameMode", { gameMode });
    }
  }

  public startGame(): void {
    if (this.room && this.isHost) {
      this.room.send("startGame");
    }
  }

  public sendTransform(data: {
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
  }): void {
    if (this.room) {
      this.room.send("playerTransform", data);
    }
  }

  public sendFireMissile(data: {
    id: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
  }): void {
    if (this.room) {
      this.room.send("fireMissile", data);
    }
  }

  public sendMissileHit(data: {
    missileId: string;
    targetSessionId?: string;
    impactX: number;
    impactY: number;
    impactZ: number;
  }): void {
    if (this.room) {
      this.room.send("missileHit", data);
    }
  }

  public sendRematch(): void {
    if (this.room) {
      this.room.send("rematch");
    }
  }

  public leaveRoom(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
      this.localSessionId = "";
      this.roomCode = "";
      this.isHost = false;
    }
  }
}
