import { Color3 } from "@babylonjs/core/Maths/math.color";

export interface PlayerColorDef {
  name: string;
  hex: string;
  color3: Color3;
}

export const PLAYER_COLORS: PlayerColorDef[] = [
  { name: "Cyan", hex: "#00e5ff", color3: new Color3(0.0, 0.9, 1.0) },
  { name: "Crimson", hex: "#ff2a5f", color3: new Color3(1.0, 0.16, 0.37) },
  { name: "Emerald", hex: "#00e676", color3: new Color3(0.0, 0.9, 0.46) },
  { name: "Amber Gold", hex: "#ffd600", color3: new Color3(1.0, 0.84, 0.0) },
  { name: "Electric Purple", hex: "#d500f9", color3: new Color3(0.83, 0.0, 0.98) },
  { name: "Coral Orange", hex: "#ff6d00", color3: new Color3(1.0, 0.43, 0.0) },
  { name: "Ice Blue", hex: "#00b0ff", color3: new Color3(0.0, 0.69, 1.0) },
  { name: "Titanium Silver", hex: "#cfd8dc", color3: new Color3(0.81, 0.85, 0.86) },
  { name: "Rose Pink", hex: "#ff4081", color3: new Color3(1.0, 0.25, 0.5) },
  { name: "Mint Teal", hex: "#1de9b6", color3: new Color3(0.11, 0.91, 0.71) },
];

export function getPlayerColor(index: number): PlayerColorDef {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
