import {
  Scene,
  TransformNode,
  AbstractMesh,
  SceneLoader,
  Vector3,
  ShadowGenerator,
  StandardMaterial,
  PBRMaterial,
  Color3,
  MeshBuilder,
  TrailMesh,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { IKartVisual } from "./types";
import { getPlayerColor } from "../network/constants";
import { getKartDef } from "../config/karts";

export class KartVisual implements IKartVisual {
  public rootNode: TransformNode;
  public visualMeshRoot: TransformNode;
  private modelOffsetNode: TransformNode;
  public meshes: AbstractMesh[] = [];
  private scene: Scene;
  private isLoaded: boolean = false;
  private shadowGenerator: ShadowGenerator | null = null;
  public colorIndex: number = 0;
  public modelIndex: number = 0;

  // Visual tilt / banking nodes
  private tiltNode: TransformNode;

  // Tail light trail nodes & meshes
  private leftTailLightAnchor!: TransformNode;
  private rightTailLightAnchor!: TransformNode;
  private leftTrailMesh: TrailMesh | null = null;
  private rightTrailMesh: TrailMesh | null = null;
  private trailMaterial!: StandardMaterial;
  private trailsInitialized: boolean = false;

  // Steering wheel nodes (if separate meshes exist)
  private frontLeftWheel: AbstractMesh | null = null;
  private frontRightWheel: AbstractMesh | null = null;
  private rearLeftWheel: AbstractMesh | null = null;
  private rearRightWheel: AbstractMesh | null = null;

  // Hover bobbing accumulator
  private hoverTimer: number = 0;
  public baseHoverHeight: number = 0.45;

  constructor(scene: Scene, shadowGenerator?: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator || null;

    // 1. Root node holds true world position & yaw rotation
    this.rootNode = new TransformNode("KartRoot", this.scene);
    this.rootNode.position = new Vector3(0, this.baseHoverHeight, 0);

    // 2. Tilt node for visual banking (roll), acceleration pitch, and hover bobbing
    this.tiltNode = new TransformNode("KartTiltNode", this.scene);
    this.tiltNode.parent = this.rootNode;

    // 3. Visual mesh container
    this.visualMeshRoot = new TransformNode("KartVisualMeshRoot", this.scene);
    this.visualMeshRoot.parent = this.tiltNode;

    // 4. Model offset node for mathematical center alignment
    this.modelOffsetNode = new TransformNode("ModelOffsetNode", this.scene);
    this.modelOffsetNode.parent = this.visualMeshRoot;

    // 5. Setup Tail Light Anchors & Unique Colored Trail
    this.setupTailLightTrails();
  }

  private setupTailLightTrails(): void {
    this.leftTailLightAnchor = new TransformNode("LeftTailLightAnchor", this.scene);
    this.leftTailLightAnchor.parent = this.tiltNode;
    this.leftTailLightAnchor.position = new Vector3(-0.45, 0.25, -1.4);

    this.rightTailLightAnchor = new TransformNode("RightTailLightAnchor", this.scene);
    this.rightTailLightAnchor.parent = this.tiltNode;
    this.rightTailLightAnchor.position = new Vector3(0.45, 0.25, -1.4);

    const defaultColor = getPlayerColor(this.colorIndex);
    this.trailMaterial = new StandardMaterial("TailTrailMat", this.scene);
    this.trailMaterial.diffuseColor = defaultColor.color3;
    this.trailMaterial.emissiveColor = defaultColor.color3.scale(3.2);
    this.trailMaterial.disableLighting = true;
    this.trailMaterial.alpha = 1.0; // 100% Opaque solid laser ribbon
    this.trailMaterial.backFaceCulling = false;
  }

  private ensureTrailsActive(): void {
    if (this.trailsInitialized) return;

    this.leftTrailMesh = new TrailMesh(
      "LeftTailTrail",
      this.leftTailLightAnchor,
      this.scene,
      0.14, // Slim, sharp glowing laser ribbon
      45,   // Smooth stream
      true
    );
    this.leftTrailMesh.material = this.trailMaterial;

    this.rightTrailMesh = new TrailMesh(
      "RightTailTrail",
      this.rightTailLightAnchor,
      this.scene,
      0.14, // Slim, sharp glowing laser ribbon
      45,   // Smooth stream
      true
    );
    this.rightTrailMesh.material = this.trailMaterial;

    this.trailsInitialized = true;
  }

  public setPlayerColor(colorIndex: number, team?: string): void {
    this.colorIndex = colorIndex;
    let color3: Color3;

    if (team === "blue") {
      color3 = Color3.FromHexString("#00f0ff");
    } else if (team === "red") {
      color3 = Color3.FromHexString("#ff2a2a");
    } else {
      const colorDef = getPlayerColor(colorIndex);
      color3 = colorDef.color3;
    }

    if (this.trailMaterial) {
      this.trailMaterial.diffuseColor = color3;
      this.trailMaterial.emissiveColor = color3.scale(3.2);
      this.trailMaterial.alpha = 1.0;
    }
  }

  public async loadKartModel(modelIndex: number): Promise<void> {
    this.modelIndex = modelIndex;
    const def = getKartDef(modelIndex);
    const primaryUrl = def.modelUrl;
    const fallbackUrl = "/models/hoveringcar.glb";

    try {
      await this.loadModel(primaryUrl);
    } catch {
      await this.loadModel(fallbackUrl);
    }
  }

  public async loadModel(modelUrl: string = "/models/kart1.glb"): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync("", modelUrl, "", this.scene);

      // Clean up previously loaded meshes
      this.meshes.forEach((m) => m.dispose());
      this.meshes = [];
      this.frontLeftWheel = null;
      this.frontRightWheel = null;
      this.rearLeftWheel = null;
      this.rearRightWheel = null;

      this.meshes = result.meshes;

      // Group all root imported meshes under modelOffsetNode
      result.meshes.forEach((mesh) => {
        if (!mesh.parent) {
          mesh.parent = this.modelOffsetNode;
        }

        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(mesh, true);
        }
        mesh.receiveShadows = true;

        if (mesh.material) {
          this.enhanceModelMaterial(mesh.material);
        }

        // Search for wheel submeshes
        const lowerName = mesh.name.toLowerCase();
        if (lowerName.includes("wheel") || lowerName.includes("tire")) {
          if (lowerName.includes("fl") || (lowerName.includes("front") && lowerName.includes("l"))) {
            this.frontLeftWheel = mesh;
          } else if (lowerName.includes("fr") || (lowerName.includes("front") && lowerName.includes("r"))) {
            this.frontRightWheel = mesh;
          } else if (lowerName.includes("rl") || lowerName.includes("bl") || (lowerName.includes("rear") && lowerName.includes("l"))) {
            this.rearLeftWheel = mesh;
          } else if (lowerName.includes("rr") || lowerName.includes("br") || (lowerName.includes("rear") && lowerName.includes("r"))) {
            this.rearRightWheel = mesh;
          }
        }
      });

      // Standardize model scale, center, and ground contact
      this.normalizeModelScaleAndOffset();
      this.setPlayerColor(this.colorIndex);
      this.isLoaded = true;

      console.log(`🏎️ Kart model [${modelUrl}] loaded perfectly (${result.meshes.length} meshes)`);
    } catch (err) {
      console.warn(`⚠️ Failed to load GLB model [${modelUrl}], generating procedural fallback:`, err);
      this.createProceduralFallback();
      this.isLoaded = true;
    }
  }

  private enhanceModelMaterial(material: any): void {
    if (material instanceof PBRMaterial) {
      material.directIntensity = 1.35;
      material.environmentIntensity = 1.15;
      material.specularIntensity = 1.0;
      if (material.albedoTexture) {
        material.albedoTexture.hasAlpha = false;
      }
    } else if (material instanceof StandardMaterial) {
      material.specularPower = 32;
    }
  }

  // Universal mathematical bounding-box normalizer for all 10 karts
  private normalizeModelScaleAndOffset(): void {
    this.visualMeshRoot.rotation.set(0, 0, 0);
    this.visualMeshRoot.scaling.set(1, 1, 1);
    this.visualMeshRoot.position.set(0, 0, 0);
    this.modelOffsetNode.position.set(0, 0, 0);
    this.modelOffsetNode.rotation.set(0, 0, 0);
    this.rootNode.position.set(0, 0, 0);
    this.rootNode.rotation.set(0, 0, 0);

    let min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

    for (const mesh of this.meshes) {
      if (mesh.getTotalVertices() > 0) {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, bounds.minimumWorld);
        max = Vector3.Maximize(max, bounds.maximumWorld);
      }
    }

    const size = max.subtract(min);
    const dx = size.x;
    const dy = size.y;
    const dz = size.z;

    // Target uniform vehicle length: 3.3m
    const targetLength = 3.3;
    const maxHorizontal = Math.max(dx, dz);
    let scale = maxHorizontal > 0.01 ? targetLength / maxHorizontal : 1.0;

    // Clamp excessive vertical height (e.g. antennas)
    if (dy * scale > 1.45) {
      scale = 1.45 / dy;
    }

    // Auto-detect or use calibrated forward axis orientation
    const def = getKartDef(this.modelIndex);
    let forwardRotationY = def.rotationYOffset !== undefined
      ? def.rotationYOffset
      : (dx > dz * 1.15 ? -Math.PI / 2 : 0);

    // Center model at origin with bottom at Y = 0
    const center = min.add(size.scale(0.5));
    this.modelOffsetNode.position = new Vector3(
      -center.x,
      -min.y,
      -center.z
    );

    this.visualMeshRoot.scaling = new Vector3(scale, scale, scale);
    this.visualMeshRoot.rotation.y = forwardRotationY;

    this.rootNode.position = new Vector3(0, this.baseHoverHeight, 0);
  }

  private createProceduralFallback(): void {
    const chassis = MeshBuilder.CreateBox("FallbackChassis", { width: 1.6, height: 0.6, depth: 2.8 }, this.scene);
    chassis.parent = this.modelOffsetNode;
    chassis.position.y = 0.4;

    const mat = new StandardMaterial("ChassisMat", this.scene);
    mat.diffuseColor = new Color3(0.2, 0.25, 0.35);
    chassis.material = mat;

    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(chassis);
    }
    this.meshes.push(chassis);
  }

  public update(deltaTime: number, speedKph: number = 0): void {
    if (!this.isLoaded) return;
    this.hoverTimer += deltaTime * 3.5;

    if (Math.abs(speedKph) > 2) {
      this.ensureTrailsActive();
      if (this.leftTrailMesh) this.leftTrailMesh.isVisible = true;
      if (this.rightTrailMesh) this.rightTrailMesh.isVisible = true;
    } else {
      if (this.leftTrailMesh) this.leftTrailMesh.isVisible = false;
      if (this.rightTrailMesh) this.rightTrailMesh.isVisible = false;
    }
  }

  public setVisualTilts(bankingRoll: number, accelPitch: number, isHovering: boolean = true): void {
    const hoverBob = isHovering ? Math.sin(this.hoverTimer) * 0.05 : 0;
    this.tiltNode.position.y = hoverBob;
    this.tiltNode.rotation.z = bankingRoll;
    this.tiltNode.rotation.x = accelPitch;
  }

  public setSteeringVisual(steerAngleRadians: number): void {
    if (this.frontLeftWheel) {
      this.frontLeftWheel.rotation.y = steerAngleRadians;
    }
    if (this.frontRightWheel) {
      this.frontRightWheel.rotation.y = steerAngleRadians;
    }
  }

  public setWheelSpin(rollingSpeed: number): void {
    const deltaRoll = rollingSpeed * 0.05;
    if (this.frontLeftWheel) this.frontLeftWheel.rotation.x += deltaRoll;
    if (this.frontRightWheel) this.frontRightWheel.rotation.x += deltaRoll;
    if (this.rearLeftWheel) this.rearLeftWheel.rotation.x += deltaRoll;
    if (this.rearRightWheel) this.rearRightWheel.rotation.x += deltaRoll;
  }

  public setBoostEffect(active: boolean): void {
    if (this.trailMaterial) {
      this.trailMaterial.alpha = 1.0;
    }
  }

  public setVisible(visible: boolean): void {
    this.rootNode.setEnabled(visible);
    if (!visible) {
      if (this.leftTrailMesh) this.leftTrailMesh.isVisible = false;
      if (this.rightTrailMesh) this.rightTrailMesh.isVisible = false;
    }
  }

  public dispose(): void {
    if (this.leftTrailMesh) this.leftTrailMesh.dispose();
    if (this.rightTrailMesh) this.rightTrailMesh.dispose();
    this.rootNode.dispose();
  }
}
