import * as THREE from 'three';
import type { SceneTextures } from './textures';

export interface AtmosphericParticlesRig {
  group: THREE.Group;
  update: (elapsed: number, snowDensityMultiplier: number) => void;
  dispose: () => void;
}

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildAtmosphericParticles(
  textures: SceneTextures,
  isSoftwareGl: boolean
): AtmosphericParticlesRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const rand = createSeededRandom(55109);
  const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);

  const sampleSpacePos = (minZ: number, maxZ: number, spreadX = 16, minY = -1.5, maxY = 10.5) => {
    const x = (rand() - 0.5) * spreadX * (0.65 + rand() * 0.55);
    const y = minY + rand() * (maxY - minY);
    const z = minZ + rand() * (maxZ - minZ);
    return [x, y, z] as const;
  };

  // =========================================================================
  // 1. Abundant Multi-Scale Rotating Crystalline Snowflakes (760 flakes!)
  // =========================================================================
  const snowCount = 760;
  const snowPos = new Float32Array(snowCount * 3);
  const snowParams = new Float32Array(snowCount * 4); // speed, size, phase, rotSpeed
  const snowTint = new Float32Array(snowCount);

  for (let i = 0; i < snowCount; i++) {
    const tierRoll = rand();
    let x: number, y: number, z: number, size: number, speed: number;

    if (tierRoll < 0.08) {
      // Hero large foreground/mid crystalline snowflakes (spread away from dead center)
      x = (rand() - 0.5) * 15.0;
      if (Math.abs(x) < 2.1) x += x >= 0 ? 2.2 : -2.2;
      y = -1.0 + rand() * 11.0;
      z = 1.5 + rand() * 4.2;
      size = 0.28 + rand() * 0.22;
      speed = 0.22 + rand() * 0.24;
    } else if (tierRoll < 0.42) {
      // Medium clear snowflakes across entire frame
      [x, y, z] = sampleSpacePos(-7.0, 5.2, 18.0, -1.5, 10.8);
      size = 0.14 + rand() * 0.13;
      speed = 0.25 + rand() * 0.32;
    } else {
      // Fine delicate winter snow flurries filling depth
      [x, y, z] = sampleSpacePos(-12.5, 4.5, 20.0, -1.5, 10.8);
      size = 0.065 + rand() * 0.085;
      speed = 0.28 + rand() * 0.42;
    }

    snowPos[i * 3] = x;
    snowPos[i * 3 + 1] = y;
    snowPos[i * 3 + 2] = z;

    snowParams[i * 4] = speed;
    snowParams[i * 4 + 1] = size;
    snowParams[i * 4 + 2] = rand() * Math.PI * 2;
    snowParams[i * 4 + 3] = (rand() - 0.5) * 0.85;
    snowTint[i] = rand() > 0.78 ? 1.0 : 0.0;
  }

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  snowGeo.setAttribute('aParams', new THREE.BufferAttribute(snowParams, 4));
  snowGeo.setAttribute('aTint', new THREE.BufferAttribute(snowTint, 1));

  const snowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFallScale: { value: 1.0 },
      uPixelRatio: { value: pixelRatio },
      uTexture: { value: textures.snowflake },
    },
    vertexShader: `
      attribute vec4 aParams;
      attribute float aTint;
      uniform float uTime;
      uniform float uFallScale;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vGoldTint;
      varying float vAngle;

      void main() {
        float speed = aParams.x * uFallScale;
        float size = aParams.y;
        float phase = aParams.z;
        float rotSpeed = aParams.w;
        vGoldTint = aTint;
        vAngle = phase + uTime * rotSpeed;

        float heightSpan = 12.3;
        float y = mod(position.y - uTime * speed + 1.5, heightSpan) - 1.5;
        float x = position.x + sin(uTime * 0.52 + phase) * 0.28;
        float z = position.z + cos(uTime * 0.38 + phase * 1.3) * 0.16;

        vAlpha = smoothstep(-1.5, 0.2, y) * smoothstep(10.8, 8.8, y);
        vAlpha *= clamp(0.45 + (z + 12.5) * 0.04, 0.34, 0.94);

        vec4 mvPos = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(size * (340.0 / max(-mvPos.z, 1.2)) * uPixelRatio, 1.5, 76.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      varying float vGoldTint;
      varying float vAngle;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float c = cos(vAngle);
        float s = sin(vAngle);
        vec2 rotated = vec2(
          centered.x * c - centered.y * s,
          centered.x * s + centered.y * c
        ) + 0.5;

        vec4 tex = texture2D(uTexture, rotated);
        float a = tex.a * vAlpha * 0.88;
        if (a < 0.02) discard;
        vec3 warmWhite = vec3(0.99, 0.96, 0.90);
        vec3 paleGold = vec3(0.95, 0.83, 0.58);
        vec3 col = mix(warmWhite, paleGold, vGoldTint);
        gl_FragColor = vec4(tex.rgb * col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.frustumCulled = false;
  snowPoints.renderOrder = 6;
  group.add(snowPoints);
  disposables.push(snowGeo, snowMat);

  // =========================================================================
  // 2. Warm Ivory Square Light Motes (signature sparkling bokeh squares)
  // =========================================================================
  const moteCount = 155;
  const motePos = new Float32Array(moteCount * 3);
  const moteParams = new Float32Array(moteCount * 4);

  for (let i = 0; i < moteCount; i++) {
    const isNear = i < 36;
    let x = (rand() - 0.5) * 16.5;
    const y = -0.8 + rand() * 10.0;
    const z = isNear ? 3.2 + rand() * 3.4 : -9.0 + rand() * 10.0;
    if (isNear && Math.abs(x) < 2.2) {
      x += x >= 0 ? 2.4 : -2.4;
    }

    motePos[i * 3] = x;
    motePos[i * 3 + 1] = y;
    motePos[i * 3 + 2] = z;

    moteParams[i * 4] = 0.1 + rand() * 0.18;
    moteParams[i * 4 + 1] = isNear ? 0.17 + rand() * 0.15 : 0.065 + rand() * 0.11;
    moteParams[i * 4 + 2] = rand() * Math.PI * 2;
    moteParams[i * 4 + 3] = rand();
  }

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('aParams', new THREE.BufferAttribute(moteParams, 4));

  const moteMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFallScale: { value: 1.0 },
      uPixelRatio: { value: pixelRatio },
      uTexture: { value: textures.squareMote },
    },
    vertexShader: `
      attribute vec4 aParams;
      uniform float uTime;
      uniform float uFallScale;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vTint;

      void main() {
        float speed = aParams.x * uFallScale;
        float size = aParams.y;
        float phase = aParams.z;
        vTint = aParams.w;

        float y = mod(position.y - uTime * speed + 0.8, 10.0) - 0.8;
        float x = position.x + sin(uTime * 0.34 + phase) * 0.14;

        float twinkle = 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * 1.35 + phase * 3.1));
        vAlpha = smoothstep(-0.8, 0.5, y) * smoothstep(9.2, 7.8, y) * twinkle * 0.8;

        vec4 mvPos = modelViewMatrix * vec4(x, y, position.z, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(size * (310.0 / max(-mvPos.z, 1.2)) * uPixelRatio, 1.5, 44.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      varying float vTint;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float a = tex.a * vAlpha;
        if (a < 0.02) discard;
        vec3 col = mix(vec3(0.99, 0.96, 0.88), vec3(0.95, 0.82, 0.56), vTint);
        gl_FragColor = vec4(tex.rgb * col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.frustumCulled = false;
  motePoints.renderOrder = 6;
  group.add(motePoints);
  disposables.push(moteGeo, moteMat);

  // =========================================================================
  // 3. Near-field & Deep Space: Soft Depth-of-Field Bokeh Discs
  // =========================================================================
  const bokehCount = 58;
  const bokehPos = new Float32Array(bokehCount * 3);
  const bokehParams = new Float32Array(bokehCount * 4);

  for (let i = 0; i < bokehCount; i++) {
    const isForeground = i < 26;
    let x = (rand() - 0.5) * 16.0;
    const y = -0.3 + rand() * 8.6;
    const z = isForeground ? 3.5 + rand() * 3.4 : -12 + rand() * 5.0;

    if (isForeground && Math.abs(x) < 2.5) {
      x += x >= 0 ? 2.6 : -2.6;
    }

    bokehPos[i * 3] = x;
    bokehPos[i * 3 + 1] = y;
    bokehPos[i * 3 + 2] = z;

    bokehParams[i * 4] = 0.08 + rand() * 0.14;
    bokehParams[i * 4 + 1] = isForeground ? 0.55 + rand() * 0.55 : 0.42 + rand() * 0.42;
    bokehParams[i * 4 + 2] = rand() * Math.PI * 2;
    bokehParams[i * 4 + 3] = rand();
  }

  const bokehGeo = new THREE.BufferGeometry();
  bokehGeo.setAttribute('position', new THREE.BufferAttribute(bokehPos, 3));
  bokehGeo.setAttribute('aParams', new THREE.BufferAttribute(bokehParams, 4));

  const bokehMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFallScale: { value: 1.0 },
      uPixelRatio: { value: pixelRatio },
      uTexture: { value: textures.softBokeh },
    },
    vertexShader: `
      attribute vec4 aParams;
      uniform float uTime;
      uniform float uFallScale;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vWarmth;

      void main() {
        float speed = aParams.x * uFallScale;
        float size = aParams.y;
        float phase = aParams.z;
        vWarmth = aParams.w;

        float y = mod(position.y - uTime * speed + 0.3, 8.9) - 0.3;
        float x = position.x + sin(uTime * 0.24 + phase) * 0.2;

        float breath = 0.52 + 0.48 * sin(uTime * 0.65 + phase);
        vAlpha = smoothstep(-0.3, 0.8, y) * smoothstep(8.6, 7.0, y) * breath * 0.34;

        vec4 mvPos = modelViewMatrix * vec4(x, y, position.z, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(size * (350.0 / max(-mvPos.z, 1.5)) * uPixelRatio, 2.0, 92.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      varying float vWarmth;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float a = tex.a * vAlpha;
        if (a < 0.01) discard;
        vec3 warmGold = mix(vec3(0.95, 0.88, 0.74), vec3(0.78, 0.48, 0.36), vWarmth * 0.35);
        gl_FragColor = vec4(tex.rgb * warmGold, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const bokehPoints = new THREE.Points(bokehGeo, bokehMat);
  bokehPoints.frustumCulled = false;
  bokehPoints.renderOrder = 7;
  group.add(bokehPoints);
  disposables.push(bokehGeo, bokehMat);

  // =========================================================================
  // 4. Far field: Dim fine warm-white starfield in deep obsidian sky
  // =========================================================================
  const starfieldCount = 540;
  const starPos = new Float32Array(starfieldCount * 3);
  const starParams = new Float32Array(starfieldCount * 3);

  for (let i = 0; i < starfieldCount; i++) {
    const [x, y, z] = sampleSpacePos(-22, -5.0, 32, -2, 13);
    starPos[i * 3] = x;
    starPos[i * 3 + 1] = y;
    starPos[i * 3 + 2] = z;

    starParams[i * 3] = 0.045 + rand() * 0.095;
    starParams[i * 3 + 1] = rand() * Math.PI * 2;
    starParams[i * 3 + 2] = rand();
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aParams', new THREE.BufferAttribute(starParams, 3));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uTexture: { value: textures.starSpark },
    },
    vertexShader: `
      attribute vec3 aParams;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vTint;

      void main() {
        float size = aParams.x;
        float phase = aParams.y;
        vTint = aParams.z;

        vAlpha = 0.25 + 0.55 * (0.5 + 0.5 * sin(uTime * 1.0 + phase));
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(size * (240.0 / max(-mvPos.z, 1.5)) * uPixelRatio, 1.0, 22.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      varying float vTint;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float a = tex.a * vAlpha * 0.56;
        if (a < 0.02) discard;
        vec3 col = mix(vec3(0.98, 0.94, 0.86), vec3(0.90, 0.76, 0.52), vTint * 0.45);
        gl_FragColor = vec4(tex.rgb * col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.frustumCulled = false;
  starPoints.renderOrder = 2;
  group.add(starPoints);
  disposables.push(starGeo, starMat);

  // =========================================================================
  // 5. Around the tree: Golden dust drifting slowly around the branches
  // =========================================================================
  const emberCount = 210;
  const emberBase = new Float32Array(emberCount * 4);
  const emberExtras = new Float32Array(emberCount * 3);

  for (let i = 0; i < emberCount; i++) {
    const hNorm = rand();
    const y = 0.3 + hNorm * 5.5;
    const treeR = 2.18 * Math.pow(1 - hNorm * 0.88, 0.85) + 0.28;
    const radius = treeR + rand() * 1.2;

    emberBase[i * 4] = radius;
    emberBase[i * 4 + 1] = y;
    emberBase[i * 4 + 2] = rand() * Math.PI * 2;
    emberBase[i * 4 + 3] = (0.045 + rand() * 0.095) * (rand() > 0.25 ? 1 : -1);

    emberExtras[i * 3] = 0.055 + rand() * 0.085;
    emberExtras[i * 3 + 1] = rand() * Math.PI * 2;
    emberExtras[i * 3 + 2] = rand();
  }

  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(emberCount * 3), 3));
  emberGeo.setAttribute('aBase', new THREE.BufferAttribute(emberBase, 4));
  emberGeo.setAttribute('aExtras', new THREE.BufferAttribute(emberExtras, 3));

  const emberMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uTexture: { value: textures.starSpark },
    },
    vertexShader: `
      attribute vec4 aBase;
      attribute vec3 aExtras;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vHue;

      void main() {
        float r = aBase.x + sin(uTime * 0.45 + aExtras.y) * 0.12;
        float y = aBase.y + sin(uTime * 0.35 + aExtras.y * 1.4) * 0.14;
        float angle = aBase.z + uTime * aBase.w;

        vec3 pos = vec3(cos(angle) * r, y, sin(angle) * r);
        vHue = aExtras.z;
        vAlpha = 0.3 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.5 + aExtras.y * 2.1));

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = clamp(aExtras.x * (260.0 / max(-mvPos.z, 1.0)) * uPixelRatio, 1.0, 28.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      varying float vAlpha;
      varying float vHue;

      void main() {
        vec4 tex = texture2D(uTexture, gl_PointCoord);
        float a = tex.a * vAlpha * 0.65;
        if (a < 0.02) discard;
        vec3 goldDust = mix(vec3(0.92, 0.76, 0.44), vec3(0.98, 0.90, 0.72), vHue);
        gl_FragColor = vec4(tex.rgb * goldDust, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const emberPoints = new THREE.Points(emberGeo, emberMat);
  emberPoints.frustumCulled = false;
  emberPoints.renderOrder = 5;
  group.add(emberPoints);
  disposables.push(emberGeo, emberMat);

  return {
    group,
    update: (elapsed: number, snowDensityMultiplier: number) => {
      snowMat.uniforms.uTime.value = elapsed;
      snowMat.uniforms.uFallScale.value = snowDensityMultiplier;
      moteMat.uniforms.uTime.value = elapsed;
      moteMat.uniforms.uFallScale.value = snowDensityMultiplier;
      bokehMat.uniforms.uTime.value = elapsed;
      bokehMat.uniforms.uFallScale.value = snowDensityMultiplier;
      starMat.uniforms.uTime.value = elapsed;
      emberMat.uniforms.uTime.value = elapsed;

      snowPoints.visible = snowDensityMultiplier > 0.01;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
