import { ARENA_HEIGHT, ARENA_WIDTH, PALETTE, PARRY_RADIUS } from './config.js';

export function computeViewportTransform(viewW, viewH) {
  const scale = Math.min(viewW / ARENA_WIDTH, viewH / ARENA_HEIGHT);
  const offsetX = (viewW - ARENA_WIDTH * scale) * 0.5;
  const offsetY = (viewH - ARENA_HEIGHT * scale) * 0.5;
  return { scale, offsetX, offsetY };
}

export function createRenderer(canvas, prng) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let cssW = ARENA_WIDTH;
  let cssH = ARENA_HEIGHT;

  const stars = Array.from({ length: 110 }, () => ({
    x: prng.range(0, ARENA_WIDTH),
    y: prng.range(0, ARENA_HEIGHT),
    r: prng.range(0.8, 2.2),
    layer: prng.range(0.3, 1.0),
    alpha: prng.range(0.25, 0.85),
    tint: prng.next() < 0.25 ? '#fde3a7' : prng.next() < 0.5 ? '#9ec5ff' : '#f6f1e6',
  }));

  function resize(width, height) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(1, width);
    cssH = Math.max(1, height);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function drawAstrolabeBackdrop(time, playerX, playerY) {
    const grad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
    grad.addColorStop(0, PALETTE.spaceTop);
    grad.addColorStop(1, PALETTE.spaceBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Subtle cosmic nebula glows
    const neb1 = ctx.createRadialGradient(ARENA_WIDTH * 0.68, ARENA_HEIGHT * 0.42, 30, ARENA_WIDTH * 0.68, ARENA_HEIGHT * 0.42, 420);
    neb1.addColorStop(0, 'rgba(242, 174, 66, 0.11)');
    neb1.addColorStop(0.5, 'rgba(92, 178, 255, 0.06)');
    neb1.addColorStop(1, 'rgba(7, 11, 24, 0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    const neb2 = ctx.createRadialGradient(ARENA_WIDTH * 0.25, ARENA_HEIGHT * 0.72, 20, ARENA_WIDTH * 0.25, ARENA_HEIGHT * 0.72, 360);
    neb2.addColorStop(0, 'rgba(56, 217, 169, 0.08)');
    neb2.addColorStop(1, 'rgba(7, 11, 24, 0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Parallax starfield
    const px = (playerX - ARENA_WIDTH * 0.5) * 0.035;
    const py = (playerY - ARENA_HEIGHT * 0.5) * 0.035;
    for (const s of stars) {
      const sx = ((s.x - px * s.layer) % ARENA_WIDTH + ARENA_WIDTH) % ARENA_WIDTH;
      const sy = ((s.y - py * s.layer) % ARENA_HEIGHT + ARENA_HEIGHT) % ARENA_HEIGHT;
      ctx.globalAlpha = s.alpha * (0.75 + 0.25 * Math.sin(time * 2.2 + s.x));
      ctx.fillStyle = s.tint;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Central Celestial Astrolabe Rings
    const cx = ARENA_WIDTH * 0.5;
    const cy = ARENA_HEIGHT * 0.5;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = 'rgba(242, 174, 66, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.rotate(time * 0.08);
    ctx.strokeStyle = 'rgba(242, 174, 66, 0.18)';
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 245, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = i % 3 === 0 ? 236 : 241;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * 250, Math.sin(a) * 250);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.rotate(-time * 0.05);
    ctx.strokeStyle = 'rgba(92, 178, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, 335, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Central Sun-Core Rune
    ctx.rotate(time * 0.25);
    ctx.fillStyle = 'rgba(242, 174, 66, 0.09)';
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(253, 227, 167, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = k % 2 === 0 ? 28 : 13;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawTitleShowcase(time) {
    drawAstrolabeBackdrop(time, ARENA_WIDTH * 0.65, ARENA_HEIGHT * 0.5);
    const heroX = ARENA_WIDTH * 0.67;
    const heroY = ARENA_HEIGHT * 0.5 + Math.sin(time * 1.4) * 14;

    // Orbiting celestial satellites around centerpiece
    for (let i = 0; i < 3; i++) {
      const a = time * 0.75 + (i * Math.PI * 2) / 3;
      const ox = heroX + Math.cos(a) * 138;
      const oy = heroY + Math.sin(a) * 92;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a + Math.PI * 0.5);
      ctx.fillStyle = i === 0 ? PALETTE.aether : i === 1 ? PALETTE.cobalt : PALETTE.coral;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-9, -8);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Centerpiece Warden Hero Craft (enlarged 2.2x)
    ctx.save();
    ctx.translate(heroX, heroY);
    ctx.scale(2.2, 2.2);
    ctx.rotate(-0.22 + Math.sin(time * 0.9) * 0.06);
    drawWardenHull(false, 0, time);
    ctx.restore();
  }

  function drawWardenHull(flash, parryTimer, time) {
    // Thruster glow
    ctx.fillStyle = 'rgba(56, 217, 169, 0.85)';
    const flame = 12 + Math.sin(time * 38) * 3.5;
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-12 - flame, 0);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();

    // Swept golden astrolabe wings
    ctx.fillStyle = flash ? '#ffffff' : PALETTE.brass;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(2, -16);
    ctx.lineTo(-14, -19);
    ctx.lineTo(-9, -6);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-14, 19);
    ctx.lineTo(2, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ivory fuselage & Aether cockpit core
    ctx.fillStyle = flash ? '#ffffff' : PALETTE.ivory;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-11, 0);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = PALETTE.aether;
    ctx.beginPath();
    ctx.arc(4, 0, 4.2, 0, Math.PI * 2);
    ctx.fill();

    if (parryTimer > 0) {
      const alpha = Math.min(1, parryTimer * 4);
      ctx.strokeStyle = `rgba(253, 227, 167, ${alpha})`;
      ctx.fillStyle = `rgba(56, 217, 169, ${alpha * 0.14})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, PARRY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawEnemy(e, time) {
    // Telegraph cues BEFORE drawing body so lines sit cleanly underneath
    if (e.type === 'lancer' && e.phase === 'windup') {
      ctx.save();
      const pulse = 0.45 + 0.55 * Math.sin(time * 32);
      ctx.strokeStyle = `rgba(255, 90, 79, ${0.4 + 0.5 * pulse})`;
      ctx.lineWidth = e.phaseTimer < 0.2 ? 3 : 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + e.chargeDirX * 560, e.y + e.chargeDirY * 560);
      ctx.stroke();
      ctx.restore();
    } else if (e.type === 'rammer' && e.phase === 'windup') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 90, 79, 0.55)';
      ctx.fillStyle = 'rgba(255, 90, 79, 0.12)';
      ctx.lineWidth = 2;
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(e.chargeDirY, e.chargeDirX));
      ctx.fillRect(0, -16, 240, 32);
      ctx.strokeRect(0, -16, 240, 32);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    const flash = e.hitFlash > 0;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.6;

    if (e.type === 'swarmer') {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-9, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 'lancer') {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-4, -12);
      ctx.lineTo(-14, -5);
      ctx.lineTo(-14, 5);
      ctx.lineTo(-4, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = e.phase === 'windup' ? '#ff5a4f' : '#fde3a7';
      ctx.beginPath();
      ctx.arc(4, 0, 3.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'rammer') {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.moveTo(21, -8);
      ctx.lineTo(24, 0);
      ctx.lineTo(21, 8);
      ctx.lineTo(-12, 16);
      ctx.lineTo(-19, 0);
      ctx.lineTo(-12, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Front brass ram crest
      ctx.fillStyle = PALETTE.brassBright;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(10, -9);
      ctx.lineTo(10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 'weaver') {
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const r = k % 2 === 0 ? 18 : 11;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.ivory;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'boss') {
      // Eclipse Leviathan Dreadnought
      ctx.fillStyle = flash ? '#ffffff' : '#2a183b';
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const r = k % 2 === 0 ? 46 : 33;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = e.bossPhase === 2 ? PALETTE.coral : PALETTE.brass;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = e.phase === 'windup' ? '#fde3a7' : PALETTE.coral;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render(sim, particleSys) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, cssW, cssH);

    const { scale, offsetX, offsetY } = computeViewportTransform(cssW, cssH);
    const shakeMag = sim.state.trauma * sim.state.trauma * 13;
    const shakeX = shakeMag > 0.2 ? Math.sin(sim.state.time * 67) * shakeMag : 0;
    const shakeY = shakeMag > 0.2 ? Math.cos(sim.state.time * 79) * shakeMag : 0;

    ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.clip();

    if (sim.state.mode === 'title') {
      drawTitleShowcase(performance.now() * 0.001);
      ctx.restore();
      return;
    }

    const s = sim.state;
    const p = s.player;
    drawAstrolabeBackdrop(s.time, p.x, p.y);

    // Arena brass perimeter border
    ctx.strokeStyle = 'rgba(242, 174, 66, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, ARENA_WIDTH - 20, ARENA_HEIGHT - 20);

    // Aether Shards
    for (const sh of s.shards) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(s.time * 3.5 + sh.x);
      ctx.fillStyle = PALETTE.aether;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Dying enemies KO dissolve
    for (const d of s.dyingEnemies) {
      const t = Math.max(0, d.life / d.maxLife);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle + (1 - t) * 1.4);
      ctx.scale(t, t);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Active enemies
    for (const e of s.enemies) {
      drawEnemy(e, s.time);
    }

    // Projectiles
    for (const pr of s.projectiles) {
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.fillStyle = pr.color;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      if (pr.owner === 'player') {
        const ang = Math.atan2(pr.vy, pr.vx);
        ctx.rotate(ang);
        ctx.ellipse(0, 0, pr.reflected ? 11 : 8, pr.reflected ? 5 : 3.5, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, 0, pr.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Player ship
    const blinkHide = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 1 && p.parryTimer <= 0;
    if (!blinkHide) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aimAngle);
      ctx.scale(p.squashX, p.squashY);
      drawWardenHull(p.hitFlash > 0, p.parryTimer, s.time);
      ctx.restore();
    }

    // Pooled particles
    for (const pt of particleSys.particles) {
      if (!pt.active) continue;
      const frac = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = frac;
      if (pt.kind === 1) {
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 3 * frac + 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1 - frac * 0.72), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * frac, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Floating callouts
    ctx.font = '700 14px Georgia, serif';
    ctx.textAlign = 'center';
    for (const c of particleSys.callouts) {
      if (!c.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (c.life / c.maxLife) * 1.4);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 4;
      ctx.strokeText(c.text, c.x, c.y);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    // Low-hull subtle crimson peripheral vignette
    if (p.hull === 1) {
      const vig = ctx.createRadialGradient(
        ARENA_WIDTH * 0.5,
        ARENA_HEIGHT * 0.5,
        ARENA_HEIGHT * 0.35,
        ARENA_WIDTH * 0.5,
        ARENA_HEIGHT * 0.5,
        ARENA_WIDTH * 0.65,
      );
      vig.addColorStop(0, 'rgba(255, 90, 79, 0)');
      vig.addColorStop(1, 'rgba(255, 90, 79, 0.22)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }

    ctx.restore();
  }

  return {
    resize,
    render,
    getTransform: computeViewportTransform,
  };
}
