/**
 * High-Performance Web Audio API Sound System
 * Generates all sound effects & synthwave background music procedurally with zero external asset lag.
 */

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;

  // Engine Synth
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Drift Screech Node
  private driftNoiseGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;

  // Music loop timer
  private musicTimerId: number | null = null;

  constructor() {}

  public init(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.28, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.setupEngineSynth();
      this.setupDriftSynth();
      console.log("🔊 Audio Engine Initialized");
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private setupEngineSynth(): void {
    if (!this.ctx || !this.sfxGain) return;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = "sine";
    this.engineOsc2.type = "triangle";

    this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);
    this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

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

  // Reduced volume and smooth electric tone for acceleration
  public updateEngine(speedKph: number, isAccelerating: boolean, isBraking: boolean, isDrifting: boolean): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineOsc2) return;

    const now = this.ctx.currentTime;
    const speedRatio = Math.min(speedKph / 140, 1.0);

    const baseFreq = 42 + speedRatio * 95 + (isAccelerating ? 15 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.1);

    const targetVol = 0.018 + speedRatio * 0.035 + (isAccelerating ? 0.02 : 0);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.08);

    if (this.driftNoiseGain && this.driftFilter) {
      if (isDrifting && speedKph > 15) {
        this.driftNoiseGain.gain.setTargetAtTime(0.12, now, 0.05);
        this.driftFilter.frequency.setTargetAtTime(1000 + speedRatio * 600, now, 0.05);
      } else {
        this.driftNoiseGain.gain.setTargetAtTime(0.0, now, 0.08);
      }
    }
  }

  // 1. Play Shoot Sound (Futuristic Plasma Launch)
  public playShoot(): void {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // 2. Play Heavy Cinematic Sci-Fi Blast / Detonation
  public playExplosion(): void {
    this.init();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;

    const now = this.ctx.currentTime;

    // Layer A: Impact Snap / Hull Puncture (0-30ms sharp transient)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = "triangle";
    snapOsc.frequency.setValueAtTime(950, now);
    snapOsc.frequency.exponentialRampToValueAtTime(160, now + 0.05);
    snapGain.gain.setValueAtTime(0.65, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(now);
    snapOsc.stop(now + 0.07);

    // Layer B: Heavy Sub-Bass Kinetic Thump (190Hz -> 28Hz boom)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(220, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.55);
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.62);

    // Layer C: Resonant Shockwave Debris & Sizzle
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.55);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.14));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.5);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    noiseSource.start(now);
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
      osc.frequency.setValueAtTime(480, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(960, now);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.48);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
  }

  // 4. Background Synthwave Music Loop
  public startBackgroundMusic(): void {
    this.init();
    if (!this.ctx || !this.musicGain || this.isMusicPlaying) return;
    this.isMusicPlaying = true;

    const notes = [
      130.81, 146.83, 164.81, 196.00, // C3, D3, E3, G3
      130.81, 174.61, 196.00, 220.00, // C3, F3, G3, A3
      110.00, 130.81, 146.83, 164.81, // A2, C3, D3, E3
      98.00, 123.47, 146.83, 196.00,  // G2, B2, D3, G3
    ];

    let noteIndex = 0;
    const bpm = 124;
    const stepTimeMs = (60 / bpm / 2) * 1000;

    const playStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.musicGain || this.isMuted) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      const freq = notes[noteIndex % notes.length];
      osc.frequency.setValueAtTime(freq, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(500 + Math.sin(noteIndex * 0.3) * 250, now);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (stepTimeMs / 1000) * 0.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + stepTimeMs / 1000);

      noteIndex++;
      this.musicTimerId = window.setTimeout(playStep, stepTimeMs);
    };

    playStep();
  }

  public stopBackgroundMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicTimerId !== null) {
      clearTimeout(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundManager();
