import {
  Scene,
  HemisphericLight,
  DirectionalLight,
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
import { KartController, RampZone } from "../entities/KartController";
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
    this.scene.clearColor = new Color3(0.06, 0.02, 0.12).toColor4(1.0);

    // Subtle atmospheric synthwave fog for distance depth
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.0032;
    this.scene.fogColor = new Color3(0.42, 0.08, 0.38);

    // 1. Setup High-Contrast Synthwave Lighting
    const hemiLight = new HemisphericLight(
      "SynthwaveHemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 1.3;
    hemiLight.diffuse = new Color3(0.92, 0.72, 1.0); // Warm radiant ambient
    hemiLight.groundColor = new Color3(0.24, 0.08, 0.36); // Indigo bounce

    const dirLight = new DirectionalLight(
      "SunDirectionalLight",
      new Vector3(-0.5, -0.85, -0.4).normalize(),
      this.scene
    );
    dirLight.position = new Vector3(60, 100, 50);
    dirLight.intensity = 1.6;
    dirLight.diffuse = new Color3(1.0, 0.88, 0.95);

    // High-performance PCF Shadow Generator (No heavy blur kernels)
    this.shadowGenerator = new ShadowGenerator(1024, dirLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

    // 2. Setup Synthwave Neon Grid Arena & Sunset Skybox
    this.setupSynthwaveArena();

    // 3. Setup Jump Ramps & Physics Zones
    this.setupJumpRamps();

    // 4. Initialize Kart Visual & Controller
    this.kartVisual = new KartVisual(this.scene, this.shadowGenerator);
    this.kartController = new KartController(this.kartVisual);

    // 5. Initialize Remote Opponents Manager
    this.remoteKartManager = new RemoteKartManager(this.scene, this.shadowGenerator);

    // 6. Initialize Modular Weapon System with 3.0s cooldown
    this.weaponSystem = new WeaponSystem(this.scene, 3.0);

    // Asynchronously load the GLB model
    this.kartVisual.loadModel("/models/hoveringcar.glb");

    // 7. Initialize Camera Controller
    this.cameraController = new CameraController(this.scene, canvas);
  }

  public setSpawnTransform(x: number, y: number, z: number, yaw: number): void {
    this.kartController.position.set(x, y, z);
    this.kartController.yaw = yaw;
    this.kartController.forwardSpeed = 0;
    this.kartController.lateralVelocity = 0;
    this.kartController.verticalVelocity = 0;
    this.kartController.isAirborne = false;
    this.kartVisual.rootNode.position.set(x, y, z);
    this.kartVisual.rootNode.rotation.y = yaw;
  }

  private setupSynthwaveArena(): void {
    const arenaSize = SCENE_CONFIG.DEFAULT_GROUND_SIZE; // 200m
    const arenaRadius = (arenaSize * 0.95) / 2;

    // A. Synthwave Sunset Horizon Sky Dome
    const skyDome = MeshBuilder.CreateSphere(
      "SynthwaveSkyDome",
      { diameter: 380, segments: 24, slice: 0.5 },
      this.scene
    );
    skyDome.position.y = -10;
    skyDome.infiniteDistance = true;

    const skyMat = new StandardMaterial("SkyDomeMat", this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;

    // Procedural Synthwave Sunset & Starfield Gradient
    const skyTex = new DynamicTexture("SkyDomeTex", { width: 1024, height: 512 }, this.scene, false);
    const sCtx = skyTex.getContext() as CanvasRenderingContext2D;

    // Horizon Gradient (Dark Indigo Top -> Vibrant Purple Mid -> Glowing Hot Pink Horizon)
    const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0.0, "#05010d");
    skyGrad.addColorStop(0.45, "#15042a");
    skyGrad.addColorStop(0.72, "#4a0e4e");
    skyGrad.addColorStop(0.88, "#9d1772");
    skyGrad.addColorStop(1.0, "#ff2a85");
    sCtx.fillStyle = skyGrad;
    sCtx.fillRect(0, 0, 1024, 512);

    // Draw twinkling starfield in upper atmosphere
    sCtx.fillStyle = "#ffffff";
    for (let i = 0; i < 180; i++) {
      const sx = Math.random() * 1024;
      const sy = Math.random() * 320;
      const sr = Math.random() * 1.5 + 0.5;
      const sa = Math.random() * 0.8 + 0.2;
      sCtx.globalAlpha = sa;
      sCtx.beginPath();
      sCtx.arc(sx, sy, sr, 0, Math.PI * 2);
      sCtx.fill();
    }
    sCtx.globalAlpha = 1.0;
    skyTex.update();
    skyMat.emissiveTexture = skyTex;
    skyDome.material = skyMat;

    // B. Synthwave Glowing Neon Grid Floor
    const ground = MeshBuilder.CreateGround(
      "SynthwaveGridFloor",
      {
        width: arenaSize,
        height: arenaSize,
        subdivisions: 4,
      },
      this.scene
    );

    const groundMat = new StandardMaterial("SynthwaveFloorMat", this.scene);
    groundMat.diffuseColor = new Color3(0.08, 0.02, 0.16);
    groundMat.specularColor = new Color3(0.65, 0.15, 0.55);
    groundMat.specularPower = 64;

    // Procedural Glowing Magenta & Pink Grid Texture
    const gridTexture = new DynamicTexture("SynthwaveGridTex", 1024, this.scene, true);
    const ctx = gridTexture.getContext() as CanvasRenderingContext2D;

    // Dark violet floor tiles
    ctx.fillStyle = "#0c021a";
    ctx.fillRect(0, 0, 1024, 1024);

    // Fine inner grid lines (Purple Glow)
    ctx.strokeStyle = "rgba(168, 38, 178, 0.45)";
    ctx.lineWidth = 2.0;
    const subStep = 32;
    for (let x = 0; x <= 1024; x += subStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += subStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Major Neon Magenta Grid Lines
    ctx.strokeStyle = "#ff2a85";
    ctx.lineWidth = 4.5;
    ctx.shadowColor = "rgba(255, 42, 133, 0.85)";
    ctx.shadowBlur = 10;
    const majorStep = 128;
    for (let x = 0; x <= 1024; x += majorStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += majorStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    gridTexture.update();
    gridTexture.uScale = 8;
    gridTexture.vScale = 8;
    groundMat.diffuseTexture = gridTexture;
    groundMat.emissiveColor = new Color3(0.06, 0.01, 0.08);

    ground.material = groundMat;
    ground.receiveShadows = true;

    // C. Glowing Arena Boundary Rails
    const outerRing = MeshBuilder.CreateTorus(
      "OuterBorderRing",
      { diameter: arenaSize * 0.95, thickness: 0.5, tessellation: 64 },
      this.scene
    );
    outerRing.position.y = 0.25;
    const railMat = new StandardMaterial("BorderRailMat", this.scene);
    railMat.diffuseColor = new Color3(0.9, 0.15, 0.55);
    railMat.emissiveColor = new Color3(0.6, 0.08, 0.35);
    outerRing.material = railMat;

    const topNeonRail = MeshBuilder.CreateTorus(
      "TopNeonRail",
      { diameter: arenaSize * 0.95, thickness: 0.35, tessellation: 64 },
      this.scene
    );
    topNeonRail.position.y = 2.2;
    const neonRailMat = new StandardMaterial("TopNeonMat", this.scene);
    neonRailMat.diffuseColor = new Color3(0.2, 0.8, 1.0);
    neonRailMat.emissiveColor = new Color3(0.1, 0.65, 0.95);
    topNeonRail.material = neonRailMat;

    // D. 12 Synthwave Arena Boundary Obelisks
    const pillarMat = new StandardMaterial("PillarMat", this.scene);
    pillarMat.diffuseColor = new Color3(0.12, 0.04, 0.22);
    pillarMat.specularColor = new Color3(0.7, 0.2, 0.6);

    const pillarCount = 12;
    for (let i = 0; i < pillarCount; i++) {
      const ang = (i / pillarCount) * Math.PI * 2;
      const px = Math.cos(ang) * arenaRadius;
      const pz = Math.sin(ang) * arenaRadius;

      const pillar = MeshBuilder.CreateBox(
        `SynthPillar_${i}`,
        { width: 1.8, height: 4.0, depth: 1.8 },
        this.scene
      );
      pillar.position = new Vector3(px, 2.0, pz);
      pillar.rotation.y = -ang;
      pillar.material = pillarMat;
      this.shadowGenerator.addShadowCaster(pillar);
      pillar.receiveShadows = true;

      // Neon Top Beacon
      const beacon = MeshBuilder.CreateBox(
        `Beacon_${i}`,
        { width: 2.0, height: 0.4, depth: 2.0 },
        this.scene
      );
      beacon.position = new Vector3(px, 4.0, pz);
      beacon.rotation.y = -ang;
      beacon.material = railMat;
    }
  }

  private setupJumpRamps(): void {
    // 6 Jump Ramps positioned strategically around the arena
    const rampConfigs: RampZone[] = [
      // North Ramp (Facing South towards center)
      { position: new Vector3(0, 0, 42), yaw: Math.PI, width: 6.5, length: 11.0, height: 3.4 },
      // South Ramp (Facing North towards center)
      { position: new Vector3(0, 0, -42), yaw: 0, width: 6.5, length: 11.0, height: 3.4 },
      // East Ramp (Facing West towards center)
      { position: new Vector3(42, 0, 0), yaw: -Math.PI / 2, width: 6.5, length: 11.0, height: 3.4 },
      // West Ramp (Facing East towards center)
      { position: new Vector3(-42, 0, 0), yaw: Math.PI / 2, width: 6.5, length: 11.0, height: 3.4 },
      // Diagonal NE Ramp
      { position: new Vector3(28, 0, 28), yaw: -Math.PI * 0.75, width: 6.5, length: 11.0, height: 3.4 },
      // Diagonal SW Ramp
      { position: new Vector3(-28, 0, -28), yaw: Math.PI * 0.25, width: 6.5, length: 11.0, height: 3.4 },
    ];

    // Store in controller for real-time physics detection
    KartController.ramps = rampConfigs;

    // Materials for ramps
    const rampMat = new StandardMaterial("RampBodyMat", this.scene);
    rampMat.diffuseColor = new Color3(0.14, 0.05, 0.26);
    rampMat.specularColor = new Color3(0.8, 0.2, 0.7);

    const rampEdgeMat = new StandardMaterial("RampEdgeMat", this.scene);
    rampEdgeMat.diffuseColor = new Color3(1.0, 0.2, 0.6);
    rampEdgeMat.emissiveColor = new Color3(0.9, 0.15, 0.55);

    const rampArrowMat = new StandardMaterial("RampArrowMat", this.scene);
    rampArrowMat.diffuseColor = new Color3(0.2, 0.9, 1.0);
    rampArrowMat.emissiveColor = new Color3(0.1, 0.75, 0.95);

    rampConfigs.forEach((cfg, idx) => {
      const rampNode = new Mesh(`RampMeshNode_${idx}`, this.scene);
      rampNode.position.copyFrom(cfg.position);
      rampNode.rotation.y = cfg.yaw;

      // Incline angle
      const inclineAngle = -Math.atan2(cfg.height, cfg.length);

      // Incline surface
      const inclinePlane = MeshBuilder.CreateBox(
        `RampIncline_${idx}`,
        { width: cfg.width, height: 0.35, depth: cfg.length },
        this.scene
      );
      inclinePlane.parent = rampNode;
      inclinePlane.position = new Vector3(0, cfg.height / 2, 0);
      inclinePlane.rotation.x = inclineAngle;
      inclinePlane.material = rampMat;
      this.shadowGenerator.addShadowCaster(inclinePlane);
      inclinePlane.receiveShadows = true;

      // Neon Guide Rails (Left & Right)
      const leftRail = MeshBuilder.CreateBox(
        `RampRailL_${idx}`,
        { width: 0.35, height: 0.6, depth: cfg.length },
        this.scene
      );
      leftRail.parent = rampNode;
      leftRail.position = new Vector3(-cfg.width / 2, cfg.height / 2 + 0.2, 0);
      leftRail.rotation.x = inclineAngle;
      leftRail.material = rampEdgeMat;

      const rightRail = MeshBuilder.CreateBox(
        `RampRailR_${idx}`,
        { width: 0.35, height: 0.6, depth: cfg.length },
        this.scene
      );
      rightRail.parent = rampNode;
      rightRail.position = new Vector3(cfg.width / 2, cfg.height / 2 + 0.2, 0);
      rightRail.rotation.x = inclineAngle;
      rightRail.material = rampEdgeMat;

      // Crest Glow Strip (Launch Edge)
      const crestStrip = MeshBuilder.CreateBox(
        `RampCrest_${idx}`,
        { width: cfg.width + 0.2, height: 0.45, depth: 0.45 },
        this.scene
      );
      crestStrip.parent = rampNode;
      crestStrip.position = new Vector3(0, cfg.height, cfg.length / 2);
      crestStrip.material = rampArrowMat;
    });
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

    // Update Kart Driving Physics, Ramps & Visuals
    this.kartController.update(deltaTime, input);

    // Physical Kart-to-Kart Collision Resolution
    this.resolveKartCollisions();

    // Update Local Missile Weapon System (Firing + 3.0s Cooldown)
    const prevCount = this.weaponSystem.getActiveMissileCount();
    this.weaponSystem.update(deltaTime, input.fire, this.kartController);
    const newCount = this.weaponSystem.getActiveMissileCount();

    if (newCount > prevCount) {
      // Missile was just fired! Broadcast over network
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
      // Check proximity with local active missiles
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

    // Update Remote Opponents & Remote VFX
    this.remoteKartManager.update(deltaTime);

    // Boost effect
    this.kartVisual.setBoostEffect(this.kartController.isBoosting);

    // Update Chase/Orbit Camera
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

        // Apply updated position immediately to mesh
        this.kartVisual.rootNode.position.copyFrom(localPos);
      }
    }
  }

  public getRawScene(): Scene {
    return this.scene;
  }
}
