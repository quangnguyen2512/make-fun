import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  NOVA_MAX_CHARGE,
  NOVA_RADIUS,
  PARRY_RADIUS,
  WAVE_SCRIPTS,
  clampDt,
  createPrng,
  createSimulation,
} from '../game/rules';
import type { CameraPreset, EnemyEntity, GameMode, HudSnapshot } from '../game/types';
import { SolarAudioSynth } from './audio';
import { type EnemyRig, SharedAssetFactory } from './models';

export interface EngineOptions {
  autostart?: boolean;
  shot?: string | null;
  seed?: number;
}

export interface EngineController {
  startRun: () => void;
  togglePause: () => void;
  returnTitle: () => void;
  continueEndless: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setAutoFire: (auto: boolean) => void;
  setMuted: (muted: boolean) => void;
  triggerParry: () => void;
  triggerNova: () => void;
  dispose: () => void;
}

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

interface ShockRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  maxScale: number;
}

// Module-scope scratch math objects for zero-GC per-frame loop
const _vec3 = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camCurrPos = new THREE.Vector3(0, 22, 24);
const _camCurrLook = new THREE.Vector3(0, 1.2, 2);
const _raycaster = new THREE.Raycaster();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _pointerNdc = new THREE.Vector2();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param) || '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|WARP/i.test(gpu);
}

const BEST_SCORE_KEY = 'solar_warden_3d_best_v1';

export function initSolarWardenEngine(
  mountEl: HTMLDivElement,
  options: EngineOptions,
  onHudUpdate: (snapshot: HudSnapshot) => void,
): EngineController {
  const isSoftwareGl = detectSoftwareWebGL();
  const seed = Number.isFinite(options.seed) ? Number(options.seed) : 42;
  const prng = createPrng(seed);
  const audio = new SolarAudioSynth();

  // Renderer Setup
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: isSoftwareGl,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.tabIndex = 0;

  mountEl.innerHTML = '';
  mountEl.appendChild(renderer.domElement);

  const width = Math.max(320, mountEl.clientWidth || window.innerWidth);
  const height = Math.max(240, mountEl.clientHeight || window.innerHeight);
  renderer.setSize(width, height, false);

  // Scene & Fog-Horizon Continuity
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b18);
  scene.fog = new THREE.FogExp2(0x070b18, 0.011);

  const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 220);
  camera.position.copy(_camCurrPos);
  camera.lookAt(_camCurrLook);

  // Studio Environment Reflection (mandatory for metallic/clearcoat contrast)
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  // Warm / Cool 3-Point Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0x6395f2, 0x12182d, 0.9);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe1b5, 2.3);
  keyLight.position.set(22, 34, 18);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -30;
  keyLight.shadow.camera.right = 30;
  keyLight.shadow.camera.top = 30;
  keyLight.shadow.camera.bottom = -30;
  keyLight.shadow.camera.near = 6;
  keyLight.shadow.camera.far = 90;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38d9a9, 0.95);
  rimLight.position.set(-24, 16, -22);
  scene.add(rimLight);

  // Assets & Composite Models
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const factory = new SharedAssetFactory(maxAniso);
  const sanctuary = factory.buildSanctuaryArena(scene);
  const warden = factory.buildWarden();
  scene.add(warden.group);

  // Pooled Projectiles InstancedMesh
  const MAX_PROJ = 200;
  const projGeo = new THREE.OctahedronGeometry(1, 0);
  const projMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.35,
    roughness: 0.2,
    metalness: 0.1,
  });
  const projInstanced = new THREE.InstancedMesh(projGeo, projMat, MAX_PROJ);
  projInstanced.count = 0;
  projInstanced.frustumCulled = false;
  scene.add(projInstanced);

  // Pooled Aether Shards InstancedMesh
  const MAX_SHARDS = 64;
  const shardGeo = new THREE.OctahedronGeometry(0.36, 0);
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0x38d9a9,
    emissive: 0x22c55e,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0.4,
  });
  const shardInstanced = new THREE.InstancedMesh(shardGeo, shardMat, MAX_SHARDS);
  shardInstanced.count = 0;
  shardInstanced.frustumCulled = false;
  scene.add(shardInstanced);

  // Pooled Spark Particles InstancedMesh (Ring Buffer, Zero GC)
  const MAX_SPARKS = 180;
  const sparks: SparkParticle[] = Array.from({ length: MAX_SPARKS }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    maxLife: 0.4,
    size: 0.2,
    colorHex: 0xfde3a7,
  }));
  let sparkCursor = 0;
  const sparkGeo = new THREE.BoxGeometry(1, 1, 1);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
  sparkInstanced.count = 0;
  sparkInstanced.frustumCulled = false;
  scene.add(sparkInstanced);

  // Pooled Shockwave Rings
  const ringGeo = new THREE.RingGeometry(0.84, 1.0, 36);
  ringGeo.rotateX(-Math.PI / 2);
  const shockRings: ShockRing[] = Array.from({ length: 6 }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfde3a7,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.visible = false;
    mesh.position.y = 0.22;
    scene.add(mesh);
    return { mesh, mat, active: false, life: 0, maxLife: 0.4, maxScale: 4 };
  });

  function spawnSparkBurst(x: number, y: number, z: number, count: number, colorHex: number, speed = 8) {
    for (let i = 0; i < count; i++) {
      const sp = sparks[sparkCursor];
      sparkCursor = (sparkCursor + 1) % MAX_SPARKS;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      sp.active = true;
      sp.x = x;
      sp.y = y;
      sp.z = z;
      sp.vx = Math.cos(ang) * spd;
      sp.vy = 2.2 + Math.random() * 4.5;
      sp.vz = Math.sin(ang) * spd;
      sp.maxLife = 0.24 + Math.random() * 0.26;
      sp.life = sp.maxLife;
      sp.size = 0.14 + Math.random() * 0.18;
      sp.colorHex = colorHex;
    }
  }

  function spawnShockRing(x: number, z: number, maxScale: number, maxLife: number, colorHex: number) {
    const slot = shockRings.find((r) => !r.active) || shockRings[0];
    slot.active = true;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.maxScale = maxScale;
    slot.mat.color.setHex(colorHex);
    slot.mesh.position.set(x, 0.22, z);
    slot.mesh.scale.setScalar(0.4);
    slot.mesh.visible = true;
  }

  // Active Enemy Rigs Map + Dying Ghost Rigs
  const enemyRigs = new Map<number, EnemyRig>();
  const dyingRigs: Array<{ rig: EnemyRig; life: number; maxLife: number }> = [];

  // Best score persistence
  let bestScore = 0;
  try {
    bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY) || 0) || 0;
  } catch {
    bestScore = 0;
  }

  function saveBestScore(score: number) {
    if (score > bestScore) {
      bestScore = score;
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      } catch {
        // Ignore storage error
      }
    }
  }

  // Simulation Hookup
  const sim = createSimulation(prng, {
    onShot(x, z, pitch) {
      audio.shot(pitch);
      spawnSparkBurst(x, 0.72, z, 3, 0xfde3a7, 4.5);
    },
    onParrySwing(x, z) {
      audio.parrySwing();
      spawnShockRing(x, z, PARRY_RADIUS, 0.34, 0x38d9a9);
    },
    onParryReflect(x, z) {
      audio.parryReflect();
      spawnShockRing(x, z, PARRY_RADIUS * 1.25, 0.36, 0xfde3a7);
      spawnSparkBurst(x, 0.85, z, 14, 0x38d9a9, 10);
    },
    onNova(x, z) {
      audio.nova();
      spawnShockRing(x, z, NOVA_RADIUS, 0.5, 0xfde3a7);
      spawnSparkBurst(x, 1.0, z, 28, 0xf5b041, 14);
    },
    onEnemyHit(x, z, colorStr) {
      audio.enemyHit();
      _color.set(colorStr);
      spawnSparkBurst(x, 0.85, z, 4, _color.getHex(), 6);
    },
    onEnemyKilled(e: EnemyEntity, _pts: number, heavy: boolean) {
      audio.enemyKill(heavy || e.type === 'boss');
      _color.set(e.color);
      spawnSparkBurst(e.x, 0.9, e.z, e.type === 'boss' ? 36 : 16, _color.getHex(), e.type === 'boss' ? 15 : 9);
      spawnShockRing(e.x, e.z, e.radius * 2.6, 0.32, _color.getHex());

      const rig = enemyRigs.get(e.id);
      if (rig) {
        enemyRigs.delete(e.id);
        rig.windupRing.visible = false;
        if (rig.telegraphBeam) rig.telegraphBeam.visible = false;
        dyingRigs.push({ rig, life: 0.36, maxLife: 0.36 });
      }
    },
    onShard(x, z, combo) {
      audio.shard(combo);
      spawnSparkBurst(x, 0.6, z, 5, 0x38d9a9, 5);
    },
    onTelegraph() {
      audio.telegraph();
    },
    onPlayerHurt(x, z) {
      audio.playerHurt();
      spawnSparkBurst(x, 0.85, z, 18, 0xff5a4f, 10);
      spawnShockRing(x, z, 3.8, 0.35, 0xff5a4f);
    },
    onWaveStart(_w, _t, boss) {
      audio.waveStart(boss);
    },
    onBossPhase(x, z) {
      audio.nova();
      spawnShockRing(x, z, 9.5, 0.5, 0xff5a4f);
      spawnSparkBurst(x, 1.8, z, 24, 0xff5a4f, 13);
    },
    onGameOver(outcome, score) {
      saveBestScore(score);
      if (outcome === 'victory') audio.victory();
      else audio.defeat();
      pushHud(true);
    },
  });

  // Camera & Input State
  let cameraPreset: CameraPreset = 'tactical';
  let paused = false;
  let lastHudEmit = 0;
  let lastEmittedMode: GameMode | null = null;
  let lastEmittedWave = -1;
  let lastEmittedHull = -1;
  let lastEmittedScore = -1;

  const keysPressed = new Set<string>();
  let mouseDown = false;
  let parryQueued = false;
  let novaQueued = false;
  let aimWorldX = 0;
  let aimWorldZ = -4;
  let pointerClientX = width * 0.5;
  let pointerClientY = height * 0.35;
  let hasPointerMoved = false;

  function syncBodyState(mode: GameMode) {
    if (document.body.dataset.state !== mode) {
      document.body.dataset.state = mode;
    }
  }

  function pushHud(force = false) {
    const mode: GameMode = paused && sim.state.mode === 'playing' ? 'paused' : sim.state.mode;
    syncBodyState(mode);
    const now = performance.now();
    const boss = sim.state.enemies.find((e) => e.type === 'boss');
    if (
      !force &&
      mode === lastEmittedMode &&
      sim.state.waveNumber === lastEmittedWave &&
      sim.state.player.hull === lastEmittedHull &&
      Math.round(sim.state.score) === lastEmittedScore &&
      now - lastHudEmit < 90
    ) {
      return;
    }
    lastHudEmit = now;
    lastEmittedMode = mode;
    lastEmittedWave = sim.state.waveNumber;
    lastEmittedHull = sim.state.player.hull;
    lastEmittedScore = Math.round(sim.state.score);

    onHudUpdate({
      mode,
      outcome: sim.state.outcome,
      hull: sim.state.player.hull,
      maxHull: sim.state.player.maxHull,
      novaPct: Math.round((sim.state.player.novaCharge / NOVA_MAX_CHARGE) * 100),
      score: Math.round(sim.state.score),
      bestScore: Math.max(bestScore, Math.round(sim.state.score)),
      combo: sim.state.combo,
      waveNumber: sim.state.waveNumber,
      totalWaves: WAVE_SCRIPTS.length,
      waveTitle: sim.state.waveTitle,
      waveBannerVisible: sim.state.waveBannerTimer > 0 && mode === 'playing',
      parriesLanded: sim.state.parriesLanded,
      enemiesDefeated: sim.state.enemiesDefeated,
      bossHpPct: boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 100)) : null,
    });
  }

  function clearAllEnemyRigs() {
    for (const rig of enemyRigs.values()) {
      scene.remove(rig.group);
    }
    enemyRigs.clear();
    for (const d of dyingRigs) {
      scene.remove(d.rig.group);
    }
    dyingRigs.length = 0;
  }

  function screenToWorldAim(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointerNdc, camera);
    if (_raycaster.ray.intersectPlane(_groundPlane, _vec3)) {
      aimWorldX = _vec3.x;
      aimWorldZ = _vec3.z;
    }
  }

  // Controls Actions
  function startRun() {
    audio.unlock();
    paused = false;
    keysPressed.clear();
    mouseDown = false;
    parryQueued = false;
    novaQueued = false;
    clearAllEnemyRigs();
    sim.resetRun();
    if (document.activeElement instanceof HTMLElement && document.activeElement !== renderer.domElement) {
      document.activeElement.blur();
    }
    renderer.domElement.focus();
    pushHud(true);
  }

  function togglePause() {
    if (sim.state.mode !== 'playing') return;
    paused = !paused;
    keysPressed.clear();
    mouseDown = false;
    pushHud(true);
  }

  function returnTitle() {
    paused = false;
    keysPressed.clear();
    mouseDown = false;
    clearAllEnemyRigs();
    sim.state.mode = 'title';
    sim.state.outcome = null;
    sim.state.enemies.length = 0;
    sim.state.projectiles.length = 0;
    sim.state.shards.length = 0;
    sim.state.player.x = 0;
    sim.state.player.z = 9;
    sim.state.player.vx = 0;
    sim.state.player.vz = 0;
    sim.state.player.aimAngle = Math.PI;
    pushHud(true);
  }

  function continueEndless() {
    audio.unlock();
    paused = false;
    sim.state.mode = 'playing';
    sim.state.outcome = null;
    sim.state.endless = true;
    sim.beginWave(sim.state.waveIndex + 1);
    pushHud(true);
  }

  // Deterministic ?shot= Staging Support
  function stageDeterministicShot(shot: string) {
    clearAllEnemyRigs();
    paused = false;
    if (shot === 'start') {
      returnTitle();
      return;
    }
    sim.resetRun();
    if (shot === 'play') {
      sim.beginWave(2);
      sim.state.enemies.length = 0;
      sim.spawnEnemy('swarmer', -7, 2);
      sim.spawnEnemy('lancer', 9, -4);
      sim.spawnEnemy('rammer', -9, -6);
      sim.spawnEnemy('weaver', 6, 8);
      sim.state.enemies[1].phase = 'windup';
      sim.state.enemies[1].phaseTimer = 0.35;
      sim.state.enemies[1].dirX = -0.7;
      sim.state.enemies[1].dirZ = 0.7;
      sim.state.player.parryTimer = 0.25;
      sim.state.score = 1840;
      sim.state.combo = 3;
      sim.state.waveBannerTimer = 0;
      sim.step(0.016, { moveX: 0, moveZ: 0, aimX: 5, aimZ: -4, firing: true, parryTriggered: false, novaTriggered: false });
    } else if (shot === 'boss') {
      sim.beginWave(4);
      sim.state.score = 6420;
      sim.state.combo = 5;
      sim.state.waveBannerTimer = 0;
      sim.step(0.016, { moveX: 0, moveZ: 0, aimX: 0, aimZ: -12, firing: true, parryTriggered: false, novaTriggered: false });
    } else if (shot === 'end') {
      sim.state.score = 9450;
      sim.state.enemiesDefeated = 42;
      sim.state.parriesLanded = 7;
      sim.state.mode = 'gameover';
      sim.state.outcome = 'victory';
      saveBestScore(sim.state.score);
    }
    pushHud(true);
  }

  if (options.shot) {
    stageDeterministicShot(options.shot);
  } else if (options.autostart) {
    startRun();
  } else {
    pushHud(true);
  }

  // Event Listeners (Window keyboard + Canvas pointer + Blur cleanup)
  const onKeyDown = (e: KeyboardEvent) => {
    audio.unlock();
    const code = e.code;
    keysPressed.add(code);

    if (sim.state.mode === 'title' && (code === 'Enter' || code === 'Space')) {
      e.preventDefault();
      startRun();
      return;
    }

    if (code === 'KeyP' || code === 'Escape') {
      if (sim.state.mode === 'playing') {
        e.preventDefault();
        togglePause();
      }
      return;
    }

    if (code === 'KeyR' && (sim.state.mode === 'playing' || sim.state.mode === 'gameover')) {
      e.preventDefault();
      startRun();
      return;
    }

    if (sim.state.mode === 'playing' && !paused) {
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        if (!e.repeat) parryQueued = true;
      } else if (code === 'KeyQ' || code === 'KeyE') {
        e.preventDefault();
        if (!e.repeat) novaQueued = true;
      }
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keysPressed.delete(e.code);
  };

  const onWindowBlur = () => {
    keysPressed.clear();
    mouseDown = false;
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      keysPressed.clear();
      mouseDown = false;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    hasPointerMoved = true;
    screenToWorldAim(e.clientX, e.clientY);
  };

  const onPointerDown = (e: PointerEvent) => {
    audio.unlock();
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    hasPointerMoved = true;
    screenToWorldAim(e.clientX, e.clientY);
    if (e.button === 2) {
      parryQueued = true;
    } else if (e.button === 0) {
      mouseDown = true;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) mouseDown = false;
  };

  const onContextMenu = (e: MouseEvent) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);

  // ResizeObserver for crisp dynamic sizing
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const w = Math.max(320, Math.round(entry.contentRect.width));
    const h = Math.max(240, Math.round(entry.contentRect.height));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (!disposed) {
      renderer.render(scene, camera);
    }
  });
  resizeObserver.observe(mountEl);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Main Animation & Render Sync Loop
  let disposed = false;
  let frameId = 0;
  let lastTime = performance.now();
  let idleOrbitTime = 0;

  function syncSceneVisuals(dt: number, isPlaying: boolean) {
    // Animate sanctuary Obelisk monument gently
    idleOrbitTime += dt;
    sanctuary.obeliskCrystal.rotation.y += dt * 0.45;
    sanctuary.obeliskCrystal.position.y = 3.1 + Math.sin(idleOrbitTime * 1.8) * 0.14;
    sanctuary.obeliskRingOuter.rotation.x = idleOrbitTime * 0.65;
    sanctuary.obeliskRingOuter.rotation.y = idleOrbitTime * 0.42;
    sanctuary.obeliskRingInner.rotation.z = -idleOrbitTime * 0.85;
    sanctuary.starsMesh.rotation.y += dt * 0.015;

    // Player Warden Rig Sync
    const p = sim.state.player;
    warden.group.position.set(p.x, 0, p.z);
    warden.bodyGroup.rotation.y = p.aimAngle;
    warden.bodyGroup.rotation.z = p.bankAngle;
    const invSquash = 1 / Math.sqrt(Math.max(0.7, p.squash));
    warden.bodyGroup.scale.set(invSquash, p.squash, p.squash);
    warden.bodyGroup.position.y = 0.72 + Math.sin(idleOrbitTime * 3.8) * 0.08;
    warden.dorsalRing.rotation.z += dt * 2.1;

    const thrusterPulse = 0.85 + Math.sin(idleOrbitTime * 28) * 0.18 + (Math.hypot(p.vx, p.vz) / 15) * 0.45;
    warden.thrusterLeft.scale.set(1, 1, thrusterPulse);
    warden.thrusterRight.scale.set(1, 1, thrusterPulse);

    if (p.hitFlash > 0) {
      warden.hullMaterial.emissive.setHex(0xff5a4f);
      warden.hullMaterial.emissiveIntensity = 1.6;
    } else if (p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0) {
      warden.hullMaterial.emissive.setHex(0x38d9a9);
      warden.hullMaterial.emissiveIntensity = 0.6;
    } else {
      warden.hullMaterial.emissive.setHex(0x000000);
      warden.hullMaterial.emissiveIntensity = 0;
    }

    warden.shieldDome.visible = p.parryTimer > 0;
    if (warden.shieldDome.visible) {
      const pulse = 0.92 + Math.sin(idleOrbitTime * 30) * 0.08;
      warden.shieldDome.scale.setScalar(pulse);
    }

    // Active Enemies Sync
    const activeIds = new Set<number>();
    for (const e of sim.state.enemies) {
      activeIds.add(e.id);
      let rig = enemyRigs.get(e.id);
      if (!rig) {
        rig = factory.buildEnemy(e.type);
        enemyRigs.set(e.id, rig);
        scene.add(rig.group);
      }

      rig.group.position.set(e.x, 0, e.z);
      rig.bodyGroup.rotation.y = e.angle;
      rig.group.scale.setScalar(1);

      if (rig.spinner) {
        rig.spinner.rotation.y += dt * (e.type === 'boss' ? 0.9 : 2.6);
      }
      if (rig.spinner2) {
        rig.spinner2.rotation.z -= dt * 1.25;
      }

      if (e.hitFlash > 0) {
        rig.hullMaterial.emissive.setHex(0xffffff);
        rig.hullMaterial.emissiveIntensity = 1.4;
      } else {
        rig.hullMaterial.emissive.setHex(0x000000);
        rig.hullMaterial.emissiveIntensity = 0;
      }

      const windingUp = e.phase === 'windup';
      rig.windupRing.visible = windingUp;
      if (windingUp) {
        const ringPulse = 1 + Math.sin(idleOrbitTime * 22) * 0.16;
        rig.windupRing.scale.setScalar(ringPulse * (e.type === 'boss' ? 3.2 : 1.45));
        rig.coreMaterial.emissiveIntensity = 3.2;
      } else {
        rig.coreMaterial.emissiveIntensity = e.type === 'boss' ? 2.4 : 1.9;
      }

      if (rig.telegraphBeam) {
        rig.telegraphBeam.visible = windingUp;
      }
    }

    // Cleanup orphaned rigs if reset happened
    for (const [id, rig] of enemyRigs.entries()) {
      if (!activeIds.has(id)) {
        scene.remove(rig.group);
        enemyRigs.delete(id);
      }
    }

    // Update KO Dying Enemies topple/dissolve animation
    for (let i = dyingRigs.length - 1; i >= 0; i--) {
      const d = dyingRigs[i];
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.rig.group);
        dyingRigs.splice(i, 1);
      } else {
        const ratio = d.life / d.maxLife;
        d.rig.group.scale.setScalar(ratio);
        d.rig.bodyGroup.rotation.z += dt * 8;
        d.rig.bodyGroup.rotation.x += dt * 5;
      }
    }

    // Instanced Projectiles Sync
    const projCount = Math.min(MAX_PROJ, sim.state.projectiles.length);
    projInstanced.count = projCount;
    for (let i = 0; i < projCount; i++) {
      const pr = sim.state.projectiles[i];
      _dummy.position.set(pr.x, 0.72, pr.z);
      const ang = Math.atan2(pr.vx, pr.vz);
      _dummy.rotation.set(0, ang, 0);
      _dummy.scale.set(pr.radius * 0.9, pr.radius * 0.9, pr.radius * 2.1);
      _dummy.updateMatrix();
      projInstanced.setMatrixAt(i, _dummy.matrix);
      _color.set(pr.color);
      projInstanced.setColorAt(i, _color);
    }
    projInstanced.instanceMatrix.needsUpdate = true;
    if (projInstanced.instanceColor) projInstanced.instanceColor.needsUpdate = true;

    // Instanced Aether Shards Sync
    const shardCount = Math.min(MAX_SHARDS, sim.state.shards.length);
    shardInstanced.count = shardCount;
    for (let i = 0; i < shardCount; i++) {
      const s = sim.state.shards[i];
      _dummy.position.set(s.x, 0.55 + Math.sin(idleOrbitTime * 5 + s.id) * 0.14, s.z);
      _dummy.rotation.set(idleOrbitTime * 1.4, idleOrbitTime * 2.2 + s.id, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      shardInstanced.setMatrixAt(i, _dummy.matrix);
    }
    shardInstanced.instanceMatrix.needsUpdate = true;

    // Instanced Sparks Ring Buffer Sync
    let activeSparkInstances = 0;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const sp = sparks[i];
      if (!sp.active) continue;
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.active = false;
        continue;
      }
      sp.vy -= 14 * dt;
      sp.x += sp.vx * dt;
      sp.y = Math.max(0.08, sp.y + sp.vy * dt);
      sp.z += sp.vz * dt;
      const s = sp.size * (sp.life / sp.maxLife);
      _dummy.position.set(sp.x, sp.y, sp.z);
      _dummy.rotation.set(sp.life * 6, sp.life * 4, 0);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      sparkInstanced.setMatrixAt(activeSparkInstances, _dummy.matrix);
      _color.setHex(sp.colorHex);
      sparkInstanced.setColorAt(activeSparkInstances, _color);
      activeSparkInstances++;
    }
    sparkInstanced.count = activeSparkInstances;
    if (activeSparkInstances > 0) {
      sparkInstanced.instanceMatrix.needsUpdate = true;
      if (sparkInstanced.instanceColor) sparkInstanced.instanceColor.needsUpdate = true;
    }

    // Shockwave Rings Sync
    for (const r of shockRings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const prog = 1 - r.life / r.maxLife;
      const scale = 0.5 + prog * r.maxScale;
      r.mesh.scale.setScalar(scale);
      r.mat.opacity = (1 - prog) * 0.85;
    }

    // Camera Follow / Title Tour with Exponential Damping & Trauma Shake
    if (sim.state.mode === 'title') {
      // Stage Solar Warden + Obelisk on the right leaving calm left negative space for title SVG
      const tourAngle = idleOrbitTime * 0.22;
      _camTargetPos.set(Math.sin(tourAngle) * 5.5 + 4.5, 9.8, Math.cos(tourAngle) * 5.5 + 16.5);
      _camTargetLook.set(-2.2, 1.3, 3.2);
    } else {
      if (cameraPreset === 'cinematic') {
        _camTargetPos.set(p.x * 0.65, 13.5, p.z * 0.65 + 17.5);
        _camTargetLook.set(p.x * 0.72, 0.8, p.z * 0.72 - 1.2);
      } else if (cameraPreset === 'overhead') {
        _camTargetPos.set(p.x * 0.45, 31.0, p.z * 0.45 + 7.5);
        _camTargetLook.set(p.x * 0.55, 0, p.z * 0.55);
      } else {
        // Default tactical 3/4 view
        _camTargetPos.set(p.x * 0.55, 22.0, p.z * 0.55 + 18.0);
        _camTargetLook.set(p.x * 0.65, 0.5, p.z * 0.65);
      }
    }

    const dampFactor = 1 - Math.exp(-(isPlaying ? 7.5 : 4.2) * Math.max(0.001, dt));
    _camCurrPos.lerp(_camTargetPos, dampFactor);
    _camCurrLook.lerp(_camTargetLook, dampFactor);

    camera.position.copy(_camCurrPos);
    if (sim.state.trauma > 0.005) {
      const shake = sim.state.trauma * sim.state.trauma * 0.85;
      camera.position.x += (Math.random() * 2 - 1) * shake;
      camera.position.y += (Math.random() * 2 - 1) * shake * 0.6;
      camera.position.z += (Math.random() * 2 - 1) * shake;
    }
    camera.lookAt(_camCurrLook);
  }

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    } else {
      frameId = window.setTimeout(cb, 80);
    }
  }

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = clampDt(rawDt);

    const isPlaying = sim.state.mode === 'playing' && !paused;
    if (isPlaying) {
      if (hasPointerMoved) {
        screenToWorldAim(pointerClientX, pointerClientY);
      } else {
        aimWorldX = sim.state.player.x;
        aimWorldZ = sim.state.player.z - 8;
      }

      let moveX = 0;
      let moveZ = 0;
      if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) moveX -= 1;
      if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) moveX += 1;
      if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) moveZ -= 1;
      if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) moveZ += 1;

      sim.step(dt, {
        moveX,
        moveZ,
        aimX: aimWorldX,
        aimZ: aimWorldZ,
        firing: mouseDown,
        parryTriggered: parryQueued,
        novaTriggered: novaQueued,
      });
      parryQueued = false;
      novaQueued = false;
      pushHud(false);
    } else if (!paused && sim.state.mode === 'title') {
      // Gentle ambient drift on title screen
      sim.state.player.x = 4.5 + Math.cos(idleOrbitTime * 0.45) * 1.4;
      sim.state.player.z = 7.5 + Math.sin(idleOrbitTime * 0.45) * 1.4;
      sim.state.player.aimAngle = -idleOrbitTime * 0.45 + Math.PI * 0.5;
    }

    syncSceneVisuals(dt, isPlaying);
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  // Snap camera immediately on first frame so deterministic shots start framed cleanly
  syncSceneVisuals(0.016, false);
  _camCurrPos.copy(_camTargetPos);
  _camCurrLook.copy(_camTargetLook);
  camera.position.copy(_camCurrPos);
  camera.lookAt(_camCurrLook);
  tick();

  return {
    startRun,
    togglePause,
    returnTitle,
    continueEndless,
    setCameraPreset(preset: CameraPreset) {
      cameraPreset = preset;
    },
    setAutoFire(auto: boolean) {
      sim.state.player.autoFire = auto;
    },
    setMuted(muted: boolean) {
      audio.setMuted(muted);
    },
    triggerParry() {
      if (sim.state.mode === 'playing' && !paused) parryQueued = true;
    },
    triggerNova() {
      if (sim.state.mode === 'playing' && !paused) novaQueued = true;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      clearAllEnemyRigs();
      sanctuary.dispose();
      projGeo.dispose();
      projMat.dispose();
      shardGeo.dispose();
      shardMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      ringGeo.dispose();
      for (const r of shockRings) r.mat.dispose();
      factory.disposeAll();
      envTex.dispose();
      renderer.dispose();
      mountEl.innerHTML = '';
    },
  };
}
