import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ENEMY_SPECS,
  MAX_DT,
  NOVA_DAMAGE,
  NOVA_MAX_CHARGE,
  NOVA_RADIUS,
  PARRY_ACTIVE_TIME,
  PARRY_COOLDOWN,
  PARRY_RADIUS,
  PARRY_REFLECT_DAMAGE,
  PARRY_REFLECT_SPEED_MULT,
  PLAYER_ACCEL,
  PLAYER_DRAG,
  PLAYER_FIRE_INTERVAL,
  PLAYER_INVULN_TIME,
  PLAYER_MAX_HULL,
  PLAYER_MAX_SPEED,
  PLAYER_RADIUS,
  WAVE_SCRIPTS,
} from './config.js';

export function clampDt(rawDt) {
  if (!Number.isFinite(rawDt) || rawDt <= 0) return 0;
  return Math.min(rawDt, MAX_DT);
}

export function createSimulation(prng, events = {}) {
  const state = {
    mode: 'title', // 'title' | 'playing' | 'paused' | 'gameover'
    outcome: null, // 'victory' | 'defeat' | null
    endless: false,
    time: 0,
    waveIndex: 0,
    waveNumber: 1,
    waveTitle: WAVE_SCRIPTS[0].title,
    waveBannerTimer: 0,
    waveRemainingToSpawn: WAVE_SCRIPTS[0].total,
    spawnTimer: 0.7,
    score: 0,
    combo: 1,
    comboTimer: 0,
    parriesLanded: 0,
    enemiesDefeated: 0,
    hitstop: 0,
    trauma: 0,
    defeatDelay: 0,
    attackTokensMax: 3,
    nextId: 1,
    player: {
      x: ARENA_WIDTH * 0.5,
      y: ARENA_HEIGHT * 0.56,
      vx: 0,
      vy: 0,
      aimAngle: -Math.PI / 2,
      hull: PLAYER_MAX_HULL,
      maxHull: PLAYER_MAX_HULL,
      invuln: 0,
      fireCooldown: 0,
      parryTimer: 0,
      parryCooldown: 0,
      novaCharge: 25,
      squashX: 1,
      squashY: 1,
      hitFlash: 0,
      autoFire: true,
    },
    enemies: [],
    projectiles: [],
    shards: [],
    dyingEnemies: [],
  };

  function emit(name, payload) {
    if (typeof events[name] === 'function') events[name](payload);
  }

  function addTrauma(amount) {
    state.trauma = Math.min(1, state.trauma + amount);
  }

  function addScore(points) {
    const gained = Math.round(points * state.combo);
    state.score += gained;
    return gained;
  }

  function bumpCombo() {
    state.combo = Math.min(8, state.combo + 1);
    state.comboTimer = 4.2;
  }

  function activeWaveScript(idx) {
    if (idx < WAVE_SCRIPTS.length) return WAVE_SCRIPTS[idx];
    const extra = idx - WAVE_SCRIPTS.length + 1;
    return {
      wave: idx + 1,
      title: `ENDLESS DRIFT · SECTOR ${idx + 1}`,
      total: 22 + extra * 5,
      spawnGap: Math.max(0.38, 0.64 - extra * 0.04),
      maxConcurrent: Math.min(13, 9 + extra),
      mix: { swarmer: 0.24, lancer: 0.26, rammer: 0.25, weaver: 0.25 },
      boss: (idx + 1) % 5 === 0,
    };
  }

  function beginWave(idx) {
    const script = activeWaveScript(idx);
    state.waveIndex = idx;
    state.waveNumber = script.wave;
    state.waveTitle = script.title;
    state.waveRemainingToSpawn = script.total;
    state.spawnTimer = 0.85;
    state.waveBannerTimer = 2.2;
    state.attackTokensMax = Math.min(5, 2 + Math.floor(idx / 2) + 1);
    if (script.boss) {
      spawnEnemy('boss', ARENA_WIDTH * 0.5, -52);
      state.waveRemainingToSpawn = 0;
    }
    emit('waveStart', { wave: state.waveNumber, title: state.waveTitle, boss: Boolean(script.boss) });
  }

  function resetRun() {
    state.mode = 'playing';
    state.outcome = null;
    state.endless = false;
    state.time = 0;
    state.score = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.parriesLanded = 0;
    state.enemiesDefeated = 0;
    state.hitstop = 0;
    state.trauma = 0;
    state.defeatDelay = 0;
    state.enemies.length = 0;
    state.projectiles.length = 0;
    state.shards.length = 0;
    state.dyingEnemies.length = 0;
    state.player.x = ARENA_WIDTH * 0.5;
    state.player.y = ARENA_HEIGHT * 0.58;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.aimAngle = -Math.PI / 2;
    state.player.hull = PLAYER_MAX_HULL;
    state.player.invuln = 0.8;
    state.player.fireCooldown = 0;
    state.player.parryTimer = 0;
    state.player.parryCooldown = 0;
    state.player.novaCharge = 35;
    state.player.squashX = 1;
    state.player.squashY = 1;
    state.player.hitFlash = 0;
    beginWave(0);
  }

  function spawnEdgePoint() {
    const margin = 36;
    const edge = Math.floor(prng.next() * 4);
    if (edge === 0) return { x: prng.range(80, ARENA_WIDTH - 80), y: -margin };
    if (edge === 1) return { x: ARENA_WIDTH + margin, y: prng.range(80, ARENA_HEIGHT - 80) };
    if (edge === 2) return { x: prng.range(80, ARENA_WIDTH - 80), y: ARENA_HEIGHT + margin };
    return { x: -margin, y: prng.range(80, ARENA_HEIGHT - 80) };
  }

  function spawnEnemy(type, customX = null, customY = null) {
    const spec = ENEMY_SPECS[type];
    const pt = customX !== null && customY !== null ? { x: customX, y: customY } : spawnEdgePoint();
    const scaleMult = 1 + state.waveIndex * 0.08;
    state.enemies.push({
      id: state.nextId++,
      type,
      x: pt.x,
      y: pt.y,
      vx: 0,
      vy: 0,
      angle: Math.atan2(state.player.y - pt.y, state.player.x - pt.x),
      hp: Math.round(spec.hp * (type === 'boss' ? 1 : scaleMult)),
      maxHp: Math.round(spec.hp * (type === 'boss' ? 1 : scaleMult)),
      radius: spec.radius,
      speed: spec.speed * (type === 'boss' ? 1 : Math.min(1.28, 1 + state.waveIndex * 0.04)),
      score: spec.score,
      color: spec.color,
      phase: 'move', // 'move' | 'windup' | 'active' | 'recover'
      phaseTimer: prng.range(0.6, 1.4),
      strafeDir: prng.next() < 0.5 ? -1 : 1,
      seedOffset: prng.range(0, Math.PI * 2),
      hitFlash: 0,
      hasToken: false,
      bossPhase: 1,
      spiralAngle: 0,
      chargeDirX: 0,
      chargeDirY: 0,
    });
  }

  function spawnProjectile(owner, x, y, vx, vy, radius, damage, color, reflected = false) {
    state.projectiles.push({
      id: state.nextId++,
      owner, // 'player' | 'enemy'
      x,
      y,
      vx,
      vy,
      radius,
      damage,
      color,
      reflected,
      life: 4.5,
    });
  }

  function spawnShards(x, y, count) {
    for (let i = 0; i < count; i++) {
      const ang = prng.range(0, Math.PI * 2);
      const spd = prng.range(55, 145);
      state.shards.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 9.0,
      });
    }
  }

  function usedAttackTokens() {
    let used = 0;
    for (const e of state.enemies) {
      if (e.hasToken) used += 1;
    }
    return used;
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.invuln > 0 || p.parryTimer > 0 || state.defeatDelay > 0) return false;
    p.hull = Math.max(0, p.hull - amount);
    p.invuln = PLAYER_INVULN_TIME;
    p.hitFlash = 0.2;
    p.squashX = 1.28;
    p.squashY = 0.72;
    state.combo = 1;
    state.hitstop = 0.06;
    addTrauma(0.58);
    emit('playerHurt', { x: p.x, y: p.y, hull: p.hull });
    if (p.hull <= 0) {
      state.defeatDelay = 0.45;
    }
    return true;
  }

  function defeatEnemy(index, heavy = false) {
    const e = state.enemies[index];
    state.enemies.splice(index, 1);
    state.enemiesDefeated += 1;
    bumpCombo();
    const pts = addScore(e.score);
    const shardCount = e.type === 'boss' ? 14 : e.type === 'weaver' ? 3 : e.type === 'rammer' ? 2 : 1;
    spawnShards(e.x, e.y, shardCount);
    state.dyingEnemies.push({
      type: e.type,
      x: e.x,
      y: e.y,
      angle: e.angle,
      radius: e.radius,
      color: e.color,
      life: 0.34,
      maxLife: 0.34,
    });
    state.hitstop = Math.max(state.hitstop, e.type === 'boss' ? 0.08 : heavy ? 0.05 : 0.025);
    addTrauma(e.type === 'boss' ? 0.75 : heavy ? 0.32 : 0.16);
    emit('enemyKilled', { enemy: e, points: pts, heavy });
  }

  function damageEnemy(index, amount, heavy = false) {
    const e = state.enemies[index];
    if (!e) return;
    e.hp -= amount;
    e.hitFlash = 0.07;
    if (e.type === 'boss' && e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
      e.bossPhase = 2;
      state.hitstop = 0.07;
      addTrauma(0.45);
      emit('bossPhase', { x: e.x, y: e.y });
    }
    if (e.hp <= 0) {
      defeatEnemy(index, heavy);
    } else {
      emit('enemyHit', { x: e.x, y: e.y, color: e.color });
    }
  }

  function triggerParry() {
    const p = state.player;
    if (p.parryCooldown > 0) return false;
    p.parryTimer = PARRY_ACTIVE_TIME;
    p.parryCooldown = PARRY_COOLDOWN;
    p.squashX = 1.18;
    p.squashY = 0.86;
    emit('parrySwing', { x: p.x, y: p.y, radius: PARRY_RADIUS });
    return true;
  }

  function triggerNova() {
    const p = state.player;
    if (p.novaCharge < NOVA_MAX_CHARGE) return false;
    p.novaCharge = 0;
    p.invuln = Math.max(p.invuln, 0.7);
    p.squashX = 1.3;
    p.squashY = 0.75;
    state.hitstop = 0.06;
    addTrauma(0.65);

    // Clear enemy projectiles in nova radius and convert to score
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      if (pr.owner !== 'enemy') continue;
      if (Math.hypot(pr.x - p.x, pr.y - p.y) <= NOVA_RADIUS) {
        state.projectiles.splice(i, 1);
        addScore(25);
      }
    }

    // Blast all enemies within NOVA_RADIUS
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist <= NOVA_RADIUS + e.radius) {
        const dx = (e.x - p.x) / Math.max(1, dist);
        const dy = (e.y - p.y) / Math.max(1, dist);
        if (e.type !== 'boss') {
          e.x += dx * 48;
          e.y += dy * 48;
        }
        damageEnemy(i, NOVA_DAMAGE, true);
      }
    }
    emit('novaBurst', { x: p.x, y: p.y, radius: NOVA_RADIUS });
    return true;
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.type === 'swarmer') {
        // Sine-weaving flanker
        const perpX = -ny * e.strafeDir;
        const perpY = nx * e.strafeDir;
        const wave = Math.sin(state.time * 4.4 + e.seedOffset) * 0.72;
        e.vx = (nx + perpX * wave) * e.speed;
        e.vy = (ny + perpY * wave) * e.speed;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.type === 'lancer') {
        // Kiter/Sniper with laser sight telegraph
        if (e.phase === 'move') {
          const desired = dist < 240 ? -0.9 : dist > 350 ? 1.0 : 0.1;
          const perpX = -ny * e.strafeDir;
          const perpY = nx * e.strafeDir;
          e.vx = (nx * desired + perpX * 0.75) * e.speed;
          e.vy = (ny * desired + perpY * 0.75) * e.speed;
          e.x = Math.max(32, Math.min(ARENA_WIDTH - 32, e.x + e.vx * dt));
          e.y = Math.max(32, Math.min(ARENA_HEIGHT - 32, e.y + e.vy * dt));
          e.angle = Math.atan2(dy, dx);
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0 && dist < 560 && usedAttackTokens() < state.attackTokensMax) {
            e.phase = 'windup';
            e.phaseTimer = 0.56;
            e.hasToken = true;
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            emit('telegraph', { x: e.x, y: e.y });
          }
        } else if (e.phase === 'windup') {
          // Track slowly during early windup, lock final 0.2s
          if (e.phaseTimer > 0.2) {
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            e.angle = Math.atan2(dy, dx);
          }
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            const boltSpeed = 395;
            spawnProjectile(
              'enemy',
              e.x + e.chargeDirX * 18,
              e.y + e.chargeDirY * 18,
              e.chargeDirX * boltSpeed,
              e.chargeDirY * boltSpeed,
              6,
              1,
              '#ff5a4f',
            );
            e.hasToken = false;
            e.phase = 'recover';
            e.phaseTimer = 0.45;
          }
        } else {
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            e.phase = 'move';
            e.phaseTimer = prng.range(1.1, 1.8);
          }
        }
      } else if (e.type === 'rammer') {
        // Armored charger with lane telegraph + lunge + recovery
        if (e.phase === 'move') {
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.angle = Math.atan2(dy, dx);
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0 && dist < 340 && usedAttackTokens() < state.attackTokensMax) {
            e.phase = 'windup';
            e.phaseTimer = 0.52;
            e.hasToken = true;
            e.chargeDirX = nx;
            e.chargeDirY = ny;
            emit('telegraph', { x: e.x, y: e.y });
          }
        } else if (e.phase === 'windup') {
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            e.phase = 'active';
            e.phaseTimer = 0.44;
          }
        } else if (e.phase === 'active') {
          const lungeSpeed = 480;
          e.x += e.chargeDirX * lungeSpeed * dt;
          e.y += e.chargeDirY * lungeSpeed * dt;
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            e.hasToken = false;
            e.phase = 'recover';
            e.phaseTimer = 0.65;
          }
        } else {
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            e.phase = 'move';
            e.phaseTimer = prng.range(1.0, 1.7);
          }
        }
      } else if (e.type === 'weaver') {
        // Arena orbiter that fires tri-petal plasma volleys
        const cx = ARENA_WIDTH * 0.5;
        const cy = ARENA_HEIGHT * 0.5;
        const toC = Math.atan2(e.y - cy, e.x - cx);
        const orbitAngle = toC + e.strafeDir * 0.8 * dt;
        const targetR = 235;
        const currR = Math.hypot(e.x - cx, e.y - cy);
        const nextR = currR + (targetR - currR) * Math.min(1, dt * 1.4);
        e.x = cx + Math.cos(orbitAngle) * nextR;
        e.y = cy + Math.sin(orbitAngle) * nextR;
        e.angle += dt * 1.8 * e.strafeDir;
        e.phaseTimer -= dt;
        if (e.phase === 'move' && e.phaseTimer <= 0 && usedAttackTokens() < state.attackTokensMax) {
          e.phase = 'windup';
          e.phaseTimer = 0.42;
          e.hasToken = true;
          emit('telegraph', { x: e.x, y: e.y });
        } else if (e.phase === 'windup' && e.phaseTimer <= 0) {
          const baseAng = Math.atan2(dy, dx);
          for (let k = -1; k <= 1; k++) {
            const a = baseAng + k * 0.28;
            spawnProjectile('enemy', e.x, e.y, Math.cos(a) * 235, Math.sin(a) * 235, 6.5, 1, '#c388ff');
          }
          e.hasToken = false;
          e.phase = 'move';
          e.phaseTimer = prng.range(1.7, 2.3);
        }
      } else if (e.type === 'boss') {
        // Eclipse Leviathan multi-phase boss
        const targetX = ARENA_WIDTH * 0.5 + Math.cos(state.time * 0.55) * 220;
        const targetY = 148 + Math.sin(state.time * 0.9) * 38;
        e.x += (targetX - e.x) * Math.min(1, dt * 1.9);
        e.y += (targetY - e.y) * Math.min(1, dt * 1.9);
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        e.phaseTimer -= dt;
        if (e.phase === 'move' && e.phaseTimer <= 0) {
          e.phase = 'windup';
          e.phaseTimer = e.bossPhase === 2 ? 0.36 : 0.48;
          emit('telegraph', { x: e.x, y: e.y });
        } else if (e.phase === 'windup' && e.phaseTimer <= 0) {
          const count = e.bossPhase === 2 ? 10 : 7;
          e.spiralAngle += 0.35;
          for (let k = 0; k < count; k++) {
            const ang = e.spiralAngle + (k / count) * Math.PI * 2;
            const spd = e.bossPhase === 2 ? 255 : 210;
            spawnProjectile('enemy', e.x, e.y, Math.cos(ang) * spd, Math.sin(ang) * spd, 7, 1, '#ff5a4f');
          }
          e.phase = 'move';
          e.phaseTimer = e.bossPhase === 2 ? 1.05 : 1.45;
        }
      }

      // Enemy-to-player contact
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius - 3) {
        if (p.parryTimer > 0 && e.type !== 'boss') {
          // Parry bash knocks enemy back and damages it
          e.x -= nx * 54;
          e.y -= ny * 54;
          damageEnemy(i, 36, true);
        } else {
          damagePlayer(1);
        }
      }
    }
  }

  function updateProjectiles(dt) {
    const p = state.player;
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (
        pr.life <= 0 ||
        pr.x < -60 ||
        pr.x > ARENA_WIDTH + 60 ||
        pr.y < -60 ||
        pr.y > ARENA_HEIGHT + 60
      ) {
        state.projectiles.splice(i, 1);
        continue;
      }

      if (pr.owner === 'enemy') {
        const distToPlayer = Math.hypot(pr.x - p.x, pr.y - p.y);
        if (p.parryTimer > 0 && distToPlayer <= PARRY_RADIUS + pr.radius) {
          // Reflect back toward closest enemy or along reversed vector!
          let target = null;
          let bestDist = Infinity;
          for (const e of state.enemies) {
            const d = Math.hypot(e.x - pr.x, e.y - pr.y);
            if (d < bestDist) {
              bestDist = d;
              target = e;
            }
          }
          const spd = Math.hypot(pr.vx, pr.vy) * PARRY_REFLECT_SPEED_MULT;
          const ang = target
            ? Math.atan2(target.y - pr.y, target.x - pr.x)
            : Math.atan2(-pr.vy, -pr.vx);
          pr.owner = 'player';
          pr.reflected = true;
          pr.vx = Math.cos(ang) * spd;
          pr.vy = Math.sin(ang) * spd;
          pr.damage = PARRY_REFLECT_DAMAGE;
          pr.color = '#fde3a7';
          pr.radius = 8.5;
          pr.life = 2.4;
          state.parriesLanded += 1;
          p.novaCharge = Math.min(NOVA_MAX_CHARGE, p.novaCharge + 18);
          p.parryCooldown = Math.min(p.parryCooldown, 0.25); // Reward crisp parry with fast reset!
          bumpCombo();
          addScore(90);
          state.hitstop = Math.max(state.hitstop, 0.045);
          addTrauma(0.25);
          emit('parryReflect', { x: pr.x, y: pr.y });
          continue;
        }
        if (distToPlayer <= p.radius + pr.radius - 2) {
          state.projectiles.splice(i, 1);
          damagePlayer(pr.damage);
          continue;
        }
      } else {
        // Player projectile hits enemies
        let hit = false;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const e = state.enemies[j];
          if (Math.hypot(pr.x - e.x, pr.y - e.y) <= e.radius + pr.radius) {
            damageEnemy(j, pr.damage, pr.reflected);
            state.projectiles.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }
    }
  }

  function updateShards(dt) {
    const p = state.player;
    for (let i = state.shards.length - 1; i >= 0; i--) {
      const s = state.shards[i];
      s.life -= dt;
      if (s.life <= 0) {
        state.shards.splice(i, 1);
        continue;
      }
      s.vx *= Math.max(0, 1 - 2.6 * dt);
      s.vy *= Math.max(0, 1 - 2.6 * dt);
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 145) {
        const pull = (1 - dist / 145) * 620;
        s.vx += (dx / Math.max(1, dist)) * pull * dt;
        s.vy += (dy / Math.max(1, dist)) * pull * dt;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (dist <= p.radius + 14) {
        state.shards.splice(i, 1);
        p.novaCharge = Math.min(NOVA_MAX_CHARGE, p.novaCharge + 9);
        addScore(35);
        emit('shardCollected', { x: s.x, y: s.y, combo: state.combo });
      }
    }
  }

  function step(rawDt, input) {
    const dt = clampDt(rawDt);
    if (dt === 0) return;

    state.trauma = Math.max(0, state.trauma - dt * 1.8);

    if (state.mode !== 'playing') return;

    // Hitstop pauses gameplay sim while trauma & flashes decay in real dt
    if (state.hitstop > 0) {
      state.hitstop = Math.max(0, state.hitstop - dt);
      return;
    }

    state.time += dt;

    if (state.defeatDelay > 0) {
      state.defeatDelay -= dt;
      if (state.defeatDelay <= 0) {
        state.mode = 'gameover';
        state.outcome = 'defeat';
        emit('gameOver', { outcome: 'defeat', score: state.score, wave: state.waveNumber });
      }
      return;
    }

    const p = state.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.parryTimer > 0) p.parryTimer = Math.max(0, p.parryTimer - dt);
    if (p.parryCooldown > 0) p.parryCooldown = Math.max(0, p.parryCooldown - dt);
    if (state.waveBannerTimer > 0) state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }

    // Damped squash-and-stretch return
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);

    // Movement
    const moveLen = Math.hypot(input.moveX, input.moveY);
    if (moveLen > 0) {
      p.vx += (input.moveX / moveLen) * PLAYER_ACCEL * dt;
      p.vy += (input.moveY / moveLen) * PLAYER_ACCEL * dt;
    }
    p.vx -= p.vx * Math.min(1, PLAYER_DRAG * dt);
    p.vy -= p.vy * Math.min(1, PLAYER_DRAG * dt);
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > PLAYER_MAX_SPEED) {
      p.vx = (p.vx / spd) * PLAYER_MAX_SPEED;
      p.vy = (p.vy / spd) * PLAYER_MAX_SPEED;
    }
    p.x = Math.max(PLAYER_RADIUS + 14, Math.min(ARENA_WIDTH - PLAYER_RADIUS - 14, p.x + p.vx * dt));
    p.y = Math.max(PLAYER_RADIUS + 14, Math.min(ARENA_HEIGHT - PLAYER_RADIUS - 14, p.y + p.vy * dt));

    p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);

    if (input.parryTriggered) triggerParry();
    if (input.novaTriggered) triggerNova();

    const shouldFire = input.firing || p.autoFire;
    if (shouldFire && p.fireCooldown <= 0) {
      p.fireCooldown = PLAYER_FIRE_INTERVAL;
      const cos = Math.cos(p.aimAngle);
      const sin = Math.sin(p.aimAngle);
      spawnProjectile('player', p.x + cos * 20, p.y + sin * 20, cos * 680, sin * 680, 4.5, 14, '#fde3a7');
      p.squashX = 0.92;
      p.squashY = 1.08;
      emit('playerShot', { x: p.x + cos * 20, y: p.y + sin * 20, pitch: prng.range(0.92, 1.08) });
    }

    // Spawner
    const script = activeWaveScript(state.waveIndex);
    if (state.waveRemainingToSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemies.length < script.maxConcurrent) {
        const type = prng.pickWeighted(script.mix);
        spawnEnemy(type);
        state.waveRemainingToSpawn -= 1;
        state.spawnTimer = script.spawnGap;
      }
    } else if (script.boss && state.enemies.length > 0 && state.enemies.length < 4) {
      // Boss escorts
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(prng.next() < 0.65 ? 'swarmer' : 'lancer');
        state.spawnTimer = 2.6;
      }
    }

    updateEnemies(dt);
    updateProjectiles(dt);
    updateShards(dt);

    for (let i = state.dyingEnemies.length - 1; i >= 0; i--) {
      state.dyingEnemies[i].life -= dt;
      if (state.dyingEnemies[i].life <= 0) state.dyingEnemies.splice(i, 1);
    }

    // Wave completion check
    const bossAlive = state.enemies.some((e) => e.type === 'boss');
    if ((state.waveRemainingToSpawn <= 0 && state.enemies.length === 0) || (script.boss && !bossAlive && state.dyingEnemies.length === 0)) {
      if (!state.endless && state.waveNumber >= WAVE_SCRIPTS.length) {
        state.mode = 'gameover';
        state.outcome = 'victory';
        emit('gameOver', { outcome: 'victory', score: state.score, wave: state.waveNumber });
      } else {
        emit('waveClear', { wave: state.waveNumber });
        beginWave(state.waveIndex + 1);
      }
    }
  }

  return {
    state,
    resetRun,
    beginWave,
    spawnEnemy,
    spawnProjectile,
    triggerParry,
    triggerNova,
    damagePlayer,
    step,
  };
}
