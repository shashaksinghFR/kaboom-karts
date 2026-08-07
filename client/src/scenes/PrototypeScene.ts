import {
  Scene,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  ShadowGenerator,
  DynamicTexture,
  Mesh,
} from "@babylonjs/core";
import { GameEngine } from "../core/Engine";
import { KartVisual } from "../entities/KartVisual";
import { KartController } from "../entities/KartController";
import { WeaponSystem } from "../entities/WeaponSystem";
import { RemoteKartManager } from "../entities/RemoteKartManager";
import { CameraController } from "./CameraController";
import { InputManager, KartInputState } from "../input/InputManager";
import { SCENE_CONFIG } from "../config/constants";

export class PrototypeScene {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  public kartVisual: KartVisual;
  public kartController: KartController;
  public weaponSystem: WeaponSystem;
  public remoteKartManager: RemoteKartManager;
  public cameraController: CameraController;

  // Network Callbacks
  public onLocalMissileFired?: (data: {
    id: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
  }) => void;

  public onLocalMissileHit?: (data: {
    missileId: string;
    targetSessionId?: string;
    impactX: number;
    impactY: number;
    impactZ: number;
  }) => void;

  constructor(gameEngine: GameEngine) {
    const rawEngine = gameEngine.getRawEngine();
    const canvas = gameEngine.getCanvas();

    this.scene = new Scene(rawEngine);
    this.scene.clearColor = new Color3(0.04, 0.05, 0.10).toColor4(1.0);

    // Subtle atmospheric distance haze
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.0028;
    this.scene.fogColor = new Color3(0.12, 0.06, 0.22);

    // 1. High-Contrast Cyberpunk Stadium Lighting
    const hemiLight = new HemisphericLight(
      "StadiumHemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 1.45;
    hemiLight.diffuse = new Color3(0.85, 0.92, 1.0); // Bright white/cyan arena light
    hemiLight.groundColor = new Color3(0.25, 0.08, 0.32); // Deep magenta bounce

    const stadiumFloodLight = new DirectionalLight(
      "StadiumFloodLight",
      new Vector3(-0.4, -0.9, -0.3).normalize(),
      this.scene
    );
    stadiumFloodLight.position = new Vector3(50, 120, 50);
    stadiumFloodLight.intensity = 1.8;
    stadiumFloodLight.diffuse = new Color3(0.95, 0.98, 1.0);

    // High-performance PCF Shadow Generator
    this.shadowGenerator = new ShadowGenerator(1024, stadiumFloodLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

    // 2. Build Futuristic Cyberpunk Stadium Arena
    this.setupCyberpunkStadiumArena();

    // 3. Initialize Kart Visual & Controller
    this.kartVisual = new KartVisual(this.scene, this.shadowGenerator);
    this.kartController = new KartController(this.kartVisual);

    // 4. Initialize Remote Opponents Manager
    this.remoteKartManager = new RemoteKartManager(this.scene, this.shadowGenerator);

    // 5. Initialize Weapon System
    this.weaponSystem = new WeaponSystem(this.scene, 3.0);

    // Load Model
    this.kartVisual.loadModel("/models/hoveringcar.glb");

    // 6. Initialize Camera Controller
    this.cameraController = new CameraController(this.scene, canvas);
  }

  public setSpawnTransform(x: number, y: number, z: number, yaw: number): void {
    this.kartController.position.set(x, 0.5, z);
    this.kartController.yaw = yaw;
    this.kartController.forwardSpeed = 0;
    this.kartController.lateralVelocity = 0;
    this.kartVisual.rootNode.position.set(x, 0.5, z);
    this.kartVisual.rootNode.rotation.y = yaw;
  }

  private setupCyberpunkStadiumArena(): void {
    const arenaSize = SCENE_CONFIG.DEFAULT_GROUND_SIZE; // 200m
    const arenaRadius = (arenaSize * 0.95) / 2; // ~95m

    // A. Skybox Dome with Distant Cyberpunk Night City & Stars
    const skyDome = MeshBuilder.CreateSphere(
      "StadiumSkyDome",
      { diameter: 390, segments: 24, slice: 0.5 },
      this.scene
    );
    skyDome.position.y = -10;
    skyDome.infiniteDistance = true;

    const skyMat = new StandardMaterial("StadiumSkyMat", this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;

    const skyTex = new DynamicTexture("StadiumSkyTex", { width: 1024, height: 512 }, this.scene, false);
    const sCtx = skyTex.getContext() as CanvasRenderingContext2D;

    // Night Sky Gradient (Deep Obsidian to Violet Cyberpunk Horizon)
    const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0.0, "#02040a");
    skyGrad.addColorStop(0.55, "#080d22");
    skyGrad.addColorStop(0.82, "#240a3d");
    skyGrad.addColorStop(1.0, "#5e0b59");
    sCtx.fillStyle = skyGrad;
    sCtx.fillRect(0, 0, 1024, 512);

    // Distant Cyber City Silhouette with glowing windows on the horizon
    sCtx.fillStyle = "#060914";
    for (let bx = 0; bx < 1024; bx += 32) {
      const bHeight = 80 + Math.sin(bx * 0.05) * 45 + ((bx * 7) % 50);
      const bWidth = 26 + (bx % 12);
      sCtx.fillRect(bx, 512 - bHeight, bWidth, bHeight);

      // Cyan / Magenta Lit Windows
      sCtx.fillStyle = (bx % 64 === 0) ? "#ff007f" : "#00f0ff";
      for (let wy = 512 - bHeight + 10; wy < 500; wy += 14) {
        for (let wx = bx + 4; wx < bx + bWidth - 4; wx += 8) {
          if (Math.random() > 0.35) {
            sCtx.fillRect(wx, wy, 4, 6);
          }
        }
      }
      sCtx.fillStyle = "#060914";
    }

    skyTex.update();
    skyMat.emissiveTexture = skyTex;
    skyDome.material = skyMat;

    // B. High-Gloss Reflective Wet Tarmac Stadium Floor
    const ground = MeshBuilder.CreateGround(
      "ReflectiveStadiumFloor",
      { width: arenaSize, height: arenaSize, subdivisions: 4 },
      this.scene
    );

    const groundMat = new StandardMaterial("GlossFloorMat", this.scene);
    groundMat.diffuseColor = new Color3(0.06, 0.08, 0.14);
    groundMat.specularColor = new Color3(0.9, 0.95, 1.0); // Intense wet gloss reflections
    groundMat.specularPower = 128; // Sharp specular highlights

    // High resolution procedural stadium floor with concentric neon reflection rings
    const groundTex = new DynamicTexture("GlossFloorTex", 1024, this.scene, true);
    const gCtx = groundTex.getContext() as CanvasRenderingContext2D;

    // Dark sleek wet asphalt base
    gCtx.fillStyle = "#080c18";
    gCtx.fillRect(0, 0, 1024, 1024);

    // Subtle dark grid tiles
    gCtx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    gCtx.lineWidth = 1.5;
    for (let p = 0; p <= 1024; p += 64) {
      gCtx.beginPath();
      gCtx.moveTo(p, 0);
      gCtx.lineTo(p, 1024);
      gCtx.stroke();
      gCtx.beginPath();
      gCtx.moveTo(0, p);
      gCtx.lineTo(1024, p);
      gCtx.stroke();
    }

    // Concentric Arena Glow Rings (Center Stage & Boundary)
    gCtx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    gCtx.lineWidth = 4;
    gCtx.beginPath();
    gCtx.arc(512, 512, 120, 0, Math.PI * 2);
    gCtx.stroke();

    gCtx.strokeStyle = "rgba(255, 0, 128, 0.45)";
    gCtx.lineWidth = 4;
    gCtx.beginPath();
    gCtx.arc(512, 512, 280, 0, Math.PI * 2);
    gCtx.stroke();

    gCtx.strokeStyle = "rgba(0, 240, 255, 0.7)";
    gCtx.lineWidth = 8;
    gCtx.beginPath();
    gCtx.arc(512, 512, 470, 0, Math.PI * 2);
    gCtx.stroke();

    groundTex.update();
    groundMat.diffuseTexture = groundTex;
    groundMat.emissiveColor = new Color3(0.04, 0.05, 0.09);

    ground.material = groundMat;
    ground.receiveShadows = true;

    // C. Multi-Tier Stadium Ribbon Stands & Canopy Structure
    const cyanNeonMat = new StandardMaterial("CyanNeonRibbonMat", this.scene);
    cyanNeonMat.diffuseColor = new Color3(0.0, 0.94, 1.0);
    cyanNeonMat.emissiveColor = new Color3(0.0, 0.85, 1.0);

    const magentaNeonMat = new StandardMaterial("MagentaNeonRibbonMat", this.scene);
    magentaNeonMat.diffuseColor = new Color3(1.0, 0.0, 0.5);
    magentaNeonMat.emissiveColor = new Color3(0.95, 0.0, 0.45);

    const stadiumStructureMat = new StandardMaterial("StadiumStructMat", this.scene);
    stadiumStructureMat.diffuseColor = new Color3(0.08, 0.11, 0.18);
    stadiumStructureMat.specularColor = new Color3(0.4, 0.6, 0.8);
    stadiumStructureMat.specularPower = 32;

    // Tier 1: Lower Ground Ring (Cyan Ribbon at ground perimeter)
    const tier1Ring = MeshBuilder.CreateTorus(
      "StadiumTier1Ribbon",
      { diameter: arenaRadius * 2, thickness: 0.5, tessellation: 72 },
      this.scene
    );
    tier1Ring.position.y = 0.35;
    tier1Ring.material = cyanNeonMat;

    // Tier 2: Mid Grandstand Barrier & Ribbon (Magenta Ribbon)
    const tier2Wall = MeshBuilder.CreateCylinder(
      "StadiumTier2Wall",
      { diameterTop: arenaRadius * 2 + 10, diameterBottom: arenaRadius * 2 + 2, height: 4.5, tessellation: 64 },
      this.scene
    );
    tier2Wall.position.y = 2.25;
    tier2Wall.material = stadiumStructureMat;
    tier2Wall.receiveShadows = true;

    const tier2Ring = MeshBuilder.CreateTorus(
      "StadiumTier2Ribbon",
      { diameter: arenaRadius * 2 + 10, thickness: 0.6, tessellation: 72 },
      this.scene
    );
    tier2Ring.position.y = 4.5;
    tier2Ring.material = magentaNeonMat;

    // Tier 3: Upper Grandstand & Crowd Seating Ring
    const tier3Wall = MeshBuilder.CreateCylinder(
      "StadiumTier3Wall",
      { diameterTop: arenaRadius * 2 + 26, diameterBottom: arenaRadius * 2 + 10, height: 7.0, tessellation: 64 },
      this.scene
    );
    tier3Wall.position.y = 8.0;
    tier3Wall.material = stadiumStructureMat;
    tier3Wall.receiveShadows = true;

    const tier3Ring = MeshBuilder.CreateTorus(
      "StadiumTier3Ribbon",
      { diameter: arenaRadius * 2 + 26, thickness: 0.7, tessellation: 72 },
      this.scene
    );
    tier3Ring.position.y = 11.5;
    tier3Ring.material = cyanNeonMat;

    // Tier 4: Grand Stadium Roof Canopy with Overhead Neon Arches
    const stadiumRoofCanopy = MeshBuilder.CreateTorus(
      "StadiumRoofCanopy",
      { diameter: arenaRadius * 2 + 28, thickness: 3.2, tessellation: 72 },
      this.scene
    );
    stadiumRoofCanopy.position.y = 17.5;
    stadiumRoofCanopy.material = stadiumStructureMat;

    const roofNeonRing = MeshBuilder.CreateTorus(
      "RoofNeonMagentaRing",
      { diameter: arenaRadius * 2 + 25, thickness: 0.9, tessellation: 72 },
      this.scene
    );
    roofNeonRing.position.y = 18.0;
    roofNeonRing.material = magentaNeonMat;

    // D. 8 Stadium Floodlight Towers Beaming onto Field
    const towerCount = 8;
    for (let i = 0; i < towerCount; i++) {
      const angle = (i / towerCount) * Math.PI * 2;
      const tx = Math.cos(angle) * (arenaRadius + 6);
      const tz = Math.sin(angle) * (arenaRadius + 6);

      const pillar = MeshBuilder.CreateCylinder(
        `StadiumPillar_${i}`,
        { diameter: 2.2, height: 16.0, tessellation: 16 },
        this.scene
      );
      pillar.position = new Vector3(tx, 8.0, tz);
      pillar.material = stadiumStructureMat;
      this.shadowGenerator.addShadowCaster(pillar);

      // Floodlight Fixture Array
      const lightArray = MeshBuilder.CreateBox(
        `FloodFixture_${i}`,
        { width: 3.5, height: 1.2, depth: 1.5 },
        this.scene
      );
      lightArray.position = new Vector3(tx, 16.0, tz);
      lightArray.rotation.y = -angle;
      lightArray.rotation.x = 0.35; // Aimed down into arena
      lightArray.material = (i % 2 === 0) ? cyanNeonMat : magentaNeonMat;

      // Real Point Light for Ground Reflections
      const pointLight = new PointLight(
        `StadiumPointLight_${i}`,
        new Vector3(tx * 0.85, 4.0, tz * 0.85),
        this.scene
      );
      pointLight.intensity = 0.65;
      pointLight.diffuse = (i % 2 === 0) ? new Color3(0.0, 0.9, 1.0) : new Color3(1.0, 0.1, 0.6);
      pointLight.range = 45;
    }
  }

  public update(deltaTime: number, inputManager: InputManager, isFrozen: boolean = false): void {
    const rawInput = inputManager.getInput();

    // Clone input and freeze throttle if countdown is active
    const input: KartInputState = {
      ...rawInput,
      throttle: isFrozen ? 0 : rawInput.throttle,
      boost: isFrozen ? false : rawInput.boost,
      fire: isFrozen ? false : rawInput.fire,
    };

    // Toggle Camera mode if C was pressed
    if (input.toggleCamera) {
      this.cameraController.toggleMode();
    }

    // Update Kart Driving Physics & Visuals
    this.kartController.update(deltaTime, input);

    // Physical Kart-to-Kart Collision Resolution
    this.resolveKartCollisions();

    // Update Local Missile Weapon System
    const prevCount = this.weaponSystem.getActiveMissileCount();
    this.weaponSystem.update(deltaTime, input.fire, this.kartController);
    const newCount = this.weaponSystem.getActiveMissileCount();

    if (newCount > prevCount) {
      const forwardHeading = this.kartController.yaw;
      const spawnPos = this.kartController.position.add(
        new Vector3(Math.sin(forwardHeading) * 1.75, 0.55, Math.cos(forwardHeading) * 1.75)
      );
      const missileId = `local_${Date.now()}`;
      this.onLocalMissileFired?.({
        id: missileId,
        x: spawnPos.x,
        y: spawnPos.y,
        z: spawnPos.z,
        yaw: forwardHeading,
        speed: 55,
      });
    }

    // Check missile hits on opponents
    const opponentTargets = this.remoteKartManager.getOpponentHitTargets();
    for (const target of opponentTargets) {
      const hitMissileId = this.weaponSystem.checkCollision(target.position, target.radius);
      if (hitMissileId) {
        this.onLocalMissileHit?.({
          missileId: hitMissileId,
          targetSessionId: target.sessionId,
          impactX: target.position.x,
          impactY: target.position.y,
          impactZ: target.position.z,
        });
      }
    }

    // Update Remote Opponents
    this.remoteKartManager.update(deltaTime);

    // Boost effect
    this.kartVisual.setBoostEffect(this.kartController.isBoosting);

    // Update Close Chase/Orbit Camera
    this.cameraController.update(deltaTime, this.kartController);
  }

  private resolveKartCollisions(): void {
    const oppColliders = this.remoteKartManager.getOpponentColliders();
    const localPos = this.kartController.position;
    const minCollisionDist = 2.65;

    for (const opp of oppColliders) {
      const dx = localPos.x - opp.position.x;
      const dz = localPos.z - opp.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < minCollisionDist * minCollisionDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minCollisionDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;

        // Push local kart away from opponent
        localPos.x += nx * overlap * 0.8;
        localPos.z += nz * overlap * 0.8;

        // Impart bounce / deflection
        const sinYaw = Math.sin(this.kartController.yaw);
        const cosYaw = Math.cos(this.kartController.yaw);
        const headingDotNormal = sinYaw * (-nx) + cosYaw * (-nz);

        if (headingDotNormal > 0) {
          this.kartController.forwardSpeed *= -0.35;
          this.kartController.lateralVelocity += nz * 4.5;
        } else {
          this.kartController.lateralVelocity += (nx * 2.5);
        }

        this.kartVisual.rootNode.position.copyFrom(localPos);
      }
    }
  }

  public getRawScene(): Scene {
    return this.scene;
  }
}
