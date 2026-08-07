import { Client, Room } from "colyseus";
import shared, { type ClientInput } from "../../shared/contracts.js";
const { ARENA, COMBAT } = shared;
import { applyInput, newRuntime, startAction, tickFighter, tryHit, type FighterRuntime } from "./combat.js";
import { createCode, registerCode, releaseCode } from "./roomCodes.js";
import { FightRoomState, PlayerState } from "./state.js";

export class FightRoom extends Room<FightRoomState> {
  maxClients = 2; private runtime = new Map<string, FighterRuntime>(); private interval?: ReturnType<typeof setInterval>; private lastTick = 0;
  onCreate(options: { roomCode?: string }) { this.setState(new FightRoomState()); this.state.roomCode = options.roomCode ?? createCode(); registerCode(this.state.roomCode, this.roomId); this.onMessage("input", (client, input: ClientInput) => this.handleInput(client.sessionId, input)); this.onMessage("rematch", (client) => this.requestRematch(client.sessionId)); this.interval = setInterval(() => this.tick(), 1000 / COMBAT.tickRate); }
  onJoin(client: Client, options: { name?: string }) {
    const existing = this.state.players.get(client.sessionId); if (existing) { existing.disconnected = false; this.runtime.set(client.sessionId, this.runtime.get(client.sessionId) ?? newRuntime()); return; }
    if (this.state.matchPhase !== "waiting" || this.state.players.size >= 2) throw new Error("This room is no longer available.");
    const player = new PlayerState(); player.name = (options.name ?? "Fighter").trim().slice(0, 16) || "Fighter"; player.x = this.state.players.size ? 920 : 360; player.y = ARENA.groundY; player.facing = this.state.players.size ? "left" : "right"; this.state.players.set(client.sessionId, player); this.runtime.set(client.sessionId, newRuntime());
    if (this.state.players.size === 2) this.beginCountdown();
  }
  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId); if (!player) return;
    if (consented || this.state.matchPhase === "waiting" || this.state.matchPhase === "matchEnd") { this.removePlayer(client.sessionId); return; }
    player.disconnected = true; this.state.matchPhase = "paused"; this.state.statusText = `${player.name} disconnected — reconnecting (30s)`;
    try { await this.allowReconnection(client, 30); player.disconnected = false; if (this.state.players.size === 2) this.resumeFight(); }
    catch { this.forfeit(client.sessionId); }
  }
  onDispose() { if (this.interval) clearInterval(this.interval); releaseCode(this.state.roomCode); }
  private handleInput(id: string, input: ClientInput) { if (this.state.matchPhase !== "fighting") return; const player = this.state.players.get(id); const runtime = this.runtime.get(id); if (!player || !runtime) return; applyInput(runtime, input); if (input.action) startAction(player, runtime, input.action, Date.now()); }
  private tick() { const now = Date.now(); if (!this.lastTick) this.lastTick = now; const dt = Math.min((now - this.lastTick) / 1000, 0.1); this.lastTick = now;
    if (this.state.matchPhase === "countdown" && now >= this.state.phaseEndsAt) this.startRound();
    if (this.state.matchPhase === "roundEnd" && now >= this.state.phaseEndsAt) this.advanceRound();
    if (this.state.matchPhase !== "fighting") return;
    this.state.roundTimer = Math.max(0, this.state.roundTimer - dt);
    const entries = [...this.state.players.entries()];
    for (const [id, player] of entries) { const other = entries.find(([otherId]) => otherId !== id)?.[1]; if (other) player.facing = player.x <= other.x ? "right" : "left"; tickFighter(player, this.runtime.get(id)!, dt, now); }
    if (entries.length === 2) { const [aId, a] = entries[0], [bId, b] = entries[1]; tryHit(a, b, this.runtime.get(aId)!, this.runtime.get(bId)!, now); tryHit(b, a, this.runtime.get(bId)!, this.runtime.get(aId)!, now); }
    if (this.state.roundTimer === 0 || entries.some(([, p]) => p.health === 0)) this.finishRound();
  }
  private beginCountdown() { this.state.matchPhase = "countdown"; this.state.statusText = "Fight begins in 3"; this.state.phaseEndsAt = Date.now() + COMBAT.countdownSeconds * 1000; }
  private startRound() { this.state.matchPhase = "fighting"; this.state.statusText = "FIGHT!"; this.state.roundTimer = COMBAT.roundSeconds; }
  private finishRound() { const players = [...this.state.players.entries()] as [string, PlayerState][]; const [aId, a] = players[0], [bId, b] = players[1]; const winner: [string, PlayerState] | undefined = a.health === b.health ? undefined : a.health > b.health ? [aId, a] : [bId, b]; if (winner) { winner[1].roundsWon++; this.state.winnerId = winner[0]; this.state.statusText = `${winner[1].name} wins the round`; } else { this.state.winnerId = ""; this.state.statusText = "Round draw"; }
    this.state.matchPhase = "roundEnd"; this.state.phaseEndsAt = Date.now() + 2500;
  }
  private advanceRound() { if ([...this.state.players.values()].some(p => p.roundsWon >= COMBAT.roundsToWin)) { this.state.matchPhase = "matchEnd"; const winner = [...this.state.players.entries()].find(([, p]) => p.roundsWon >= COMBAT.roundsToWin)!; this.state.winnerId = winner[0]; this.state.statusText = `${winner[1].name} wins the match`; return; } this.state.roundNumber++; for (const [id, p] of this.state.players) { p.health = COMBAT.maxHealth; p.x = p.facing === "right" ? 360 : 920; p.y = ARENA.groundY; p.action = "idle"; this.runtime.set(id, newRuntime()); } this.beginCountdown(); }
  private resumeFight() { this.state.matchPhase = "fighting"; this.state.statusText = "FIGHT!"; }
  private requestRematch(id: string) { if (this.state.matchPhase !== "matchEnd") return; const player = this.state.players.get(id); if (!player) return; player.rematch = true; if ([...this.state.players.values()].length === 2 && [...this.state.players.values()].every(p => p.rematch)) { this.state.roundNumber = 1; this.state.winnerId = ""; for (const [playerId, fighter] of this.state.players) { fighter.roundsWon = 0; fighter.health = COMBAT.maxHealth; fighter.rematch = false; fighter.x = fighter.facing === "right" ? 360 : 920; fighter.y = ARENA.groundY; fighter.action = "idle"; this.runtime.set(playerId, newRuntime()); } this.beginCountdown(); } else this.state.statusText = "Waiting for opponent to accept rematch"; }
  private forfeit(id: string) { const winner = [...this.state.players.entries()].find(([key]) => key !== id); if (winner) { winner[1].roundsWon = COMBAT.roundsToWin; this.state.winnerId = winner[0]; this.state.statusText = `${winner[1].name} wins by forfeit`; this.state.matchPhase = "matchEnd"; } else this.removePlayer(id); }
  private removePlayer(id: string) { this.state.players.delete(id); this.runtime.delete(id); this.state.matchPhase = "waiting"; this.state.statusText = "Waiting for an opponent"; }
}
