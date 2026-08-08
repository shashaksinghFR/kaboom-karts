import { PLAYER_COLORS, getPlayerColor } from "../network/constants";
import { KART_CATALOG, getKartDef } from "../config/karts";

export class LobbyUI {
  // Screens
  private homeView: HTMLElement | null;
  private lobbyView: HTMLElement | null;
  private gameView: HTMLElement | null;
  private gameoverModal: HTMLElement | null;
  private countdownOverlay: HTMLElement | null;
  private countdownNumber: HTMLElement | null;
  private landscapePrompt: HTMLElement | null;
  private btnDismissLandscape: HTMLElement | null;

  // Home Screen Elements
  private playerNameInput: HTMLInputElement | null;
  private roomCodeInput: HTMLInputElement | null;
  private btnCreateRoom: HTMLButtonElement | null;
  private btnJoinRoom: HTMLButtonElement | null;
  private homeErrorMsg: HTMLElement | null;

  // Lobby Screen Elements
  private displayRoomCode: HTMLElement | null;
  private playerCountChip: HTMLElement | null;
  private slotsGrid: HTMLElement | null;
  private kartGallery: HTMLElement | null;
  private currentKartName: HTMLElement | null;
  private btnCopyCode: HTMLButtonElement | null;
  private btnLeaveRoom: HTMLButtonElement | null;
  private btnToggleReady: HTMLButtonElement | null;
  private btnStartGame: HTMLButtonElement | null;

  // Game Over Elements
  private gameoverCard: HTMLElement | null;
  private gameoverBadge: HTMLElement | null;
  private gameoverTitle: HTMLElement | null;
  private winnerNameBanner: HTMLElement | null;
  private gameoverSubtitle: HTMLElement | null;
  private btnReturnLobby: HTMLButtonElement | null;

  // Selected Kart State
  public selectedKartIndex: number = 0;

  // Callbacks
  public onCreateRoomCallback?: (playerName: string) => void;
  public onJoinRoomCallback?: (roomCode: string, playerName: string) => void;
  public onLeaveRoomCallback?: () => void;
  public onToggleReadyCallback?: () => void;
  public onSelectKartCallback?: (kartModelIndex: number) => void;
  public onStartGameCallback?: () => void;
  public onReturnToLobbyCallback?: () => void;

  private isReadyState: boolean = false;
  private isHost: boolean = false;

  constructor() {
    this.homeView = document.getElementById("home-view");
    this.lobbyView = document.getElementById("lobby-view");
    this.gameView = document.getElementById("ui-overlay");
    this.gameoverModal = document.getElementById("gameover-modal");
    this.countdownOverlay = document.getElementById("countdown-overlay");
    this.countdownNumber = document.getElementById("countdown-number");
    this.landscapePrompt = document.getElementById("landscape-prompt");
    this.btnDismissLandscape = document.getElementById("btn-dismiss-landscape");

    this.playerNameInput = document.getElementById("player-name-input") as HTMLInputElement;
    this.roomCodeInput = document.getElementById("room-code-input") as HTMLInputElement;
    this.btnCreateRoom = document.getElementById("btn-create-room") as HTMLButtonElement;
    this.btnJoinRoom = document.getElementById("btn-join-room") as HTMLButtonElement;
    this.homeErrorMsg = document.getElementById("home-error-msg");

    this.displayRoomCode = document.getElementById("display-room-code");
    this.playerCountChip = document.getElementById("player-count-chip");
    this.slotsGrid = document.getElementById("slots-grid");
    this.kartGallery = document.getElementById("kart-gallery");
    this.currentKartName = document.getElementById("current-kart-name");

    this.btnCopyCode = document.getElementById("btn-copy-code") as HTMLButtonElement;
    this.btnLeaveRoom = document.getElementById("btn-leave-room") as HTMLButtonElement;
    this.btnToggleReady = document.getElementById("btn-toggle-ready") as HTMLButtonElement;
    this.btnStartGame = document.getElementById("btn-start-game") as HTMLButtonElement;

    this.gameoverCard = document.getElementById("gameover-card");
    this.gameoverBadge = document.getElementById("gameover-badge");
    this.gameoverTitle = document.getElementById("gameover-title");
    this.winnerNameBanner = document.getElementById("winner-name-banner");
    this.gameoverSubtitle = document.getElementById("gameover-subtitle");
    this.btnReturnLobby = document.getElementById("btn-return-lobby") as HTMLButtonElement;

    this.renderKartGallery();
    this.setupListeners();
    this.checkOrientation();
    window.addEventListener("resize", () => this.checkOrientation());
    window.addEventListener("orientationchange", () => this.checkOrientation());
  }

  private renderKartGallery(): void {
    if (!this.kartGallery) return;

    let html = "";
    KART_CATALOG.forEach((kart, index) => {
      const isSelected = index === this.selectedKartIndex;
      const numStr = (index + 1).toString().padStart(2, "0");

      html += `
        <div class="kart-card ${isSelected ? "selected" : ""}" data-kart-index="${index}" style="--kart-accent: ${kart.accentColor}">
          <div class="kart-card-header">
            <span class="kart-num">#${numStr}</span>
            <span class="kart-accent-dot"></span>
          </div>

          <div class="kart-visual-preview">
            <div class="kart-silhouette">
              <span class="kart-icon-label">🏎️</span>
            </div>
          </div>

          <div class="kart-details">
            <h3 class="kart-name">${kart.name}</h3>
            <p class="kart-tagline">${kart.tagline}</p>

            <div class="kart-stats-cluster">
              <div class="stat-row">
                <span class="stat-name">SPD</span>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width: ${kart.speedRating}%;"></div>
                </div>
              </div>
              <div class="stat-row">
                <span class="stat-name">HND</span>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width: ${kart.handlingRating}%;"></div>
                </div>
              </div>
              <div class="stat-row">
                <span class="stat-name">ARM</span>
                <div class="stat-bar-track">
                  <div class="stat-bar-fill" style="width: ${kart.armorRating}%;"></div>
                </div>
              </div>
            </div>
          </div>

          <button class="btn-lock-kart ${isSelected ? "locked" : ""}" data-kart-index="${index}">
            <span>${isSelected ? "LOCKED IN" : "SELECT KART"}</span>
          </button>
        </div>
      `;
    });

    this.kartGallery.innerHTML = html;

    // Attach click listeners to cards and buttons
    const cards = this.kartGallery.querySelectorAll(".kart-card");
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        const idx = parseInt(card.getAttribute("data-kart-index") || "0", 10);
        this.selectKart(idx);
      });
    });
  }

  public selectKart(index: number): void {
    const safeIdx = Math.max(0, Math.min(KART_CATALOG.length - 1, index));
    this.selectedKartIndex = safeIdx;
    const def = getKartDef(safeIdx);

    if (this.currentKartName) {
      this.currentKartName.textContent = def.name.toUpperCase();
    }

    this.renderKartGallery();
    this.onSelectKartCallback?.(safeIdx);
  }

  private setupListeners(): void {
    this.btnCreateRoom?.addEventListener("click", () => {
      const name = this.getPlayerName();
      this.clearError();
      this.onCreateRoomCallback?.(name);
    });

    this.btnJoinRoom?.addEventListener("click", () => {
      const name = this.getPlayerName();
      const code = this.roomCodeInput?.value.trim().toUpperCase() || "";
      if (!code) {
        this.showError("Please enter a valid room code.");
        return;
      }
      this.clearError();
      this.onJoinRoomCallback?.(code, name);
    });

    this.btnCopyCode?.addEventListener("click", () => {
      const code = this.displayRoomCode?.textContent || "";
      if (code && code !== "------") {
        navigator.clipboard.writeText(code).then(() => {
          if (this.btnCopyCode) {
            const originalText = this.btnCopyCode.innerHTML;
            this.btnCopyCode.innerHTML = "<span>COPIED!</span>";
            setTimeout(() => {
              if (this.btnCopyCode) this.btnCopyCode.innerHTML = originalText;
            }, 1800);
          }
        });
      }
    });

    this.btnLeaveRoom?.addEventListener("click", () => {
      this.onLeaveRoomCallback?.();
      this.showScreen("home");
    });

    this.btnToggleReady?.addEventListener("click", () => {
      this.onToggleReadyCallback?.();
    });

    this.btnStartGame?.addEventListener("click", () => {
      this.onStartGameCallback?.();
    });

    this.btnReturnLobby?.addEventListener("click", () => {
      this.onReturnToLobbyCallback?.();
    });

    this.btnDismissLandscape?.addEventListener("click", () => {
      if (this.landscapePrompt) {
        this.landscapePrompt.style.display = "none";
      }
    });
  }

  private checkOrientation(): void {
    const isMobile = window.innerWidth <= 820 || "ontouchstart" in window;
    const isPortrait = window.innerHeight > window.innerWidth;

    if (this.landscapePrompt) {
      if (isMobile && isPortrait) {
        this.landscapePrompt.style.display = "flex";
      } else {
        this.landscapePrompt.style.display = "none";
      }
    }
  }

  public getPlayerName(): string {
    const raw = this.playerNameInput?.value.trim();
    return raw || `Pilot_${Math.floor(100 + Math.random() * 900)}`;
  }

  public showScreen(screen: "home" | "lobby" | "game" | "gameover"): void {
    if (this.homeView) this.homeView.style.display = screen === "home" ? "flex" : "none";
    if (this.lobbyView) this.lobbyView.style.display = screen === "lobby" ? "flex" : "none";
    if (this.gameView) this.gameView.style.display = screen === "game" ? "flex" : "none";
    if (this.gameoverModal) this.gameoverModal.style.display = screen === "gameover" ? "flex" : "none";

    if (screen !== "game") {
      this.hideCountdown();
    }
  }

  public showCountdown(seconds: number): void {
    if (this.countdownOverlay && this.countdownNumber) {
      this.countdownOverlay.style.display = "flex";
      this.countdownNumber.textContent = seconds > 0 ? `${seconds}` : "GO!";
    }
  }

  public hideCountdown(): void {
    if (this.countdownOverlay) {
      this.countdownOverlay.style.display = "none";
    }
  }

  public setRoomCode(code: string): void {
    if (this.displayRoomCode) {
      this.displayRoomCode.textContent = code;
    }
    const tag = document.getElementById("hud-room-code-tag");
    if (tag) {
      tag.textContent = code;
    }
  }

  public showError(msg: string): void {
    if (this.homeErrorMsg) {
      this.homeErrorMsg.textContent = msg;
      this.homeErrorMsg.style.display = "block";
    }
  }

  public clearError(): void {
    if (this.homeErrorMsg) {
      this.homeErrorMsg.style.display = "none";
      this.homeErrorMsg.textContent = "";
    }
  }

  // Only the winner sees VICTORY; everyone else sees DEFEAT
  public showMatchResult(winnerName: string, isLocalWinner: boolean): void {
    if (this.gameoverCard) {
      this.gameoverCard.className = `modal-card ${isLocalWinner ? "victory" : "defeat"}`;
    }

    if (this.gameoverBadge) {
      this.gameoverBadge.textContent = isLocalWinner ? "CHAMPION" : "MATCH ENDED";
    }

    if (this.gameoverTitle) {
      this.gameoverTitle.textContent = isLocalWinner ? "VICTORY" : "DEFEAT";
    }

    if (this.winnerNameBanner) {
      this.winnerNameBanner.textContent = isLocalWinner ? "YOU WON THE MATCH!" : `${winnerName} WON`;
    }

    if (this.gameoverSubtitle) {
      this.gameoverSubtitle.textContent = isLocalWinner
        ? "You obliterated all rivals in the Cyberpunk Arena!"
        : `Eliminated from the arena. Better luck in the next round!`;
    }

    this.showScreen("gameover");
  }

  public updateLobbyState(state: any, localSessionId: string): void {
    if (!this.slotsGrid || !state || !state.players) return;

    const playersMap = state.players;
    const playerCount = playersMap.size || 0;
    const localPlayer = playersMap.get(localSessionId);

    this.isHost = localPlayer?.isHost || false;
    this.isReadyState = localPlayer?.isReady || false;

    // Sync selected kart index from server state
    if (localPlayer && localPlayer.kartModelIndex !== undefined && localPlayer.kartModelIndex !== this.selectedKartIndex) {
      this.selectedKartIndex = localPlayer.kartModelIndex;
      this.renderKartGallery();
    }

    // Update count chip
    if (this.playerCountChip) {
      this.playerCountChip.textContent = `${playerCount} / 10 PLAYERS`;
    }

    // Build 10 slots map
    const slotMap = new Map<number, any>();
    playersMap.forEach((player: any) => {
      slotMap.set(player.slotIndex, player);
    });

    // Render 10 slots cleanly
    let slotsHtml = "";

    for (let slot = 0; slot < 10; slot++) {
      const p = slotMap.get(slot);
      const colorDef = getPlayerColor(slot);
      const slotNumStr = (slot + 1).toString().padStart(2, "0");

      if (p) {
        const isMe = p.id === localSessionId;
        const kartDef = getKartDef(p.kartModelIndex ?? p.slotIndex ?? 0);
        const statusHtml = p.isReady
          ? `<div class="slot-status-pill ready">READY</div>`
          : `<div class="slot-status-pill waiting">WAITING</div>`;

        slotsHtml += `
          <div class="slot-card occupied" style="--slot-color: ${colorDef.hex}">
            <div class="slot-header">
              <span class="slot-number">SLOT ${slotNumStr}</span>
              <div class="slot-color-swatch" title="${colorDef.name} Trail"></div>
            </div>
            <div class="slot-body">
              <div class="slot-avatar" style="color: ${colorDef.hex}; font-weight: 800; font-family: var(--font-mono); font-size: 0.85rem;">P${slot + 1}</div>
              <div class="slot-name-wrap">
                <div class="slot-pilot-name" title="${p.name}">${p.name} ${isMe ? "(YOU)" : ""}</div>
                <div class="slot-kart-badge" style="color: ${kartDef.accentColor}; font-size: 0.72rem; font-family: var(--font-mono);">
                  🏎️ ${kartDef.name}
                </div>
              </div>
            </div>
            ${statusHtml}
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="slot-card empty" style="--slot-color: ${colorDef.hex}">
            <div class="slot-header">
              <span class="slot-number">SLOT ${slotNumStr}</span>
              <div class="slot-color-swatch" style="opacity: 0.25;"></div>
            </div>
            <div class="slot-body">
              <div class="slot-avatar" style="opacity: 0.3; font-family: var(--font-mono); font-size: 0.75rem;">--</div>
              <div class="slot-name-wrap">
                <div class="slot-pilot-name" style="color: var(--text-muted);">OPEN SLOT</div>
                <span class="slot-role-tag" style="opacity: 0.3;">${colorDef.name.toUpperCase()} TRAIL</span>
              </div>
            </div>
            <div class="slot-status-pill waiting">EMPTY</div>
          </div>
        `;
      }
    }

    this.slotsGrid.innerHTML = slotsHtml;

    // Update Action Buttons
    if (this.btnToggleReady) {
      if (this.isHost) {
        this.btnToggleReady.style.display = "none";
      } else {
        this.btnToggleReady.style.display = "block";
        this.btnToggleReady.innerHTML = this.isReadyState
          ? "<span>UNREADY</span>"
          : "<span>READY UP</span>";
      }
    }

    if (this.btnStartGame) {
      if (this.isHost) {
        this.btnStartGame.style.display = "block";
        const canStart = playerCount >= 2;
        this.btnStartGame.disabled = !canStart;
        this.btnStartGame.innerHTML = canStart
          ? "<span>START GAME</span>"
          : "<span>WAITING FOR RACERS (MIN 2)</span>";
      } else {
        this.btnStartGame.style.display = "block";
        this.btnStartGame.disabled = true;
        this.btnStartGame.innerHTML = "<span>WAITING FOR HOST...</span>";
      }
    }
  }

  public updateScoreboard(playersMap: any, localSessionId: string): void {
    const scoreboardList = document.getElementById("scoreboard-list");
    if (!scoreboardList || !playersMap) return;

    let html = "";
    playersMap.forEach?.((p: any) => {
      const colorDef = getPlayerColor(p.colorIndex);
      const isMe = p.id === localSessionId;
      const isDead = p.eliminated || p.health <= 0;

      html += `
        <div class="scoreboard-row" style="opacity: ${isDead ? 0.45 : 1.0}">
          <div class="scoreboard-name">
            <span class="scoreboard-dot" style="background-color: ${colorDef.hex}"></span>
            <span>${p.name} ${isMe ? "(You)" : ""}</span>
          </div>
          <div class="scoreboard-score">${isDead ? "ELIMINATED" : `${p.health} HP`}</div>
        </div>
      `;
    });

    scoreboardList.innerHTML = html;
  }
}
