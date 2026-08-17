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
  private homeFullscreenBtn: HTMLButtonElement | null;
  private hudFullscreenBtn: HTMLButtonElement | null;

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
  private btnModeFfa: HTMLButtonElement | null;
  private btnModeTeam: HTMLButtonElement | null;
  private teamModeIndicator: HTMLElement | null;
  private slotsSectionTitle: HTMLElement | null;

  // Game Over Elements
  private gameoverCard: HTMLElement | null;
  private gameoverBadge: HTMLElement | null;
  private gameoverTitle: HTMLElement | null;
  private winnerNameBanner: HTMLElement | null;
  private gameoverSubtitle: HTMLElement | null;
  private btnReturnLobby: HTMLButtonElement | null = null;
  private loadingOverlay: HTMLElement | null = null;
  private loaderFill: HTMLElement | null = null;

  // Selected Kart State & Performance Caching
  public selectedKartIndex: number = 0;
  public currentGameMode: "ffa" | "team" = "ffa";
  private latestPlayersMap: any = null;
  private localSessionId: string = "";
  private lastLobbyHash: string = "";
  private lastScoreboardHash: string = "";
  private lastGalleryHash: string = "";

  // Callbacks
  public onCreateRoomCallback?: (playerName: string) => void;
  public onJoinRoomCallback?: (roomCode: string, playerName: string) => void;
  public onLeaveRoomCallback?: () => void;
  public onToggleReadyCallback?: () => void;
  public onSelectKartCallback?: (kartModelIndex: number) => void;
  public onSwitchSlotCallback?: (slotIndex: number) => void;
  public onSetGameModeCallback?: (gameMode: "ffa" | "team") => void;
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
    this.homeFullscreenBtn = document.getElementById("home-fullscreen-btn") as HTMLButtonElement;
    this.hudFullscreenBtn = document.getElementById("hud-fullscreen-toggle") as HTMLButtonElement;

    this.displayRoomCode = document.getElementById("display-room-code");
    this.playerCountChip = document.getElementById("player-count-chip");
    this.slotsGrid = document.getElementById("slots-grid");
    this.kartGallery = document.getElementById("kart-gallery");
    this.currentKartName = document.getElementById("current-kart-name");
    this.btnModeFfa = document.getElementById("btn-mode-ffa") as HTMLButtonElement;
    this.btnModeTeam = document.getElementById("btn-mode-team") as HTMLButtonElement;
    this.teamModeIndicator = document.getElementById("team-mode-indicator");
    this.slotsSectionTitle = document.getElementById("slots-section-title");

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
    this.loadingOverlay = document.getElementById("loading-overlay");
    this.loaderFill = document.getElementById("loader-fill");

    this.renderKartGallery();
    this.setupListeners();
    this.checkOrientation();
    window.addEventListener("resize", () => this.checkOrientation());
    window.addEventListener("orientationchange", () => this.checkOrientation());
  }

  public renderKartGallery(): void {
    if (!this.kartGallery) return;

    // Check if gallery state actually changed before rebuilding DOM
    const galleryHash = `${this.selectedKartIndex}_` + (this.latestPlayersMap ? Array.from(this.latestPlayersMap.values()).map((p: any) => `${p.id}_${p.kartModelIndex}`).join("|") : "");
    if (galleryHash === this.lastGalleryHash && this.kartGallery.children.length > 0) {
      return;
    }
    this.lastGalleryHash = galleryHash;

    let html = "";
    KART_CATALOG.forEach((kart, index) => {
      const isSelected = index === this.selectedKartIndex;
      const numStr = (index + 1).toString().padStart(2, "0");

      // Check if this kart is locked in by another player in the room
      let takenByPlayer: any = null;
      if (this.latestPlayersMap) {
        this.latestPlayersMap.forEach((player: any) => {
          if (player.id !== this.localSessionId && player.kartModelIndex === index) {
            takenByPlayer = player;
          }
        });
      }
      const isTaken = takenByPlayer !== null;

      let cardClass = "kart-card";
      let btnLabel = "SELECT KART";
      let btnClass = "btn-lock-kart";

      if (isSelected) {
        cardClass += " selected";
        btnLabel = "LOCKED IN";
        btnClass += " locked";
      } else if (isTaken) {
        cardClass += " taken disabled";
        btnLabel = `TAKEN (${takenByPlayer.name.substring(0, 8)})`;
        btnClass += " taken";
      }

      html += `
        <div class="${cardClass}" data-kart-index="${index}" data-taken="${isTaken}" style="--kart-accent: ${kart.accentColor}">
          <div class="kart-card-header">
            <span class="kart-num">#${numStr}</span>
            <span class="kart-accent-dot"></span>
          </div>

          <div class="kart-visual-preview">
            <img class="kart-card-img" src="${kart.imageUrl}" alt="${kart.name}" loading="lazy" />
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

          <button class="${btnClass}" data-kart-index="${index}" ${isTaken ? "disabled" : ""}>
            <span>${btnLabel}</span>
          </button>
        </div>
      `;
    });

    this.kartGallery.innerHTML = html;

    // Attach click listeners to cards and buttons
    const cards = this.kartGallery.querySelectorAll(".kart-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const isTaken = card.getAttribute("data-taken") === "true";
        if (isTaken) return; // Block selecting taken karts

        const idx = parseInt(card.getAttribute("data-kart-index") || "0", 10);
        this.selectKart(idx);
      });
    });
  }

  public selectKart(index: number): void {
    // Prevent selecting if already taken by another player
    if (this.latestPlayersMap) {
      let isTakenByOther = false;
      this.latestPlayersMap.forEach((player: any) => {
        if (player.id !== this.localSessionId && player.kartModelIndex === index) {
          isTakenByOther = true;
        }
      });
      if (isTakenByOther) {
        console.warn("⚠️ Kart is already taken by another player.");
        return;
      }
    }

    const safeIdx = Math.max(0, Math.min(KART_CATALOG.length - 1, index));
    this.selectedKartIndex = safeIdx;
    const def = getKartDef(safeIdx);

    if (this.currentKartName) {
      this.currentKartName.textContent = def.name.toUpperCase();
    }

    this.lastGalleryHash = ""; // Force re-render
    this.renderKartGallery();
    this.onSelectKartCallback?.(safeIdx);
  }

  private toggleFullscreen(): void {
    const doc = document as any;
    const elem = document.documentElement as any;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
    if (!isFs) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  }

  private setupListeners(): void {
    const onFullscreen = (e: Event) => {
      e.preventDefault();
      this.toggleFullscreen();
    };
    
    this.homeFullscreenBtn?.addEventListener("click", onFullscreen);
    this.homeFullscreenBtn?.addEventListener("touchstart", onFullscreen, { passive: false });
    
    this.hudFullscreenBtn?.addEventListener("click", onFullscreen);
    this.hudFullscreenBtn?.addEventListener("touchstart", onFullscreen, { passive: false });

    this.btnModeFfa?.addEventListener("click", () => {
      if (this.isHost) {
        this.onSetGameModeCallback?.("ffa");
      }
    });

    this.btnModeTeam?.addEventListener("click", () => {
      if (this.isHost) {
        this.onSetGameModeCallback?.("team");
      }
    });

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

  public showLoadingScreen(durationMs: number): void {
    if (this.loadingOverlay && this.loaderFill) {
      this.loadingOverlay.style.display = "flex";
      this.loaderFill.style.transition = "none";
      this.loaderFill.style.width = "0%";
      
      // Force reflow
      void this.loaderFill.offsetWidth;
      
      this.loaderFill.style.transition = `width ${durationMs}ms linear`;
      this.loaderFill.style.width = "100%";
    }
  }

  public hideLoadingScreen(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = "none";
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

  // Team-aware match results
  public showMatchResult(winnerName: string, isLocalWinner: boolean, winningTeam?: string): void {
    if (this.gameoverCard) {
      this.gameoverCard.className = `modal-card ${isLocalWinner ? "victory" : "defeat"}`;
    }

    if (this.gameoverBadge) {
      this.gameoverBadge.textContent = isLocalWinner ? "🏆 CHAMPION" : "MATCH OVER";
    }

    if (this.gameoverTitle) {
      this.gameoverTitle.textContent = isLocalWinner ? "VICTORY" : "DEFEAT";
    }

    if (this.winnerNameBanner) {
      if (winningTeam && (winningTeam === "blue" || winningTeam === "red")) {
        const teamLabel = winningTeam === "blue" ? "TEAM BLUE" : "TEAM RED";
        this.winnerNameBanner.textContent = isLocalWinner ? `YOUR ${teamLabel} WON!` : `${teamLabel} WON THE MATCH`;
      } else {
        this.winnerNameBanner.textContent = isLocalWinner ? "YOU WON THE MATCH!" : `${winnerName} WON THE MATCH`;
      }
    }

    if (this.gameoverSubtitle) {
      this.gameoverSubtitle.textContent = isLocalWinner
        ? "You eliminated all rivals and dominated the Cyberpunk Arena!"
        : "Eliminated from the arena. Better luck in the next round!";
    }

    this.showScreen("gameover");
  }

  public updateLobbyState(state: any, localSessionId: string): void {
    if (!this.slotsGrid || !state || !state.players) return;

    const playersMap = state.players;
    const playerCount = playersMap.size || 0;
    const localPlayer = playersMap.get(localSessionId);
    const gameMode: "ffa" | "team" = state.gameMode || "ffa";
    this.currentGameMode = gameMode;

    this.isHost = localPlayer?.isHost || false;
    this.isReadyState = localPlayer?.isReady || false;

    this.latestPlayersMap = playersMap;
    this.localSessionId = localSessionId;

    // Update Mode Selector UI
    if (this.btnModeFfa && this.btnModeTeam) {
      if (gameMode === "team") {
        this.btnModeFfa.className = "mode-toggle-btn";
        this.btnModeTeam.className = "mode-toggle-btn team-active";
      } else {
        this.btnModeFfa.className = "mode-toggle-btn active";
        this.btnModeTeam.className = "mode-toggle-btn";
      }
      this.btnModeFfa.disabled = !this.isHost;
      this.btnModeTeam.disabled = !this.isHost;
    }

    if (this.teamModeIndicator) {
      this.teamModeIndicator.style.display = gameMode === "team" ? "flex" : "none";
    }

    // Sync selected kart index from server state
    if (localPlayer && localPlayer.kartModelIndex !== undefined) {
      if (localPlayer.kartModelIndex !== this.selectedKartIndex) {
        this.selectedKartIndex = localPlayer.kartModelIndex;
        const def = getKartDef(this.selectedKartIndex);
        if (this.currentKartName) {
          this.currentKartName.textContent = def.name.toUpperCase();
        }
      }
    }

    // PERFORMANCE OPTIMIZATION: If lobby view is hidden, do NOT render slots or gallery
    if (this.lobbyView && this.lobbyView.style.display === "none") {
      return;
    }

    // Re-render gallery to reflect taken/locked karts
    this.renderKartGallery();

    // Update count chip
    if (this.playerCountChip) {
      this.playerCountChip.textContent = `${playerCount} / 10 PLAYERS`;
    }

    // Build hash of player slots to avoid unnecessary DOM rebuilding
    const lobbyHash = Array.from(playersMap.values()).map((p: any) => `${p.id}_${p.slotIndex}_${p.kartModelIndex}_${p.isReady}_${p.isHost}_${p.team}`).join("|") + `_${gameMode}_${this.selectedKartIndex}_${this.isHost}`;
    if (lobbyHash === this.lastLobbyHash) {
      return;
    }
    this.lastLobbyHash = lobbyHash;

    // Build 10 slots map
    const slotMap = new Map<number, any>();
    playersMap.forEach((player: any) => {
      slotMap.set(player.slotIndex, player);
    });

    // Render 10 slots cleanly
    let slotsHtml = "";

    for (let slot = 0; slot < 10; slot++) {
      const p = slotMap.get(slot);
      const isTeamBlue = slot < 5;
      const teamTag = gameMode === "team" ? (isTeamBlue ? "TEAM BLUE" : "TEAM RED") : "";
      
      // In team mode: blue team uses cyan (#00f0ff), red team uses red (#ff2a2a)
      const colorDef = gameMode === "team"
        ? (isTeamBlue ? { hex: "#00f0ff", name: "Blue" } : { hex: "#ff2a2a", name: "Red" })
        : getPlayerColor(slot);

      const slotNumStr = (slot + 1).toString().padStart(2, "0");
      const teamCardClass = gameMode === "team" ? (isTeamBlue ? "team-blue-slot" : "team-red-slot") : "";

      if (p) {
        const isMe = p.id === localSessionId;
        const kartDef = getKartDef(p.kartModelIndex ?? p.slotIndex ?? 0);
        const statusHtml = p.isReady
          ? `<div class="slot-status-pill ready">READY</div>`
          : `<div class="slot-status-pill waiting">WAITING</div>`;

        slotsHtml += `
          <div class="slot-card occupied ${teamCardClass}" style="--slot-color: ${colorDef.hex}">
            <div class="slot-header">
              <span class="slot-number">${gameMode === "team" ? teamTag : `SLOT ${slotNumStr}`}</span>
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
        const emptyLabel = gameMode === "team"
          ? (isTeamBlue ? "+ JOIN BLUE" : "+ JOIN RED")
          : "+ JOIN SLOT";

        slotsHtml += `
          <div class="slot-card empty clickable-slot ${teamCardClass}" data-slot-index="${slot}" style="--slot-color: ${colorDef.hex}" title="Click to switch to this slot">
            <div class="slot-header">
              <span class="slot-number">${gameMode === "team" ? teamTag : `SLOT ${slotNumStr}`}</span>
              <div class="slot-color-swatch" style="opacity: 0.35;"></div>
            </div>
            <div class="slot-body">
              <div class="slot-avatar" style="opacity: 0.4; font-family: var(--font-mono); font-size: 0.75rem;">+</div>
              <div class="slot-name-wrap">
                <div class="slot-pilot-name" style="color: var(--text-secondary);">OPEN SLOT</div>
                <span class="slot-role-tag" style="color: ${colorDef.hex}; opacity: 0.75;">${colorDef.name.toUpperCase()} TRAIL</span>
              </div>
            </div>
            <div class="slot-status-pill switch-pill">${emptyLabel}</div>
          </div>
        `;
      }
    }

    this.slotsGrid.innerHTML = slotsHtml;

    // Attach click listeners to empty slots so players can switch teams/slots
    const emptySlotCards = this.slotsGrid.querySelectorAll(".slot-card.empty");
    emptySlotCards.forEach((card) => {
      card.addEventListener("click", () => {
        const slotIdx = parseInt(card.getAttribute("data-slot-index") || "-1", 10);
        if (slotIdx >= 0 && slotIdx < 10) {
          this.onSwitchSlotCallback?.(slotIdx);
        }
      });
    });

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

    // PERFORMANCE OPTIMIZATION: Memoize scoreboard to avoid 30Hz DOM rebuilding
    const scoreHash = Array.from(playersMap.values()).map((p: any) => `${p.id}_${p.health}_${p.eliminated}_${p.score}_${p.team}`).join("|");
    if (scoreHash === this.lastScoreboardHash) {
      return;
    }
    this.lastScoreboardHash = scoreHash;

    let html = "";
    playersMap.forEach?.((p: any) => {
      const isTeamMode = p.team === "blue" || p.team === "red";
      const colorDef = isTeamMode
        ? (p.team === "blue" ? { hex: "#00f0ff", name: "Blue" } : { hex: "#ff2a2a", name: "Red" })
        : getPlayerColor(p.colorIndex);

      const isMe = p.id === localSessionId;
      const isDead = p.eliminated || p.health <= 0;

      html += `
        <div class="scoreboard-row" style="opacity: ${isDead ? 0.45 : 1.0}">
          <div class="scoreboard-name">
            <span class="scoreboard-dot" style="background-color: ${colorDef.hex}"></span>
            <span>${p.name} ${isMe ? "(You)" : ""}</span>
          </div>
          <div class="scoreboard-score" style="color: ${colorDef.hex}">${isDead ? "ELIMINATED" : `${p.health} HP`}</div>
        </div>
      `;
    });

    scoreboardList.innerHTML = html;
  }
}
