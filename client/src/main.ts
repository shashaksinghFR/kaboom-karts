import { GameEngine } from "./core/Engine";
import { PrototypeScene } from "./scenes/PrototypeScene";
import { InputManager } from "./input/InputManager";
import { HudOverlay } from "./ui/HudOverlay";
import { LobbyUI } from "./ui/LobbyUI";
import { NetworkClient } from "./network/NetworkClient";

window.addEventListener("DOMContentLoaded", async () => {
  // 1. Initialize Canvas, Engine & Scene
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new GameEngine(canvas);
  const inputManager = new InputManager();
  const hud = new HudOverlay();
  const lobbyUI = new LobbyUI();
  const networkClient = new NetworkClient();

  // Create the 3D Battle Arena Scene
  const prototypeScene = new PrototypeScene(engine);
  const rawScene = prototypeScene.getRawScene();
  engine.setScene(rawScene);

  let currentPhase: string = "lobby";
  let lastNetworkBroadcast = 0;
  let hasSetInitialSpawn = false;

  // Setup HUD Camera Mode Toggle
  hud.setCameraMode(prototypeScene.cameraController.getMode());
  hud.onCameraToggle(() => {
    const nextMode = prototypeScene.cameraController.toggleMode();
    hud.setCameraMode(nextMode);
  });

  // Setup Control Scheme Toggle (PC Keyboard vs Phone Joystick)
  const homeControlToggle = document.getElementById("home-control-toggle");
  const homeControlText = document.getElementById("home-control-text");
  const hudControlToggle = document.getElementById("hud-control-toggle");
  const hudControlText = document.getElementById("hud-control-text");

  const syncControlUI = () => {
    const mode = inputManager.getControlMode();
    const isTouch = mode === "touch";
    if (homeControlText) {
      homeControlText.textContent = isTouch ? "PHONE JOYSTICK" : "PC KEYBOARD";
    }
    if (hudControlText) {
      hudControlText.textContent = isTouch ? "CONTROLS: TOUCH" : "CONTROLS: PC";
    }
  };

  syncControlUI();

  homeControlToggle?.addEventListener("click", () => {
    inputManager.toggleControlMode();
    syncControlUI();
  });

  hudControlToggle?.addEventListener("click", () => {
    inputManager.toggleControlMode();
    syncControlUI();
  });

  // 2. Connect Lobby UI Actions
  lobbyUI.onCreateRoomCallback = async (playerName) => {
    try {
      const room = await networkClient.createRoom(playerName);
      lobbyUI.setRoomCode(networkClient.roomCode || room.state?.roomCode || "");
      lobbyUI.showScreen("lobby");
    } catch (err: any) {
      lobbyUI.showError(err.message || "Failed to create room.");
    }
  };

  lobbyUI.onJoinRoomCallback = async (roomCode, playerName) => {
    try {
      const room = await networkClient.joinRoomByCode(roomCode, playerName);
      lobbyUI.setRoomCode(networkClient.roomCode || room.state?.roomCode || roomCode);
      lobbyUI.showScreen("lobby");
    } catch (err: any) {
      lobbyUI.showError(err.message || "Room code not found or expired.");
    }
  };

  lobbyUI.onLeaveRoomCallback = () => {
    networkClient.leaveRoom();
    hasSetInitialSpawn = false;
  };

  lobbyUI.onToggleReadyCallback = () => {
    networkClient.toggleReady();
  };

  lobbyUI.onStartGameCallback = () => {
    networkClient.startGame();
  };

  lobbyUI.onReturnToLobbyCallback = () => {
    networkClient.sendRematch();
    lobbyUI.showScreen("lobby");
  };

  // 3. Connect Network Event Handlers
  networkClient.onStateChanged = (state) => {
    lobbyUI.updateLobbyState(state, networkClient.localSessionId);
    lobbyUI.updateScoreboard(state.players, networkClient.localSessionId);

    const newPhase = state.matchPhase;

    // Handle phase transitions
    if (newPhase !== currentPhase) {
      currentPhase = newPhase;

      if (newPhase === "countdown") {
        lobbyUI.showScreen("game");
        lobbyUI.showCountdown(state.countdownTimer);
        hasSetInitialSpawn = false;
      } else if (newPhase === "playing") {
        lobbyUI.showScreen("game");
        lobbyUI.hideCountdown();
      } else if (newPhase === "lobby") {
        lobbyUI.showScreen("lobby");
        lobbyUI.hideCountdown();
        hasSetInitialSpawn = false;
      } else if (newPhase === "gameover") {
        lobbyUI.showVictory(state.winnerName || "Match Concluded");
      }
    }

    // Active countdown tick
    if (newPhase === "countdown") {
      lobbyUI.showCountdown(state.countdownTimer);
    }

    // Set local player's spawn transform & assigned trail color
    if (state.players) {
      const myPlayer = state.players.get(networkClient.localSessionId);
      if (myPlayer) {
        if (!hasSetInitialSpawn && (newPhase === "countdown" || newPhase === "playing")) {
          prototypeScene.setSpawnTransform(myPlayer.x, myPlayer.y, myPlayer.z, myPlayer.yaw);
          prototypeScene.kartVisual.setPlayerColor(myPlayer.colorIndex);
          hasSetInitialSpawn = true;
        }
      }

      // Synchronize remote opponents
      prototypeScene.remoteKartManager.syncPlayers(state.players, networkClient.localSessionId);
    }
  };

  networkClient.onMissileFired = (data) => {
    prototypeScene.remoteKartManager.handleMissileFired(data, networkClient.localSessionId);
  };

  networkClient.onMissileExploded = (data) => {
    prototypeScene.remoteKartManager.handleMissileExploded(data);
  };

  networkClient.onError = (msg) => {
    lobbyUI.showError(msg);
  };

  // 4. Connect Scene Weapon Broadcast to Server
  prototypeScene.onLocalMissileFired = (data) => {
    networkClient.sendFireMissile(data);
  };

  prototypeScene.onLocalMissileHit = (data) => {
    networkClient.sendMissileHit(data);
  };

  // 5. Pre-Render Loop (Physics, Weapon, Prediction & Network Sync)
  rawScene.onBeforeRenderObservable.add(() => {
    const deltaTime = rawScene.getEngine().getDeltaTime() / 1000.0;
    const isFrozen = currentPhase === "countdown";
    prototypeScene.update(deltaTime, inputManager, isFrozen);

    // Sync HUD Camera Mode
    hud.setCameraMode(prototypeScene.cameraController.getMode());

    // Broadcast local kart transform to server at ~30Hz
    if (networkClient.room && (currentPhase === "playing" || currentPhase === "countdown")) {
      const now = performance.now();
      if (now - lastNetworkBroadcast >= 33) {
        networkClient.sendTransform({
          x: prototypeScene.kartController.position.x,
          y: prototypeScene.kartController.position.y,
          z: prototypeScene.kartController.position.z,
          yaw: prototypeScene.kartController.yaw,
          pitch: prototypeScene.kartController.currentPitch,
          roll: prototypeScene.kartController.currentRoll,
          steerVisual: prototypeScene.kartController.steerSmoothed,
          speedKph: prototypeScene.kartController.getSpeedKph(),
          isDrifting: prototypeScene.kartController.isDrifting,
          isBoosting: prototypeScene.kartController.isBoosting,
        });
        lastNetworkBroadcast = now;
      }
    }
  });

  // 6. Post-Render Loop (UI Telemetry)
  rawScene.onAfterRenderObservable.add(() => {
    const fps = engine.getFps();
    const speed = prototypeScene.kartController.getSpeedKph();
    const isDrifting = prototypeScene.kartController.isDrifting;
    const isBoosting = prototypeScene.kartController.isBoosting;

    hud.updateTelemetry(fps, speed, isDrifting, isBoosting);

    // Sync Weapon Cooldown Status
    const isReady = prototypeScene.weaponSystem.isReady();
    const cooldownRemaining = prototypeScene.weaponSystem.getCooldownRemaining();
    const cooldownProgress = prototypeScene.weaponSystem.getCooldownProgress();
    hud.updateWeaponStatus(isReady, cooldownRemaining, cooldownProgress);
  });

  // 7. Start Rendering Engine
  engine.start();

  console.log("Kaboom Karts 10-player room multiplayer initialized!");
});
