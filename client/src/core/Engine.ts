import { Engine as BabylonEngine, Scene } from "@babylonjs/core";

export class GameEngine {
  private engine: BabylonEngine;
  private canvas: HTMLCanvasElement;
  private activeScene: Scene | null = null;
  private resizeHandler: () => void;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;

    // High performance configuration with smart hardware scaling
    this.engine = new BabylonEngine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
      powerPreference: "high-performance",
      doNotHandleContextLost: true,
    });

    // Cap device pixel ratio scaling at 1.5 to prevent GPU lag on 4K/retina displays
    const optimalScale = 1.0 / Math.min(window.devicePixelRatio || 1.0, 1.5);
    this.engine.setHardwareScalingLevel(optimalScale);

    this.resizeHandler = () => {
      this.engine.resize();
    };

    window.addEventListener("resize", this.resizeHandler);
  }

  public getRawEngine(): BabylonEngine {
    return this.engine;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setScene(scene: Scene): void {
    this.activeScene = scene;
  }

  public getScene(): Scene | null {
    return this.activeScene;
  }

  public start(): void {
    this.engine.runRenderLoop(() => {
      if (this.activeScene && this.activeScene.activeCamera) {
        this.activeScene.render();
      }
    });
  }

  public stop(): void {
    this.engine.stopRenderLoop();
  }

  public getFps(): number {
    return Math.round(this.engine.getFps());
  }

  public dispose(): void {
    window.removeEventListener("resize", this.resizeHandler);
    if (this.activeScene) {
      this.activeScene.dispose();
    }
    this.engine.dispose();
  }
}
