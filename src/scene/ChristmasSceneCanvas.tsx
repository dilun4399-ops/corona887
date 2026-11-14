import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSceneTextures } from './textures';
import { buildChristmasTree } from './treeBuilder';
import { buildSpiralRibbon } from './spiralRibbon';
import { buildStarAndGifts } from './starAndGifts';
import { buildAtmosphericParticles } from './particles';
import type { HandTrackingState } from '../hooks/useHandTracking';

export type SnowMode = 'gentle' | 'rich' | 'off';
export type RibbonMode = 'calm' | 'radiant';

export interface SceneSettings {
  autoDrift: boolean;
  snowMode: SnowMode;
  ribbonMode: RibbonMode;
  resetCounter: number;
}

interface ChristmasSceneCanvasProps {
  settings: SceneSettings;
  handStateRef: MutableRefObject<HandTrackingState>;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createBackdropDome(): {
  mesh: THREE.Mesh;
  dispose: () => void;
} {
  const geo = new THREE.SphereGeometry(42, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocalPos;
      void main() {
        // True deep obsidian black sky with only a whisper of dark crimson near the lower horizon
        float centerGlow = clamp(1.0 - abs(vLocalPos.y + 0.05) * 1.9, 0.0, 1.0);
        float glow = centerGlow * centerGlow * centerGlow;
        vec3 deepObsidian = vec3(0.0035, 0.0028, 0.0035);
        vec3 subtleCrimson = vec3(0.020, 0.004, 0.007);
        vec3 col = mix(deepObsidian, subtleCrimson, glow * 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 3.0, 0);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

const _homePos = new THREE.Vector3();
const _homeTarget = new THREE.Vector3(0, 3.05, 0);
const _raycaster = new THREE.Raycaster();
const _ndcPointer = new THREE.Vector2();

function computeHomeDistance(aspect: number): number {
  // Keep full tree, circular rug, gift boxes, and top title breathing room well-framed
  if (aspect >= 1.45) return 10.8;
  if (aspect >= 1.0) return 11.8;
  return 14.4;
}

export function ChristmasSceneCanvas({ settings, handStateRef }: ChristmasSceneCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<SceneSettings>(settings);
  const resetAnimRef = useRef<boolean>(false);
  const lastResetCountRef = useRef<number>(settings.resetCounter);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    settingsRef.current = settings;
    if (settings.resetCounter !== lastResetCountRef.current) {
      lastResetCountRef.current = settings.resetCounter;
      resetAnimRef.current = true;
    }
  }, [settings]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(height, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvasEl = renderer.domElement;
    canvasEl.style.display = 'block';
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    container.appendChild(canvasEl);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost);
    canvasEl.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030203);
    scene.fog = new THREE.FogExp2(0x030203, 0.014);

    // Studio environment reflection map via RoomEnvironment on all devices
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.62;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    const homeDist = computeHomeDistance(aspect);
    camera.position.set(0, 3.25, homeDist);

    const controls = new OrbitControls(camera, canvasEl);
    controls.target.copy(_homeTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.minDistance = 4.0;
    controls.maxDistance = 18.0;
    // Keep camera strictly level so the tree never tilts or leans when dragging horizontally
    const levelPolarAngle = Math.PI * 0.492;
    controls.minPolarAngle = levelPolarAngle;
    controls.maxPolarAngle = levelPolarAngle;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.85;
    controls.update();

    let isUserInteracting = false;
    const onControlStart = () => {
      isUserInteracting = true;
      resetAnimRef.current = false;
    };
    const onControlEnd = () => {
      isUserInteracting = false;
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    // 360-degree true obsidian atmospheric sky dome
    const backdropDome = createBackdropDome();
    scene.add(backdropDome.mesh);

    // 3-Point Warm/Cool Studio Lighting Rig tuned so dense tree foliage & ornaments pop cleanly
    const hemiLight = new THREE.HemisphereLight(0x313c54, 0x1a0609, 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe4bd, 2.95);
    keyLight.position.set(4.5, 7.8, 5.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -4.2;
    keyLight.shadow.camera.right = 4.2;
    keyLight.shadow.camera.top = 7.2;
    keyLight.shadow.camera.bottom = -1.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    // Warm crimson-amber rim backlight for mysterious edge silhouette
    const rimLight = new THREE.DirectionalLight(0xc23442, 2.1);
    rimLight.position.set(-4.2, 4.5, -5.0);
    scene.add(rimLight);

    // Soft warm front-right fill to reveal overlapping pine boughs, bows, and ornaments
    const warmFill = new THREE.PointLight(0xeac37a, 3.2, 16, 1.4);
    warmFill.position.set(2.3, 2.4, 4.8);
    scene.add(warmFill);

    // Subtle deep crimson fill from left
    const wineFill = new THREE.PointLight(0x941a2c, 2.1, 14, 1.5);
    wineFill.position.set(-3.4, 2.8, 3.4);
    scene.add(wineFill);

    // Balanced back-side warm fill so every 360-degree face looks equally luminous when rotated
    const backWarmFill = new THREE.PointLight(0xe0b56d, 2.4, 15, 1.4);
    backWarmFill.position.set(-2.2, 3.1, -4.8);
    scene.add(backWarmFill);

    const backWineFill = new THREE.PointLight(0xa31f33, 1.9, 14, 1.5);
    backWineFill.position.set(3.4, 2.6, -3.6);
    scene.add(backWineFill);

    // Build modular 3D scene rigs
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures = createSceneTextures(maxAnisotropy);
    const treeRig = buildChristmasTree(textures, isSoftwareGl);
    const ribbonRig = buildSpiralRibbon(textures, isSoftwareGl);
    const starAndGiftsRig = buildStarAndGifts(textures, isSoftwareGl);
    const particlesRig = buildAtmosphericParticles(textures, isSoftwareGl);

    // Root tree group centered at visual mid-height (y = 3.05) so 3x gesture scaling explodes symmetrically
    const treeRootGroup = new THREE.Group();
    treeRootGroup.position.set(0, 3.05, 0);

    const heroGroup = new THREE.Group();
    heroGroup.position.set(0, -3.05, 0);
    heroGroup.add(treeRig.group);
    heroGroup.add(ribbonRig.group);
    heroGroup.add(starAndGiftsRig.group);
    treeRootGroup.add(heroGroup);

    // Invisible simplified raycast cone covering the tree & star for crisp click-to-explode detection
    const hitConeGeo = new THREE.ConeGeometry(2.35, 6.5, 12);
    hitConeGeo.translate(0, 3.25, 0);
    const hitConeMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    });
    const treeHitCone = new THREE.Mesh(hitConeGeo, hitConeMat);
    treeHitCone.renderOrder = -100;
    heroGroup.add(treeHitCone);

    scene.add(treeRootGroup);
    scene.add(particlesRig.group);

    // Post-processing composer on hardware GPU (subtle bloom on star & highlights so tree stays dominant)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.24, 0.44, 0.85);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    // Smooth mouse parallax + click-to-explode / click-to-collapse tracking
    const pointer = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
    let pointerDownPos: { x: number; y: number } | null = null;
    let unleashActive = false;
    let prevGestureOpen = false;

    const updateCanvasCursor = (clientX: number, clientY: number) => {
      if (isUserInteracting) {
        canvasEl.style.cursor = 'grabbing';
        return;
      }
      if (unleashActive) {
        canvasEl.style.cursor = 'pointer';
        return;
      }
      const rect = canvasEl.getBoundingClientRect();
      _ndcPointer.set(
        ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      );
      _raycaster.setFromCamera(_ndcPointer, camera);
      const hits = _raycaster.intersectObject(treeHitCone, false);
      canvasEl.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      pointer.y = -(e.clientY / Math.max(window.innerHeight, 1)) * 2 + 1;
      if (e.target === canvasEl) {
        updateCanvasCursor(e.clientX, e.clientY);
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        canvasEl.style.cursor = 'grabbing';
      }
    };

    const onCanvasPointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || !pointerDownPos) return;
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;

      // Only treat short clicks (< 6px drag) as explode/collapse toggles; drags rotate via OrbitControls
      if (moveDist < 6) {
        if (unleashActive) {
          unleashActive = false;
        } else {
          const rect = canvasEl.getBoundingClientRect();
          _ndcPointer.set(
            ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
            -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
          );
          _raycaster.setFromCamera(_ndcPointer, camera);
          const hits = _raycaster.intersectObject(treeHitCone, false);
          if (hits.length > 0) {
            unleashActive = true;
          }
        }
      }
      updateCanvasCursor(e.clientX, e.clientY);
    };

    canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
    canvasEl.addEventListener('pointerup', onCanvasPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const asp = w / Math.max(h, 1);

      camera.aspect = asp;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      if (composer && bloomPass) {
        composer.setSize(w, h);
        bloomPass.resolution.set(w, h);
      }
    };
    window.addEventListener('resize', onResize);

    // Animation loop with software WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let driftAngle = 0;
    let scaleFactor = 1.0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const currentSettings = settingsRef.current;

      // Damped mouse parallax
      pointer.smoothX = THREE.MathUtils.damp(pointer.smoothX, pointer.x, 3.2, delta);
      pointer.smoothY = THREE.MathUtils.damp(pointer.smoothY, pointer.y, 3.2, delta);

      // Hand gesture + mouse-click scaling: OPEN or clicked -> 3x unleash explosion, CLOSED / re-clicked -> 1x tree
      const hand = handStateRef.current;
      const isGestureOpen = hand.active && hand.handDetected && hand.isHandOpen;
      if (isGestureOpen !== prevGestureOpen) {
        prevGestureOpen = isGestureOpen;
        unleashActive = isGestureOpen;
      }
      if (resetAnimRef.current) {
        unleashActive = false;
      }
      const targetScale = unleashActive ? 3.0 : 1.0;
      scaleFactor += (targetScale - scaleFactor) * 0.1;
      treeRootGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // Strictly horizontal Y-axis rotation (no tilting/pitching in X/Z)
      treeRootGroup.rotation.x = 0;
      treeRootGroup.rotation.z = 0;

      if (resetAnimRef.current) {
        const curAsp = camera.aspect || 1;
        const targetDist = computeHomeDistance(curAsp);
        _homePos.set(0, 3.25, targetDist);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _homePos.x, 4.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _homePos.y, 4.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _homePos.z, 4.5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _homeTarget.x, 4.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _homeTarget.y, 4.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _homeTarget.z, 4.5, delta);

        if (camera.position.distanceTo(_homePos) < 0.03) {
          resetAnimRef.current = false;
        }
      } else if (hand.active && hand.handDetected) {
        // Hand movement controls left/right horizontal rotation only
        const targetRotY = hand.handX * Math.PI;
        treeRootGroup.rotation.y = THREE.MathUtils.damp(treeRootGroup.rotation.y, targetRotY, 4.2, delta);
        treeRootGroup.position.y = THREE.MathUtils.damp(treeRootGroup.position.y, 3.05, 3.0, delta);
      } else if (currentSettings.autoDrift && !isUserInteracting) {
        driftAngle += delta * 0.14;
        const targetRotY = Math.sin(driftAngle) * 0.35 + pointer.smoothX * 0.09;
        treeRootGroup.rotation.y = THREE.MathUtils.damp(treeRootGroup.rotation.y, targetRotY, 2.5, delta);
        treeRootGroup.position.y = THREE.MathUtils.damp(treeRootGroup.position.y, 3.05, 2.5, delta);
      } else {
        treeRootGroup.rotation.y = THREE.MathUtils.damp(
          treeRootGroup.rotation.y,
          pointer.smoothX * 0.09,
          3.0,
          delta
        );
        treeRootGroup.position.y = THREE.MathUtils.damp(treeRootGroup.position.y, 3.05, 2.5, delta);
      }

      const snowMult =
        currentSettings.snowMode === 'rich'
          ? 1.35
          : currentSettings.snowMode === 'gentle'
            ? 0.88
            : 0;
      const ribbonFlow = currentSettings.ribbonMode === 'radiant' ? 1.45 : 0.85;

      const unleash = THREE.MathUtils.clamp((scaleFactor - 1.0) / 2.0, 0, 1);
      treeRig.update(elapsed, unleash);
      ribbonRig.update(elapsed, ribbonFlow, unleash);
      starAndGiftsRig.update(elapsed, unleash);
      particlesRig.update(elapsed, snowMult);

      controls.update();

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      canvasEl.removeEventListener('pointerdown', onCanvasPointerDown);
      canvasEl.removeEventListener('pointerup', onCanvasPointerUp);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      hitConeGeo.dispose();
      hitConeMat.dispose();
      treeRig.dispose();
      ribbonRig.dispose();
      starAndGiftsRig.dispose();
      particlesRig.dispose();
      textures.dispose();
      backdropDome.dispose();
      envTarget.dispose();
      if (composer) composer.dispose();
      renderer.dispose();

      if (canvasEl.parentNode === container) {
        container.removeChild(canvasEl);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full scene-backdrop overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060203]/90 text-[#f3dfb0] text-sm tracking-wide">
          Restoring 3D atmosphere...
        </div>
      )}
    </div>
  );
}
