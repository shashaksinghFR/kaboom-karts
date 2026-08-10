import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  TransformNode,
  TrailMesh,
  PointLight,
} from "@babylonjs/core";
import { SCENE_CONFIG } from "../config/constants";

export class Missile {
  private scene: Scene;
  public rootNode: TransformNode;
  private meshes: Mesh[] = [];
  private trailMesh: TrailMesh | null = null;
  private trailMat!: StandardMaterial;

  private light: PointLight | null = null;

  public velocity: Vector3;
  public speed: number = 65.0; // Fast high-velocity rocket
  public age: number = 0;
  public maxLifetime: number = 3.5;
  public isDead: boolean = false;

  private arenaRadius: number;

  constructor(
    scene: Scene,
    spawnPosition: Vector3,
    headingYaw: number,
    speed: number = 65.0
  ) {
    this.scene = scene;
    this.speed = speed;
    this.arenaRadius = (SCENE_CONFIG.DEFAULT_GROUND_SIZE * 0.95) / 2 - 1.0;

    // Direction vector from car yaw
    const dirX = Math.sin(headingYaw);
    const dirZ = Math.cos(headingYaw);
    this.velocity = new Vector3(dirX * this.speed, 0, dirZ * this.speed);

    // Root Transform Node
    this.rootNode = new TransformNode("MissileRoot", this.scene);
    this.rootNode.position.copyFrom(spawnPosition);
    this.rootNode.rotation.y = headingYaw;

    // Dynamic light casting onto ground as missile travels
    try {
      this.light = new PointLight("MissileLight", new Vector3(0, 0.2, 0), this.scene);
      this.light.parent = this.rootNode;
      this.light.diffuse = new Color3(0.0, 0.95, 1.0);
      this.light.intensity = 2.0;
      this.light.range = 14;
    } catch {
      // Ignore if light limit reached
    }

    // Build Cyberpunk Rocket Visual
    this.createMissileVisual();

    // Setup sleek rocket trail
    this.setupMissileTrail();
  }

  public get position(): Vector3 {
    return this.rootNode.position;
  }

  private createMissileVisual(): void {
    // 1. Rocket Body Cylinder (along Z axis)
    const body = MeshBuilder.CreateCylinder(
      "MissileBody",
      { height: 1.1, diameter: 0.22, tessellation: 16 },
      this.scene
    );
    body.rotation.x = Math.PI / 2; // Orient along Z axis
    body.parent = this.rootNode;

    const bodyMat = new StandardMaterial("MissileBodyMat", this.scene);
    bodyMat.diffuseColor = new Color3(0.0, 0.95, 1.0); // Vivid Neon Cyan
    bodyMat.emissiveColor = new Color3(0.0, 0.85, 1.0);
    bodyMat.disableLighting = true;
    body.material = bodyMat;
    this.meshes.push(body);

    // 2. Glowing Conical Warhead / Tip
    const tip = MeshBuilder.CreateCylinder(
      "MissileTip",
      { height: 0.45, diameterTop: 0.0, diameterBottom: 0.22, tessellation: 16 },
      this.scene
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.75;
    tip.parent = this.rootNode;

    const tipMat = new StandardMaterial("MissileTipMat", this.scene);
    tipMat.diffuseColor = new Color3(1.0, 0.05, 0.4); // Intense Pink / Magenta warhead
    tipMat.emissiveColor = new Color3(1.0, 0.15, 0.6);
    tipMat.disableLighting = true;
    tip.material = tipMat;
    this.meshes.push(tip);

    // 3. Thruster Exhaust Glow Ring at rear
    const thruster = MeshBuilder.CreateTorus(
      "MissileThruster",
      { diameter: 0.22, thickness: 0.06, tessellation: 16 },
      this.scene
    );
    thruster.position.z = -0.55;
    thruster.parent = this.rootNode;

    const thrusterMat = new StandardMaterial("MissileThrusterMat", this.scene);
    thrusterMat.diffuseColor = new Color3(1.0, 0.6, 0.0);
    thrusterMat.emissiveColor = new Color3(1.0, 0.9, 0.2);
    thrusterMat.disableLighting = true;
    thruster.material = thrusterMat;
    this.meshes.push(thruster);
  }

  private setupMissileTrail(): void {
    const trailAnchor = new TransformNode("MissileTrailAnchor", this.scene);
    trailAnchor.parent = this.rootNode;
    trailAnchor.position = new Vector3(0, 0, -0.6);

    this.trailMat = new StandardMaterial("MissileTrailMat", this.scene);
    this.trailMat.diffuseColor = new Color3(0.0, 0.95, 1.0);
    this.trailMat.emissiveColor = new Color3(0.0, 0.95, 1.0);
    this.trailMat.disableLighting = true;
    this.trailMat.alpha = 1.0; // 100% opaque glowing laser trail

    this.trailMesh = new TrailMesh(
      "MissileTrail",
      trailAnchor,
      this.scene,
      0.14,
      14,
      true
    );
    this.trailMesh.material = this.trailMat;
  }

  public update(deltaTime: number, onExplode: (pos: Vector3) => void): void {
    if (this.isDead) return;

    this.age += deltaTime;

    // Linear translation along velocity vector
    this.rootNode.position.x += this.velocity.x * deltaTime;
    this.rootNode.position.z += this.velocity.z * deltaTime;

    // 1. Max Lifetime Despawn Check
    if (this.age >= this.maxLifetime) {
      onExplode(this.rootNode.position.clone());
      this.destroy();
      return;
    }

    // (Removed artificial arena radius boundary check since we use massive custom 3D models now)
  }

  public destroy(): void {
    if (this.isDead) return;
    this.isDead = true;

    if (this.light) {
      this.light.dispose();
      this.light = null;
    }
    if (this.trailMesh) {
      this.trailMesh.dispose();
    }
    this.meshes.forEach((mesh) => mesh.dispose());
    this.rootNode.dispose();
  }
}
