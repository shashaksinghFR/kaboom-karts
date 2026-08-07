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
  DynamicTexture,
  Mesh,
  TrailMesh,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { getPlayerColor } from "../network/constants";

export class RemoteKartVisual {
  public rootNode: TransformNode;
  public visualMeshRoot: TransformNode;
  private modelOffsetNode: TransformNode;
  public meshes: AbstractMesh[] = [];
  private scene: Scene;
  private isLoaded: boolean = false;
  private shadowGenerator: ShadowGenerator | null = null;

  // Floating Nameplate (Clean white text, true 4:1 aspect ratio, perfectly proportioned)
  private nameplateMesh!: Mesh;
  private nameplateTexture!: DynamicTexture;
  public playerName: string = "Racer";
  public colorIndex: number = 0;
  public health: number = 100;
  public isHost: boolean = false;

  // Tail Light Trails
  private leftTailLightAnchor!: TransformNode;
  private rightTailLightAnchor!: TransformNode;
  private leftTrailMesh: TrailMesh | null = null;
  private rightTrailMesh: TrailMesh | null = null;
  private trailMaterial!: StandardMaterial;
  private trailsInitialized: boolean = false;

  // Subtle Enemy Underglow Halo
  private underglowMesh!: Mesh;
  private underglowMat!: StandardMaterial;

  // Interpolation targets for smooth remote rendering
  public targetPosition: Vector3 = Vector3.Zero();
  public targetYaw: number = 0;
  public targetPitch: number = 0;
  public targetRoll: number = 0;
  public speedKph: number = 0;

  // Tilt node for visual banking/pitch
  private tiltNode: TransformNode;

  constructor(
    scene: Scene,
    playerName: string,
    colorIndex: number,
    isHost: boolean = false,
    shadowGenerator?: ShadowGenerator
  ) {
    this.scene = scene;
    this.playerName = playerName;
    this.colorIndex = colorIndex;
    this.isHost = isHost;
    this.shadowGenerator = shadowGenerator || null;

    // 1. Root node
    this.rootNode = new TransformNode(`RemoteKart_${playerName}`, this.scene);
    this.rootNode.position = new Vector3(0, 0.5, 0);
    this.targetPosition.copyFrom(this.rootNode.position);

    // 2. Tilt node
    this.tiltNode = new TransformNode("RemoteKartTilt", this.scene);
    this.tiltNode.parent = this.rootNode;

    // 3. Visual mesh container
    this.visualMeshRoot = new TransformNode("RemoteVisualRoot", this.scene);
    this.visualMeshRoot.parent = this.tiltNode;
    this.visualMeshRoot.rotation.y = -Math.PI / 2;

    // 4. Model offset node for centering
    this.modelOffsetNode = new TransformNode("RemoteModelOffset", this.scene);
    this.modelOffsetNode.parent = this.visualMeshRoot;

    // 5. Setup Subtle Underglow Aura
    this.setupSubtleGlow();

    // 6. Setup Tail Light Anchors & Trails
    this.setupTailLightTrails();

    // 7. Setup Clean Proportionate Nameplate
    this.setupNameplate();

    // 8. Load Model with original textures + subtle glow enhancement
    this.loadModel();
  }

  private setupSubtleGlow(): void {
    const playerColor = getPlayerColor(this.colorIndex);

    // Create subtle underglow disc on the ground directly beneath kart
    this.underglowMesh = MeshBuilder.CreateDisc(
      `RemoteUnderglow_${this.playerName}`,
      { radius: 1.85, tessellation: 32 },
      this.scene
    );
    this.underglowMesh.parent = this.tiltNode;
    this.underglowMesh.rotation.x = Math.PI / 2; // Flat on floor
    this.underglowMesh.position.y = -0.38; // Hovering right above ground

    this.underglowMat = new StandardMaterial(`RemoteUnderglowMat_${this.playerName}`, this.scene);
    this.underglowMat.diffuseColor = playerColor.color3;
    this.underglowMat.emissiveColor = playerColor.color3;
    this.underglowMat.disableLighting = true;
    this.underglowMat.alpha = 0.35;
    this.underglowMat.backFaceCulling = false;

    // Radial gradient glow texture
    const glowTex = new DynamicTexture(
      `UnderglowTex_${this.playerName}`,
      256,
      this.scene,
      false
    );
    glowTex.hasAlpha = true;
    const ctx = glowTex.getContext() as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grad.addColorStop(0.45, "rgba(255, 255, 255, 0.45)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    glowTex.update();

    this.underglowMat.opacityTexture = glowTex;
    this.underglowMesh.material = this.underglowMat;
  }

  private setupTailLightTrails(): void {
    this.leftTailLightAnchor = new TransformNode("RemoteLeftTailAnchor", this.scene);
    this.leftTailLightAnchor.parent = this.tiltNode;
    this.leftTailLightAnchor.position = new Vector3(-0.42, 0.28, -1.35);

    this.rightTailLightAnchor = new TransformNode("RemoteRightTailAnchor", this.scene);
    this.rightTailLightAnchor.parent = this.tiltNode;
    this.rightTailLightAnchor.position = new Vector3(0.42, 0.28, -1.35);

    const playerColor = getPlayerColor(this.colorIndex);
    this.trailMaterial = new StandardMaterial(`RemoteTrailMat_${this.colorIndex}`, this.scene);
    this.trailMaterial.diffuseColor = playerColor.color3;
    this.trailMaterial.emissiveColor = playerColor.color3;
    this.trailMaterial.disableLighting = true;
    this.trailMaterial.alpha = 0.45;
    this.trailMaterial.backFaceCulling = false;
  }

  private ensureTrailsActive(): void {
    if (this.trailsInitialized) return;

    this.leftTrailMesh = new TrailMesh(
      `RemoteLeftTrail_${this.playerName}`,
      this.leftTailLightAnchor,
      this.scene,
      0.08,
      25,
      true
    );
    this.leftTrailMesh.material = this.trailMaterial;

    this.rightTrailMesh = new TrailMesh(
      `RemoteRightTrail_${this.playerName}`,
      this.rightTailLightAnchor,
      this.scene,
      0.08,
      25,
      true
    );
    this.rightTrailMesh.material = this.trailMaterial;

    this.trailsInitialized = true;
  }

  private setupNameplate(): void {
    // 3.6m wide by 0.9m high plane (4:1 aspect ratio)
    this.nameplateMesh = MeshBuilder.CreatePlane(
      "NameplatePlane",
      { width: 3.6, height: 0.9 },
      this.scene
    );
    this.nameplateMesh.parent = this.rootNode;
    this.nameplateMesh.position.y = 1.6;
    this.nameplateMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;

    // Matching 4:1 texture dimension (512 x 128)
    this.nameplateTexture = new DynamicTexture(
      "NameplateTex",
      { width: 512, height: 128 },
      this.scene,
      true
    );
    this.nameplateTexture.hasAlpha = true;

    const mat = new StandardMaterial("NameplateMat", this.scene);
    mat.diffuseTexture = this.nameplateTexture;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;
    this.nameplateMesh.material = mat;

    this.updateNameplate();
  }

  public updateNameplate(): void {
    const ctx = this.nameplateTexture.getContext() as CanvasRenderingContext2D;

    // 100% transparent background
    ctx.clearRect(0, 0, 512, 128);

    // Sharp, crisp text with strong outline for visibility over bright arena
    ctx.font = "bold 44px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = "#ffffff";
    ctx.fillText(this.playerName, 256, 64);

    this.nameplateTexture.update();
  }

  private async loadModel(modelUrl: string = "/models/hoveringcar.glb"): Promise<void> {
    try {
      const result = await SceneLoader.ImportMeshAsync("", "", modelUrl, this.scene);
      this.meshes = result.meshes;

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
      });

      this.normalizeModelScaleAndOffset();
      this.isLoaded = true;
    } catch (err) {
      console.warn("⚠️ Failed to load remote GLB model, using procedural fallback:", err);
      this.createProceduralFallback();
      this.isLoaded = true;
    }
  }

  private enhanceModelMaterial(material: any): void {
    const playerColor = getPlayerColor(this.colorIndex);

    if (material instanceof PBRMaterial) {
      material.directIntensity = 1.45;
      material.environmentIntensity = 1.35;
      material.specularIntensity = 1.1;
      // Gentle subtle emissive tint based on player color
      material.emissiveColor = playerColor.color3.scale(0.18);
      if (material.albedoTexture) {
        material.albedoTexture.hasAlpha = false;
      }
    } else if (material instanceof StandardMaterial) {
      material.specularPower = 48;
      material.emissiveColor = playerColor.color3.scale(0.2);
    }
  }

  private normalizeModelScaleAndOffset(): void {
    this.visualMeshRoot.rotation.set(0, 0, 0);
    this.visualMeshRoot.scaling.set(1, 1, 1);
    this.visualMeshRoot.position.set(0, 0, 0);
    this.modelOffsetNode.position.set(0, 0, 0);
    this.rootNode.position.set(0, 0, 0);

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
    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetLength = 3.2;
    let scale = maxDimension > 0.01 ? targetLength / maxDimension : 1.0;

    const center = min.add(size.scale(0.5));
    this.modelOffsetNode.position = new Vector3(-center.x, -min.y, -center.z);
    this.visualMeshRoot.scaling = new Vector3(scale, scale, scale);
    this.visualMeshRoot.rotation.y = -Math.PI / 2;
    this.rootNode.position.copyFrom(this.targetPosition);
  }

  private createProceduralFallback(): void {
    const chassis = MeshBuilder.CreateBox("FallbackChassis", { width: 1.6, height: 0.6, depth: 2.8 }, this.scene);
    chassis.parent = this.modelOffsetNode;
    chassis.position.y = 0.4;

    const mat = new StandardMaterial("FallbackMat", this.scene);
    mat.diffuseColor = new Color3(0.2, 0.25, 0.35);
    chassis.material = mat;
    this.meshes.push(chassis);
  }

  public update(deltaTime: number): void {
    if (!this.isLoaded) return;

    // Smooth position interpolation (16 * deltaTime factor)
    const lerpRate = Math.min(1.0, 16.0 * deltaTime);
    this.rootNode.position = Vector3.Lerp(this.rootNode.position, this.targetPosition, lerpRate);

    // Smooth yaw rotation interpolation
    let deltaYaw = this.targetYaw - this.rootNode.rotation.y;
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
    this.rootNode.rotation.y += deltaYaw * lerpRate;

    // Pitch & Roll
    this.tiltNode.rotation.x += (this.targetPitch - this.tiltNode.rotation.x) * lerpRate;
    this.tiltNode.rotation.z += (this.targetRoll - this.tiltNode.rotation.z) * lerpRate;

    // Update Opponent's Visible Tail Light Trails
    if (Math.abs(this.speedKph) > 2) {
      this.ensureTrailsActive();
      if (this.leftTrailMesh) this.leftTrailMesh.isVisible = true;
      if (this.rightTrailMesh) this.rightTrailMesh.isVisible = true;
    } else {
      if (this.leftTrailMesh) this.leftTrailMesh.isVisible = false;
      if (this.rightTrailMesh) this.rightTrailMesh.isVisible = false;
    }
  }

  public setHealth(health: number): void {
    if (this.health !== health) {
      this.health = health;
      this.updateNameplate();
    }
  }

  public dispose(): void {
    if (this.leftTrailMesh) this.leftTrailMesh.dispose();
    if (this.rightTrailMesh) this.rightTrailMesh.dispose();
    if (this.underglowMesh) this.underglowMesh.dispose();
    if (this.underglowMat) this.underglowMat.dispose();
    this.nameplateMesh.dispose();
    this.nameplateTexture.dispose();
    this.meshes.forEach((m) => m.dispose());
    this.rootNode.dispose();
  }
}
