import * as THREE from 'three';
import type { SceneTextures } from './textures';
import { getTreeEnvelopeRadius } from './treeBuilder';

export interface GestureBurstParticlesRig {
  group: THREE.Group;
  update: (elapsed: number, delta: number, targetExplode: number) => number;
  dispose: () => void;
}

const PARTICLE_COUNT = 1200;

export function buildGestureBurstParticles(
  textures: SceneTextures,
  isSoftwareGl: boolean
): GestureBurstParticlesRig {
  const group = new THREE.Group();

  const treePositions = new Float32Array(PARTICLE_COUNT * 3);
  const explodePositions = new Float32Array(PARTICLE_COUNT * 3);
  const currentPositions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const phases = new Float32Array(PARTICLE_COUNT);
  const fallSpeeds = new Float32Array(PARTICLE_COUNT);

  let seed = 95271;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Dark Luxury Christmas palette: pine green, black-cherry wine red, champagne gold, warm ivory
  const colDeepGreen = new THREE.Color('#1c5c3d');
  const colEmerald = new THREE.Color('#308556');
  const colWineRed = new THREE.Color('#961b30');
  const colRuby = new THREE.Color('#bd263e');
  const colChampagne = new THREE.Color('#ecc676');
  const colIvory = new THREE.Color('#fff3d4');
  const tmpColor = new THREE.Color();

  const treeBaseY = 0.28;
  const treeTopY = 5.82;
  const treeHeight = treeTopY - treeBaseY;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const role = rand();
    let tx = 0;
    let ty = 0;
    let tz = 0;

    if (role < 0.05) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = Math.pow(rand(), 0.6) * 0.42;
      tx = r * Math.sin(phi) * Math.cos(theta);
      ty = 6.06 + r * Math.cos(phi);
      tz = r * Math.sin(phi) * Math.sin(theta);
      tmpColor.copy(colChampagne).lerp(colIvory, rand() * 0.75);
      sizes[i] = 0.13 + rand() * 0.09;
    } else if (role < 0.18) {
      const t = rand();
      ty = THREE.MathUtils.lerp(5.42, 0.38, t);
      const hNorm = THREE.MathUtils.clamp((ty - 0.24) / (5.75 - 0.24), 0, 1);
      const r = getTreeEnvelopeRadius(hNorm) + 0.04 + (rand() - 0.5) * 0.06;
      const angle = t * 4.65 * Math.PI * 2 - Math.PI * 0.32 + (rand() - 0.5) * 0.12;
      tx = Math.cos(angle) * r;
      tz = Math.sin(angle) * r;
      tmpColor.copy(colChampagne).lerp(colIvory, rand() * 0.45);
      sizes[i] = 0.1 + rand() * 0.07;
    } else {
      const hNorm = Math.pow(rand(), 0.78) * 0.96;
      ty = treeBaseY + hNorm * treeHeight;
      const envR = getTreeEnvelopeRadius(hNorm);
      const radialFrac = 0.35 + Math.pow(rand(), 0.45) * 0.68;
      const r = envR * radialFrac;
      const angle = rand() * Math.PI * 2;
      tx = Math.cos(angle) * r;
      tz = Math.sin(angle) * r;

      const palettePick = rand();
      if (palettePick < 0.46) {
        tmpColor.copy(colDeepGreen).lerp(colEmerald, rand() * 0.8);
      } else if (palettePick < 0.74) {
        tmpColor.copy(colWineRed).lerp(colRuby, rand() * 0.65);
      } else if (palettePick < 0.92) {
        tmpColor.copy(colChampagne);
      } else {
        tmpColor.copy(colIvory);
      }
      sizes[i] = 0.09 + rand() * 0.08;
    }

    treePositions[i * 3] = tx;
    treePositions[i * 3 + 1] = ty;
    treePositions[i * 3 + 2] = tz;

    currentPositions[i * 3] = tx;
    currentPositions[i * 3 + 1] = ty;
    currentPositions[i * 3 + 2] = tz;

    // In-place spherical explosion wrapping directly around the tree (strictly Z-clamped so particles stay in camera view)
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const shellRadius = 1.45 + Math.pow(rand(), 0.72) * 2.25; // 1.45 ~ 3.70 around the tree

    const dx = Math.sin(phi) * Math.cos(theta) * shellRadius * 1.15;
    const dy = Math.cos(phi) * shellRadius * 0.82;
    // Limit Z spread tightly (0.52x) so particles never rush into the camera or vanish into deep Z
    const dz = Math.sin(phi) * Math.sin(theta) * shellRadius * 0.52;

    explodePositions[i * 3] = THREE.MathUtils.clamp(tx * 0.35 + dx, -3.9, 3.9);
    explodePositions[i * 3 + 1] = THREE.MathUtils.clamp(2.95 + dy, 0.45, 5.75);
    explodePositions[i * 3 + 2] = THREE.MathUtils.clamp(tz * 0.35 + dz, -2.1, 2.1);

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;

    phases[i] = rand() * Math.PI * 2;
    fallSpeeds[i] = 0.08 + rand() * 0.14;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(currentPositions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uExplode: { value: 0 },
      uPixelRatio: { value: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) },
      uTexture: { value: textures.starSpark },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;

      uniform float uTime;
      uniform float uExplode;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = aColor;
        float twinkle = 0.6 + 0.4 * sin(uTime * 2.1 + aPhase);
        vAlpha = mix(0.32, 0.96, uExplode) * twinkle;

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;

        float sizeBoost = mix(0.85, 1.48, uExplode);
        float ptSize = aSize * sizeBoost * (255.0 / max(-mvPos.z, 1.0)) * uPixelRatio;
        gl_PointSize = clamp(ptSize, 2.0, 38.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float alpha = tex.a * vAlpha;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(vColor * tex.rgb * 1.18, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  group.add(points);

  let currentExplode = 0;
  let burstElapsed = 0;
  let lastTarget = 0;

  return {
    group,
    update: (elapsed: number, delta: number, targetExplode: number) => {
      const dt = Math.min(delta, 0.05);

      if (targetExplode > 0.5 && lastTarget <= 0.5) {
        burstElapsed = 0;
        // Inject an outward initial radial kick that rapidly decelerates via damping
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          velocities[i3] = (explodePositions[i3] - currentPositions[i3]) * 3.6;
          velocities[i3 + 1] = (explodePositions[i3 + 1] - currentPositions[i3 + 1]) * 3.6;
          velocities[i3 + 2] = (explodePositions[i3 + 2] - currentPositions[i3 + 2]) * 3.2;
        }
      }
      lastTarget = targetExplode;

      const smoothAlpha = 1 - Math.exp(-3.8 * dt);
      currentExplode = THREE.MathUtils.lerp(currentExplode, targetExplode, smoothAlpha);

      const posArr = posAttr.array as Float32Array;

      if (targetExplode > 0.5) {
        burstElapsed += dt;
        // Strong velocity damping so particles pop outward in place, decelerate smoothly, and hover/slowly drift
        const velDamping = Math.exp(-4.2 * dt);
        const gentleFallOffset = Math.min(0.45, burstElapsed * 0.045);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          velocities[i3] *= velDamping;
          velocities[i3 + 1] *= velDamping;
          velocities[i3 + 2] *= velDamping;

          const floatX = Math.sin(elapsed * 0.85 + phases[i]) * 0.14;
          const floatY =
            Math.cos(elapsed * 0.72 + phases[i]) * 0.12 - gentleFallOffset * fallSpeeds[i] * 6.0;
          const floatZ = Math.cos(elapsed * 0.65 + phases[i]) * 0.08;

          const goalX = explodePositions[i3] + floatX;
          const goalY = Math.max(0.32, explodePositions[i3 + 1] + floatY);
          const goalZ = THREE.MathUtils.clamp(explodePositions[i3 + 2] + floatZ, -2.2, 2.2);

          posArr[i3] += velocities[i3] * dt;
          posArr[i3 + 1] += velocities[i3 + 1] * dt;
          posArr[i3 + 2] += velocities[i3 + 2] * dt;

          const settle = 1 - Math.exp(-2.2 * dt);
          posArr[i3] = THREE.MathUtils.lerp(posArr[i3], goalX, settle);
          posArr[i3 + 1] = THREE.MathUtils.lerp(posArr[i3 + 1], goalY, settle);
          posArr[i3 + 2] = THREE.MathUtils.lerp(posArr[i3 + 2], goalZ, settle);
        }
      } else {
        // Smoothly pull particles back to the tree silhouette
        const gatherLerp = 1 - Math.exp(-4.5 * dt);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          velocities[i3] = 0;
          velocities[i3 + 1] = 0;
          velocities[i3 + 2] = 0;

          posArr[i3] = THREE.MathUtils.lerp(posArr[i3], treePositions[i3], gatherLerp);
          posArr[i3 + 1] = THREE.MathUtils.lerp(posArr[i3 + 1], treePositions[i3 + 1], gatherLerp);
          posArr[i3 + 2] = THREE.MathUtils.lerp(posArr[i3 + 2], treePositions[i3 + 2], gatherLerp);
        }
      }

      posAttr.needsUpdate = true;
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uExplode.value = currentExplode;
      return currentExplode;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
