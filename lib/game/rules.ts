import type {
  DyingEnemy,
  EnemyArchetype,
  EnemyEntity,
  GameMode,
  GameOutcome,
  PlayerState,
  ProjectileEntity,
  ShardEntity,
  SimInput,
} from './types';

export const ARENA_RADIUS = 25;
export const OBELISK_RADIUS = 2.2;
export const MAX_DT = 0.05;
export const PLAYER_MAX_HULL = 4;
export const PLAYER_RADIUS = 0.95;
export const PLAYER_ACCEL = 58;
export const PLAYER_DRAG = 5.4;
export const PLAYER_MAX_SPEED = 14.5;
export const PLAYER_FIRE_INTERVAL = 0.14;
export const PLAYER_INVULN_TIME = 1.15;

export const PARRY_COOLDOWN = 0.95;
export const PARRY_ACTIVE_TIME = 0.34;
export const PARRY_RADIUS = 3.4;
export const PARRY_REFLECT_SPEED_MULT = 2.15;
export const PARRY_REFLECT_DAMAGE = 62;

export const NOVA_MAX_CHARGE = 100;
export const NOVA_RADIUS = 13.5;
export const NOVA_DAMAGE = 95;

export interface WaveDef {
  wave: number;
  title: string;
  total: number;
  spawnGap: number;
  maxConcurrent: number;
  mix: Partial<Record<EnemyArchetype, number>>;
  boss?: boolean;
}

export const WAVE_SCRIPTS: WaveDef[] = [
  { wave: 1, title: 'SECTOR I · SOLAR DRIFT', total: 10, spawnGap: 1.05, maxConcurrent: 4, mix: { swarmer: 0.7, lancer: 0.3 } },
  { wave: 2, title: 'SECTOR II · LANCER ARC', total: 15, spawnGap: 0.9, maxConcurrent: 6, mix: { swarmer: 0.45, lancer: 0.35, rammer: 0.2 } },
  { wave: 3, title: 'SECTOR III · IRON VANGUARD', total: 20, spawnGap: 0.78, maxConcurrent: 7, mix: { swarmer: 0.32, lancer: 0.28, rammer: 0.24, weaver: 0.16 } },
  { wave: 4, title: 'SECTOR IV · ASTRAL TEMPEST', total: 24, spawnGap: 0.68, maxConcurrent: 9, mix: { swarmer: 0.26, lancer: 0.28, rammer: 0.24, weaver: 0.22 } },
  { wave: 5, title: 'SECTOR V · ECLIPSE LEVIATHAN', total: 1, spawnGap: 1.5, maxConcurrent: 5, mix: { swarmer: 0.65, lancer: 0.35 }, boss: true },
];

export const ENEMY_SPECS: Record<
  EnemyArchetype,
  { hp: number; radius: number; speed: number; score: number; color: string }
> = {
  swarmer: { hp: 26, radius: 0.75, speed: 7.4, score: 110, color: '#f5b041' },
  lancer: { hp: 42, radius: 0.9, speed: 5.0, score: 180, color: '#5cb2ff' },
  rammer: { hp: 76, radius: 1.15, speed: 4.2, score: 240, color: '#ff5a4f' },
  weaver: { hp: 64, radius: 1.05, speed: 4.5, score: 260, color: '#c388ff' },
  boss: { hp: 960, radius: 2.6, speed: 3.1, score: 1500, color: '#ff5a4f' },
};

export interface Prng {
  next(): number;
  range(min: number, max: number): number;
  pickWeighted(table: Partial<Record<EnemyArchetype, number>>): EnemyArchetype;
}

export function createPrng(initialSeed = 42): Prng {
  let s = (initialSeed >>> 0) || 1;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min: number, max: number) {
      return min + (max - min) * this.next();
    },
    pickWeighted(table) {
      const entries = Object.entries(table) as [EnemyArchetype, number][];
      let total = 0;
      for (const [, w] of entries) total += w;
      let roll = this.next() * total;
      for (const [k, w] of entries) {
        roll -= w;
        if (roll <= 0) return k;
      }
      return entries[0][0];
    },
  };
}

export function clampDt(rawDt: number): number {
  if (!Number.isFinite(rawDt) || rawDt <= 0) return 0;
  return Math.min(rawDt, MAX_DT);
}

export interface SimEventCallbacks {
  onShot?: (x: number, z: number, pitch: number) => void;
  onParrySwing?: (x: number, z: number) => void;
  onParryReflect?: (x: number, z: number) => void;
  onNova?: (x: number, z: number) => void;
  onEnemyHit?: (x: number, z: number, color: string) => void;
  onEnemyKilled?: (enemy: EnemyEntity, points: number, heavy: boolean) => void;
  onShard?: (x: number, z: number, combo: number) => void;
  onTelegraph?: () => void;
  onPlayerHurt?: (x: number, z: number) => void;
  onWaveStart?: (wave: number, title: string, boss: boolean) => void;
  onBossPhase?: (x: number, z: number) => void;
  onGameOver?: (outcome: 'victory' | 'defeat', score: number) => void;
}

export interface SimulationState {
  mode: GameMode;
  outcome: GameOutcome;
  endless: boolean;
  time: number;
  waveIndex: number;
  waveNumber: number;
  waveTitle: string;
  waveBannerTimer: number;
  waveRemainingToSpawn: number;
  spawnTimer: number;
  score: number;
  combo: number;
  comboTimer: number;
  parriesLanded: number;
  enemiesDefeated: number;
  hitstop: number;
  trauma: number;
  defeatDelay: number;
  attackTokensMax: number;
  nextId: number;
  player: PlayerState;
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
  shards: ShardEntity[];
  dyingEnemies: DyingEnemy[];
}

export function createSimulation(prng: Prng, events: SimEventCallbacks = {}) {
  const state: SimulationState = {
    mode: 'title',
    outcome: null,
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
      x: 0,
      z: 9,
      vx: 0,
      vz: 0,
      aimAngle: 0,
      bankAngle: 0,
      hull: PLAYER_MAX_HULL,
      maxHull: PLAYER_MAX_HULL,
      invuln: 0,
      fireCooldown: 0,
      parryTimer: 0,
      parryCooldown: 0,
      novaCharge: 35,
      hitFlash: 0,
      squash: 1,
      autoFire: true,
    },
    enemies: [],
    projectiles: [],
    shards: [],
    dyingEnemies: [],
  };

  function addTrauma(amount: number) {
    state.trauma = Math.min(1, state.trauma + amount);
  }

  function addScore(points: number) {
    const gained = Math.round(points * state.combo);
    state.score += gained;
    return gained;
  }

  function bumpCombo() {
    state.combo = Math.min(8, state.combo + 1);
    state.comboTimer = 4.2;
  }

  function activeWaveScript(idx: number): WaveDef {
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

  function spawnRingPoint(): { x: number; z: number } {
    const ang = prng.range(0, Math.PI * 2);
    const r = ARENA_RADIUS - 1.2;
    return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
  }

  function spawnEnemy(type: EnemyArchetype, customX?: number, customZ?: number): EnemyEntity {
    const spec = ENEMY_SPECS[type];
    const pt =
      customX !== undefined && customZ !== undefined
        ? { x: customX, z: customZ }
        : spawnRingPoint();
    const scaleMult = 1 + state.waveIndex * 0.08;
    const hp = Math.round(spec.hp * (type === 'boss' ? 1 : scaleMult));
    const entity: EnemyEntity = {
      id: state.nextId++,
      type,
      x: pt.x,
      z: pt.z,
      vx: 0,
      vz: 0,
      angle: Math.atan2(state.player.x - pt.x, state.player.z - pt.z),
      hp,
      maxHp: hp,
      radius: spec.radius,
      speed: spec.speed * (type === 'boss' ? 1 : Math.min(1.28, 1 + state.waveIndex * 0.04)),
      score: spec.score,
      color: spec.color,
      phase: 'move',
      phaseTimer: prng.range(0.6, 1.4),
      strafeDir: prng.next() < 0.5 ? -1 : 1,
      seedOffset: prng.range(0, Math.PI * 2),
      hitFlash: 0,
      hasToken: false,
      bossPhase: 1,
      spiralAngle: 0,
      dirX: 0,
      dirZ: 1,
    };
    state.enemies.push(entity);
    return entity;
  }

  function spawnProjectile(
    owner: 'player' | 'enemy',
    x: number,
    z: number,
    vx: number,
    vz: number,
    radius: number,
    damage: number,
    color: string,
    reflected = false,
  ) {
    state.projectiles.push({
      id: state.nextId++,
      owner,
      x,
      z,
      vx,
      vz,
      radius,
      damage,
      color,
      reflected,
      life: 4.2,
    });
  }

  function spawnShards(x: number, z: number, count: number) {
    for (let i = 0; i < count; i++) {
      const ang = prng.range(0, Math.PI * 2);
      const spd = prng.range(2.2, 5.8);
      state.shards.push({
        id: state.nextId++,
        x,
        z,
        vx: Math.cos(ang) * spd,
        vz: Math.sin(ang) * spd,
        life: 9.0,
      });
    }
  }

  function beginWave(idx: number) {
    const script = activeWaveScript(idx);
    state.waveIndex = idx;
    state.waveNumber = script.wave;
    state.waveTitle = script.title;
    state.waveRemainingToSpawn = script.total;
    state.spawnTimer = 0.85;
    state.waveBannerTimer = 2.2;
    state.attackTokensMax = Math.min(5, 2 + Math.floor(idx / 2) + 1);
    if (script.boss) {
      spawnEnemy('boss', 0, -14);
      state.waveRemainingToSpawn = 0;
    }
    events.onWaveStart?.(state.waveNumber, state.waveTitle, Boolean(script.boss));
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
    state.player.x = 0;
    state.player.z = 9;
    state.player.vx = 0;
    state.player.vz = 0;
    state.player.aimAngle = Math.PI;
    state.player.bankAngle = 0;
    state.player.hull = PLAYER_MAX_HULL;
    state.player.invuln = 0.9;
    state.player.fireCooldown = 0;
    state.player.parryTimer = 0;
    state.player.parryCooldown = 0;
    state.player.novaCharge = 35;
    state.player.hitFlash = 0;
    state.player.squash = 1;
    beginWave(0);
  }

  function usedAttackTokens() {
    let used = 0;
    for (const e of state.enemies) {
      if (e.hasToken) used += 1;
    }
    return used;
  }

  function keepOutsideObelisk(obj: { x: number; z: number }, radius: number) {
    const d = Math.hypot(obj.x, obj.z);
    const minDist = OBELISK_RADIUS + radius;
    if (d < minDist && d > 0.0001) {
      obj.x = (obj.x / d) * minDist;
      obj.z = (obj.z / d) * minDist;
    }
  }

  function clampInsideArena(obj: { x: number; z: number }, radius: number) {
    const d = Math.hypot(obj.x, obj.z);
    const maxR = ARENA_RADIUS - radius;
    if (d > maxR) {
      obj.x = (obj.x / d) * maxR;
      obj.z = (obj.z / d) * maxR;
    }
  }

  function damagePlayer(amount: number): boolean {
    const p = state.player;
    if (p.invuln > 0 || p.parryTimer > 0 || state.defeatDelay > 0) return false;
    p.hull = Math.max(0, p.hull - amount);
    p.invuln = PLAYER_INVULN_TIME;
    p.hitFlash = 0.22;
    p.squash = 1.28;
    state.combo = 1;
    state.hitstop = 0.06;
    addTrauma(0.6);
    events.onPlayerHurt?.(p.x, p.z);
    if (p.hull <= 0) {
      state.defeatDelay = 0.45;
    }
    return true;
  }

  function defeatEnemy(index: number, heavy = false) {
    const e = state.enemies[index];
    state.enemies.splice(index, 1);
    state.enemiesDefeated += 1;
    bumpCombo();
    const pts = addScore(e.score);
    const shardCount = e.type === 'boss' ? 14 : e.type === 'weaver' ? 3 : e.type === 'rammer' ? 2 : 1;
    spawnShards(e.x, e.z, shardCount);
    state.dyingEnemies.push({
      type: e.type,
      x: e.x,
      z: e.z,
      angle: e.angle,
      radius: e.radius,
      color: e.color,
      life: 0.36,
      maxLife: 0.36,
    });
    state.hitstop = Math.max(state.hitstop, e.type === 'boss' ? 0.08 : heavy ? 0.05 : 0.025);
    addTrauma(e.type === 'boss' ? 0.78 : heavy ? 0.32 : 0.16);
    events.onEnemyKilled?.(e, pts, heavy);
  }

  function damageEnemy(index: number, amount: number, heavy = false) {
    const e = state.enemies[index];
    if (!e) return;
    e.hp -= amount;
    e.hitFlash = 0.08;
    if (e.type === 'boss' && e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
      e.bossPhase = 2;
      state.hitstop = 0.07;
      addTrauma(0.45);
      events.onBossPhase?.(e.x, e.z);
    }
    if (e.hp <= 0) {
      defeatEnemy(index, heavy);
    } else {
      events.onEnemyHit?.(e.x, e.z, e.color);
    }
  }

  function triggerParry(): boolean {
    const p = state.player;
    if (p.parryCooldown > 0) return false;
    p.parryTimer = PARRY_ACTIVE_TIME;
    p.parryCooldown = PARRY_COOLDOWN;
    p.squash = 1.18;
    events.onParrySwing?.(p.x, p.z);
    return true;
  }

  function triggerNova(): boolean {
    const p = state.player;
    if (p.novaCharge < NOVA_MAX_CHARGE) return false;
    p.novaCharge = 0;
    p.invuln = Math.max(p.invuln, 0.75);
    p.squash = 1.32;
    state.hitstop = 0.065;
    addTrauma(0.65);

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      if (pr.owner !== 'enemy') continue;
      if (Math.hypot(pr.x - p.x, pr.z - p.z) <= NOVA_RADIUS) {
        state.projectiles.splice(i, 1);
        addScore(25);
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const dist = Math.hypot(e.x - p.x, e.z - p.z);
      if (dist <= NOVA_RADIUS + e.radius) {
        if (e.type !== 'boss' && dist > 0.01) {
          e.x += ((e.x - p.x) / dist) * 2.2;
          e.z += ((e.z - p.z) / dist) * 2.2;
        }
        damageEnemy(i, NOVA_DAMAGE, true);
      }
    }
    events.onNova?.(p.x, p.z);
    return true;
  }

  function updateEnemies(dt: number) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.max(0.01, Math.hypot(dx, dz));
      const nx = dx / dist;
      const nz = dz / dist;

      if (e.type === 'swarmer') {
        const perpX = -nz * e.strafeDir;
        const perpZ = nx * e.strafeDir;
        const wave = Math.sin(state.time * 4.4 + e.seedOffset) * 0.75;
        e.vx = (nx + perpX * wave) * e.speed;
        e.vz = (nz + perpZ * wave) * e.speed;
        e.x += e.vx * dt;
        e.z += e.vz * dt;
        e.angle = Math.atan2(e.vx, e.vz);
      } else if (e.type === 'lancer') {
        if (e.phase === 'move') {
          const desired = dist < 9.5 ? -0.9 : dist > 14.5 ? 1.0 : 0.1;
          const perpX = -nz * e.strafeDir;
          const perpZ = nx * e.strafeDir;
          e.vx = (nx * desired + perpX * 0.78) * e.speed;
          e.vz = (nz * desired + perpZ * 0.78) * e.speed;
          e.x += e.vx * dt;
          e.z += e.vz * dt;
          clampInsideArena(e, e.radius);
          e.angle = Math.atan2(dx, dz);
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0 && dist < 24 && usedAttackTokens() < state.attackTokensMax) {
            e.phase = 'windup';
            e.phaseTimer = 0.56;
            e.hasToken = true;
            e.dirX = nx;
            e.dirZ = nz;
            events.onTelegraph?.();
          }
        } else if (e.phase === 'windup') {
          if (e.phaseTimer > 0.2) {
            e.dirX = nx;
            e.dirZ = nz;
            e.angle = Math.atan2(dx, dz);
          }
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            const boltSpeed = 16.5;
            spawnProjectile(
              'enemy',
              e.x + e.dirX * 1.1,
              e.z + e.dirZ * 1.1,
              e.dirX * boltSpeed,
              e.dirZ * boltSpeed,
              0.38,
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
        if (e.phase === 'move') {
          e.vx = nx * e.speed;
          e.vz = nz * e.speed;
          e.x += e.vx * dt;
          e.z += e.vz * dt;
          e.angle = Math.atan2(dx, dz);
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0 && dist < 14 && usedAttackTokens() < state.attackTokensMax) {
            e.phase = 'windup';
            e.phaseTimer = 0.52;
            e.hasToken = true;
            e.dirX = nx;
            e.dirZ = nz;
            events.onTelegraph?.();
          }
        } else if (e.phase === 'windup') {
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            e.phase = 'active';
            e.phaseTimer = 0.44;
          }
        } else if (e.phase === 'active') {
          const lungeSpeed = 19.5;
          e.x += e.dirX * lungeSpeed * dt;
          e.z += e.dirZ * lungeSpeed * dt;
          clampInsideArena(e, e.radius);
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
        const toC = Math.atan2(e.z, e.x);
        const orbitAngle = toC + e.strafeDir * 0.8 * dt;
        const targetR = 11.5;
        const currR = Math.hypot(e.x, e.z);
        const nextR = currR + (targetR - currR) * Math.min(1, dt * 1.4);
        e.x = Math.cos(orbitAngle) * nextR;
        e.z = Math.sin(orbitAngle) * nextR;
        e.angle += dt * 1.8 * e.strafeDir;
        e.phaseTimer -= dt;
        if (e.phase === 'move' && e.phaseTimer <= 0 && usedAttackTokens() < state.attackTokensMax) {
          e.phase = 'windup';
          e.phaseTimer = 0.42;
          e.hasToken = true;
          events.onTelegraph?.();
        } else if (e.phase === 'windup' && e.phaseTimer <= 0) {
          const baseAng = Math.atan2(dz, dx);
          for (let k = -1; k <= 1; k++) {
            const a = baseAng + k * 0.28;
            spawnProjectile('enemy', e.x, e.z, Math.cos(a) * 10.5, Math.sin(a) * 10.5, 0.4, 1, '#c388ff');
          }
          e.hasToken = false;
          e.phase = 'move';
          e.phaseTimer = prng.range(1.7, 2.3);
        }
      } else if (e.type === 'boss') {
        const targetX = Math.cos(state.time * 0.55) * 10.5;
        const targetZ = -11.5 + Math.sin(state.time * 0.9) * 3.2;
        e.x += (targetX - e.x) * Math.min(1, dt * 1.9);
        e.z += (targetZ - e.z) * Math.min(1, dt * 1.9);
        e.angle = Math.atan2(p.x - e.x, p.z - e.z);
        e.phaseTimer -= dt;
        if (e.phase === 'move' && e.phaseTimer <= 0) {
          e.phase = 'windup';
          e.phaseTimer = e.bossPhase === 2 ? 0.36 : 0.48;
          events.onTelegraph?.();
        } else if (e.phase === 'windup' && e.phaseTimer <= 0) {
          const count = e.bossPhase === 2 ? 10 : 7;
          e.spiralAngle += 0.35;
          for (let k = 0; k < count; k++) {
            const ang = e.spiralAngle + (k / count) * Math.PI * 2;
            const spd = e.bossPhase === 2 ? 11.2 : 9.2;
            spawnProjectile('enemy', e.x, e.z, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.42, 1, '#ff5a4f');
          }
          e.phase = 'move';
          e.phaseTimer = e.bossPhase === 2 ? 1.05 : 1.45;
        }
      }

      keepOutsideObelisk(e, e.radius);

      if (Math.hypot(p.x - e.x, p.z - e.z) < PLAYER_RADIUS + e.radius - 0.15) {
        if (p.parryTimer > 0 && e.type !== 'boss') {
          e.x -= nx * 2.4;
          e.z -= nz * 2.4;
          damageEnemy(i, 36, true);
        } else {
          damagePlayer(1);
        }
      }
    }
  }

  function updateProjectiles(dt: number) {
    const p = state.player;
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const pr = state.projectiles[i];
      pr.x += pr.vx * dt;
      pr.z += pr.vz * dt;
      pr.life -= dt;

      if (pr.life <= 0 || Math.hypot(pr.x, pr.z) > ARENA_RADIUS + 4) {
        state.projectiles.splice(i, 1);
        continue;
      }

      if (pr.owner === 'enemy') {
        const distToPlayer = Math.hypot(pr.x - p.x, pr.z - p.z);
        if (p.parryTimer > 0 && distToPlayer <= PARRY_RADIUS + pr.radius) {
          let target: EnemyEntity | null = null;
          let bestDist = Infinity;
          for (const e of state.enemies) {
            const d = Math.hypot(e.x - pr.x, e.z - pr.z);
            if (d < bestDist) {
              bestDist = d;
              target = e;
            }
          }
          const spd = Math.hypot(pr.vx, pr.vz) * PARRY_REFLECT_SPEED_MULT;
          const ang = target
            ? Math.atan2(target.z - pr.z, target.x - pr.x)
            : Math.atan2(-pr.vz, -pr.vx);
          pr.owner = 'player';
          pr.reflected = true;
          pr.vx = Math.cos(ang) * spd;
          pr.vz = Math.sin(ang) * spd;
          pr.damage = PARRY_REFLECT_DAMAGE;
          pr.color = '#fde3a7';
          pr.radius = 0.48;
          pr.life = 2.4;
          state.parriesLanded += 1;
          p.novaCharge = Math.min(NOVA_MAX_CHARGE, p.novaCharge + 18);
          p.parryCooldown = Math.min(p.parryCooldown, 0.25);
          bumpCombo();
          addScore(90);
          state.hitstop = Math.max(state.hitstop, 0.045);
          addTrauma(0.25);
          events.onParryReflect?.(pr.x, pr.z);
          continue;
        }
        if (distToPlayer <= PLAYER_RADIUS + pr.radius - 0.1) {
          state.projectiles.splice(i, 1);
          damagePlayer(pr.damage);
          continue;
        }
      } else {
        let hit = false;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const e = state.enemies[j];
          if (Math.hypot(pr.x - e.x, pr.z - e.z) <= e.radius + pr.radius) {
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

  function updateShards(dt: number) {
    const p = state.player;
    for (let i = state.shards.length - 1; i >= 0; i--) {
      const s = state.shards[i];
      s.life -= dt;
      if (s.life <= 0) {
        state.shards.splice(i, 1);
        continue;
      }
      s.vx *= Math.max(0, 1 - 2.6 * dt);
      s.vz *= Math.max(0, 1 - 2.6 * dt);
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6.5) {
        const pull = (1 - dist / 6.5) * 28;
        s.vx += (dx / Math.max(0.01, dist)) * pull * dt;
        s.vz += (dz / Math.max(0.01, dist)) * pull * dt;
      }
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      if (dist <= PLAYER_RADIUS + 0.7) {
        state.shards.splice(i, 1);
        p.novaCharge = Math.min(NOVA_MAX_CHARGE, p.novaCharge + 9);
        addScore(35);
        events.onShard?.(s.x, s.z, state.combo);
      }
    }
  }

  function step(rawDt: number, input: SimInput) {
    const dt = clampDt(rawDt);
    if (dt === 0) return;

    state.trauma = Math.max(0, state.trauma - dt * 1.8);
    if (state.mode !== 'playing') return;

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
        events.onGameOver?.('defeat', state.score);
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

    p.squash += (1 - p.squash) * Math.min(1, dt * 14);

    const moveLen = Math.hypot(input.moveX, input.moveZ);
    if (moveLen > 0) {
      p.vx += (input.moveX / moveLen) * PLAYER_ACCEL * dt;
      p.vz += (input.moveZ / moveLen) * PLAYER_ACCEL * dt;
    }
    p.vx -= p.vx * Math.min(1, PLAYER_DRAG * dt);
    p.vz -= p.vz * Math.min(1, PLAYER_DRAG * dt);
    const spd = Math.hypot(p.vx, p.vz);
    if (spd > PLAYER_MAX_SPEED) {
      p.vx = (p.vx / spd) * PLAYER_MAX_SPEED;
      p.vz = (p.vz / spd) * PLAYER_MAX_SPEED;
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    keepOutsideObelisk(p, PLAYER_RADIUS);
    clampInsideArena(p, PLAYER_RADIUS);

    p.aimAngle = Math.atan2(input.aimX - p.x, input.aimZ - p.z);
    const desiredBank = Math.max(-0.42, Math.min(0.42, -p.vx * 0.03));
    p.bankAngle += (desiredBank - p.bankAngle) * Math.min(1, dt * 10);

    if (input.parryTriggered) triggerParry();
    if (input.novaTriggered) triggerNova();

    const shouldFire = input.firing || p.autoFire;
    if (shouldFire && p.fireCooldown <= 0) {
      p.fireCooldown = PLAYER_FIRE_INTERVAL;
      const sx = Math.sin(p.aimAngle);
      const sz = Math.cos(p.aimAngle);
      spawnProjectile('player', p.x + sx * 1.15, p.z + sz * 1.15, sx * 29, sz * 29, 0.25, 14, '#fde3a7');
      p.squash = 0.92;
      events.onShot?.(p.x + sx * 1.15, p.z + sz * 1.15, prng.range(0.92, 1.08));
    }

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

    const bossAlive = state.enemies.some((e) => e.type === 'boss');
    if (
      (state.waveRemainingToSpawn <= 0 && state.enemies.length === 0) ||
      (script.boss && !bossAlive && state.dyingEnemies.length === 0)
    ) {
      if (!state.endless && state.waveNumber >= WAVE_SCRIPTS.length) {
        state.mode = 'gameover';
        state.outcome = 'victory';
        events.onGameOver?.('victory', state.score);
      } else {
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
