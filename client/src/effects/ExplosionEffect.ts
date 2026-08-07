import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  PointLight,
} from "@babylonjs/core";

export class ExplosionEffect {
  private scene: Scene;
  private sphere: Mesh;
  private ring: Mesh;
  private light: PointLight;
  private mat: StandardMaterial;
  private ringMat: StandardMaterial;
  private age: number = 0;
  private duration: number = 0.45; // seconds
  public isFinished: boolean = false;

  constructor(scene: Scene, position: Vector3) {
    this.scene = scene;

    // Expanding plasma shockwave sphere
    this.sphere = MeshBuilder.CreateSphere("ExplosionSphere", { diameter: 1.0, segments: 16 }, scene);
    this.sphere.position.copyFrom(position);

    this.mat = new StandardMaterial("ExplosionMat", scene);
    this.mat.diffuseColor = new Color3(1.0, 0.35, 0.05); // Fiery orange
    this.mat.emissiveColor = new Color3(1.0, 0.45, 0.1);
    this.mat.disableLighting = true;
    this.mat.alpha = 0.85;
    this.sphere.material = this.mat;

    // Expanding shockwave ring
    this.ring = MeshBuilder.CreateTorus("ExplosionRing", { diameter: 1.5, thickness: 0.15, tessellation: 32 }, scene);
    this.ring.position.copyFrom(position);
    this.ring.position.y = 0.2;

    this.ringMat = new StandardMaterial("ExplosionRingMat", scene);
    this.ringMat.diffuseColor = new Color3(0.0, 0.85, 1.0); // Cyan energy ring
    this.ringMat.emissiveColor = new Color3(0.0, 0.85, 1.0);
    this.ringMat.disableLighting = true;
    this.ringMat.alpha = 0.9;
    this.ring.material = this.ringMat;

    // Brief point light flash
    this.light = new PointLight("ExplosionLight", position, scene);
    this.light.diffuse = new Color3(1.0, 0.5, 0.1);
    this.light.intensity = 4.0;
    this.light.range = 35;
  }

  public update(deltaTime: number): void {
    this.age += deltaTime;
    const progress = Math.min(this.age / this.duration, 1.0);

    // Scale outward
    const scale = 1.0 + progress * 5.5;
    this.sphere.scaling.set(scale, scale, scale);

    const ringScale = 1.0 + progress * 8.0;
    this.ring.scaling.set(ringScale, 1.0, ringScale);

    // Fade out alpha
    const alpha = Math.max(0, 1.0 - progress);
    this.mat.alpha = alpha * 0.85;
    this.ringMat.alpha = alpha * 0.9;

    // Fade light flash
    this.light.intensity = 4.0 * (1.0 - progress);

    if (progress >= 1.0) {
      this.dispose();
      this.isFinished = true;
    }
  }

  public dispose(): void {
    this.sphere.dispose();
    this.ring.dispose();
    this.mat.dispose();
    this.ringMat.dispose();
    this.light.dispose();
  }
}
