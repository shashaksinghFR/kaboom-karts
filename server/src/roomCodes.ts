const codes = new Map<string, string>();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createCode(): string {
  let code = "";
  do { code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(""); } while (codes.has(code));
  return code;
}
export function registerCode(code: string, roomId: string) { codes.set(code, roomId); }
export function resolveCode(code: string) { return codes.get(code.toUpperCase()); }
export function releaseCode(code: string) { codes.delete(code); }
