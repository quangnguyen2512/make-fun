export function createAudioEngine() {
  let ctx = null;
  let muted = false;
  let unlocked = false;

  if (typeof window !== 'undefined') {
    const unlock = () => {
      unlocked = true;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
  }

  function ensureContext() {
    if (muted || !unlocked) return null;
    if (!ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freqStart, freqEnd, duration, type = 'triangle', gainPeak = 0.08, delay = 0) {
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    isMuted() {
      return muted;
    },
    setMuted(next) {
      muted = Boolean(next);
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    playShot(pitchJitter = 1) {
      tone(680 * pitchJitter, 280 * pitchJitter, 0.075, 'triangle', 0.045);
    },
    playParrySwing() {
      tone(320, 620, 0.14, 'sine', 0.07);
    },
    playParryReflect() {
      tone(520, 1240, 0.18, 'triangle', 0.11);
      tone(780, 1560, 0.22, 'sine', 0.08, 0.02);
    },
    playShard(combo = 1) {
      const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      const base = notes[Math.min(notes.length - 1, Math.max(0, combo % notes.length))];
      tone(base, base * 1.25, 0.11, 'sine', 0.06);
    },
    playEnemyHit() {
      tone(220, 110, 0.055, 'square', 0.035);
    },
    playEnemyKill(heavy = false) {
      tone(heavy ? 180 : 280, 58, heavy ? 0.22 : 0.14, 'sawtooth', heavy ? 0.09 : 0.06);
    },
    playTelegraph() {
      tone(440, 880, 0.24, 'sine', 0.04);
    },
    playNova() {
      tone(140, 540, 0.36, 'sawtooth', 0.11);
      tone(280, 72, 0.45, 'sine', 0.12, 0.04);
    },
    playHurt() {
      tone(160, 52, 0.26, 'sawtooth', 0.13);
    },
    playWaveClear() {
      tone(440, 440, 0.12, 'triangle', 0.07, 0);
      tone(554.37, 554.37, 0.12, 'triangle', 0.07, 0.09);
      tone(659.25, 659.25, 0.22, 'triangle', 0.08, 0.18);
    },
    playVictory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        tone(f, f, 0.26, 'triangle', 0.08, idx * 0.11);
      });
    },
    playDefeat() {
      [330, 277.18, 220, 146.83].forEach((f, idx) => {
        tone(f, f * 0.94, 0.24, 'sawtooth', 0.07, idx * 0.13);
      });
    },
  };
}
