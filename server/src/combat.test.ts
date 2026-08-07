import { describe, expect, it } from "vitest";
import { ARENA, COMBAT } from "../../shared/contracts.js";
import { newRuntime, startAction, tickFighter, tryHit } from "./combat.js";
import { PlayerState } from "./state.js";

const fighter = (x: number, facing: "left" | "right") => { const p = new PlayerState(); p.x = x; p.y = ARENA.groundY; p.facing = facing; return p; };
describe("authoritative combat", () => {
  it("damages a defender inside an active punch range", () => { const a = fighter(300, "right"), b = fighter(350, "left"), ar = newRuntime(), br = newRuntime(); startAction(a, ar, "punch", 0); expect(tryHit(a, b, ar, br, COMBAT.punch.startup + 1)).toBe(true); expect(b.health).toBe(92); });
  it("blocks attacks from the correct direction", () => { const a = fighter(300, "right"), b = fighter(350, "left"), ar = newRuntime(), br = newRuntime(); b.action = "block"; startAction(a, ar, "kick", 0); tryHit(a, b, ar, br, COMBAT.kick.startup + 1); expect(b.health).toBe(100); });
  it("does not permit aerial attacks and lands jumping fighters", () => { const p = fighter(300, "right"), run = newRuntime(); expect(startAction(p, run, "jump", 0)).toBe(true); expect(startAction(p, run, "punch", 1)).toBe(false); tickFighter(p, run, 2, 2000); expect(p.y).toBe(ARENA.groundY); });
});
