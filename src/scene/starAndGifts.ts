import * as THREE from 'three';
import type { SceneTextures } from './textures';

export interface StarAndGiftsRig {
  group: THREE.Group;
  update: (elapsed: number, unleash?: number) => void;
  dispose: () => void;
}

/**
 * Builds a crisp, architectural 3D faceted 5-pointed star geometry with beveled front/back ridges.
 */
function createFacetedStarGeometry(
  outerRadius = 0.39,
  innerRadius = 0.16,
  depth = 0.12
): THREE.BufferGeometry {
  const perimeter: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    perimeter.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }

  const positions: number[] = [];
  const uvs: number[] = [];

  const pushTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number]
  ) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const scale = 0.5 / outerRadius;
    uvs.push(
      a[0] * scale + 0.5,
      a[1] * scale + 0.5,
      b[0] * scale + 0.5,
      b[1] * scale + 0.5,
      c[0] * scale + 0.5,
      c[1] * scale + 0.5
    );
  };

  const frontApex: [number, number, number] = [0, 0, depth];
  const backApex: [number, number, number] = [0, 0, -depth];

  for (let i = 0; i < 10; i++) {
    const p1 = perimeter[i];
    const p2 = perimeter[(i + 1) % 10];
    const v1: [number, number, number] = [p1[0], p1[1], 0];
    const v2: [number, number, number] = [p2[0], p2[1], 0];

    pushTri(frontApex, v1, v2);
    pushTri(backApex, v2, v1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Procedural luxury woven dark-burgundy/charcoal tree rug texture with antique-gold embroidered trim.
 */
function createLuxuryRugTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Deep woven dark wine-charcoal velvet wool gradient
  const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, size * 0.5);
  grad.addColorStop(0, '#1e080d');
  grad.addColorStop(0.55, '#2b0a11');
  grad.addColorStop(0.84, '#1b060a');
  grad.addColorStop(0.95, '#110406');
  grad.addColorStop(1, '#0a0304');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle woven textile grain
  let seed = 7711;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 4800; i++) {
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (size * 0.48);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(92, 22, 34, 0.14)' : 'rgba(8, 2, 4, 0.18)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Delicate antique-gold embroidered concentric border rings
  ctx.strokeStyle = 'rgba(196, 154, 82, 0.52)';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(176, 134, 68, 0.28)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.415, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.49);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.6, 'rgba(12, 3, 5, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface GiftSpec {
  pos: [number, number, number];
  rotY: number;
  w: number;
  h: number;
  d: number;
  boxColor: number;
  ribbonColor: number;
  isMetallicWrap?: boolean;
}

function createLuxuryGiftBox(
  spec: GiftSpec,
  velvetBump: THREE.Texture,
  brushedBump: THREE.Texture,
  isSoftwareGl: boolean,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const gift = new THREE.Group();
  gift.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
  gift.rotation.y = spec.rotY;

  const { w, h, d } = spec;
  const lidH = Math.min(0.085, h * 0.22);
  const bodyH = h - lidH * 0.45;

  const boxMat = new THREE.MeshPhysicalMaterial({
    color: spec.boxColor,
    roughness: spec.isMetallicWrap ? 0.34 : 0.78,
    metalness: spec.isMetallicWrap ? 0.62 : 0.08,
    sheen: spec.isMetallicWrap ? 0.15 : 0.85,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(spec.boxColor).lerp(new THREE.Color(0xffffff), 0.25),
    bumpMap: spec.isMetallicWrap ? brushedBump : velvetBump,
    bumpScale: 0.01,
  });

  const ribbonMat = new THREE.MeshPhysicalMaterial({
    color: spec.ribbonColor,
    roughness: 0.24,
    metalness: 0.76,
    clearcoat: 0.5,
    clearcoatRoughness: 0.18,
    bumpMap: brushedBump,
    bumpScale: 0.005,
  });

  disposables.push(boxMat, ribbonMat);

  // 1. Box body grounded cleanly at local y = 0
  const bodyGeo = new THREE.BoxGeometry(w, bodyH, d);
  bodyGeo.translate(0, bodyH * 0.5, 0);
  const bodyMesh = new THREE.Mesh(bodyGeo, boxMat);
  bodyMesh.castShadow = !isSoftwareGl;
  bodyMesh.receiveShadow = !isSoftwareGl;
  gift.add(bodyMesh);
  disposables.push(bodyGeo);

  // 2. Overhanging lid
  const lidW = w + 0.036;
  const lidD = d + 0.036;
  const lidGeo = new THREE.BoxGeometry(lidW, lidH, lidD);
  lidGeo.translate(0, h - lidH * 0.5, 0);
  const lidMesh = new THREE.Mesh(lidGeo, boxMat);
  lidMesh.castShadow = !isSoftwareGl;
  lidMesh.receiveShadow = !isSoftwareGl;
  gift.add(lidMesh);
  disposables.push(lidGeo);

  // 3. Crossed satin ribbon straps
  const bandThickness = 0.014;
  const bandWidth = Math.min(w, d) * 0.19;

  const bandXGeo = new THREE.BoxGeometry(bandWidth, h + bandThickness, lidD + 0.016);
  bandXGeo.translate(0, (h + bandThickness) * 0.5, 0);
  const bandX = new THREE.Mesh(bandXGeo, ribbonMat);
  gift.add(bandX);

  const bandZGeo = new THREE.BoxGeometry(lidW + 0.016, h + bandThickness, bandWidth);
  bandZGeo.translate(0, (h + bandThickness) * 0.5, 0);
  const bandZ = new THREE.Mesh(bandZGeo, ribbonMat);
  gift.add(bandZ);
  disposables.push(bandXGeo, bandZGeo);

  // 4. Sculpted 4-loop ribbon bow on top
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, h + bandThickness * 0.85, 0);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const loopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(angle) * 0.075, 0.062, Math.sin(angle) * 0.075),
      new THREE.Vector3(Math.cos(angle) * 0.125, 0.028, Math.sin(angle) * 0.125),
      new THREE.Vector3(Math.cos(angle) * 0.085, -0.005, Math.sin(angle) * 0.085),
      new THREE.Vector3(0, 0.005, 0),
    ]);
    const loopGeo = new THREE.TubeGeometry(loopCurve, 14, 0.017, 6, false);
    loopGeo.scale(1, 0.72, 1);
    const loopMesh = new THREE.Mesh(loopGeo, ribbonMat);
    bowGroup.add(loopMesh);
    disposables.push(loopGeo);
  }

  const knotGeo = new THREE.SphereGeometry(0.028, 10, 8);
  knotGeo.scale(1, 0.75, 1);
  const knotMesh = new THREE.Mesh(knotGeo, ribbonMat);
  bowGroup.add(knotMesh);
  disposables.push(knotGeo);

  gift.add(bowGroup);
  return gift;
}

export function buildStarAndGifts(
  textures: SceneTextures,
  isSoftwareGl: boolean
): StarAndGiftsRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. 3D Faceted Champagne Gold Star Topper
  const starGroup = new THREE.Group();
  starGroup.position.set(0, 6.06, 0);

  const finialGeo = new THREE.CylinderGeometry(0.014, 0.042, 0.34, 12);
  finialGeo.translate(0, -0.31, 0);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xe6c173,
    roughness: 0.2,
    metalness: 0.9,
    bumpMap: textures.brushedBump,
    bumpScale: 0.005,
    emissive: new THREE.Color(0xc99238),
    emissiveIntensity: 0.55,
  });

  const finialMesh = new THREE.Mesh(finialGeo, starMat);
  starGroup.add(finialMesh);

  const starGeo = createFacetedStarGeometry(0.39, 0.16, 0.12);
  const starMesh = new THREE.Mesh(starGeo, starMat);
  starGroup.add(starMesh);

  const starHaloMat = new THREE.SpriteMaterial({
    map: textures.starSpark,
    color: 0xffe4a8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const starHalo = new THREE.Sprite(starHaloMat);
  starHalo.scale.set(1.85, 1.85, 1);
  starHalo.position.set(0, 0, -0.02);
  starGroup.add(starHalo);

  const starLight = new THREE.PointLight(0xffdca0, 2.6, 7.0, 1.7);
  starLight.position.set(0, 0.05, 0.25);
  starGroup.add(starLight);

  group.add(starGroup);
  disposables.push(finialGeo, starGeo, starMat, starHaloMat);

  // 2. Luxury Dark Velvet/Wool Circular Tree Rug (Carpet) & Soft Ground Contact Shadow
  const rugAndGiftsGroup = new THREE.Group();
  group.add(rugAndGiftsGroup);

  const shadowTex = createSoftContactShadowTexture();
  const shadowGeo = new THREE.CircleGeometry(3.6, 48);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = -0.002;
  rugAndGiftsGroup.add(shadowPlane);
  disposables.push(shadowTex, shadowGeo, shadowMat);

  const rugHeight = 0.032;
  const rugRadius = 2.78;
  const rugTex = createLuxuryRugTexture();
  const rugGeo = new THREE.CylinderGeometry(rugRadius, rugRadius + 0.04, rugHeight, 64, 1);
  rugGeo.translate(0, rugHeight * 0.5, 0);

  const rugMat = new THREE.MeshPhysicalMaterial({
    map: rugTex,
    roughness: 0.88,
    metalness: 0.04,
    sheen: 0.85,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(0x5a1622),
    bumpMap: textures.velvetBump,
    bumpScale: 0.018,
  });
  const rugMesh = new THREE.Mesh(rugGeo, rugMat);
  rugMesh.receiveShadow = !isSoftwareGl;
  rugAndGiftsGroup.add(rugMesh);

  // Subtle woven antique-gold braided piping around the rug perimeter
  const rimGeo = new THREE.TorusGeometry(rugRadius + 0.01, 0.022, 10, 72);
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.translate(0, rugHeight * 0.72, 0);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x9e793c,
    roughness: 0.45,
    metalness: 0.65,
    bumpMap: textures.velvetBump,
    bumpScale: 0.012,
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.receiveShadow = !isSoftwareGl;
  rugAndGiftsGroup.add(rimMesh);

  disposables.push(rugTex, rugGeo, rugMat, rimGeo, rimMat);

  // 3. Two Tasteful Luxury Gift Boxes Placed Beside the Tree on the Rug
  const giftSpecs: GiftSpec[] = [
    {
      pos: [1.56, rugHeight, 1.62],
      rotY: -0.34,
      w: 0.56,
      h: 0.42,
      d: 0.52,
      boxColor: 0x5c0e1a,
      ribbonColor: 0xd9ad5b,
    },
    {
      pos: [2.12, rugHeight, 1.02],
      rotY: 0.46,
      w: 0.44,
      h: 0.34,
      d: 0.44,
      boxColor: 0x1c1513,
      ribbonColor: 0xc89a4c,
      isMetallicWrap: true,
    },
  ];

  for (const spec of giftSpecs) {
    const giftBox = createLuxuryGiftBox(
      spec,
      textures.velvetBump,
      textures.brushedBump,
      isSoftwareGl,
      disposables
    );
    rugAndGiftsGroup.add(giftBox);
  }

  return {
    group,
    update: (elapsed: number, unleash = 0) => {
      const clampedUnleash = THREE.MathUtils.clamp(unleash, 0, 1);
      const breath = 0.5 + 0.5 * Math.sin(elapsed * 1.15);
      const subtleShimmer = 0.5 + 0.5 * Math.sin(elapsed * 2.4 + 0.8);
      starMat.emissiveIntensity =
        (0.42 + breath * 0.42 + subtleShimmer * 0.12) * (1.0 - clampedUnleash * 0.42);
      starLight.intensity = (1.75 + breath * 0.85) * (1.0 - clampedUnleash * 0.55);
      starHaloMat.opacity = (0.58 + breath * 0.26) * (1.0 - clampedUnleash * 0.72);
      const haloScale = (1.48 + breath * 0.22) * (1.0 - clampedUnleash * 0.48);
      starHalo.scale.set(haloScale, haloScale, 1);
      starGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.14 + clampedUnleash * 1.2;
      starGroup.position.y = 6.06 - clampedUnleash * 3.01;
      const starSolidScale = Math.max(0.16, 1.0 - clampedUnleash * 0.84);
      starMesh.scale.setScalar(starSolidScale);
      finialMesh.scale.setScalar(Math.max(0.001, 1.0 - clampedUnleash * 2.2));
      finialMesh.visible = clampedUnleash < 0.45;

      const floorScale = Math.max(0.001, 1.0 - clampedUnleash * 2.2);
      rugAndGiftsGroup.scale.setScalar(floorScale);
      rugAndGiftsGroup.visible = floorScale > 0.01;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
