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

  // Kill & Elimination elements
  private killBanner: HTMLElement | null;
  private killBannerText: HTMLElement | null;
  private killfeedContainer: HTMLElement | null;
  private shotdownModal: HTMLElement | null;
  private shotdownKillerName: HTMLElement | null;
  private btnShotdownLobby: HTMLButtonElement | null;

  private killBannerTimeout: any = null;
  private lastFpsUpdate: number = 0;
  private onCameraToggleCallback: (() => void) | null = null;
  private onShotdownLobbyCallback: (() => void) | null = null;

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

    this.killBanner = document.getElementById("kill-banner");
    this.killBannerText = document.getElementById("kill-banner-text");
    this.killfeedContainer = document.getElementById("hud-killfeed");
    this.shotdownModal = document.getElementById("shotdown-modal");
    this.shotdownKillerName = document.getElementById("shotdown-killer-name");
    this.btnShotdownLobby = document.getElementById("btn-shotdown-lobby") as HTMLButtonElement;

    if (this.camToggleBtn) {
      this.camToggleBtn.addEventListener("click", () => {
        if (this.onCameraToggleCallback) {
          this.onCameraToggleCallback();
        }
      });
    }

    if (this.btnShotdownLobby) {
      this.btnShotdownLobby.addEventListener("click", () => {
        this.hideShotDownModal();
        if (this.onShotdownLobbyCallback) {
          this.onShotdownLobbyCallback();
        }
      });
    }
  }

  public onCameraToggle(callback: () => void): void {
    this.onCameraToggleCallback = callback;
  }

  public onShotdownLobby(callback: () => void): void {
    this.onShotdownLobbyCallback = callback;
  }

  public showKillBanner(victimName: string): void {
    if (!this.killBanner || !this.killBannerText) return;

    if (this.killBannerTimeout) {
      clearTimeout(this.killBannerTimeout);
    }

    this.killBannerText.textContent = `YOU SHOT DOWN ${victimName.toUpperCase()}!`;
    this.killBanner.style.display = "flex";

    this.killBannerTimeout = setTimeout(() => {
      if (this.killBanner) {
        this.killBanner.style.display = "none";
      }
    }, 3200);
  }

  public addKillfeedItem(killerName: string, victimName: string): void {
    if (!this.killfeedContainer) return;

    const item = document.createElement("div");
    item.className = "killfeed-item";
    item.innerHTML = `<span style="color: var(--accent-cyan);">${killerName}</span> <span>🚀</span> <span style="color: var(--accent-red);">${victimName}</span>`;

    this.killfeedContainer.appendChild(item);

    // Fade out and remove after 4.5 seconds
    setTimeout(() => {
      item.style.transition = "opacity 0.5s ease-out, transform 0.5s ease-out";
      item.style.opacity = "0";
      item.style.transform = "translateX(30px)";
      setTimeout(() => item.remove(), 500);
    }, 4500);
  }

  public showShotDownModal(killerName: string): void {
    if (this.shotdownKillerName) {
      this.shotdownKillerName.textContent = killerName ? `BY ${killerName.toUpperCase()}` : "BY RIVAL COMBATANT";
    }
    if (this.shotdownModal) {
      this.shotdownModal.style.display = "flex";
    }
  }

  public startRespawnCountdown(seconds: number): void {
    const countdownEl = document.getElementById("shotdown-countdown");
    if (!countdownEl) return;
    
    let remaining = seconds;
    countdownEl.textContent = `RESPAWNING IN ${remaining}...`;
    
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        countdownEl.textContent = `RESPAWNING IN ${remaining}...`;
      } else {
        clearInterval(interval);
      }
    }, 1000);
    
    (this as any).respawnInterval = interval;
  }

  public hideShotDownModal(): void {
    if (this.shotdownModal) {
      this.shotdownModal.style.display = "none";
    }
    if ((this as any).respawnInterval) {
      clearInterval((this as any).respawnInterval);
    }
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
