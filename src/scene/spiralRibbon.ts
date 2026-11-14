import * as THREE from 'three';
import type { SceneTextures } from './textures';
import { getTreeEnvelopeRadius } from './treeBuilder';

export interface SpiralRibbonRig {
  group: THREE.Group;
  update: (elapsed: number, flowMultiplier: number, unleash?: number) => void;
  dispose: () => void;
}

export function buildSpiralRibbon(
  textures: SceneTextures,
  isSoftwareGl: boolean
): SpiralRibbonRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Continuous 3D spiral hugging the tree's outer branch tips, tapering off at lower boughs (no base ring)
  const curvePoints: THREE.Vector3[] = [];
  const spiralSamples = 260;
  const turns = 4.65;
  const startY = 5.42;
  const endTreeY = 0.36;

  for (let i = 0; i <= spiralSamples; i++) {
    const t = i / spiralSamples; // 0 = top, 1 = bottom of tree
    const y = THREE.MathUtils.lerp(startY, endTreeY, t);
    const hNorm = THREE.MathUtils.clamp((y - 0.24) / (5.75 - 0.24), 0, 1);

    const envelopeR = getTreeEnvelopeRadius(hNorm);
    const radius = envelopeR + 0.03 + 0.02 * Math.sin(t * Math.PI * 5);
    const angle = t * turns * Math.PI * 2 - Math.PI * 0.32;

    curvePoints.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
  }

  const spiralCurve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal', 0.45);

  // 1. Refined, slender champagne-gold filament (0.022 radius, soft luminosity)
  const coreGeo = new THREE.TubeGeometry(spiralCurve, 420, 0.022, 8, false);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: 1.0 },
      uUnleash: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec3 n = normalMatrix * normal;
        vNormal = length(n) > 0.0001 ? normalize(n) : vec3(0.0, 1.0, 0.0);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = length(mvPos.xyz) > 0.0001 ? normalize(-mvPos.xyz) : vec3(0.0, 0.0, 1.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform float uUnleash;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        float fadeOut = 1.0 - smoothstep(0.04, 0.45, uUnleash);
        if (fadeOut < 0.01) discard;

        float t = vUv.x;
        float s1 = clamp(0.5 + 0.5 * sin(t * 22.0 - uTime * 1.8 * uFlowSpeed), 0.0, 1.0);
        float s2 = clamp(0.5 + 0.5 * sin(t * 9.0 - uTime * 1.0 * uFlowSpeed + 1.4), 0.0, 1.0);
        float pulse1 = s1 * s1 * s1;
        float pulse2 = s2 * s2;
        float flow = 0.5 + 0.5 * (pulse1 * 0.65 + pulse2 * 0.35);

        float endFade = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.90, t);
        float facing = clamp(abs(dot(vNormal, vViewDir)), 0.3, 1.0);

        vec3 mutedChampagne = vec3(0.76, 0.58, 0.28);
        vec3 warmGold = vec3(0.96, 0.85, 0.62);
        vec3 col = mix(mutedChampagne, warmGold, clamp(facing * flow, 0.0, 1.0));
        // Gentle restrained glow so the Christmas tree itself remains the hero
        col *= (0.58 + 0.28 * pulse1);

        gl_FragColor = vec4(col, endFade * 0.72 * fadeOut);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.frustumCulled = false;
  coreMesh.renderOrder = 4;
  group.add(coreMesh);
  disposables.push(coreGeo, coreMat);

  // 2. Delicate soft outer glow sheath (subtle, never overpowering)
  const auraGeo = new THREE.TubeGeometry(spiralCurve, 320, 0.062, 8, false);
  const auraMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: 1.0 },
      uUnleash: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec3 n = normalMatrix * normal;
        vNormal = length(n) > 0.0001 ? normalize(n) : vec3(0.0, 1.0, 0.0);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = length(mvPos.xyz) > 0.0001 ? normalize(-mvPos.xyz) : vec3(0.0, 0.0, 1.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFlowSpeed;
      uniform float uUnleash;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        float fadeOut = 1.0 - smoothstep(0.04, 0.45, uUnleash);
        if (fadeOut < 0.01) discard;

        float t = vUv.x;
        float pulse = 0.65 + 0.35 * sin(t * 22.0 - uTime * 1.8 * uFlowSpeed);
        float endFade = smoothstep(0.0, 0.045, t) * smoothstep(1.0, 0.90, t);
        float d = clamp(abs(dot(vNormal, vViewDir)), 0.0, 1.0);
        float edge = d * d;

        vec3 glowCol = vec3(0.84, 0.64, 0.32);
        gl_FragColor = vec4(glowCol * pulse, edge * endFade * 0.09 * fadeOut);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  auraMesh.frustumCulled = false;
  auraMesh.renderOrder = 4;
  group.add(auraMesh);
  disposables.push(auraGeo, auraMat);

  // 3. Fine delicate golden micro-sparks drifting off the ribbon (burst full-screen on unleash)
  const sparkCount = 2200;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkExplodes = new Float32Array(sparkCount * 3);
  const sparkProgress = new Float32Array(sparkCount);
  const sparkPhases = new Float32Array(sparkCount);
  const sparkSizes = new Float32Array(sparkCount);
  const sparkOffsets = new Float32Array(sparkCount * 3);

  let seed = 8817;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const samplePt = new THREE.Vector3();
  for (let i = 0; i < sparkCount; i++) {
    const u = Math.pow(rand(), 0.94) * 0.94 + 0.03;
    spiralCurve.getPointAt(u, samplePt);

    const spread = 0.02 + rand() * 0.11;
    const theta = rand() * Math.PI * 2;
    const oy = (rand() - 0.35) * 0.09;

    const sx = samplePt.x + Math.cos(theta) * spread;
    const sy = samplePt.y + oy;
    const sz = samplePt.z + Math.sin(theta) * spread;

    sparkPositions[i * 3] = sx;
    sparkPositions[i * 3 + 1] = sy;
    sparkPositions[i * 3 + 2] = sz;

    const bTheta = rand() * Math.PI * 2;
    const bPhi = Math.acos(2 * rand() - 1);
    const shellR = 0.75 + Math.pow(rand(), 0.7) * 2.45;
    const targetX = Math.sin(bPhi) * Math.cos(bTheta) * shellR * 1.5;
    const targetY = 3.05 + Math.cos(bPhi) * shellR * 0.92;
    const targetZ = Math.sin(bPhi) * Math.sin(bTheta) * shellR * 1.18;

    sparkExplodes[i * 3] = targetX - sx;
    sparkExplodes[i * 3 + 1] = targetY - sy;
    sparkExplodes[i * 3 + 2] = targetZ - sz;

    sparkOffsets[i * 3] = (rand() - 0.5) * 0.045;
    sparkOffsets[i * 3 + 1] = 0.015 + rand() * 0.05;
    sparkOffsets[i * 3 + 2] = (rand() - 0.5) * 0.045;

    sparkProgress[i] = u;
    sparkPhases[i] = rand() * Math.PI * 2;
    sparkSizes[i] = 0.034 + rand() * 0.072;
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('aExplode', new THREE.BufferAttribute(sparkExplodes, 3));
  sparkGeo.setAttribute('aOffset', new THREE.BufferAttribute(sparkOffsets, 3));
  sparkGeo.setAttribute('aProgress', new THREE.BufferAttribute(sparkProgress, 1));
  sparkGeo.setAttribute('aPhase', new THREE.BufferAttribute(sparkPhases, 1));
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1));

  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlowSpeed: { value: 1.0 },
      uUnleash: { value: 0 },
      uPixelRatio: { value: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) },
      uTexture: { value: textures.starSpark },
    },
    vertexShader: `
      attribute vec3 aExplode;
      attribute vec3 aOffset;
      attribute float aProgress;
      attribute float aPhase;
      attribute float aSize;

      uniform float uTime;
      uniform float uFlowSpeed;
      uniform float uUnleash;
      uniform float uPixelRatio;

      varying float vIntensity;
      varying float vUnleash;

      void main() {
        float e = clamp(uUnleash, 0.0, 1.0);
        float easeE = 1.0 - (1.0 - e) * (1.0 - e);
        vUnleash = easeE;

        float swirl = easeE * (0.85 + uTime * 0.16 * easeE);
        float cs = cos(swirl);
        float sn = sin(swirl);
        vec3 off = aExplode * easeE;
        vec3 swirled = vec3(
          off.x * cs - off.z * sn,
          off.y + sin(uTime * 1.4 + aPhase) * 0.1 * easeE,
          off.x * sn + off.z * cs
        );

        float drift = sin(uTime * 0.9 + aPhase);
        vec3 pos = position + aOffset * drift + swirled;

        float wave = clamp(0.5 + 0.5 * sin(aProgress * 22.0 - uTime * 1.8 * uFlowSpeed), 0.0, 1.0);
        float twinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.1 + aPhase * 2.3));
        vIntensity = (0.3 + 0.7 * (wave * wave)) * twinkle;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        float ptSize = aSize * (250.0 / max(-mvPos.z, 0.8)) * uPixelRatio * (0.75 + 0.35 * vIntensity) * (1.0 + 0.95 * easeE);
        gl_PointSize = clamp(ptSize, 1.0, 34.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vIntensity;
      varying float vUnleash;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float baseVis = 0.44 + 0.52 * vUnleash;
        float alpha = tex.a * vIntensity * baseVis;
        if (alpha < 0.02) discard;
        vec3 goldCol = mix(vec3(0.82, 0.62, 0.30), vec3(0.98, 0.88, 0.68), vIntensity);
        gl_FragColor = vec4(goldCol * tex.rgb, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  sparkPoints.renderOrder = 5;
  group.add(sparkPoints);
  disposables.push(sparkGeo, sparkMat);

  return {
    group,
    update: (elapsed: number, flowMultiplier: number, unleash = 0) => {
      const clampedUnleash = THREE.MathUtils.clamp(unleash, 0, 1);
      coreMat.uniforms.uTime.value = elapsed;
      coreMat.uniforms.uFlowSpeed.value = flowMultiplier;
      coreMat.uniforms.uUnleash.value = clampedUnleash;
      auraMat.uniforms.uTime.value = elapsed;
      auraMat.uniforms.uFlowSpeed.value = flowMultiplier;
      auraMat.uniforms.uUnleash.value = clampedUnleash;
      sparkMat.uniforms.uTime.value = elapsed;
      sparkMat.uniforms.uFlowSpeed.value = flowMultiplier;
      sparkMat.uniforms.uUnleash.value = clampedUnleash;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
