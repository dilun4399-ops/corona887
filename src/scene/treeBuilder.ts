import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneTextures } from './textures';

export interface ChristmasTreeRig {
  group: THREE.Group;
  update: (elapsed: number, unleash?: number) => void;
  dispose: () => void;
}

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Evaluates the sculpted conical silhouette radius of the Christmas tree at normalized height hNorm in [0, 1].
 */
export function getTreeEnvelopeRadius(hNorm: number): number {
  const clamped = Math.max(0, Math.min(1, hNorm));
  const baseCurve = 2.06 * Math.pow(1 - clamped * 0.96, 0.92);
  const tierWave = 1.0 + 0.06 * Math.sin(clamped * Math.PI * 14);
  return baseCurve * tierWave;
}

/**
 * Builds a feathery, organic 3D evergreen pine-bough cluster:
 * curved twig stem with layered upturned/drooping needle sprays and fine tip needles
 * so the tree silhouette looks natural, airy at the edges, and lushly layered inside.
 */
function createLushBoughClusterGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rand = createSeededRandom(314159);

  // Tapered woody twig core extending along +Z
  const stem = new THREE.CylinderGeometry(0.01, 0.022, 0.64, 5, 1);
  stem.rotateX(Math.PI / 2);
  stem.translate(0, 0, 0.32);
  parts.push(stem);

  // Layered needle sprays along the bough: fuller near base, feathery and slender at tip
  const bladeCount = 38;
  for (let i = 0; i < bladeCount; i++) {
    const t = i / (bladeCount - 1);
    const zPos = 0.04 + t * 0.56;
    const len = 0.22 + (1 - Math.abs(t - 0.38)) * 0.14;
    const width = 0.032 * (1 - t * 0.42) + 0.01;

    const blade = new THREE.ConeGeometry(width, len, 4, 1);
    blade.scale(1.1, 0.52, 1.0);
    blade.rotateX(Math.PI / 2);
    blade.translate(0, 0, len * 0.48);

    const side = i % 2 === 0 ? 1 : -1;
    const layer = i % 3;
    const yaw = side * (0.34 + (1 - t * 0.7) * 0.62 + (rand() - 0.5) * 0.22);
    // Natural arc: outer needles lift slightly at tips while lower needles droop
    const pitch = (layer === 2 ? -0.34 : layer === 1 ? -0.06 : 0.2) + (rand() - 0.5) * 0.18;
    const roll = side * (0.2 + (rand() - 0.5) * 0.28);

    const euler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
    const mat = new THREE.Matrix4().makeRotationFromEuler(euler);
    mat.setPosition(side * 0.01, (layer - 1) * 0.016, zPos);
    blade.applyMatrix4(mat);
    parts.push(blade);
  }

  // Feathery terminal needle plume at bough tip
  for (let k = -2; k <= 2; k++) {
    const tip = new THREE.ConeGeometry(0.022, 0.25, 4, 1);
    tip.scale(1.0, 0.52, 1.0);
    tip.rotateX(Math.PI / 2);
    tip.translate(0, 0, 0.12);
    const euler = new THREE.Euler(-0.18 + Math.abs(k) * 0.09, k * 0.21, 0, 'YXZ');
    const mat = new THREE.Matrix4().makeRotationFromEuler(euler);
    mat.setPosition(0, 0.005, 0.58);
    tip.applyMatrix4(mat);
    parts.push(tip);
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Deep recessed shadow core inside the trunk zone so deep crevices stay obsidian/wine-black
 * without creating an obvious smooth cone silhouette.
 */
function createInnerShadowCoreGeometry(
  baseY: number,
  topY: number,
  rand: () => number
): THREE.BufferGeometry {
  const height = topY - baseY - 0.35;
  const geo = new THREE.CylinderGeometry(0.03, 1.05, height, 24, 20, false);
  geo.translate(0, baseY + height * 0.5, 0);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.001) {
      const hNorm = THREE.MathUtils.clamp((y - baseY) / height, 0, 1);
      const targetR = getTreeEnvelopeRadius(hNorm) * 0.48;
      const angle = Math.atan2(z, x);
      const irregular =
        1.0 +
        0.18 * Math.sin(angle * 6 + hNorm * 16) +
        0.12 * Math.cos(hNorm * Math.PI * 20) +
        (rand() - 0.5) * 0.1;
      const newR = targetR * irregular;
      pos.setX(i, (x / r) * newR);
      pos.setZ(i, (z / r) * newR);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a lush sculpted dark-crimson velvet ribbon bow.
 */
function createVelvetBow(
  velvetMaterial: THREE.Material,
  scale = 1
): { group: THREE.Group; geometries: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  for (const dir of [-1, 1]) {
    const loopCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(dir * 0.12, 0.08, 0.025),
        new THREE.Vector3(dir * 0.18, 0.025, -0.015),
        new THREE.Vector3(dir * 0.135, -0.06, -0.01),
        new THREE.Vector3(0, -0.01, 0),
      ],
      false
    );
    const loopGeo = new THREE.TubeGeometry(loopCurve, 22, 0.032, 8, false);
    loopGeo.scale(1, 1, 0.42);
    geometries.push(loopGeo);
    const loopMesh = new THREE.Mesh(loopGeo, velvetMaterial);
    loopMesh.castShadow = true;
    loopMesh.receiveShadow = true;
    group.add(loopMesh);
  }

  for (const dir of [-1, 1]) {
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dir * 0.018, -0.018, 0.01),
      new THREE.Vector3(dir * 0.072, -0.12, 0.04),
      new THREE.Vector3(dir * 0.12, -0.24, 0.01),
      new THREE.Vector3(dir * 0.155, -0.34, -0.02),
    ]);
    const tailGeo = new THREE.TubeGeometry(tailCurve, 18, 0.024, 6, false);
    tailGeo.scale(1, 1, 0.32);
    geometries.push(tailGeo);
    const tailMesh = new THREE.Mesh(tailGeo, velvetMaterial);
    tailMesh.castShadow = true;
    group.add(tailMesh);
  }

  const knotGeo = new THREE.CylinderGeometry(0.032, 0.03, 0.05, 10);
  knotGeo.rotateZ(Math.PI / 2);
  knotGeo.scale(1, 1.15, 0.8);
  geometries.push(knotGeo);
  const knotMesh = new THREE.Mesh(knotGeo, velvetMaterial);
  group.add(knotMesh);

  group.scale.setScalar(scale);
  return { group, geometries };
}

export function buildChristmasTree(
  textures: SceneTextures,
  isSoftwareGl: boolean
): ChristmasTreeRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const rand = createSeededRandom(20261225);

  const treeBaseY = 0.24;
  const treeTopY = 5.75;
  const treeHeight = treeTopY - treeBaseY;

  // 1. Dark bark trunk & recessed shadow core
  const trunkGeo = new THREE.CylinderGeometry(0.03, 0.26, treeHeight * 0.92, 12, 1);
  trunkGeo.translate(0, treeBaseY + treeHeight * 0.46, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x16090a,
    roughness: 0.94,
    metalness: 0.04,
  });
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = !isSoftwareGl;
  trunkMesh.receiveShadow = !isSoftwareGl;
  group.add(trunkMesh);
  disposables.push(trunkGeo, trunkMat);

  const innerCoreGeo = createInnerShadowCoreGeometry(treeBaseY, treeTopY, rand);
  const innerCoreMat = new THREE.MeshStandardMaterial({
    color: 0x0b1610,
    roughness: 0.92,
    metalness: 0.04,
  });
  const innerCoreMesh = new THREE.Mesh(innerCoreGeo, innerCoreMat);
  innerCoreMesh.castShadow = !isSoftwareGl;
  innerCoreMesh.receiveShadow = !isSoftwareGl;
  group.add(innerCoreMesh);
  disposables.push(innerCoreGeo, innerCoreMat);

  const explodeUniforms: Array<{ value: number }> = [];

  const attachInstancedExplode = (
    mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
    localShrink: number,
    explodeMin: number,
    explodeRange: number,
    withWind = false
  ) => {
    const prevCacheKey = mat.customProgramCacheKey?.bind(mat);
    mat.customProgramCacheKey = () =>
      `${prevCacheKey ? prevCacheKey() : ''}_explode_${localShrink}_${withWind ? 'w' : 'n'}`;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uUnleash = { value: 0 };
      if (withWind) shader.uniforms.uWindTime = { value: 0 };
      mat.userData.shader = shader;
      explodeUniforms.push(shader.uniforms.uUnleash);

      shader.vertexShader =
        `uniform float uUnleash;\n${withWind ? 'uniform float uWindTime;\n' : ''}` +
        shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        ${
          withWind
            ? `
        float tipFactor = clamp(position.z * 1.4, 0.0, 1.0);
        float swayWave = sin(uWindTime * 1.15 + position.x * 2.5 + position.y * 1.8);
        transformed.y += swayWave * 0.018 * tipFactor;
        transformed.x += cos(uWindTime * 0.85 + position.z * 2.0) * 0.012 * tipFactor;
        `
            : ''
        }
        float shrinkMix = mix(1.0, ${localShrink.toFixed(3)}, clamp(uUnleash, 0.0, 1.0));
        transformed *= shrinkMix;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          if (uUnleash > 0.001) {
            vec3 instPos = instanceMatrix[3].xyz;
            vec3 fromCenter = instPos - vec3(0.0, 3.05, 0.0);
            float distC = length(fromCenter);
            vec3 radDir = distC > 0.001 ? (fromCenter / distC) : vec3(0.0, 1.0, 0.0);
            float h1 = fract(sin(dot(instPos.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
            float h2 = fract(sin(dot(instPos.zyx, vec3(39.346, 11.135, 83.155))) * 24634.6345);
            vec3 tang = vec3(-radDir.z, (h2 - 0.5) * 0.9, radDir.x);
            float tl = length(tang);
            tang = tl > 0.001 ? (tang / tl) : vec3(1.0, 0.0, 0.0);
            float easeU = 1.0 - (1.0 - uUnleash) * (1.0 - uUnleash);
            float distOut = (${explodeMin.toFixed(2)} + h1 * ${explodeRange.toFixed(2)}) * easeU;
            vec3 burst = radDir * distOut + tang * (0.65 * easeU);
            mvPosition.xyz += burst;
          }
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `
      );
    };
  };

  // 2. Feathery, asymmetrical 3D pine boughs with subtle living breeze & particle dissolve
  const boughGeo = createLushBoughClusterGeometry();
  const boughMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.56,
    metalness: 0.1,
    bumpMap: textures.velvetBump,
    bumpScale: 0.01,
  });
  attachInstancedExplode(boughMat, 0.012, 0.35, 1.85, true);
  disposables.push(boughGeo, boughMat);

  interface BoughPlacement {
    pos: THREE.Vector3;
    rot: THREE.Euler;
    scale: THREE.Vector3;
    color: THREE.Color;
  }

  const boughs: BoughPlacement[] = [];
  // Dramatic dark luxury palette: deep obsidian-pine interior + black cherry + wine burgundy + warm bronze tips
  const palDeepPine = new THREE.Color('#0f291c');
  const palInkGreen = new THREE.Color('#183b29');
  const palBlackCherry = new THREE.Color('#3d0a12');
  const palWineRed = new THREE.Color('#63111f');
  const palCrimsonTip = new THREE.Color('#801a28');
  const palBronzeKiss = new THREE.Color('#8c5d2c');
  const tmpColor = new THREE.Color();

  // 22 irregular branch tiers with varied branch reach so silhouette feels wild, organic, and sculpted
  const tierCount = 22;
  for (let tier = 0; tier < tierCount; tier++) {
    const hNorm = tier / (tierCount - 1);
    const tierY = treeBaseY + hNorm * (treeHeight - 0.16);
    const baseEnvR = getTreeEnvelopeRadius(hNorm);

    const primaryBranches = Math.max(7, Math.round(21 * (1 - hNorm * 0.65)));
    const tierOffset = tier * 0.6180339 * Math.PI * 2;

    for (let b = 0; b < primaryBranches; b++) {
      const branchAngle =
        tierOffset + (b / primaryBranches) * Math.PI * 2 + (rand() - 0.5) * 0.24;

      // Subtle per-branch variation keeps feathery pine texture while ensuring every 360-degree face looks straight and balanced
      const branchReachBias = 0.91 + rand() * 0.18;
      const branchYOffset = (rand() - 0.5) * 0.06;
      const radialSteps = Math.max(2, Math.round(4 * (1 - hNorm * 0.5)));

      for (let step = 0; step < radialSteps; step++) {
        const rFrac = (step + 0.4) / (radialSteps + 0.15);
        const boughLen = THREE.MathUtils.lerp(1.22, 0.5, hNorm) * (0.9 + rand() * 0.2);
        const targetR = baseEnvR * branchReachBias * rFrac;
        const startR = Math.max(0.05, targetR - boughLen * 0.34);

        // Natural branch sag + slight upward tip curl on outer branches
        const sagY = -0.26 * rFrac * (1 - hNorm * 0.65) + branchYOffset;
        const px = Math.cos(branchAngle) * startR;
        const pz = Math.sin(branchAngle) * startR;
        const py = tierY + sagY;

        const yaw = Math.atan2(px, pz) + (rand() - 0.5) * 0.22;
        const pitch = THREE.MathUtils.lerp(0.36, -0.38, hNorm) + (rand() - 0.5) * 0.16;
        const roll = (rand() - 0.5) * 0.22;

        const scaleW = boughLen * (0.88 + rand() * 0.28);
        const scaleH = boughLen * (0.88 + rand() * 0.24);

        const mixPick = rand();
        if (rFrac < 0.45) {
          tmpColor.copy(palDeepPine).lerp(palInkGreen, rand() * 0.65);
          if (mixPick > 0.55) tmpColor.lerp(palBlackCherry, 0.5);
        } else if (mixPick < 0.36) {
          tmpColor.copy(palInkGreen).lerp(palDeepPine, rand() * 0.5);
          if (rand() > 0.75) tmpColor.lerp(palBronzeKiss, 0.3);
        } else {
          tmpColor
            .copy(palBlackCherry)
            .lerp(palWineRed, 0.45 + rand() * 0.55)
            .lerp(palCrimsonTip, Math.max(0, rFrac - 0.65) * rand());
          if (rand() > 0.84) tmpColor.lerp(palBronzeKiss, 0.32);
        }

        boughs.push({
          pos: new THREE.Vector3(px, py, pz),
          rot: new THREE.Euler(pitch, yaw, roll, 'YXZ'),
          scale: new THREE.Vector3(scaleW, scaleH, boughLen),
          color: tmpColor.clone(),
        });

        // Asymmetric lateral offshoots for soft, non-uniform feathery volume
        if (rFrac > 0.42) {
          for (const side of [-1, 1]) {
            if (rand() < 0.72) {
              const latYaw = yaw + side * (0.36 + rand() * 0.28);
              const latPitch = pitch + (rand() - 0.5) * 0.16;
              const latColor = tmpColor.clone().lerp(palInkGreen, rand() * 0.3);
              boughs.push({
                pos: new THREE.Vector3(
                  px + Math.sin(yaw) * 0.06,
                  py + (rand() - 0.5) * 0.05,
                  pz + Math.cos(yaw) * 0.06
                ),
                rot: new THREE.Euler(latPitch, latYaw, roll + side * 0.25, 'YXZ'),
                scale: new THREE.Vector3(scaleW * 0.82, scaleH * 0.85, boughLen * 0.84),
                color: latColor,
              });
            }
          }
        }
      }
    }
  }

  // Crown tuft right under the star finial
  for (let k = 0; k < 20; k++) {
    const angle = (k / 20) * Math.PI * 2;
    const h = treeTopY - 0.24 + (k % 3) * 0.08;
    const r = 0.035 + (1 - (k % 3) * 0.25) * 0.06;
    const col = k % 2 === 0 ? palInkGreen.clone() : palWineRed.clone();
    boughs.push({
      pos: new THREE.Vector3(Math.cos(angle) * r, h, Math.sin(angle) * r),
      rot: new THREE.Euler(-0.74 - rand() * 0.24, Math.atan2(Math.cos(angle), Math.sin(angle)), 0, 'YXZ'),
      scale: new THREE.Vector3(0.4, 0.4, 0.44),
      color: col,
    });
  }

  const foliageMesh = new THREE.InstancedMesh(boughGeo, boughMat, boughs.length);
  foliageMesh.castShadow = !isSoftwareGl;
  foliageMesh.receiveShadow = !isSoftwareGl;
  foliageMesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < boughs.length; i++) {
    const b = boughs[i];
    dummy.position.copy(b.pos);
    dummy.rotation.copy(b.rot);
    dummy.scale.copy(b.scale);
    dummy.updateMatrix();
    foliageMesh.setMatrixAt(i, dummy.matrix);
    foliageMesh.setColorAt(i, b.color);
  }
  foliageMesh.instanceMatrix.needsUpdate = true;
  if (foliageMesh.instanceColor) foliageMesh.instanceColor.needsUpdate = true;
  foliageMesh.computeBoundingSphere();
  group.add(foliageMesh);

  // 3. Sculpted Velvet Crimson Bows nestled naturally across tiers (matching reference image)
  const velvetBowMat = new THREE.MeshPhysicalMaterial({
    color: 0x731120,
    roughness: 0.78,
    metalness: 0.06,
    sheen: 1.0,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(0xc93448),
    bumpMap: textures.velvetBump,
    bumpScale: 0.015,
  });
  disposables.push(velvetBowMat);

  const bowSpecs = [
    { hNorm: 0.78, angle: 0.15, scale: 0.95 },
    { hNorm: 0.72, angle: 2.25, scale: 0.98 },
    { hNorm: 0.66, angle: -2.05, scale: 1.06 },
    { hNorm: 0.59, angle: -0.24, scale: 1.16 },
    { hNorm: 0.53, angle: 1.48, scale: 1.18 },
    { hNorm: 0.48, angle: -2.95, scale: 1.2 },
    { hNorm: 0.42, angle: 0.36, scale: 1.26 },
    { hNorm: 0.36, angle: -1.35, scale: 1.28 },
    { hNorm: 0.28, angle: 2.82, scale: 1.32 },
    { hNorm: 0.24, angle: -0.22, scale: 1.36 },
    { hNorm: 0.14, angle: 1.75, scale: 1.4 },
    { hNorm: 0.1, angle: -1.75, scale: 1.42 },
  ];

  interface BowRigItem {
    group: THREE.Group;
    basePos: THREE.Vector3;
    burstDir: THREE.Vector3;
    baseRotY: number;
  }
  const bowItems: BowRigItem[] = [];

  for (const spec of bowSpecs) {
    const y = treeBaseY + spec.hNorm * (treeHeight - 0.22);
    const r = getTreeEnvelopeRadius(spec.hNorm) * 0.96;
    const { group: bowGroup, geometries } = createVelvetBow(velvetBowMat, spec.scale);
    for (const g of geometries) disposables.push(g);
    const basePos = new THREE.Vector3(Math.sin(spec.angle) * r, y, Math.cos(spec.angle) * r);
    bowGroup.position.copy(basePos);
    bowGroup.rotation.y = spec.angle;
    bowGroup.rotation.x = 0.24;
    group.add(bowGroup);

    const burstDir = basePos
      .clone()
      .sub(new THREE.Vector3(0, 3.05, 0))
      .normalize()
      .multiplyScalar(0.45 + rand() * 0.45);
    bowItems.push({
      group: bowGroup,
      basePos,
      burstDir,
      baseRotY: spec.angle,
    });
  }

  // 4. Jewel-like Ornaments (larger, punchier champagne gold, antique bronze, glossy ruby, matte wine)
  const matteRedTransforms: THREE.Matrix4[] = [];
  const rubyGlassTransforms: THREE.Matrix4[] = [];
  const bronzeGoldTransforms: THREE.Matrix4[] = [];
  const champagneGoldTransforms: THREE.Matrix4[] = [];
  const capTransforms: THREE.Matrix4[] = [];
  const ringTransforms: THREE.Matrix4[] = [];

  const totalOrnaments = 170;
  for (let i = 0; i < totalOrnaments; i++) {
    const frac = (i + 0.5) / totalOrnaments;
    const hNorm = 0.05 + Math.pow(frac, 0.86) * 0.88;
    const y = treeBaseY + hNorm * (treeHeight - 0.2);
    const envR = getTreeEnvelopeRadius(hNorm);
    const r = envR * (0.84 + rand() * 0.19);
    const angle = i * 2.39996 + (rand() - 0.5) * 0.34;

    const sizeTier = i % 3 === 0 ? 1.28 : i % 3 === 1 ? 1.0 : 0.78;
    const radius = THREE.MathUtils.lerp(0.145, 0.058, hNorm) * sizeTier;

    const ox = Math.sin(angle) * r;
    const oz = Math.cos(angle) * r;
    const oy = y - radius * 0.42;

    dummy.position.set(ox, oy, oz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(radius);
    dummy.updateMatrix();

    const kind = i % 4;
    if (kind === 0) matteRedTransforms.push(dummy.matrix.clone());
    else if (kind === 1) rubyGlassTransforms.push(dummy.matrix.clone());
    else if (kind === 2) bronzeGoldTransforms.push(dummy.matrix.clone());
    else champagneGoldTransforms.push(dummy.matrix.clone());

    dummy.position.set(ox, oy + radius * 0.96, oz);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.setScalar(radius);
    dummy.updateMatrix();
    capTransforms.push(dummy.matrix.clone());

    dummy.position.set(ox, oy + radius * 1.15, oz);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.setScalar(radius);
    dummy.updateMatrix();
    ringTransforms.push(dummy.matrix.clone());
  }

  const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
  const capGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.24, 10);
  const ringGeo = new THREE.TorusGeometry(0.14, 0.035, 6, 14);
  disposables.push(sphereGeo, capGeo, ringGeo);

  const matteRedMat = new THREE.MeshStandardMaterial({
    color: 0x701120,
    roughness: 0.56,
    metalness: 0.18,
    bumpMap: textures.velvetBump,
    bumpScale: 0.012,
  });

  const rubyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x991224,
    roughness: 0.1,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.95,
    envMapIntensity: 1.25,
    emissive: new THREE.Color(0x280409),
    emissiveIntensity: 0.55,
  });

  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xc8964e,
    roughness: 0.2,
    metalness: 0.92,
    envMapIntensity: 1.3,
    bumpMap: textures.brushedBump,
    bumpScale: 0.007,
  });

  const champagneGoldMat = new THREE.MeshStandardMaterial({
    color: 0xebd092,
    roughness: 0.16,
    metalness: 0.92,
    envMapIntensity: 1.35,
    bumpMap: textures.brushedBump,
    bumpScale: 0.005,
  });

  const capGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd9af68,
    roughness: 0.24,
    metalness: 0.9,
  });

  attachInstancedExplode(matteRedMat, 0.04, 0.45, 1.95, false);
  attachInstancedExplode(rubyGlassMat, 0.04, 0.45, 1.95, false);
  attachInstancedExplode(bronzeGoldMat, 0.04, 0.45, 1.95, false);
  attachInstancedExplode(champagneGoldMat, 0.04, 0.45, 1.95, false);
  attachInstancedExplode(capGoldMat, 0.005, 0.45, 1.95, false);

  disposables.push(matteRedMat, rubyGlassMat, bronzeGoldMat, champagneGoldMat, capGoldMat);

  const addInstancedGroup = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    matrices: THREE.Matrix4[],
    castShadow: boolean
  ) => {
    const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
    inst.castShadow = castShadow;
    inst.receiveShadow = !isSoftwareGl;
    inst.frustumCulled = false;
    for (let i = 0; i < matrices.length; i++) {
      inst.setMatrixAt(i, matrices[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  };

  addInstancedGroup(sphereGeo, matteRedMat, matteRedTransforms, !isSoftwareGl);
  addInstancedGroup(sphereGeo, rubyGlassMat, rubyGlassTransforms, !isSoftwareGl);
  addInstancedGroup(sphereGeo, bronzeGoldMat, bronzeGoldTransforms, !isSoftwareGl);
  addInstancedGroup(sphereGeo, champagneGoldMat, champagneGoldTransforms, !isSoftwareGl);
  addInstancedGroup(capGeo, capGoldMat, capTransforms, false);
  addInstancedGroup(ringGeo, capGoldMat, ringTransforms, false);

  // 5. Warm-Gold Twinkling Fairy Lights nestled among branches (explode outward on unleash)
  const lightCount = 260;
  const lightPositions = new Float32Array(lightCount * 3);
  const lightExplodes = new Float32Array(lightCount * 3);
  const lightPhases = new Float32Array(lightCount);
  const lightSpeeds = new Float32Array(lightCount);
  const lightSizes = new Float32Array(lightCount);
  const lightColors = new Float32Array(lightCount * 3);

  const warmIvory = new THREE.Color(0xfff1cc);
  const warmChampagne = new THREE.Color(0xedb966);
  const warmAmber = new THREE.Color(0xd98042);

  for (let i = 0; i < lightCount; i++) {
    const hNorm = 0.05 + Math.pow(rand(), 0.8) * 0.9;
    const y = treeBaseY + hNorm * (treeHeight - 0.16);
    const envR = getTreeEnvelopeRadius(hNorm);
    const r = envR * (0.72 + rand() * 0.3);
    const angle = rand() * Math.PI * 2;

    const lx = Math.cos(angle) * r;
    const ly = y + (rand() - 0.5) * 0.08;
    const lz = Math.sin(angle) * r;
    lightPositions[i * 3] = lx;
    lightPositions[i * 3 + 1] = ly;
    lightPositions[i * 3 + 2] = lz;

    const dx = lx;
    const dy = ly - 3.05;
    const dz = lz;
    const dLen = Math.max(Math.hypot(dx, dy, dz), 0.05);
    const burstMag = 0.5 + rand() * 2.1;
    lightExplodes[i * 3] = (dx / dLen) * burstMag * 1.45 + (rand() - 0.5) * 1.1;
    lightExplodes[i * 3 + 1] = (dy / dLen) * burstMag * 0.85 + (rand() - 0.5) * 0.85;
    lightExplodes[i * 3 + 2] = (dz / dLen) * burstMag * 1.25 + (rand() - 0.5) * 0.9;

    lightPhases[i] = rand() * Math.PI * 2;
    lightSpeeds[i] = 0.75 + rand() * 1.9;
    lightSizes[i] = (0.11 + rand() * 0.12) * (1.0 - hNorm * 0.18);

    const pick = rand();
    if (pick < 0.48) tmpColor.copy(warmIvory);
    else if (pick < 0.85) tmpColor.copy(warmChampagne);
    else tmpColor.copy(warmAmber);

    lightColors[i * 3] = tmpColor.r;
    lightColors[i * 3 + 1] = tmpColor.g;
    lightColors[i * 3 + 2] = tmpColor.b;
  }

  const lightsGeo = new THREE.BufferGeometry();
  lightsGeo.setAttribute('position', new THREE.BufferAttribute(lightPositions, 3));
  lightsGeo.setAttribute('aExplode', new THREE.BufferAttribute(lightExplodes, 3));
  lightsGeo.setAttribute('aPhase', new THREE.BufferAttribute(lightPhases, 1));
  lightsGeo.setAttribute('aSpeed', new THREE.BufferAttribute(lightSpeeds, 1));
  lightsGeo.setAttribute('aSize', new THREE.BufferAttribute(lightSizes, 1));
  lightsGeo.setAttribute('aColor', new THREE.BufferAttribute(lightColors, 3));

  const lightsMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uUnleash: { value: 0 },
      uPixelRatio: { value: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) },
      uTexture: { value: textures.starSpark },
    },
    vertexShader: `
      attribute vec3 aExplode;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;
      attribute vec3 aColor;

      uniform float uTime;
      uniform float uUnleash;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vColor = aColor;
        float wave1 = sin(uTime * aSpeed + aPhase);
        float wave2 = sin(uTime * (aSpeed * 0.53) + aPhase * 1.7);
        float t = clamp(0.5 + 0.5 * (wave1 * 0.65 + wave2 * 0.35), 0.0, 1.0);
        float twinkle = 0.3 + 0.7 * (t * t);
        vTwinkle = twinkle;

        float easeU = 1.0 - (1.0 - uUnleash) * (1.0 - uUnleash);
        vec3 pos = position + aExplode * easeU;
        pos.y += sin(uTime * 1.5 + aPhase) * 0.1 * easeU;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float ptSize = aSize * (250.0 / max(-mvPosition.z, 1.0)) * uPixelRatio * (0.85 + 0.25 * twinkle) * (1.0 + 0.6 * easeU);
        gl_PointSize = clamp(ptSize, 1.0, 42.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float alpha = tex.a * (0.38 + 0.55 * vTwinkle);
        if (alpha < 0.02) discard;
        vec3 col = vColor * tex.rgb * (0.75 + 0.55 * vTwinkle);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const fairyLights = new THREE.Points(lightsGeo, lightsMat);
  fairyLights.frustumCulled = false;
  fairyLights.renderOrder = 3;
  group.add(fairyLights);
  disposables.push(lightsGeo, lightsMat);

  // 6. 8,500-Particle Full-Screen Tree Unleash Galaxy Cloud (erupts from tree into full-screen 3D particles)
  const burstCount = 8500;
  const burstPos = new Float32Array(burstCount * 3);
  const burstExplode = new Float32Array(burstCount * 3);
  const burstColors = new Float32Array(burstCount * 3);
  const burstSizes = new Float32Array(burstCount);
  const burstPhases = new Float32Array(burstCount);
  const burstKind = new Float32Array(burstCount); // 0 = crisp jewel dot, 1 = glowing star flare

  const palBurstGold = new THREE.Color('#f4d180');
  const palBurstRuby = new THREE.Color('#c72038');
  const palBurstWine = new THREE.Color('#8c1528');
  const palBurstPine = new THREE.Color('#2c704d');
  const palBurstIvory = new THREE.Color('#fff5d9');

  for (let i = 0; i < burstCount; i++) {
    const hNorm = Math.pow(rand(), 0.82);
    const y = treeBaseY + hNorm * (treeHeight - 0.1);
    const envR = getTreeEnvelopeRadius(hNorm);
    const r = envR * (0.25 + Math.pow(rand(), 0.6) * 0.82);
    const angle = rand() * Math.PI * 2;

    const px = Math.cos(angle) * r;
    const py = y + (rand() - 0.5) * 0.14;
    const pz = Math.sin(angle) * r;

    burstPos[i * 3] = px;
    burstPos[i * 3 + 1] = py;
    burstPos[i * 3 + 2] = pz;

    // Full-screen widescreen 3D explosion target around (0, 3.05, 0) in local treeRootGroup space
    // Note: treeRootGroup scales 3x, so local [-3.2..3.2] horizontally -> world [-9.6..9.6] edge-to-edge!
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const isOuterWide = rand() < 0.68;
    const shellR = isOuterWide ? 1.15 + Math.pow(rand(), 0.72) * 2.15 : 0.18 + rand() * 1.1;

    const targetX = Math.sin(phi) * Math.cos(theta) * shellR * 1.52;
    const targetY = 3.05 + Math.cos(phi) * shellR * 0.88;
    const targetZ = Math.sin(phi) * Math.sin(theta) * shellR * 1.18;

    burstExplode[i * 3] = targetX - px;
    burstExplode[i * 3 + 1] = targetY - py;
    burstExplode[i * 3 + 2] = targetZ - pz;

    const pick = rand();
    if (pick < 0.24) tmpColor.copy(palBurstPine).lerp(palInkGreen, rand() * 0.7);
    else if (pick < 0.44) tmpColor.copy(palBurstRuby).lerp(palBurstWine, rand());
    else if (pick < 0.82) tmpColor.copy(palBurstGold).lerp(palBronzeKiss, rand() * 0.45);
    else tmpColor.copy(palBurstIvory);

    burstColors[i * 3] = tmpColor.r;
    burstColors[i * 3 + 1] = tmpColor.g;
    burstColors[i * 3 + 2] = tmpColor.b;

    const isFlare = rand() > 0.76;
    burstKind[i] = isFlare ? 1.0 : 0.0;
    burstSizes[i] = isFlare ? 0.08 + rand() * 0.13 : 0.042 + rand() * 0.075;
    burstPhases[i] = rand() * Math.PI * 2;
  }

  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  burstGeo.setAttribute('aExplode', new THREE.BufferAttribute(burstExplode, 3));
  burstGeo.setAttribute('aColor', new THREE.BufferAttribute(burstColors, 3));
  burstGeo.setAttribute('aSize', new THREE.BufferAttribute(burstSizes, 1));
  burstGeo.setAttribute('aPhase', new THREE.BufferAttribute(burstPhases, 1));
  burstGeo.setAttribute('aKind', new THREE.BufferAttribute(burstKind, 1));

  const burstMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uUnleash: { value: 0 },
      uPixelRatio: { value: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) },
      uTexture: { value: textures.starSpark },
    },
    vertexShader: `
      attribute vec3 aExplode;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aKind;

      uniform float uTime;
      uniform float uUnleash;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;

      void main() {
        vColor = aColor;
        vKind = aKind;
        float e = clamp(uUnleash, 0.0, 1.0);
        float easeE = 1.0 - (1.0 - e) * (1.0 - e);

        // Swirling vortex rotation around tree axis as particles erupt
        float swirl = easeE * (0.9 + 0.15 * sin(aPhase) + uTime * 0.14 * easeE);
        float cs = cos(swirl);
        float sn = sin(swirl);
        vec3 off = aExplode * easeE;
        vec3 swirled = vec3(
          off.x * cs - off.z * sn,
          off.y + sin(uTime * 1.45 + aPhase) * 0.11 * easeE,
          off.x * sn + off.z * cs
        );

        vec3 pos = position + swirled;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;

        float twinkle = 0.55 + 0.45 * sin(uTime * 2.6 + aPhase * 3.1);
        vAlpha = smoothstep(0.015, 0.22, e) * twinkle;

        float ptSize = aSize * (285.0 / max(-mvPos.z, 0.8)) * uPixelRatio * (0.4 + 1.05 * easeE);
        gl_PointSize = clamp(ptSize, 0.0, 44.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vKind;

      void main() {
        if (vAlpha < 0.01) discard;
        vec2 centered = gl_PointCoord - vec2(0.5);
        float dist = length(centered) * 2.0;

        if (vKind > 0.5) {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          float alpha = tex.a * vAlpha * 0.94;
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vColor * tex.rgb * 1.35, alpha);
        } else {
          // Crisp luminous micro-particle with hot pinpoint core & tight aura
          if (dist > 1.0) discard;
          float core = smoothstep(0.55, 0.05, dist);
          float halo = (1.0 - dist);
          float intensity = core * 0.95 + halo * halo * 0.45;
          float alpha = intensity * vAlpha;
          if (alpha < 0.02) discard;
          vec3 col = mix(vColor, vec3(1.0, 0.96, 0.86), core * 0.48);
          gl_FragColor = vec4(col * 1.25, alpha);
        }
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const burstPoints = new THREE.Points(burstGeo, burstMat);
  burstPoints.frustumCulled = false;
  burstPoints.renderOrder = 6;
  group.add(burstPoints);
  disposables.push(burstGeo, burstMat);

  return {
    group,
    update: (elapsed: number, unleash = 0) => {
      const clampedUnleash = THREE.MathUtils.clamp(unleash, 0, 1);

      lightsMat.uniforms.uTime.value = elapsed;
      lightsMat.uniforms.uUnleash.value = clampedUnleash;
      burstMat.uniforms.uTime.value = elapsed;
      burstMat.uniforms.uUnleash.value = clampedUnleash;

      if (boughMat.userData.shader) {
        boughMat.userData.shader.uniforms.uWindTime.value = elapsed;
      }
      for (const u of explodeUniforms) {
        u.value = clampedUnleash;
      }

      // Shrink/hide solid trunk & inner dark cone as the tree bursts into particles
      const solidCoreScale = Math.max(0.001, 1.0 - clampedUnleash * 2.6);
      trunkMesh.scale.setScalar(solidCoreScale);
      innerCoreMesh.scale.setScalar(solidCoreScale);
      trunkMesh.visible = solidCoreScale > 0.01;
      innerCoreMesh.visible = solidCoreScale > 0.01;

      // Dissolve & scatter velvet bows into the particle storm on unleash
      const easeU = 1.0 - (1.0 - clampedUnleash) * (1.0 - clampedUnleash);
      for (let i = 0; i < bowItems.length; i++) {
        const item = bowItems[i];
        item.group.position.copy(item.basePos).addScaledVector(item.burstDir, easeU * 1.8);
        item.group.rotation.y = item.baseRotY + easeU * 1.4;
        const bowScale = bowSpecs[i].scale * Math.max(0.001, 1.0 - easeU * 1.35);
        item.group.scale.setScalar(bowScale);
        item.group.visible = bowScale > 0.02;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
