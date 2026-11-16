const POOL_SIZE = 512;
const CALLOUT_SIZE = 32;

export function createParticleSystem() {
  const particles = Array.from({ length: POOL_SIZE }, () => ({
    active: false,
    kind: 0, // 0 = spark, 1 = ring, 2 = ember
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 2,
    color: '#fde3a7',
  }));
  let cursor = 0;

  const callouts = Array.from({ length: CALLOUT_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vy: -36,
    life: 0,
    maxLife: 0.75,
    text: '',
    color: '#fde3a7',
  }));
  let calloutCursor = 0;

  function spawnParticle(x, y, vx, vy, maxLife, size, color, kind = 0) {
    const p = particles[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.size = size;
    p.color = color;
  }

  function spawnBurst(prng, x, y, count, speedMin, speedMax, color, sizeMin = 2, sizeMax = 5) {
    for (let i = 0; i < count; i++) {
      const ang = prng.range(0, Math.PI * 2);
      const spd = prng.range(speedMin, speedMax);
      spawnParticle(
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        prng.range(0.24, 0.58),
        prng.range(sizeMin, sizeMax),
        color,
        0,
      );
    }
  }

  function spawnRing(x, y, maxRadius, color, duration = 0.34) {
    spawnParticle(x, y, 0, 0, duration, maxRadius, color, 1);
  }

  function spawnCallout(x, y, text, color = '#fde3a7') {
    const c = callouts[calloutCursor];
    calloutCursor = (calloutCursor + 1) % CALLOUT_SIZE;
    c.active = true;
    c.x = x;
    c.y = y;
    c.vy = -42;
    c.life = 0.8;
    c.maxLife = 0.8;
    c.text = text;
    c.color = color;
  }

  function update(dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.kind !== 1) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.max(0, 1 - 3.2 * dt);
        p.vy *= Math.max(0, 1 - 3.2 * dt);
      }
    }
    for (let i = 0; i < CALLOUT_SIZE; i++) {
      const c = callouts[i];
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        continue;
      }
      c.y += c.vy * dt;
    }
  }

  function reset() {
    for (let i = 0; i < POOL_SIZE; i++) particles[i].active = false;
    for (let i = 0; i < CALLOUT_SIZE; i++) callouts[i].active = false;
  }

  return {
    particles,
    callouts,
    spawnParticle,
    spawnBurst,
    spawnRing,
    spawnCallout,
    update,
    reset,
  };
}
