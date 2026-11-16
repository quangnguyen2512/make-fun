export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;
export const MAX_DT = 0.05;

export const BEST_SCORE_KEY = 'solar_warden_best_v1';

export const PLAYER_MAX_HULL = 4;
export const PLAYER_RADIUS = 16;
export const PLAYER_ACCEL = 1650;
export const PLAYER_DRAG = 5.2;
export const PLAYER_MAX_SPEED = 360;
export const PLAYER_FIRE_INTERVAL = 0.14;
export const PLAYER_INVULN_TIME = 1.15;

export const PARRY_COOLDOWN = 0.95;
export const PARRY_ACTIVE_TIME = 0.34;
export const PARRY_RADIUS = 72;
export const PARRY_REFLECT_SPEED_MULT = 2.15;
export const PARRY_REFLECT_DAMAGE = 60;

export const NOVA_MAX_CHARGE = 100;
export const NOVA_RADIUS = 320;
export const NOVA_DAMAGE = 95;

export const PALETTE = {
  spaceTop: '#070b18',
  spaceBottom: '#131d3d',
  brass: '#f2ae42',
  brassBright: '#fde3a7',
  ivory: '#f6f1e6',
  aether: '#38d9a9',
  coral: '#ff5a4f',
  cobalt: '#5cb2ff',
  violet: '#c388ff',
  ink: '#050812',
};

export const ENEMY_SPECS = {
  swarmer: {
    hp: 26,
    radius: 13,
    speed: 175,
    score: 110,
    color: '#f5b041',
  },
  lancer: {
    hp: 42,
    radius: 15,
    speed: 115,
    score: 180,
    color: '#5cb2ff',
  },
  rammer: {
    hp: 76,
    radius: 19,
    speed: 92,
    score: 240,
    color: '#ff5a4f',
  },
  weaver: {
    hp: 64,
    radius: 17,
    speed: 105,
    score: 260,
    color: '#c388ff',
  },
  boss: {
    hp: 960,
    radius: 44,
    speed: 68,
    score: 1500,
    color: '#ff5a4f',
  },
};

export const WAVE_SCRIPTS = [
  { wave: 1, title: 'SECTOR I · SOLAR DRIFT', total: 10, spawnGap: 1.05, maxConcurrent: 4, mix: { swarmer: 0.7, lancer: 0.3 } },
  { wave: 2, title: 'SECTOR II · LANCER ARC', total: 15, spawnGap: 0.9, maxConcurrent: 6, mix: { swarmer: 0.45, lancer: 0.35, rammer: 0.2 } },
  { wave: 3, title: 'SECTOR III · IRON VANGUARD', total: 20, spawnGap: 0.78, maxConcurrent: 7, mix: { swarmer: 0.32, lancer: 0.28, rammer: 0.24, weaver: 0.16 } },
  { wave: 4, title: 'SECTOR IV · ASTRAL TEMPEST', total: 24, spawnGap: 0.68, maxConcurrent: 9, mix: { swarmer: 0.26, lancer: 0.28, rammer: 0.24, weaver: 0.22 } },
  { wave: 5, title: 'SECTOR V · ECLIPSE LEVIATHAN', total: 1, spawnGap: 1.5, maxConcurrent: 5, boss: true },
];
