import * as THREE from 'three';

export interface SceneTextures {
  snowflake: THREE.CanvasTexture;
  squareMote: THREE.CanvasTexture;
  softBokeh: THREE.CanvasTexture;
  starSpark: THREE.CanvasTexture;
  baseGlow: THREE.CanvasTexture;
  velvetBump: THREE.DataTexture;
  brushedBump: THREE.DataTexture;
  dispose: () => void;
}

function createSnowflakeTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Soft warm ivory glow behind the crystal
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  halo.addColorStop(0, 'rgba(255, 249, 236, 0.42)');
  halo.addColorStop(0.32, 'rgba(247, 232, 200, 0.14)');
  halo.addColorStop(1, 'rgba(247, 232, 200, 0.0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255, 250, 238, 0.96)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);

    // Main crystalline arm
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -49);
    ctx.stroke();

    // Inner diamond hexagon strut
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(0, -15);
    ctx.lineTo(6, -11);
    ctx.stroke();

    // Detailed dendritic chevrons along arm
    ctx.lineWidth = 1.8;
    for (const [yPos, len] of [
      [-21, 11],
      [-32, 13],
      [-41, 7.5],
    ]) {
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(-len, yPos - len * 0.72);
      ctx.moveTo(0, yPos);
      ctx.lineTo(len, yPos - len * 0.72);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Luminous crystal hub
  ctx.fillStyle = 'rgba(255, 252, 244, 0.98)';
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSquareMoteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Soft outer warm glow
  const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.48);
  glow.addColorStop(0, 'rgba(255, 245, 218, 0.68)');
  glow.addColorStop(0.45, 'rgba(242, 210, 152, 0.22)');
  glow.addColorStop(1, 'rgba(242, 210, 152, 0.0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Crisp luminous square core with subtly softened corners
  ctx.fillStyle = 'rgba(255, 249, 232, 0.96)';
  const s = 22;
  const x = cx - s / 2;
  const y = cy - s / 2;
  const r = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, r);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftBokehTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  grad.addColorStop(0, 'rgba(255, 245, 224, 0.26)');
  grad.addColorStop(0.55, 'rgba(255, 242, 214, 0.22)');
  grad.addColorStop(0.78, 'rgba(244, 216, 165, 0.14)');
  grad.addColorStop(1, 'rgba(244, 216, 165, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createStarSparkTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  radial.addColorStop(0, 'rgba(255, 250, 232, 1.0)');
  radial.addColorStop(0.18, 'rgba(250, 223, 160, 0.72)');
  radial.addColorStop(0.45, 'rgba(222, 168, 86, 0.18)');
  radial.addColorStop(1, 'rgba(222, 168, 86, 0.0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // Delicate 4-point cross flare
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    const flare = ctx.createLinearGradient(0, -size * 0.44, 0, size * 0.44);
    flare.addColorStop(0, 'rgba(255, 246, 220, 0)');
    flare.addColorStop(0.5, 'rgba(255, 248, 226, 0.88)');
    flare.addColorStop(1, 'rgba(255, 246, 220, 0)');
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.44);
    ctx.quadraticCurveTo(3.5, 0, 0, size * 0.44);
    ctx.quadraticCurveTo(-3.5, 0, 0, -size * 0.44);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBaseGlowTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.49);
  grad.addColorStop(0, 'rgba(42, 12, 16, 0.55)');
  grad.addColorStop(0.38, 'rgba(72, 28, 18, 0.34)');
  grad.addColorStop(0.64, 'rgba(204, 152, 74, 0.24)');
  grad.addColorStop(0.74, 'rgba(235, 188, 102, 0.16)');
  grad.addColorStop(0.88, 'rgba(92, 34, 24, 0.06)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createVelvetBumpTexture(): THREE.DataTexture {
  const width = 128;
  const height = 128;
  const data = new Uint8Array(width * height * 4);
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < width * height; i++) {
    const n = Math.floor(110 + rand() * 55);
    const idx = i * 4;
    data[idx] = n;
    data[idx + 1] = n;
    data[idx + 2] = n;
    data[idx + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBrushedMetalBumpTexture(): THREE.DataTexture {
  const width = 128;
  const height = 128;
  const data = new Uint8Array(width * height * 4);
  let seed = 9187;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < height; y++) {
    const rowBias = 115 + rand() * 35;
    for (let x = 0; x < width; x++) {
      const val = Math.min(255, Math.max(0, Math.floor(rowBias + (rand() - 0.5) * 18)));
      const idx = (y * width + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSceneTextures(maxAnisotropy: number): SceneTextures {
  const snowflake = createSnowflakeTexture();
  const squareMote = createSquareMoteTexture();
  const softBokeh = createSoftBokehTexture();
  const starSpark = createStarSparkTexture();
  const baseGlow = createBaseGlowTexture();
  const velvetBump = createVelvetBumpTexture();
  const brushedBump = createBrushedMetalBumpTexture();

  snowflake.anisotropy = maxAnisotropy;
  baseGlow.anisotropy = maxAnisotropy;

  return {
    snowflake,
    squareMote,
    softBokeh,
    starSpark,
    baseGlow,
    velvetBump,
    brushedBump,
    dispose: () => {
      snowflake.dispose();
      squareMote.dispose();
      softBokeh.dispose();
      starSpark.dispose();
      baseGlow.dispose();
      velvetBump.dispose();
      brushedBump.dispose();
    },
  };
}
