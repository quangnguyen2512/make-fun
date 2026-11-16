import { NOVA_MAX_CHARGE, PLAYER_MAX_HULL, WAVE_SCRIPTS } from './config.js';

function socketSvg(state) {
  const fill = state === 'full' ? '#f2ae42' : state === 'damaged' ? '#ff5a4f' : 'rgba(12, 18, 38, 0.75)';
  const stroke = state === 'empty' ? 'rgba(158, 176, 207, 0.45)' : '#fde3a7';
  const inner =
    state === 'full'
      ? '<polygon points="12,5 17,11 12,18 7,11" fill="#fde3a7" />'
      : state === 'damaged'
        ? '<path d="M10 6 L13 11 L10 16" stroke="#fde3a7" stroke-width="1.8" fill="none" />'
        : '';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.8" />
    ${inner}
  </svg>`;
}

export function createHudController(handlers) {
  const hullSocketsEl = document.getElementById('hull-sockets');
  const novaBlockEl = document.querySelector('.nova-block');
  const novaFillEl = document.getElementById('nova-fill');
  const novaTrailEl = document.getElementById('nova-trail');
  const novaPctEl = document.getElementById('nova-pct');
  const waveLabelEl = document.getElementById('wave-label');
  const bossBarEl = document.getElementById('boss-bar');
  const bossFillEl = document.getElementById('boss-fill');
  const bossTrailEl = document.getElementById('boss-trail');
  const scoreValueEl = document.getElementById('score-value');
  const comboBadgeEl = document.getElementById('combo-badge');
  const waveBannerEl = document.getElementById('wave-banner');
  const muteBtn = document.getElementById('btn-mute');
  const muteWaves = document.getElementById('mute-waves');
  const pauseBtn = document.getElementById('btn-pause');
  const restartBtn = document.getElementById('btn-restart');

  const titleScreen = document.getElementById('title-screen');
  const titleBest = document.getElementById('title-best');
  const titleBestNum = document.getElementById('title-best-num');
  const startBtn = document.getElementById('btn-start');

  const pauseModal = document.getElementById('pause-modal');
  const pauseWave = document.getElementById('pause-wave');
  const pauseScore = document.getElementById('pause-score');
  const pauseParries = document.getElementById('pause-parries');
  const resumeBtn = document.getElementById('btn-resume');
  const pauseRestartBtn = document.getElementById('btn-pause-restart');
  const pauseTitleBtn = document.getElementById('btn-pause-title');

  const endModal = document.getElementById('end-modal');
  const endKicker = document.getElementById('end-kicker');
  const endTitle = document.getElementById('end-title');
  const endScore = document.getElementById('end-score');
  const endBest = document.getElementById('end-best');
  const endWave = document.getElementById('end-wave');
  const endParries = document.getElementById('end-parries');
  const playAgainBtn = document.getElementById('btn-play-again');
  const endlessBtn = document.getElementById('btn-endless');
  const endTitleBtn = document.getElementById('btn-end-title');
  const srStatus = document.getElementById('sr-status');

  let lastHull = -1;
  let lastNova = -1;
  let lastScore = -1;
  let lastCombo = -1;
  let lastWave = -1;
  let lastMode = '';

  function blurClick(fn) {
    return (e) => {
      e.currentTarget.blur();
      fn();
    };
  }

  startBtn.addEventListener('click', blurClick(handlers.onStart));
  playAgainBtn.addEventListener('click', blurClick(handlers.onStart));
  endlessBtn.addEventListener('click', blurClick(handlers.onContinueEndless));
  pauseBtn.addEventListener('click', blurClick(handlers.onTogglePause));
  resumeBtn.addEventListener('click', blurClick(handlers.onTogglePause));
  restartBtn.addEventListener('click', blurClick(handlers.onRestart));
  pauseRestartBtn.addEventListener('click', blurClick(handlers.onRestart));
  pauseTitleBtn.addEventListener('click', blurClick(handlers.onReturnTitle));
  endTitleBtn.addEventListener('click', blurClick(handlers.onReturnTitle));
  muteBtn.addEventListener('click', blurClick(handlers.onToggleMute));

  function updateMute(muted) {
    muteBtn.classList.toggle('muted', muted);
    muteWaves.style.display = muted ? 'none' : '';
  }

  function sync(state, bestScore) {
    if (state.mode !== lastMode) {
      lastMode = state.mode;
      document.body.dataset.state = state.mode;
      titleScreen.classList.toggle('hidden', state.mode !== 'title');
      pauseModal.classList.toggle('hidden', state.mode !== 'paused');
      endModal.classList.toggle('hidden', state.mode !== 'gameover');

      if (state.mode === 'title') {
        titleBest.classList.toggle('hidden', bestScore <= 0);
        titleBestNum.textContent = String(Math.round(bestScore));
        srStatus.textContent = 'Solar Warden title screen. Press Enter or click Launch Sortie to start.';
      } else if (state.mode === 'paused') {
        pauseWave.textContent = state.waveNumber <= WAVE_SCRIPTS.length ? `${state.waveNumber} / ${WAVE_SCRIPTS.length}` : `${state.waveNumber}`;
        pauseScore.textContent = String(Math.round(state.score));
        pauseParries.textContent = String(state.parriesLanded);
        srStatus.textContent = 'Sortie paused.';
      } else if (state.mode === 'gameover') {
        const isVictory = state.outcome === 'victory';
        endKicker.textContent = isVictory ? 'SECTOR CLEARED' : 'SIGNAL LOST';
        endKicker.className = `modal-kicker ${isVictory ? 'victory' : 'defeat'}`;
        endTitle.textContent = isVictory ? 'BASTION SECURED' : 'BASTION BREACHED';
        playAgainBtn.textContent = isVictory ? 'PLAY AGAIN' : 'TRY AGAIN';
        endlessBtn.classList.toggle('hidden', !isVictory);
        endScore.textContent = String(Math.round(state.score));
        endBest.textContent = String(Math.round(bestScore));
        endWave.textContent = state.waveNumber <= WAVE_SCRIPTS.length ? `${state.waveNumber} / ${WAVE_SCRIPTS.length}` : `${state.waveNumber}`;
        endParries.textContent = String(state.parriesLanded);
        srStatus.textContent = `${endTitle.textContent}. Score ${Math.round(state.score)}.`;
      } else {
        srStatus.textContent = `Sortie active. Wave ${state.waveNumber}.`;
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'solar-warden-state', state: state.mode }, '*');
      }
    }

    const p = state.player;
    if (p.hull !== lastHull) {
      lastHull = p.hull;
      let html = '';
      for (let i = 0; i < PLAYER_MAX_HULL; i++) {
        const s = i < p.hull ? (p.hull === 1 && i === 0 ? 'damaged' : 'full') : 'empty';
        html += socketSvg(s);
      }
      hullSocketsEl.innerHTML = html;
    }

    const novaInt = Math.round((p.novaCharge / NOVA_MAX_CHARGE) * 100);
    if (novaInt !== lastNova) {
      lastNova = novaInt;
      novaFillEl.style.width = `${novaInt}%`;
      novaTrailEl.style.width = `${novaInt}%`;
      novaPctEl.textContent = novaInt >= 100 ? 'READY' : `${novaInt}%`;
      novaBlockEl.classList.toggle('ready', novaInt >= 100);
    }

    const scoreInt = Math.round(state.score);
    if (scoreInt !== lastScore) {
      lastScore = scoreInt;
      scoreValueEl.textContent = String(scoreInt);
    }

    if (state.combo !== lastCombo) {
      lastCombo = state.combo;
      comboBadgeEl.textContent = `x${state.combo}`;
      comboBadgeEl.classList.toggle('hidden', state.combo <= 1);
    }

    if (state.waveNumber !== lastWave) {
      lastWave = state.waveNumber;
      waveLabelEl.textContent = state.waveNumber <= WAVE_SCRIPTS.length
        ? `WAVE ${state.waveNumber} / ${WAVE_SCRIPTS.length}`
        : `ENDLESS ${state.waveNumber}`;
    }

    if (state.waveBannerTimer > 0 && state.mode === 'playing') {
      waveBannerEl.textContent = state.waveTitle;
      waveBannerEl.classList.remove('hidden');
    } else {
      waveBannerEl.classList.add('hidden');
    }

    const boss = state.mode === 'playing' ? state.enemies.find((e) => e.type === 'boss') : null;
    if (boss) {
      bossBarEl.classList.remove('hidden');
      const pct = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));
      bossFillEl.style.width = `${pct}%`;
      bossTrailEl.style.width = `${pct}%`;
    } else {
      bossBarEl.classList.add('hidden');
    }
  }

  return {
    sync,
    updateMute,
  };
}
