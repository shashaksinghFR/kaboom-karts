export const ARENA = { width: 1280, height: 720, groundY: 610, fighterWidth: 58, fighterHeight: 110 } as const;
export const COMBAT = {
  maxHealth: 100, roundSeconds: 60, countdownSeconds: 3, roundsToWin: 2,
  moveSpeed: 310, jumpVelocity: 620, gravity: 1750, tickRate: 30,
  punch: { damage: 8, startup: 90, active: 100, recovery: 220, range: 66 },
  kick: { damage: 14, startup: 140, active: 120, recovery: 310, range: 84 },
} as const;

export type MatchPhase = "waiting" | "countdown" | "fighting" | "roundEnd" | "matchEnd" | "paused";
export type FighterAction = "idle" | "walk" | "jump" | "punch" | "kick" | "block" | "hitstun" | "ko";
export type Facing = "left" | "right";
export type InputState = { left: boolean; right: boolean; block: boolean };
export type InputAction = "jump" | "punch" | "kick";
export type ClientInput = { state?: Partial<InputState>; action?: InputAction };

export const emptyInput = (): InputState => ({ left: false, right: false, block: false });

export default { ARENA, COMBAT, emptyInput };
