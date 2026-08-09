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

  private isFrozen: boolean = false;
  private arenaLoaded: boolean = false;

  constructor(gameEngine: GameEngine) {
    const rawEngine = gameEngine.getRawEngine();
    const canvas = gameEngine.getCanvas();

    this.scene = new Scene(rawEngine);
    this.scene.clearColor = new Color3(0.12, 0.16, 0.28).toColor4(1.0);

    // Bright, crisp atmospheric haze
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.0015;
    this.scene.fogColor = new Color3(0.28, 0.34, 0.50);

    // 1. Balanced Stadium Lighting (Fixes the blinding white screen)
    const hemiLight = new HemisphericLight(
      "StadiumHemiLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 0.8;
    hemiLight.diffuse = new Color3(0.9, 0.9, 0.95);
    hemiLight.groundColor = new Color3(0.1, 0.15, 0.25);

    const stadiumSunLight = new DirectionalLight(
      "StadiumSunLight",
      new Vector3(-0.4, -0.9, -0.3).normalize(),
      this.scene
    );
    stadiumSunLight.position = new Vector3(60, 140, 60);
    stadiumSunLight.intensity = 1.4;
    stadiumSunLight.diffuse = new Color3(1.0, 0.98, 0.92);

    const rimFillLight = new DirectionalLight(
      "StadiumRimFillLight",
      new Vector3(0.45, -0.6, 0.45).normalize(),
      this.scene
    );
    rimFillLight.intensity = 0.6;
    rimFillLight.diffuse = new Color3(0.85, 0.92, 1.0);

    // High-performance PCF Shadow Generator
    this.shadowGenerator = new ShadowGenerator(1024, stadiumSunLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;

    // 2. Build 3D Battle Arena & Collisions
    this.setup3DBattleArena();

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
    this.kartController.position.set(x, 2.0, z); // Spawn slightly higher so they drop into the arena
    this.kartController.yaw = yaw;
    this.kartController.forwardSpeed = 0;
    this.kartController.lateralVelocity = 0;
    this.kartVisual.rootNode.position.set(x, 2.0, z);
    this.kartVisual.rootNode.rotation.y = yaw;
  }

  private setup3DBattleArena(): void {
    // 1. Enable Global Physics Collisions and Gravity
    this.scene.collisionsEnabled = true;
    this.scene.gravity = new Vector3(0, -9.81, 0);

    // A. Skybox Sphere with Crimson Cyber Nebula & Spire Skyline
    const skyDome = MeshBuilder.CreateSphere(
      "StadiumSkyDome",
      { diameter: 60000, segments: 32 }, // Scaled down to prevent maxZ clipping
      this.scene
    );
    skyDome.infiniteDistance = true;

    const skyMat = new StandardMaterial("StadiumSkyMat", this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.fogEnabled = false; // Prevent fog from turning the sky into a solid grey wall

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

    skyTex.update();
    skyMat.emissiveTexture = skyTex;
    skyDome.material = skyMat;

    // B. Load Custom 3D Battle Arena Model
    import("@babylonjs/core").then(({ SceneLoader }) => {
      SceneLoader.ImportMeshAsync("", "/models/", "battlearena.glb", this.scene).then((result) => {
        console.log(`🏟️ Battle Arena loaded successfully (${result.meshes.length} meshes)`);
        
        result.meshes.forEach((mesh) => {
          // Enable collisions and shadows for all arena meshes
          mesh.checkCollisions = true;
          mesh.receiveShadows = true;
        });

        // Scale the root node of the loaded arena by 500x
        if (result.meshes.length > 0) {
           // GLB loader usually puts everything under a root node `__root__` which is result.meshes[0]
           result.meshes[0].scaling.scaleInPlace(500);
           
           // Ensure transformations are applied to children for correct physics collisions
           result.meshes.forEach(m => m.computeWorldMatrix(true));
        }

        // Snap kart back up to top so it lands on the new arena
        if (this.kartController) {
           this.kartController.verticalVelocity = 0;
           this.kartController.position.y = 100.0;
        }

        this.arenaLoaded = true;

      }).catch((err) => {
        console.error("⚠️ Failed to load battle arena:", err);
      });
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

    if (!this.arenaLoaded) {
      // Do not update kart physics/movement until the arena is fully loaded
      return;
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
