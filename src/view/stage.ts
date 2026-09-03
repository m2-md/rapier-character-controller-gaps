// view/stage.ts — cinematic scene setup (dark cinematic + neon glow).
// PRESENTATION only: renderer/tone mapping, PBR environment (RoomEnvironment),
// shadow-casting lights, ground and neon PBR materials. Physics/probes untouched.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Neon accent palette (the article's visual spec).
export const ACCENT = {
  cyan: 0x22d3ee,
  violet: 0xa78bfa,
  magenta: 0xf472b6,
  success: 0x34d399,
  warning: 0xfbbf24,
} as const;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  key: THREE.DirectionalLight;
}

// Deep radial gradient background — the same tones as the CSS palette.
// It lives as an in-scene texture so the fog dissolves the ground toward this tone.
function makeBackgroundTexture(): THREE.Texture {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size * 0.14,
    size * 0.04,
    size / 2,
    size * 0.14,
    size * 1.15,
  );
  g.addColorStop(0.0, "#10141f");
  g.addColorStop(0.6, "#080a11");
  g.addColorStop(1.0, "#05060b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = makeBackgroundTexture();
  scene.fog = new THREE.FogExp2(0x080a11, 0.02);

  // Embedded RoomEnvironment → PMREM for PBR reflections (NO external HDRI).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
  roomEnv.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    400,
  );
  camera.position.set(0, 7, 12);

  // Directional key light — casts a soft shadow, slightly warm tone.
  const key = new THREE.DirectionalLight(0xfff1de, 2.6);
  key.position.set(9, 17, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  const span = 28;
  key.shadow.camera.left = -span;
  key.shadow.camera.right = span;
  key.shadow.camera.top = span;
  key.shadow.camera.bottom = -span;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);
  scene.add(key.target);

  // Hemisphere fill — blue from the sky, dark fill from the ground.
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x0a0c16, 0.55));

  // Colored rim lights — cinematic neon edge (cyan + violet).
  const rimCyan = new THREE.DirectionalLight(ACCENT.cyan, 1.4);
  rimCyan.position.set(-13, 5, -10);
  scene.add(rimCyan);
  const rimViolet = new THREE.DirectionalLight(ACCENT.violet, 0.9);
  rimViolet.position.set(11, 3, -13);
  scene.add(rimViolet);

  return { renderer, scene, camera, key };
}

// Wide ground: receives shadows, dissolves into darkness outward via fog. A
// fading neon grid on top of it.
export function createGround(scene: THREE.Scene): void {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshStandardMaterial({
      color: 0x0a0e18,
      roughness: 0.88,
      metalness: 0.2,
      envMapIntensity: 0.5,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.1;
  plane.receiveShadow = true;
  scene.add(plane);

  const grid = new THREE.GridHelper(140, 140, 0x2b3a5e, 0x141c30);
  grid.position.y = 0.102;
  const gm = grid.material as THREE.Material;
  gm.transparent = true;
  gm.opacity = 0.45;
  grid.renderOrder = 1;
  scene.add(grid);
}

// --- Neon PBR material factories (visual only) ---

export function rampMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.22,
    metalness: 0.3,
    roughness: 0.32,
    envMapIntensity: 1.1,
  });
}

export function stairMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x0f766e,
    emissive: ACCENT.cyan,
    emissiveIntensity: 0.12,
    metalness: 0.35,
    roughness: 0.4,
    envMapIntensity: 1.0,
  });
}

export function dynamicBoxMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.15,
    metalness: 0.25,
    roughness: 0.38,
    envMapIntensity: 1.1,
  });
}

export function characterMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: ACCENT.cyan,
    emissive: ACCENT.cyan,
    emissiveIntensity: 0.45,
    metalness: 0.4,
    roughness: 0.28,
    envMapIntensity: 1.3,
  });
}
