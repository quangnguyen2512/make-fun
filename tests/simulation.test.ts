import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOVA_MAX_CHARGE,
  PARRY_RADIUS,
  PLAYER_MAX_HULL,
  clampDt,
  createPrng,
  createSimulation,
} from '../lib/game/rules';

const idleInput = {
  moveX: 0,
  moveZ: 0,
  aimX: 0,
  aimZ: -8,
  firing: false,
  parryTriggered: false,
  novaTriggered: false,
};

test('clampDt caps large frame stalls to MAX_DT', () => {
  assert.equal(clampDt(1.5), 0.05);
  assert.equal(clampDt(-0.2), 0);
  assert.equal(clampDt(0.016), 0.016);
});

test('survives opening seconds with no player input', () => {
  const sim = createSimulation(createPrng(7));
  sim.resetRun();
  for (let i = 0; i < 180; i++) {
    sim.step(1 / 60, idleInput);
  }
  assert.equal(sim.state.mode, 'playing');
  assert.equal(sim.state.player.hull, PLAYER_MAX_HULL);
});

test('Aegis Parry reflects nearby enemy projectiles and increments parriesLanded', () => {
  const sim = createSimulation(createPrng(11));
  sim.resetRun();
  sim.state.player.autoFire = false;
  sim.state.player.invuln = 0;
  sim.state.player.x = 0;
  sim.state.player.z = 9;
  sim.spawnProjectile('enemy', PARRY_RADIUS * 0.5, 9, -8, 0, 0.38, 1, '#ff5a4f');

  sim.step(1 / 60, { ...idleInput, parryTriggered: true });

  assert.equal(sim.state.parriesLanded, 1);
  assert.equal(sim.state.projectiles.length, 1);
  assert.equal(sim.state.projectiles[0].owner, 'player');
  assert.equal(sim.state.projectiles[0].reflected, true);
  assert.ok(sim.state.score > 0);
});

test('Solar Nova clears enemy projectiles and damages enemies when fully charged', () => {
  const sim = createSimulation(createPrng(19));
  sim.resetRun();
  sim.state.player.autoFire = false;
  sim.state.enemies.length = 0;
  sim.spawnEnemy('swarmer', sim.state.player.x + 5, sim.state.player.z);
  sim.spawnProjectile('enemy', sim.state.player.x + 4, sim.state.player.z, -6, 0, 0.38, 1, '#ff5a4f');
  sim.state.player.novaCharge = NOVA_MAX_CHARGE;

  sim.step(1 / 60, { ...idleInput, novaTriggered: true });

  assert.equal(sim.state.player.novaCharge, 0);
  assert.equal(sim.state.projectiles.length, 0);
  assert.equal(sim.state.enemies.length, 0);
  assert.equal(sim.state.enemiesDefeated, 1);
});

test('Defeating Wave 5 boss transitions to victory gameover state', () => {
  const sim = createSimulation(createPrng(23));
  sim.resetRun();
  sim.beginWave(4); // Wave 5 boss
  const boss = sim.state.enemies.find((e) => e.type === 'boss');
  assert.ok(boss, 'Boss should spawn on Wave 5');
  sim.state.enemies = [boss];
  boss.hp = 10;
  sim.spawnProjectile('player', boss.x, boss.z, 0, 0, 0.3, 40, '#fde3a7');

  for (let i = 0; i < 40; i++) {
    sim.step(1 / 60, idleInput);
  }
  assert.equal(sim.state.mode, 'gameover');
  assert.equal(sim.state.outcome, 'victory');
});

test('Losing all hull pips triggers defeat gameover state after brief delay', () => {
  const sim = createSimulation(createPrng(31));
  sim.resetRun();
  sim.state.player.invuln = 0;
  sim.state.player.hull = 1;
  sim.damagePlayer(1);
  assert.equal(sim.state.player.hull, 0);
  for (let i = 0; i < 40; i++) {
    sim.step(1 / 60, idleInput);
  }
  assert.equal(sim.state.mode, 'gameover');
  assert.equal(sim.state.outcome, 'defeat');
});
