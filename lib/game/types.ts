export type GameMode = 'title' | 'playing' | 'paused' | 'gameover';
export type GameOutcome = 'victory' | 'defeat' | null;
export type EnemyArchetype = 'swarmer' | 'lancer' | 'rammer' | 'weaver' | 'boss';
export type EnemyPhase = 'move' | 'windup' | 'active' | 'recover';
export type CameraPreset = 'tactical' | 'cinematic' | 'overhead';

export interface PlayerState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  aimAngle: number;
  bankAngle: number;
  hull: number;
  maxHull: number;
  invuln: number;
  fireCooldown: number;
  parryTimer: number;
  parryCooldown: number;
  novaCharge: number;
  hitFlash: number;
  squash: number;
  autoFire: boolean;
}

export interface EnemyEntity {
  id: number;
  type: EnemyArchetype;
  x: number;
  z: number;
  vx: number;
  vz: number;
  angle: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  score: number;
  color: string;
  phase: EnemyPhase;
  phaseTimer: number;
  strafeDir: number;
  seedOffset: number;
  hitFlash: number;
  hasToken: boolean;
  bossPhase: number;
  spiralAngle: number;
  dirX: number;
  dirZ: number;
}

export interface ProjectileEntity {
  id: number;
  owner: 'player' | 'enemy';
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  damage: number;
  color: string;
  reflected: boolean;
  life: number;
}

export interface ShardEntity {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
}

export interface DyingEnemy {
  type: EnemyArchetype;
  x: number;
  z: number;
  angle: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface SimInput {
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  firing: boolean;
  parryTriggered: boolean;
  novaTriggered: boolean;
}

export interface HudSnapshot {
  mode: GameMode;
  outcome: GameOutcome;
  hull: number;
  maxHull: number;
  novaPct: number;
  score: number;
  bestScore: number;
  combo: number;
  waveNumber: number;
  totalWaves: number;
  waveTitle: string;
  waveBannerVisible: boolean;
  parriesLanded: number;
  enemiesDefeated: number;
  bossHpPct: number | null;
}
