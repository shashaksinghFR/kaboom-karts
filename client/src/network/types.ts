export interface NetworkPlayerState {
  sessionId: string;
  name: string;
  score: number;
  health: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  steerVisual: number;
}

export interface NetworkMissileState {
  id: string;
  ownerSessionId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}
