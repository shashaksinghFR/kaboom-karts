import { describe, expect, it } from "vitest";
import { createCode, registerCode, releaseCode, resolveCode } from "./roomCodes.js";

describe("room code registry", () => {
  it("creates five-character codes and resolves them case-insensitively", () => { const code = createCode(); registerCode(code, "room-1"); expect(code).toMatch(/^[A-Z0-9]{5}$/); expect(resolveCode(code.toLowerCase())).toBe("room-1"); releaseCode(code); expect(resolveCode(code)).toBeUndefined(); });
});
