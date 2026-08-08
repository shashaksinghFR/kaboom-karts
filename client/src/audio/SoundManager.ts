/**
 * High-Performance Web Audio API & BGM Sound System
 * Features:
 * - Continuous asset-based background music (/audio/backgroundmusic.mp3)
 * - Punchy acceleration engine harmonics with responsive volume
 * - Hyper-futuristic dual-phase missile launch sound
 * - Cinematic multi-stage shockwave blast detonation
 * - Seamless mobile & desktop audio unlocking
 */

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;

  // Background Music Element
  private bgmAudio: HTMLAudioElement | null = null;

  // Engine Synth
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Drift Screech Node
  private driftNoiseGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  // Asset Audio Buffers & Clips
  private shootBuffer: AudioBuffer | null = null;
  private boomBuffer: AudioBuffer | null = null;

  constructor() {}

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      this.ensureBGMPlaying();
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.95, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.setupEngineSynth();
      this.setupDriftSynth();
      this.initBGM();
      this.loadSoundAssets();

      console.log("🔊 Audio Engine Initialized with Shoot & Boom Assets");
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private async loadSoundAssets(): Promise<void> {
    if (!this.ctx) return;

    // Load Shoot SFX
    try {
      const shootRes = await fetch("/audio/shoot.mp3");
      const shootArrayBuf = await shootRes.arrayBuffer();
      this.shootBuffer = await this.ctx.decodeAudioData(shootArrayBuf);
      console.log("🎯 shoot.mp3 audio buffer decoded successfully");
    } catch (e) {
      console.warn("Failed to load /audio/shoot.mp3 buffer, falling back to dynamic audio element", e);
    }

    // Load Boom SFX
    try {
      const boomRes = await fetch("/audio/boom.mp3");
      const boomArrayBuf = await boomRes.arrayBuffer();
      this.boomBuffer = await this.ctx.decodeAudioData(boomArrayBuf);
      console.log("💥 boom.mp3 audio buffer decoded successfully");
    } catch (e) {
      console.warn("Failed to load /audio/boom.mp3 buffer, falling back to dynamic audio element", e);
    }
  }

  private initBGM(): void {
    if (this.bgmAudio) return;
    try {
      this.bgmAudio = new Audio("/audio/backgroundmusic.mp3");
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.isMuted ? 0 : 0.42;
      this.bgmAudio.preload = "auto";
      this.bgmAudio.play().then(() => {
        this.isMusicPlaying = true;
      }).catch((e) => {
        console.log("Audio autoplay waiting for user gesture:", e.message);
      });
    } catch (err) {
      console.warn("Failed to initialize background music audio", err);
    }
  }

  public ensureBGMPlaying(): void {
    if (this.isMuted) return;
    if (!this.bgmAudio) {
      this.initBGM();
    } else if (this.bgmAudio.paused) {
      this.bgmAudio.play().then(() => {
        this.isMusicPlaying = true;
      }).catch(() => {});
    }
  }

  private setupEngineSynth(): void {
    if (!this.ctx || !this.sfxGain) return;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = "sine";
    this.engineOsc2.type = "triangle";

    this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);
    this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.setValueAtTime(420, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private setupDriftSynth(): void {
    if (!this.ctx || !this.sfxGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = "bandpass";
    this.driftFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.driftNoiseGain = this.ctx.createGain();
    this.driftNoiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    whiteNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftNoiseGain);
    this.driftNoiseGain.connect(this.sfxGain);

    whiteNoise.start();
  }

  // Increased volume and punchy high-response electric engine tone for acceleration
  public updateEngine(speedKph: number, isAccelerating: boolean, isBraking: boolean, isDrifting: boolean): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineOsc2) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.min(speedKph / 140, 1.0);

    const baseFreq = 50 + speedRatio * 110 + (isAccelerating ? 25 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.6, now, 0.08);

    if (this.engineFilter) {
      const filterFreq = 380 + speedRatio * 600 + (isAccelerating ? 200 : 0);
      this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    }

    // Increased target volume for rich acceleration feel
    const targetVol = 0.038 + speedRatio * 0.055 + (isAccelerating ? 0.045 : (isBraking ? 0.01 : 0));
    this.engineGain.gain.setTargetAtTime(this.isMuted ? 0 : targetVol, now, 0.06);

    if (this.driftNoiseGain && this.driftFilter) {
      if (isDrifting && speedKph > 15) {
        this.driftNoiseGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.16, now, 0.05);
        this.driftFilter.frequency.setTargetAtTime(1100 + speedRatio * 700, now, 0.05);
      } else {
        this.driftNoiseGain.gain.setTargetAtTime(0.0, now, 0.08);
      }
    }
  }

  // 1. Play Shoot Sound (using shoot.mp3 asset with high-performance buffer)
  public playShoot(): void {
    this.init();
    if (this.isMuted) return;

    if (this.ctx && this.sfxGain && this.shootBuffer) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.shootBuffer;
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.85, this.ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(this.sfxGain);
        source.start();
        return;
      } catch {
        // Fall back to Audio element
      }
    }

    // Fallback: Instant Audio Element clone
    try {
      const audio = new Audio("/audio/shoot.mp3");
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch {
      // Procedural synthesizer fallback
      this.playSynthShoot();
    }
  }

  private playSynthShoot(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const pingOsc = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    pingOsc.type = "sawtooth";
    pingOsc.frequency.setValueAtTime(1400, now);
    pingOsc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
    pingGain.gain.setValueAtTime(0.4, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    pingOsc.connect(pingGain);
    pingGain.connect(this.sfxGain);
    pingOsc.start(now);
    pingOsc.stop(now + 0.15);
  }

  // 2. Play Heavy Blast Sound (using boom.mp3 asset with high-performance buffer)
  public playExplosion(): void {
    this.init();
    if (this.isMuted) return;

    if (this.ctx && this.sfxGain && this.boomBuffer) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.boomBuffer;
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(this.sfxGain);
        source.start();
        return;
      } catch {
        // Fall back to Audio element
      }
    }

    // Fallback: Instant Audio Element clone
    try {
      const audio = new Audio("/audio/boom.mp3");
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch {
      this.playSynthExplosion();
    }
  }

  private playSynthExplosion(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = "triangle";
    snapOsc.frequency.setValueAtTime(1600, now);
    snapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
    snapGain.gain.setValueAtTime(0.85, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(now);
    snapOsc.stop(now + 0.09);

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(260, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.65);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.72);
  }

  // 3. Countdown Beep (Digit beep on 5..1, Victory GO chime on 0)
  public playCountdown(count: number): void {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (count > 0) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(540, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1080, now);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.start(now);
      osc.stop(now + 0.5);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
  }

  // 4. Background Music Controls (Continuous throughout game)
  public startBackgroundMusic(): void {
    this.init();
    this.ensureBGMPlaying();
  }

  public stopBackgroundMusic(): void {
    // Keep BGM playing as requested ("play this bgm throughout the game")
    // If explicitly needed to pause, can be handled here
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isMuted ? 0 : 0.42;
      if (this.isMuted) {
        this.bgmAudio.pause();
      } else {
        this.bgmAudio.play().catch(() => {});
      }
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
