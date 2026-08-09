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
    this.scene.clearColor = new Color3(0.12, 0.16, 0.28).toColor4(1.0);

    // Bright, crisp atmospheric haze
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.0015;
    this.scene.fogColor = new Color3(0.28, 0.34, 0.50);

    // 1. High-Luminance Stadium Sun & Flood Lighting for Maximum Vehicle Visibility
    const hemiLight = new HemisphericLight(
      "StadiumHemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 2.3;
    hemiLight.diffuse = new Color3(1.0, 1.0, 1.0); // Ultra bright white ambient
    hemiLight.groundColor = new Color3(0.75, 0.82, 0.95); // High upward bounce illumination

    const stadiumSunLight = new DirectionalLight(
      "StadiumSunLight",
      new Vector3(-0.4, -0.9, -0.3).normalize(),
      this.scene
    );
    stadiumSunLight.position = new Vector3(60, 140, 60);
    stadiumSunLight.intensity = 2.8; // Bright radiant sunlight effect
    stadiumSunLight.diffuse = new Color3(1.0, 0.98, 0.92);

    // Dynamic Rim Fill Light to make all enemy cars pop from a distance
    const rimFillLight = new DirectionalLight(
      "StadiumRimFillLight",
      new Vector3(0.45, -0.6, 0.45).normalize(),
      this.scene
    );
    rimFillLight.intensity = 1.3;
    rimFillLight.diffuse = new Color3(0.85, 0.92, 1.0);

    // High-performance PCF Shadow Generator
    this.shadowGenerator = new ShadowGenerator(1024, stadiumSunLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

    // 2. Build Bright Luminous Cyberpunk Stadium Arena
    this.setupBrightStadiumArena();

    // 3. Initialize Kart Visual & Controller
    this.kartVisual = new KartVisual(this.scene, this.shadowGenerator);
    this.kartController = new KartController(this.kartVisual);

    // 4. Initialize Remote Opponents Manager
    this.remoteKartManager = new RemoteKartManager(this.scene, this.shadowGenerator);

    // 5. Initialize Weapon System (2.0s Cooldown)
    this.weaponSystem = new WeaponSystem(this.scene, 2.0);

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

  private setupBrightStadiumArena(): void {
    const arenaSize = SCENE_CONFIG.DEFAULT_GROUND_SIZE; // 200m
    const arenaRadius = (arenaSize * 0.95) / 2; // ~95m

    // A. Skybox Sphere with Crimson Cyber Nebula & Spire Skyline
    const skyDome = MeshBuilder.CreateSphere(
      "StadiumSkyDome",
      { diameter: 8000, segments: 32 },
      this.scene
    );
    skyDome.infiniteDistance = true;

    const skyMat = new StandardMaterial("StadiumSkyMat", this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;

    const skyTex = new DynamicTexture("StadiumSkyTex", { width: 1024, height: 512 }, this.scene, false);
    const sCtx = skyTex.getContext() as CanvasRenderingContext2D;

    // Dramatic Crimson Red Nebula Horizon Gradient
    const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0.0, "#080206");
    skyGrad.addColorStop(0.45, "#24040c");
    skyGrad.addColorStop(0.70, "#5e0b1c");
    skyGrad.addColorStop(0.88, "#a3122c");
    skyGrad.addColorStop(1.0, "#e61c3e");
    sCtx.fillStyle = skyGrad;
    sCtx.fillRect(0, 0, 1024, 512);

    // Glowing Crimson Nebula Clouds
    for (let c = 0; c < 12; c++) {
      const cx = (c * 90) % 1024;
      const cy = 220 + Math.sin(c * 1.5) * 80;
      const rad = 140 + (c % 4) * 40;
      const cGrad = sCtx.createRadialGradient(cx, cy, 10, cx, cy, rad);
      cGrad.addColorStop(0, "rgba(230, 28, 62, 0.35)");
      cGrad.addColorStop(0.6, "rgba(160, 18, 44, 0.15)");
      cGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      sCtx.fillStyle = cGrad;
      sCtx.beginPath();
      sCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      sCtx.fill();
    }

    // High-Tech Cyber Architecture & Spire Silhouette
    sCtx.fillStyle = "#0c0f18";
    
    // Central Cyber Spire (from reference image)
    const spireX = 512;
    sCtx.fillRect(spireX - 16, 512 - 260, 32, 260);
    sCtx.fillRect(spireX - 8, 512 - 340, 16, 80);
    sCtx.fillRect(spireX - 3, 512 - 390, 6, 50);

    // Illuminated Spire Rings (Glowing Cyan)
    sCtx.fillStyle = "#00f0ff";
    for (let sy = 512 - 370; sy < 500; sy += 18) {
      sCtx.fillRect(spireX - 14, sy, 28, 4);
    }

    // Flanking Cyber Megastructures & Horizon Towers
    sCtx.fillStyle = "#0e1320";
    for (let bx = 0; bx < 1024; bx += 40) {
      if (Math.abs(bx - spireX) < 40) continue; // Leave center spire clear
      const distFromCenter = Math.abs(bx - 512) / 512;
      const bHeight = 90 + distFromCenter * 130 + Math.sin(bx * 0.08) * 40;
      const bWidth = 32 + (bx % 16);
      sCtx.fillRect(bx, 512 - bHeight, bWidth, bHeight);

      // Angled Tron Cyber Line Markings on Buildings (Cyan & Red)
      sCtx.strokeStyle = (bx % 80 === 0) ? "#ff2a4b" : "#00f0ff";
      sCtx.lineWidth = 2.5;
      sCtx.beginPath();
      sCtx.moveTo(bx + 4, 512);
      sCtx.lineTo(bx + 4, 512 - bHeight + 10);
      sCtx.lineTo(bx + bWidth - 4, 512 - bHeight + 20);
      sCtx.stroke();

      // Lit Cyber Window Grids
      sCtx.fillStyle = (bx % 80 === 0) ? "rgba(255, 42, 75, 0.9)" : "rgba(0, 240, 255, 0.9)";
      for (let wy = 512 - bHeight + 25; wy < 500; wy += 16) {
        for (let wx = bx + 8; wx < bx + bWidth - 8; wx += 10) {
          if (Math.random() > 0.4) {
            sCtx.fillRect(wx, wy, 4, 6);
          }
        }
      }
      sCtx.fillStyle = "#0e1320";
    }

    skyTex.update();
    skyMat.emissiveTexture = skyTex;
    skyDome.material = skyMat;

    // B. REFLECTIVE TRON CYBER ARENA FLOOR (Reference Image Inspired)
    const ground = MeshBuilder.CreateGround(
      "ReflectiveStadiumFloor",
      { width: arenaSize, height: arenaSize, subdivisions: 4 },
      this.scene
    );

    const groundMat = new StandardMaterial("TronFloorMat", this.scene);
    groundMat.diffuseColor = new Color3(0.72, 0.78, 0.88); // Crisp high-contrast metallic base
    groundMat.specularColor = new Color3(1.0, 1.0, 1.0); // Glossy wet reflections
    groundMat.specularPower = 28;
    groundMat.emissiveColor = new Color3(0.18, 0.22, 0.30); // Self-illuminated circuit clarity

    // High-resolution procedural Tron circuit floor texture
    const groundTex = new DynamicTexture("TronFloorTex", 1024, this.scene, true);
    const gCtx = groundTex.getContext() as CanvasRenderingContext2D;

    // 1. Sleek metallic slate/titanium floor base
    gCtx.fillStyle = "#1e2638";
    gCtx.fillRect(0, 0, 1024, 1024);

    // 2. Subtle high-tech modular floor panel seams
    gCtx.strokeStyle = "rgba(40, 60, 95, 0.55)";
    gCtx.lineWidth = 2.0;
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

    // 3. Glowing Tron Cyan Circuit Lines with 90° Angular Bends (Directly matching reference image)
    gCtx.strokeStyle = "#00f0ff";
    gCtx.shadowColor = "rgba(0, 240, 255, 0.85)";
    gCtx.shadowBlur = 12;
    gCtx.lineWidth = 4.5;

    // Main longitudinal runway circuit tracks
    const circuitOffsets = [160, 280, 400, 624, 744, 864];
    circuitOffsets.forEach((cx, idx) => {
      gCtx.beginPath();
      gCtx.moveTo(cx, 0);
      gCtx.lineTo(cx, 320 + (idx % 3) * 60);
      gCtx.lineTo(cx + ((idx % 2 === 0) ? 36 : -36), 360 + (idx % 3) * 60);
      gCtx.lineTo(cx + ((idx % 2 === 0) ? 36 : -36), 660 + (idx % 3) * 50);
      gCtx.lineTo(cx, 700 + (idx % 3) * 50);
      gCtx.lineTo(cx, 1024);
      gCtx.stroke();
    });

    // 4. Illuminated Central Runway Dash Markers (--- --- ---)
    gCtx.strokeStyle = "#ffffff";
    gCtx.shadowColor = "rgba(0, 240, 255, 0.9)";
    gCtx.shadowBlur = 14;
    gCtx.lineWidth = 6;
    for (let dy = 20; dy < 1024; dy += 60) {
      gCtx.beginPath();
      gCtx.moveTo(512, dy);
      gCtx.lineTo(512, dy + 32);
      gCtx.stroke();
    }

    // 5. Concentric Luminous Combat Rings & Perimeter Borders
    gCtx.shadowBlur = 16;
    gCtx.strokeStyle = "#00f0ff";
    gCtx.lineWidth = 5;
    gCtx.beginPath();
    gCtx.arc(512, 512, 130, 0, Math.PI * 2);
    gCtx.stroke();

    // Red Team / Crimson Combat Ring
    gCtx.strokeStyle = "#ff2a4b";
    gCtx.shadowColor = "rgba(255, 42, 75, 0.85)";
    gCtx.lineWidth = 5;
    gCtx.beginPath();
    gCtx.arc(512, 512, 290, 0, Math.PI * 2);
    gCtx.stroke();

    // Outer Perimeter Boundary Tron Ring
    gCtx.strokeStyle = "#00f0ff";
    gCtx.shadowColor = "rgba(0, 240, 255, 0.95)";
    gCtx.lineWidth = 8;
    gCtx.beginPath();
    gCtx.arc(512, 512, 475, 0, Math.PI * 2);
    gCtx.stroke();

    // Reset shadow blur
    gCtx.shadowBlur = 0;

    groundTex.update();
    groundMat.diffuseTexture = groundTex;

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
    stadiumStructureMat.diffuseColor = new Color3(0.18, 0.22, 0.32);
    stadiumStructureMat.specularColor = new Color3(0.6, 0.75, 0.9);
    stadiumStructureMat.specularPower = 48;

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
      lightArray.rotation.x = 0.35;
      lightArray.material = (i % 2 === 0) ? cyanNeonMat : magentaNeonMat;

      // Real Point Light for Ground Reflections
      const pointLight = new PointLight(
        `StadiumPointLight_${i}`,
        new Vector3(tx * 0.85, 4.0, tz * 0.85),
        this.scene
      );
      pointLight.intensity = 0.9;
      pointLight.diffuse = (i % 2 === 0) ? new Color3(0.0, 0.95, 1.0) : new Color3(1.0, 0.2, 0.7);
      pointLight.range = 55;
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
