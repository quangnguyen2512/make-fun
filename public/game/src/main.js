import { BEST_SCORE_KEY } from './config.js';
import { createPrng } from './prng.js';
import { createAudioEngine } from './audio.js';
import { createParticleSystem } from './particles.js';
import { createInputHub } from './input.js';
import { createSimulation } from './simulation.js';
import { createRenderer } from './renderer.js';
import { createHudController } from './hud.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const autostart = params.get('autostart') === '1';
const parsedSeed = Number.parseInt(params.get('seed') ?? '', 10);
const runSeed = Number.isInteger(parsedSeed) ? parsedSeed : 42;

const canvas = document.getElementById('arena');
const prng = createPrng(runSeed);
const audio = createAudioEngine();
const particles = createParticleSystem();
const renderer = createRenderer(canvas, createPrng(runSeed + 99));
const input = createInputHub(canvas, renderer.getTransform);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(val) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(Math.round(val)));
  } catch {
    // Ignore storage restriction
  }
}

let bestScore = readBest();

const sim = createSimulation(prng, {
  playerShot(e) {
    audio.playShot(e.pitch);
    particles.spawnParticle(e.x, e.y, 0, 0, 0.09, 5, '#fde3a7', 0);
  },
  parrySwing(e) {
    audio.playParrySwing();
    particles.spawnRing(e.x, e.y, e.radius, '#fde3a7', 0.34);
  },
  parryReflect(e) {
    audio.playParryReflect();
    particles.spawnBurst(prng, e.x, e.y, 14, 90, 260, '#fde3a7', 2.5, 5);
    particles.spawnCallout(e.x, e.y - 18, 'REFLECT!', '#fde3a7');
  },
  novaBurst(e) {
    audio.playNova();
    particles.spawnRing(e.x, e.y, e.radius, '#38d9a9', 0.42);
    particles.spawnBurst(prng, e.x, e.y, 28, 120, 420, '#38d9a9', 3, 6);
    particles.spawnCallout(e.x, e.y - 26, 'SOLAR NOVA!', '#38d9a9');
  },
  enemyHit(e) {
    audio.playEnemyHit();
    particles.spawnBurst(prng, e.x, e.y, 5, 60, 170, e.color, 2, 3.8);
  },
  enemyKilled(e) {
    audio.playEnemyKill(e.heavy);
    particles.spawnBurst(prng, e.enemy.x, e.enemy.y, e.enemy.type === 'boss' ? 36 : 16, 70, 290, e.enemy.color, 2.5, 5.5);
    particles.spawnCallout(e.enemy.x, e.enemy.y - 12, `+${e.points}`, '#f6f1e6');
  },
  shardCollected(e) {
    audio.playShard(e.combo);
    particles.spawnBurst(prng, e.x, e.y, 4, 40, 120, '#38d9a9', 2, 3.5);
  },
  telegraph() {
    audio.playTelegraph();
  },
  playerHurt(e) {
    audio.playHurt();
    particles.spawnBurst(prng, e.x, e.y, 18, 90, 310, '#ff5a4f', 2.5, 5.5);
  },
  waveStart() {
    audio.playWaveClear();
  },
  gameOver(e) {
    if (sim.state.score > bestScore) {
      bestScore = Math.round(sim.state.score);
      saveBest(bestScore);
    }
    if (e.outcome === 'victory') audio.playVictory();
    else audio.playDefeat();
  },
});

function startNewRun() {
  particles.reset();
  input.clearHeld();
  sim.resetRun();
  canvas.focus?.();
}

const hud = createHudController({
  onStart: startNewRun,
  onRestart: startNewRun,
  onContinueEndless() {
    sim.state.endless = true;
    sim.state.mode = 'playing';
    sim.state.outcome = null;
    sim.beginWave(sim.state.waveIndex + 1);
  },
  onTogglePause() {
    if (sim.state.mode === 'playing') sim.state.mode = 'paused';
    else if (sim.state.mode === 'paused') sim.state.mode = 'playing';
  },
  onReturnTitle() {
    particles.reset();
    sim.state.mode = 'title';
  },
  onToggleMute() {
    hud.updateMute(audio.toggleMute());
  },
});

function handleResize() {
  const rect = canvas.getBoundingClientRect();
  renderer.resize(rect.width || window.innerWidth, rect.height || window.innerHeight);
  if (shotMode) renderer.render(sim, particles);
}

const ro = new ResizeObserver(handleResize);
ro.observe(canvas);
window.addEventListener('resize', handleResize);
handleResize();

function stageDeterministicShot(mode) {
  audio.setMuted(true);
  if (mode === 'start') {
    sim.state.mode = 'title';
    bestScore = Math.max(bestScore, 4280);
  } else if (mode === 'play') {
    startNewRun();
    sim.beginWave(2);
    sim.state.waveBannerTimer = 0;
    sim.state.score = 2840;
    sim.state.combo = 4;
    sim.state.player.novaCharge = 76;
    sim.state.player.x = 460;
    sim.state.player.y = 400;
    sim.spawnEnemy('lancer', 890, 230);
    sim.spawnEnemy('rammer', 860, 490);
    sim.spawnEnemy('weaver', 740, 190);
    sim.spawnProjectile('enemy', 515, 390, -240, 20, 6.5, 1, '#ff5a4f');
    for (let i = 0; i < 65; i++) {
      sim.step(1 / 60, { moveX: 0.35, moveY: -0.15, aimX: 880, aimY: 260, firing: true, parryTriggered: i === 56, novaTriggered: false });
      particles.update(1 / 60);
    }
  } else if (mode === 'boss') {
    startNewRun();
    sim.beginWave(4);
    sim.state.waveBannerTimer = 0;
    sim.state.score = 7420;
    sim.state.combo = 5;
    sim.state.player.novaCharge = 100;
    sim.state.player.x = 640;
    sim.state.player.y = 530;
    for (let i = 0; i < 120; i++) {
      sim.step(1 / 60, { moveX: Math.sin(i * 0.08), moveY: 0, aimX: 640, aimY: 160, firing: true, parryTriggered: i === 108, novaTriggered: false });
      particles.update(1 / 60);
    }
  } else if (mode === 'end') {
    startNewRun();
    sim.beginWave(4);
    sim.state.waveBannerTimer = 0;
    for (let i = 0; i < 40; i++) {
      sim.step(1 / 60, { moveX: 0.2, moveY: -0.2, aimX: 640, aimY: 160, firing: true, parryTriggered: false, novaTriggered: false });
      particles.update(1 / 60);
    }
    particles.spawnRing(640, 260, 260, '#38d9a9', 0.5);
    particles.spawnBurst(prng, 640, 260, 28, 80, 320, '#fde3a7', 3, 6);
    sim.state.score = 9640;
    sim.state.waveNumber = 5;
    sim.state.parriesLanded = 14;
    bestScore = 9640;
    sim.state.mode = 'gameover';
    sim.state.outcome = 'victory';
  }
  hud.sync(sim.state, bestScore);
  renderer.render(sim, particles);
  window.__shotReady = true;
}

if (shotMode) {
  stageDeterministicShot(shotMode);
} else {
  if (autostart) startNewRun();
  let lastTs = performance.now();

  function frame(now) {
    const rawDt = (now - lastTs) / 1000;
    lastTs = now;
    const dt = Math.min(rawDt, 0.05);

    if (input.consumeJustPressed('KeyM')) {
      hud.updateMute(audio.toggleMute());
    }
    if (input.consumeJustPressed('KeyF')) {
      sim.state.player.autoFire = !sim.state.player.autoFire;
    }

    if (sim.state.mode === 'title') {
      if (input.consumeJustPressed('Enter') || input.consumeJustPressed('Space')) {
        startNewRun();
      }
    } else if (sim.state.mode === 'playing') {
      if (input.consumeJustPressed('KeyP') || input.consumeJustPressed('Escape')) {
        sim.state.mode = 'paused';
      } else if (input.consumeJustPressed('KeyR')) {
        startNewRun();
      } else {
        input.tickBuffers(dt);
        const sampled = input.sampleGameplayInput(sim.state.player.x, sim.state.player.y);
        sim.step(dt, sampled);
        particles.update(dt);
      }
    } else if (sim.state.mode === 'paused') {
      if (input.consumeJustPressed('KeyP') || input.consumeJustPressed('Escape')) {
        sim.state.mode = 'playing';
      } else if (input.consumeJustPressed('KeyR')) {
        startNewRun();
      }
    } else if (sim.state.mode === 'gameover') {
      if (input.consumeJustPressed('Enter') || input.consumeJustPressed('Space') || input.consumeJustPressed('KeyR')) {
        startNewRun();
      }
    }

    if (sim.state.score > bestScore) {
      bestScore = Math.round(sim.state.score);
    }

    input.endFrame();
    hud.sync(sim.state, bestScore);
    renderer.render(sim, particles);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
