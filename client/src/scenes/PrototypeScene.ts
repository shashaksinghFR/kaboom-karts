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

    // 1. High-Luminance Solar & Ambient Space Lighting (Crystal Clear Car Visibility)
    const hemiLight = new HemisphericLight(
      "SpaceHemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 1.85;
    hemiLight.diffuse = new Color3(1.0, 1.0, 1.0); // Pure radiant white ambient
    hemiLight.groundColor = new Color3(0.65, 0.72, 0.85); // Upward reflection from reflective circuit floor

    // Overhead Radiant Sun Light
    const sunPosition = new Vector3(45, 120, 45);
    const stadiumFloodLight = new DirectionalLight(
      "SunDirectionalLight",
      new Vector3(-0.35, -0.92, -0.35).normalize(),
      this.scene
    );
    stadiumFloodLight.position = sunPosition;
    stadiumFloodLight.intensity = 2.4;
    stadiumFloodLight.diffuse = new Color3(1.0, 0.98, 0.92);

    // High-performance PCF Shadow Generator
    this.shadowGenerator = new ShadowGenerator(1024, stadiumFloodLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

    // 2. Build Deep Space Arena & Radiant Sun
    this.setupSpaceStadiumArena(sunPosition);

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

  private setupSpaceStadiumArena(sunPos: Vector3): void {
    const arenaSize = SCENE_CONFIG.DEFAULT_GROUND_SIZE; // 200m
    const arenaRadius = (arenaSize * 0.95) / 2; // ~95m

    // A. Deep Space Skybox Dome with Radiant Stars & Cosmic Nebulae
    const skyDome = MeshBuilder.CreateSphere(
      "SpaceSkyDome",
      { diameter: 450, segments: 24, slice: 0.5 },
      this.scene
    );
    skyDome.position.y = -10;
    skyDome.infiniteDistance = true;

    const skyMat = new StandardMaterial("SpaceSkyMat", this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;

    const skyTex = new DynamicTexture("SpaceSkyTex", { width: 1024, height: 512 }, this.scene, false);
    const sCtx = skyTex.getContext() as CanvasRenderingContext2D;

    // Deep Cosmic Space Gradient
    const spaceGrad = sCtx.createLinearGradient(0, 0, 0, 512);
    spaceGrad.addColorStop(0.0, "#010206");
    spaceGrad.addColorStop(0.35, "#040714");
    spaceGrad.addColorStop(0.70, "#080e28");
    spaceGrad.addColorStop(0.92, "#121a3e");
    spaceGrad.addColorStop(1.0, "#1c2654");
    sCtx.fillStyle = spaceGrad;
    sCtx.fillRect(0, 0, 1024, 512);

    // Glowing Cosmic Nebulae Clouds (Cyan, Magenta & Deep Violet Gas Clouds)
    const nebulae = [
      { x: 220, y: 180, rad: 160, col: "rgba(0, 240, 255, 0.22)" },
      { x: 740, y: 140, rad: 190, col: "rgba(180, 40, 255, 0.24)" },
      { x: 480, y: 260, rad: 140, col: "rgba(255, 40, 120, 0.18)" },
      { x: 920, y: 200, rad: 150, col: "rgba(0, 200, 255, 0.16)" },
      { x: 120, y: 280, rad: 130, col: "rgba(140, 60, 255, 0.20)" },
    ];

    nebulae.forEach((neb) => {
      const g = sCtx.createRadialGradient(neb.x, neb.y, 10, neb.x, neb.y, neb.rad);
      g.addColorStop(0, neb.col);
      g.addColorStop(0.6, neb.col.replace("0.", "0.08"));
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      sCtx.fillStyle = g;
      sCtx.beginPath();
      sCtx.arc(neb.x, neb.y, neb.rad, 0, Math.PI * 2);
      sCtx.fill();
    });

    // 400+ Sparkling Stars & Constellations
    for (let i = 0; i < 420; i++) {
      const sx = (i * 37 + (i % 7) * 83) % 1024;
      const sy = (i * 59 + (i % 11) * 41) % 460;
      const starSize = Math.random() < 0.85 ? Math.random() * 1.8 + 0.6 : Math.random() * 2.8 + 2.0;

      // Color variation: White, Cyan, Gold, Violet
      let starColor = "#ffffff";
      const randType = Math.random();
      if (randType < 0.25) starColor = "#a0f0ff";
      else if (randType < 0.45) starColor = "#ffeaa7";
      else if (randType < 0.60) starColor = "#e0aaff";

      sCtx.fillStyle = starColor;
      sCtx.beginPath();
      sCtx.arc(sx, sy, starSize, 0, Math.PI * 2);
      sCtx.fill();

      // Cross flare for large bright stars
      if (starSize > 2.5) {
        sCtx.strokeStyle = starColor;
        sCtx.lineWidth = 0.8;
        sCtx.beginPath();
        sCtx.moveTo(sx - starSize * 3, sy);
        sCtx.lineTo(sx + starSize * 3, sy);
        sCtx.moveTo(sx, sy - starSize * 3);
        sCtx.lineTo(sx, sy + starSize * 3);
        sCtx.stroke();
      }
    }

    skyTex.update();
    skyMat.emissiveTexture = skyTex;
    skyDome.material = skyMat;

    // B. Radiant 3D Celestial Sun Sphere High Above the Field
    const sunSphere = MeshBuilder.CreateSphere(
      "RadiantSunCore",
      { diameter: 22, segments: 24 },
      this.scene
    );
    sunSphere.position.copyFrom(sunPos);

    const sunMat = new StandardMaterial("SunCoreMat", this.scene);
    sunMat.emissiveColor = new Color3(1.0, 0.98, 0.82); // Blazing white-yellow sun
    sunMat.diffuseColor = new Color3(1.0, 0.95, 0.75);
    sunMat.disableLighting = true;
    sunSphere.material = sunMat;

    // Solar Corona Halo Ring
    const sunCorona = MeshBuilder.CreateTorus(
      "SunCoronaRing",
      { diameter: 34, thickness: 1.8, tessellation: 36 },
      this.scene
    );
    sunCorona.position.copyFrom(sunPos);
    sunCorona.rotation.x = Math.PI / 4;
    sunCorona.rotation.y = Math.PI / 6;

    const coronaMat = new StandardMaterial("SunCoronaMat", this.scene);
    coronaMat.emissiveColor = new Color3(1.0, 0.85, 0.35); // Golden radiant flare
    coronaMat.disableLighting = true;
    coronaMat.alpha = 0.85;
    sunCorona.material = coronaMat;

    // Sun Point Light
    const sunPointLight = new PointLight("SunPointLight", sunPos, this.scene);
    sunPointLight.intensity = 2.8;
    sunPointLight.range = 280;
    sunPointLight.diffuse = new Color3(1.0, 0.96, 0.85);

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
