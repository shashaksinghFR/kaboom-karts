import { CameraMode } from "../scenes/CameraController";

export class HudOverlay {
  private fpsElement: HTMLElement | null;
  private speedElement: HTMLElement | null;
  private driftIndicator: HTMLElement | null;
  private boostIndicator: HTMLElement | null;
  private camModeText: HTMLElement | null;
  private camToggleBtn: HTMLElement | null;

  // Weapon elements
  private weaponBadge: HTMLElement | null;
  private weaponText: HTMLElement | null;
  private weaponCooldownFill: HTMLElement | null;

  private lastFpsUpdate: number = 0;
  private onCameraToggleCallback: (() => void) | null = null;

  constructor() {
    this.fpsElement = document.getElementById("fps-display");
    this.speedElement = document.getElementById("speed-display");
    this.driftIndicator = document.getElementById("drift-indicator");
    this.boostIndicator = document.getElementById("boost-indicator");
    this.camModeText = document.getElementById("cam-mode-text");
    this.camToggleBtn = document.getElementById("cam-toggle-btn");

    this.weaponBadge = document.getElementById("weapon-status-badge");
    this.weaponText = document.getElementById("weapon-status-text");
    this.weaponCooldownFill = document.getElementById("weapon-cooldown-fill");

    if (this.camToggleBtn) {
      this.camToggleBtn.addEventListener("click", () => {
        if (this.onCameraToggleCallback) {
          this.onCameraToggleCallback();
        }
      });
    }
  }

  public onCameraToggle(callback: () => void): void {
    this.onCameraToggleCallback = callback;
  }

  public setCameraMode(mode: CameraMode): void {
    if (this.camModeText) {
      this.camModeText.textContent = mode === CameraMode.CHASE ? "CHASE CAM" : "ORBIT CAM";
    }
  }

  public updateWeaponStatus(isReady: boolean, cooldownRemaining: number, cooldownProgress: number): void {
    if (!this.weaponBadge || !this.weaponText || !this.weaponCooldownFill) return;

    if (isReady) {
      this.weaponBadge.classList.add("ready");
      this.weaponBadge.classList.remove("cooling");
      this.weaponText.textContent = "MISSILE READY";
      this.weaponCooldownFill.style.width = "100%";
    } else {
      this.weaponBadge.classList.remove("ready");
      this.weaponBadge.classList.add("cooling");
      this.weaponText.textContent = `RELOADING (${cooldownRemaining.toFixed(1)}s)`;
      this.weaponCooldownFill.style.width = `${Math.round(cooldownProgress * 100)}%`;
    }
  }

  public updateTelemetry(fps: number, speedKph: number, isDrifting: boolean, isBoosting: boolean): void {
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 250) {
      if (this.fpsElement) {
        this.fpsElement.textContent = `${fps}`;
      }
      this.lastFpsUpdate = now;
    }

    if (this.speedElement) {
      this.speedElement.textContent = `${speedKph}`;
    }

    if (this.driftIndicator) {
      if (isDrifting) {
        this.driftIndicator.classList.add("active-drift");
      } else {
        this.driftIndicator.classList.remove("active-drift");
      }
    }

    if (this.boostIndicator) {
      if (isBoosting) {
        this.boostIndicator.classList.add("active-boost");
      } else {
        this.boostIndicator.classList.remove("active-boost");
      }
    }
  }
}
