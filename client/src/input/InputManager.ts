export interface KartInputState {
  throttle: number; // 1.0 (forward), -1.0 (reverse), 0 (none)
  steer: number;    // -1.0 (left), 1.0 (right), 0 (none)
  drift: boolean;   // Shift or Space / Drift button
  boost: boolean;   // Shift / Boost button
  fire: boolean;    // Space, Left Mouse Click, F, J, Enter / Fire button
  toggleCamera: boolean; // C key trigger / Cam button
  resetKart: boolean;    // R key trigger
}

export type ControlMode = "keyboard" | "touch";

export class InputManager {
  private keysDown: Set<string> = new Set();
  private fireTriggered: boolean = false;
  private toggleCameraTriggered: boolean = false;
  private resetKartTriggered: boolean = false;

  // Touch Controller State
  public touchThrottle: number = 0;
  public touchSteer: number = 0;
  public touchDrift: boolean = false;
  public touchBoost: boolean = false;
  private controlMode: ControlMode = "keyboard";

  private onKeyDownHandler: (e: KeyboardEvent) => void;
  private onKeyUpHandler: (e: KeyboardEvent) => void;
  private onMouseDownHandler: (e: MouseEvent) => void;

  constructor() {
    // Auto-detect mobile touch device on startup
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 900;
    this.controlMode = isTouchDevice ? "touch" : "keyboard";

    this.onKeyDownHandler = (e: KeyboardEvent) => {
      // Prevent browser scrolling on navigation and action keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].includes(e.key)) {
        e.preventDefault();
      }

      const key = e.key.toLowerCase();
      this.keysDown.add(key);

      // Fire triggers (Space, F, J, Enter)
      if ((key === " " || key === "space" || key === "f" || key === "j" || key === "enter") && !e.repeat) {
        this.fireTriggered = true;
      }

      if (key === "c" && !e.repeat) {
        this.toggleCameraTriggered = true;
      }
      if (key === "r" && !e.repeat) {
        this.resetKartTriggered = true;
      }
    };

    this.onKeyUpHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      this.keysDown.delete(key);
    };

    this.onMouseDownHandler = (e: MouseEvent) => {
      // Primary left click on canvas fires missile (ignore if clicking UI buttons)
      const target = e.target as HTMLElement;
      if (target && target.tagName === "CANVAS" && e.button === 0) {
        this.fireTriggered = true;
      }
    };

    window.addEventListener("keydown", this.onKeyDownHandler);
    window.addEventListener("keyup", this.onKeyUpHandler);
    window.addEventListener("mousedown", this.onMouseDownHandler);

    this.setupTouchJoystick();
  }

  public setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
    const touchOverlay = document.getElementById("touch-controls");
    if (touchOverlay) {
      touchOverlay.style.display = mode === "touch" ? "flex" : "none";
    }
  }

  public getControlMode(): ControlMode {
    return this.controlMode;
  }

  public toggleControlMode(): ControlMode {
    const nextMode: ControlMode = this.controlMode === "keyboard" ? "touch" : "keyboard";
    this.setControlMode(nextMode);
    return nextMode;
  }

  private setupTouchJoystick(): void {
    const joystickZone = document.getElementById("joystick-zone");
    const joystickThumb = document.getElementById("joystick-thumb");
    const touchOverlay = document.getElementById("touch-controls");

    if (touchOverlay) {
      touchOverlay.style.display = this.controlMode === "touch" ? "flex" : "none";
    }

    if (joystickZone && joystickThumb) {
      let touchId: number | null = null;
      let startX = 0;
      let startY = 0;
      const maxRadius = 48; // Max thumb travel distance

      const handleStart = (clientX: number, clientY: number, id: number | null) => {
        touchId = id;
        const rect = joystickZone.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        handleMove(clientX, clientY);
      };

      const handleMove = (clientX: number, clientY: number) => {
        const dx = clientX - startX;
        const dy = clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);

        const thumbX = Math.cos(angle) * clampedDist;
        const thumbY = Math.sin(angle) * clampedDist;

        joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

        // Normalize steer (-1 left to 1 right) and throttle (-1 reverse to 1 forward)
        this.touchSteer = Math.max(-1.0, Math.min(1.0, thumbX / maxRadius));
        this.touchThrottle = Math.max(-1.0, Math.min(1.0, -thumbY / maxRadius));
      };

      const handleEnd = () => {
        touchId = null;
        joystickThumb.style.transform = "translate(0px, 0px)";
        this.touchSteer = 0;
        this.touchThrottle = 0;
      };

      // Touch Events for Joystick
      joystickZone.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        handleStart(touch.clientX, touch.clientY, touch.identifier);
      }, { passive: false });

      window.addEventListener("touchmove", (e) => {
        if (touchId === null) return;
        // Prevent default browser behavior (like scrolling) while dragging joystick
        e.preventDefault(); 
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === touchId) {
            handleMove(touch.clientX, touch.clientY);
            break;
          }
        }
      }, { passive: false });

      const onTouchEnd = (e: TouchEvent) => {
        if (touchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            handleEnd();
            break;
          }
        }
      };
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);

      // Mouse drag emulation for desktop joystick testing
      let isMouseDown = false;
      joystickZone.addEventListener("mousedown", (e) => {
        isMouseDown = true;
        handleStart(e.clientX, e.clientY, null);
      });
      window.addEventListener("mousemove", (e) => {
        if (isMouseDown) handleMove(e.clientX, e.clientY);
      });
      window.addEventListener("mouseup", () => {
        if (isMouseDown) {
          isMouseDown = false;
          handleEnd();
        }
      });
    }

    // Touch Action Buttons (Fire, Drift, Boost, Cam)
    const btnTouchFire = document.getElementById("btn-touch-fire");
    const btnTouchDrift = document.getElementById("btn-touch-drift");
    const btnTouchBoost = document.getElementById("btn-touch-boost");
    const btnTouchCam = document.getElementById("btn-touch-cam");

    if (btnTouchFire) {
      btnTouchFire.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.fireTriggered = true;
      }, { passive: false });
      btnTouchFire.addEventListener("mousedown", () => {
        this.fireTriggered = true;
      });
    }

    if (btnTouchDrift) {
      btnTouchDrift.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.touchDrift = true;
      }, { passive: false });
      const endDrift = () => { this.touchDrift = false; };
      btnTouchDrift.addEventListener("touchend", endDrift);
      btnTouchDrift.addEventListener("touchcancel", endDrift);
      btnTouchDrift.addEventListener("mousedown", () => { this.touchDrift = true; });
      btnTouchDrift.addEventListener("mouseup", endDrift);
    }

    if (btnTouchBoost) {
      btnTouchBoost.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.touchBoost = true;
      }, { passive: false });
      const endBoost = () => { this.touchBoost = false; };
      btnTouchBoost.addEventListener("touchend", endBoost);
      btnTouchBoost.addEventListener("touchcancel", endBoost);
      btnTouchBoost.addEventListener("mousedown", () => { this.touchBoost = true; });
      btnTouchBoost.addEventListener("mouseup", endBoost);
    }

    if (btnTouchCam) {
      btnTouchCam.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.toggleCameraTriggered = true;
      }, { passive: false });
      btnTouchCam.addEventListener("mousedown", () => {
        this.toggleCameraTriggered = true;
      });
    }
  }

  public getInput(): KartInputState {
    let throttle = this.touchThrottle;
    let steer = this.touchSteer;

    // Merge Keyboard Input (W/S/Up/Down & A/D/Left/Right)
    if (this.keysDown.has("w") || this.keysDown.has("arrowup")) {
      throttle = 1.0;
    } else if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) {
      throttle = -1.0;
    }

    if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) {
      steer = -1.0;
    } else if (this.keysDown.has("d") || this.keysDown.has("arrowright")) {
      steer = 1.0;
    }

    const drift = this.touchDrift || this.keysDown.has("shift") || this.keysDown.has("control");
    const boost = this.touchBoost || this.keysDown.has("shift");

    const fire = this.fireTriggered;
    this.fireTriggered = false;

    const toggleCamera = this.toggleCameraTriggered;
    this.toggleCameraTriggered = false;

    const resetKart = this.resetKartTriggered;
    this.resetKartTriggered = false;

    return {
      throttle,
      steer,
      drift,
      boost,
      fire,
      toggleCamera,
      resetKart,
    };
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDownHandler);
    window.removeEventListener("keyup", this.onKeyUpHandler);
    window.removeEventListener("mousedown", this.onMouseDownHandler);
    this.keysDown.clear();
  }
}
