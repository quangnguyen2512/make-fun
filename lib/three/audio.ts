export class SolarAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private unlocked = false;
  public muted = false;

  public unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    this.unlocked = true;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.22;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Ignore audio failures on restricted contexts
    }
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.22, this.ctx.currentTime, 0.02);
    }
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    if (!this.unlocked || this.muted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public shot(pitch = 1) {
    this.playTone(620 * pitch, 240 * pitch, 0.075, 'triangle', 0.26);
  }

  public parrySwing() {
    this.playTone(340, 680, 0.14, 'sine', 0.34);
  }

  public parryReflect() {
    this.playTone(540, 1280, 0.24, 'triangle', 0.55);
    this.playTone(810, 1620, 0.2, 'sine', 0.35);
  }

  public nova() {
    this.playTone(180, 65, 0.42, 'sawtooth', 0.55);
    this.playTone(440, 960, 0.38, 'triangle', 0.4);
  }

  public enemyHit() {
    this.playTone(260, 140, 0.06, 'square', 0.16);
  }

  public enemyKill(heavy = false) {
    this.playTone(heavy ? 180 : 280, 58, heavy ? 0.32 : 0.18, 'sawtooth', heavy ? 0.45 : 0.28);
  }

  public shard(combo: number) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = scale[Math.min(scale.length - 1, Math.max(0, combo - 1))];
    this.playTone(f, f * 1.25, 0.11, 'sine', 0.28);
  }

  public telegraph() {
    this.playTone(440, 720, 0.14, 'sine', 0.22);
  }

  public playerHurt() {
    this.playTone(150, 55, 0.28, 'sawtooth', 0.55);
  }

  public waveStart(boss = false) {
    this.playTone(boss ? 196 : 330, boss ? 293.66 : 495, 0.36, 'triangle', 0.38);
  }

  public victory() {
    this.playTone(523.25, 659.25, 0.22, 'triangle', 0.38);
    setTimeout(() => this.playTone(659.25, 1046.5, 0.35, 'triangle', 0.42), 160);
  }

  public defeat() {
    this.playTone(240, 90, 0.48, 'sawtooth', 0.45);
  }
}
