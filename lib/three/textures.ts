import * as THREE from 'three';

export interface ArenaTextureSet {
  albedo: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  dispose: () => void;
}

export function createArenaTextures(maxAnisotropy: number): ArenaTextureSet {
  const size = 1024;
  const half = size / 2;

  // 1. Albedo Canvas (Engraved Celestial Astrolabe Obsidian & Brass)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const bgGrad = ctx.createRadialGradient(half, half, 20, half, half, half);
  bgGrad.addColorStop(0, '#131d3b');
  bgGrad.addColorStop(0.55, '#0c132a');
  bgGrad.addColorStop(0.92, '#080e20');
  bgGrad.addColorStop(1, '#1c1816');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle basalt stone grain & subtle tile variation
  for (let i = 0; i < 3200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
    const px = Math.abs(x) * size;
    const py = Math.abs(y) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(2,5,14,0.16)';
    ctx.fillRect(px, py, 2, 2);
  }

  // Concentric orbital rings
  const ringRadii = [0.12, 0.24, 0.38, 0.56, 0.74, 0.90, 0.96];
  ringRadii.forEach((norm, idx) => {
    const r = norm * half;
    ctx.beginPath();
    ctx.arc(half, half, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      idx === 0 || idx === 5 || idx === 6
        ? 'rgba(229, 179, 99, 0.52)'
        : 'rgba(92, 178, 255, 0.20)';
    ctx.lineWidth = idx === 6 ? 6 : idx === 5 ? 3 : 1.8;
    ctx.stroke();
  });

  // Radial astrolabe sector lines & degree ticks
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const isMajor = deg % 30 === 0;
    const isMedium = deg % 15 === 0;

    if (isMajor) {
      ctx.beginPath();
      ctx.moveTo(half + cos * (half * 0.12), half + sin * (half * 0.12));
      ctx.lineTo(half + cos * (half * 0.96), half + sin * (half * 0.96));
      ctx.strokeStyle = 'rgba(229, 179, 99, 0.26)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const rInner = half * (isMajor ? 0.87 : isMedium ? 0.89 : 0.915);
    const rOuter = half * 0.95;
    ctx.beginPath();
    ctx.moveTo(half + cos * rInner, half + sin * rInner);
    ctx.lineTo(half + cos * rOuter, half + sin * rOuter);
    ctx.strokeStyle = isMajor ? 'rgba(246, 208, 138, 0.65)' : 'rgba(140, 175, 225, 0.28)';
    ctx.lineWidth = isMajor ? 2.6 : 1.2;
    ctx.stroke();
  }

  // Cardinal sun inlays
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const px = half + Math.cos(ang) * (half * 0.56);
    const py = half + Math.sin(ang) * (half * 0.56);
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(229, 179, 99, 0.32)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(246, 208, 138, 0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = maxAnisotropy;
  albedo.needsUpdate = true;

  // 2. Roughness + Bump Map (linear NoColorSpace)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#c8c8c8'; // Base ~0.78 roughness slate
  rctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2500; i++) {
    const x = (Math.sin(i * 45.123) * 19381.123) % 1;
    const y = (Math.sin(i * 91.771) * 19381.123) % 1;
    rctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,60,0.08)';
    rctx.fillRect(Math.abs(x) * size, Math.abs(y) * size, 3, 3);
  }

  // Polished brass channels have lower roughness (darker grey)
  ringRadii.forEach((norm, idx) => {
    rctx.beginPath();
    rctx.arc(half, half, norm * half, 0, Math.PI * 2);
    rctx.strokeStyle = idx >= 5 ? '#484848' : '#787878';
    rctx.lineWidth = idx === 6 ? 8 : 3;
    rctx.stroke();
  });

  const roughness = new THREE.CanvasTexture(roughCanvas);
  roughness.colorSpace = THREE.NoColorSpace;
  roughness.anisotropy = maxAnisotropy;
  roughness.needsUpdate = true;

  const bump = new THREE.CanvasTexture(roughCanvas);
  bump.colorSpace = THREE.NoColorSpace;
  bump.anisotropy = maxAnisotropy;
  bump.needsUpdate = true;

  return {
    albedo,
    roughness,
    bump,
    dispose: () => {
      albedo.dispose();
      roughness.dispose();
      bump.dispose();
    },
  };
}

export function createBrushedMetalRoughness(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const shade = 70 + Math.floor(Math.abs(Math.sin(y * 1.73)) * 55);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(half, half, 4, half, half, half);
  grad.addColorStop(0, 'rgba(3, 5, 12, 0.78)');
  grad.addColorStop(0.55, 'rgba(3, 5, 12, 0.35)');
  grad.addColorStop(1, 'rgba(3, 5, 12, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
