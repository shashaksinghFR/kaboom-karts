import shared, { type ClientInput, type InputState } from "../../shared/contracts.js";
const { ARENA, COMBAT, emptyInput } = shared;
import type { PlayerState } from "./state.js";

export type FighterRuntime = { input: InputState; attackStarted: number; hitApplied: boolean; hitstunUntil: number };
export const newRuntime = (): FighterRuntime => ({ input: emptyInput(), attackStarted: 0, hitApplied: false, hitstunUntil: 0 });
export function applyInput(runtime: FighterRuntime, input: ClientInput) { runtime.input = { ...runtime.input, ...input.state }; }
export function startAction(player: PlayerState, runtime: FighterRuntime, action: "jump" | "punch" | "kick", now: number) {
  if (player.action === "ko" || now < runtime.hitstunUntil || player.action === "punch" || player.action === "kick") return false;
  if (player.action === "jump" && action !== "jump") return false;
  if (action === "jump") { if (player.y !== ARENA.groundY) return false; player.action = "jump"; (player as PlayerState & { velocityY?: number }).velocityY = -COMBAT.jumpVelocity; return true; }
  if (player.y !== ARENA.groundY) return false;
  player.action = action; runtime.attackStarted = now; runtime.hitApplied = false; return true;
}
export function tickFighter(player: PlayerState, runtime: FighterRuntime, dt: number, now: number) {
  const runtimePlayer = player as PlayerState & { velocityY?: number };
  if (now < runtime.hitstunUntil) { player.action = "hitstun"; return; }
  if (player.action === "hitstun") player.action = "idle";
  if (player.action === "jump") { runtimePlayer.velocityY = (runtimePlayer.velocityY ?? 0) + COMBAT.gravity * dt; player.y += runtimePlayer.velocityY * dt; if (player.y >= ARENA.groundY) { player.y = ARENA.groundY; runtimePlayer.velocityY = 0; player.action = "idle"; } return; }
  if (player.action === "punch" || player.action === "kick") { const spec = (COMBAT as Record<string, any>)[player.action]; if (now - runtime.attackStarted >= spec.startup + spec.active + spec.recovery) player.action = "idle"; return; }
  const direction = Number(runtime.input.right) - Number(runtime.input.left);
  if (direction) { player.x = Math.max(ARENA.fighterWidth / 2, Math.min(ARENA.width - ARENA.fighterWidth / 2, player.x + direction * COMBAT.moveSpeed * dt)); player.action = "walk"; }
  else player.action = runtime.input.block ? "block" : "idle";
}
export function tryHit(attacker: PlayerState, defender: PlayerState, attackerRun: FighterRuntime, defenderRun: FighterRuntime, now: number): boolean {
  if (attacker.action !== "punch" && attacker.action !== "kick") return false;
  const spec = (COMBAT as Record<string, any>)[attacker.action]; const elapsed = now - attackerRun.attackStarted;
  if (attackerRun.hitApplied || elapsed < spec.startup || elapsed > spec.startup + spec.active) return false;
  const inFront = attacker.facing === "right" ? defender.x >= attacker.x : defender.x <= attacker.x;
  if (!inFront || Math.abs(defender.x - attacker.x) > spec.range || Math.abs(defender.y - attacker.y) > ARENA.fighterHeight) return false;
  attackerRun.hitApplied = true;
  const correctlyBlocking = defender.action === "block" && defender.facing !== attacker.facing;
  if (!correctlyBlocking) { defender.health = Math.max(0, defender.health - spec.damage); defenderRun.hitstunUntil = now + 180; defender.action = defender.health === 0 ? "ko" : "hitstun"; }
  return true;
}
