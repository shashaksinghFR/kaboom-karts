export interface KartModelDef {
  id: string;
  name: string;
  tagline: string;
  modelUrl: string;
  accentColor: string;
  speedRating: number;
  handlingRating: number;
  armorRating: number;
  forwardAxis?: "x" | "z" | "-x" | "-z";
}

export const KART_CATALOG: KartModelDef[] = [
  {
    id: "kart1",
    name: "Apex Phantom",
    tagline: "Futuristic Hover Prototype",
    modelUrl: "/models/kart1.glb",
    accentColor: "#00f0ff",
    speedRating: 92,
    handlingRating: 88,
    armorRating: 80,
  },
  {
    id: "kart2",
    name: "Cyber Viper",
    tagline: "High-Velocity Circuit Racer",
    modelUrl: "/models/kart2.glb",
    accentColor: "#ff007f",
    speedRating: 95,
    handlingRating: 85,
    armorRating: 78,
  },
  {
    id: "kart3",
    name: "Neon Interceptor",
    tagline: "Tactical Laser Cruiser",
    modelUrl: "/models/kart3.glb",
    accentColor: "#39ff14",
    speedRating: 89,
    handlingRating: 94,
    armorRating: 82,
  },
  {
    id: "kart4",
    name: "Quantum Striker",
    tagline: "Aero Plasma Speeder",
    modelUrl: "/models/kart4.glb",
    accentColor: "#ffaa00",
    speedRating: 94,
    handlingRating: 86,
    armorRating: 85,
  },
  {
    id: "kart5",
    name: "Hyperion Pulse",
    tagline: "Energy Wave Hovercraft",
    modelUrl: "/models/kart5.glb",
    accentColor: "#bf00ff",
    speedRating: 91,
    handlingRating: 90,
    armorRating: 84,
  },
  {
    id: "kart6",
    name: "Dreadnought",
    tagline: "Heavy Armored Enforcer",
    modelUrl: "/models/kart6.glb",
    accentColor: "#ff2a2a",
    speedRating: 86,
    handlingRating: 80,
    armorRating: 98,
  },
  {
    id: "kart7",
    name: "Solis Spectre",
    tagline: "Ultra-Light Solar Runner",
    modelUrl: "/models/kart7.glb",
    accentColor: "#00e5ff",
    speedRating: 93,
    handlingRating: 95,
    armorRating: 75,
  },
  {
    id: "kart8",
    name: "Vortex Cruiser",
    tagline: "Warp-Core Drift Machine",
    modelUrl: "/models/kart8.glb",
    accentColor: "#ffe600",
    speedRating: 90,
    handlingRating: 96,
    armorRating: 81,
  },
  {
    id: "kart9",
    name: "Titan Razor",
    tagline: "Blade Aero Interceptor",
    modelUrl: "/models/kart9.glb",
    accentColor: "#00ffaa",
    speedRating: 96,
    handlingRating: 82,
    armorRating: 86,
  },
  {
    id: "kart10",
    name: "Valkyrie X",
    tagline: "Experimental Jet Hybrid",
    modelUrl: "/models/kart10.glb",
    accentColor: "#ff00bb",
    speedRating: 98,
    handlingRating: 89,
    armorRating: 80,
  },
];

export function getKartDef(index: number): KartModelDef {
  const safeIdx = Math.max(0, Math.min(KART_CATALOG.length - 1, Math.floor(index)));
  return KART_CATALOG[safeIdx] || KART_CATALOG[0];
}
