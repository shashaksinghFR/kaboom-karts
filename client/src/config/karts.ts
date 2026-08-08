export interface KartModelDef {
  id: string;
  name: string;
  tagline: string;
  modelUrl: string;
  imageUrl: string;
  accentColor: string;
  speedRating: number;
  handlingRating: number;
  armorRating: number;
  rotationYOffset?: number;
}

export const KART_CATALOG: KartModelDef[] = [
  {
    id: "kart1",
    name: "Apex Phantom",
    tagline: "Futuristic Hover Prototype",
    modelUrl: "/models/kart1.glb",
    imageUrl: "/assets/karts/kart1img.png",
    accentColor: "#00f0ff",
    speedRating: 92,
    handlingRating: 88,
    armorRating: 80,
    rotationYOffset: -Math.PI / 2, // -90 deg (authored on X axis)
  },
  {
    id: "kart2",
    name: "Cyber Viper",
    tagline: "High-Velocity Circuit Racer",
    modelUrl: "/models/kart2.glb",
    imageUrl: "/assets/karts/kart2img.png",
    accentColor: "#ff007f",
    speedRating: 95,
    handlingRating: 85,
    armorRating: 78,
    rotationYOffset: 0,
  },
  {
    id: "kart3",
    name: "Neon Interceptor",
    tagline: "Tactical Laser Cruiser",
    modelUrl: "/models/kart3.glb",
    imageUrl: "/assets/karts/kart3img.png",
    accentColor: "#39ff14",
    speedRating: 89,
    handlingRating: 94,
    armorRating: 82,
    rotationYOffset: -2.8605, // Calibrated counter-yaw: makes vehicle face +Z straight forward
  },
  {
    id: "kart4",
    name: "Quantum Striker",
    tagline: "Aero Plasma Speeder",
    modelUrl: "/models/kart4.glb",
    imageUrl: "/assets/karts/kart4img.png",
    accentColor: "#ffaa00",
    speedRating: 94,
    handlingRating: 86,
    armorRating: 85,
    rotationYOffset: 2.8485, // Calibrated counter-yaw: makes vehicle face +Z straight forward
  },
  {
    id: "kart5",
    name: "Hyperion Pulse",
    tagline: "Energy Wave Hovercraft",
    modelUrl: "/models/kart5.glb",
    imageUrl: "/assets/karts/kart5img.png",
    accentColor: "#bf00ff",
    speedRating: 91,
    handlingRating: 90,
    armorRating: 84,
    rotationYOffset: 0,
  },
  {
    id: "kart6",
    name: "Dreadnought",
    tagline: "Heavy Armored Enforcer",
    modelUrl: "/models/kart6.glb",
    imageUrl: "/assets/karts/kart6img.png",
    accentColor: "#ff2a2a",
    speedRating: 86,
    handlingRating: 80,
    armorRating: 98,
    rotationYOffset: 0,
  },
  {
    id: "kart7",
    name: "Solis Spectre",
    tagline: "Ultra-Light Solar Runner",
    modelUrl: "/models/kart7.glb",
    imageUrl: "/assets/karts/kart7img.png",
    accentColor: "#00e5ff",
    speedRating: 93,
    handlingRating: 95,
    armorRating: 75,
    rotationYOffset: 0,
  },
  {
    id: "kart8",
    name: "Vortex Cruiser",
    tagline: "Warp-Core Drift Machine",
    modelUrl: "/models/kart8.glb",
    imageUrl: "/assets/karts/kart8img.png",
    accentColor: "#ffe600",
    speedRating: 90,
    handlingRating: 96,
    armorRating: 81,
    rotationYOffset: 0,
  },
  {
    id: "kart9",
    name: "Titan Razor",
    tagline: "Blade Aero Interceptor",
    modelUrl: "/models/kart9.glb",
    imageUrl: "/assets/karts/kart9img.png",
    accentColor: "#00ffaa",
    speedRating: 96,
    handlingRating: 82,
    armorRating: 86,
    rotationYOffset: 0,
  },
  {
    id: "kart10",
    name: "Valkyrie X",
    tagline: "Experimental Jet Hybrid",
    modelUrl: "/models/kart10.glb",
    imageUrl: "/assets/karts/kart10img.png",
    accentColor: "#ff00bb",
    speedRating: 98,
    handlingRating: 89,
    armorRating: 80,
    rotationYOffset: 0,
  },
];

export function getKartDef(index: number): KartModelDef {
  const safeIdx = Math.max(0, Math.min(KART_CATALOG.length - 1, Math.floor(index)));
  return KART_CATALOG[safeIdx] || KART_CATALOG[0];
}
