import { ARENA_HEIGHT, ARENA_WIDTH } from './config.js';

export function createInputHub(canvas, getTransform) {
  const held = new Set();
  const justPressed = new Set();
  const buffers = new Map();

  let pointerClientX = 0;
  let pointerClientY = 0;
  let pointerActive = false;
  let mouseDown = false;
  let rightClickJustPressed = false;

  function normalizeKey(code, key) {
    if (code === 'Space' || key === ' ') return 'Space';
    return code || key;
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = getTransform(rect.width, rect.height);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return {
      x: Math.max(0, Math.min(ARENA_WIDTH, (localX - offsetX) / scale)),
      y: Math.max(0, Math.min(ARENA_HEIGHT, (localY - offsetY) / scale)),
    };
  }

  function clearHeld() {
    held.clear();
    mouseDown = false;
  }

  function onKeyDown(e) {
    const k = normalizeKey(e.code, e.key);
    if (k === 'Space' || k.startsWith('Arrow')) {
      e.preventDefault();
    }
    if (!held.has(k)) {
      justPressed.add(k);
      if (k === 'Space') buffers.set('parry', 0.13);
      if (k === 'KeyQ' || k === 'ShiftLeft' || k === 'ShiftRight') buffers.set('nova', 0.13);
    }
    held.add(k);
  }

  function onKeyUp(e) {
    held.delete(normalizeKey(e.code, e.key));
  }

  function onPointerMove(e) {
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    pointerActive = true;
  }

  function onPointerDown(e) {
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    pointerActive = true;
    if (e.button === 2) {
      rightClickJustPressed = true;
      buffers.set('parry', 0.13);
    } else if (e.button === 0) {
      mouseDown = true;
    }
  }

  function onPointerUp(e) {
    if (e.button === 0) mouseDown = false;
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearHeld();
  });

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    clearHeld,
    tickBuffers(dt) {
      for (const [name, rem] of buffers.entries()) {
        if (rem - dt <= 0) buffers.delete(name);
        else buffers.set(name, rem - dt);
      }
    },
    consumeJustPressed(code) {
      if (justPressed.has(code)) {
        justPressed.delete(code);
        return true;
      }
      return false;
    },
    consumeBuffer(name) {
      if ((buffers.get(name) ?? 0) > 0) {
        buffers.delete(name);
        return true;
      }
      return false;
    },
    endFrame() {
      justPressed.clear();
      rightClickJustPressed = false;
    },
    sampleGameplayInput(playerX, playerY) {
      let mx = 0;
      let my = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) mx -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) mx += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) my -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) my += 1;
      const aim = pointerActive
        ? screenToWorld(pointerClientX, pointerClientY)
        : { x: playerX + 180, y: playerY };
      return {
        moveX: mx,
        moveY: my,
        aimX: aim.x,
        aimY: aim.y,
        firing: mouseDown || held.has('KeyJ'),
        parryTriggered: this.consumeBuffer('parry') || rightClickJustPressed,
        novaTriggered: this.consumeBuffer('nova'),
      };
    },
  };
}
