import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";

export const SCENE_CONFIG = {
  CLEAR_COLOR: new Color4(0.06, 0.08, 0.12, 1.0),
  FOG_COLOR: new Color3(0.06, 0.08, 0.12),
  DEFAULT_GROUND_SIZE: 200, // Expansive 200m arena
  DEFAULT_GROUND_SUBDIVISIONS: 4,
};

export const CAMERA_CONFIG = {
  ALPHA: -Math.PI / 2.5,
  BETA: Math.PI / 3.2,
  RADIUS: 24,
  TARGET: new Vector3(0, 1, 0),
  LOWER_RADIUS_LIMIT: 4,
  UPPER_RADIUS_LIMIT: 120,
  LOWER_BETA_LIMIT: 0.1,
  UPPER_BETA_LIMIT: Math.PI / 2.05,
  WHEEL_PRECISION: 20,
  PINCH_PRECISION: 30,
};

export const LIGHT_CONFIG = {
  HEMISPHERIC_DIRECTION: new Vector3(0, 1, 0),
  HEMISPHERIC_INTENSITY: 0.85,
  HEMISPHERIC_GROUND_COLOR: new Color3(0.12, 0.14, 0.18),
  DIRECTIONAL_DIRECTION: new Vector3(-1, -2, -1),
  DIRECTIONAL_INTENSITY: 1.1,
};
