// main.ts — üçüncü şahıs kapsül karakter: yürür, zıplar, rampa tırmanır,
// merdiven çıkar, kutu iter. Hareket katmanı CharacterMover'da; burada sadece
// three.js görselleştirme + input + teşhis HUD'u var.
//
// Sunum katmanı "dark cinematic + neon glow": ACES tone mapping, RoomEnvironment
// PBR, gölge atan ışıklar ve UnrealBloomPass (bkz. src/view/*). Fizik/probe
// sayısal davranışı (eğim tablosu, 0-vs-6 basamak, determinizm) DEĞİŞMEDİ —
// sadece nasıl çizildikleri güzelleştirildi.
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { CharacterMover, type MoveInput } from "./character-mover";
import {
  ACCENT,
  createGround,
  createStage,
  characterMaterial,
  dynamicBoxMaterial,
  rampMaterial,
  stairMaterial,
} from "./view/stage";
import { createPostFx } from "./view/postfx";
import { Hud } from "./view/hud";

const DEG = Math.PI / 180;

await RAPIER.init();

// ---------- three.js sinematik sahne ----------
const canvas = document.getElementById("scene") as HTMLCanvasElement;
const stage = createStage(canvas);
const { renderer, scene, camera, key } = stage;
createGround(scene);

const postfx = createPostFx(renderer, scene, camera);

// ---------- Rapier dünya ----------
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

interface Dynamic {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  mass: number;
}
const dynamics: Dynamic[] = [];

function zQuat(angleRad: number): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  return { x: 0, y: 0, z: Math.sin(angleRad / 2), w: Math.cos(angleRad / 2) };
}

function addFixedBox(
  hx: number,
  hy: number,
  hz: number,
  pos: [number, number, number],
  material: THREE.Material,
  rot?: { x: number; y: number; z: number; w: number },
): void {
  const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(...pos);
  const body = world.createRigidBody(desc);
  let cdesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
  if (rot) cdesc = cdesc.setRotation(rot);
  world.createCollider(cdesc, body);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(...pos);
  if (rot) mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  scene.add(mesh);
}

function addDynamicBox(
  half: number,
  pos: [number, number, number],
  color: number,
): void {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(...pos),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(half, half, half).setDensity(1.0),
    body,
  );
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(half * 2, half * 2, half * 2),
    dynamicBoxMaterial(color),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  dynamics.push({ body, mesh, mass: body.mass() });
}

// Zemin (fizik collideri — görseli createGround çiziyor; bu kutu neredeyse
// düz ve zeminin altında kalıyor, sahnede görünmez ama çarpışma yüzeyi bu).
addFixedBox(
  30,
  0.1,
  30,
  [0, 0, 0],
  new THREE.MeshStandardMaterial({
    color: 0x0a0e18,
    roughness: 0.95,
    visible: false,
  }),
);

// Rampalar: farklı açılar (Z ekseni etrafında döndürülmüş kutular).
// Renkler neon accent'e taşındı; açı/konum/collider aynı.
addFixedBox(
  3,
  0.1,
  3,
  [-9, 0.9, -3],
  rampMaterial(ACCENT.cyan),
  zQuat(30 * DEG),
); // 30° tırmanılır
addFixedBox(
  3,
  0.1,
  3,
  [-9, 1.6, 4],
  rampMaterial(ACCENT.violet),
  zQuat(45 * DEG),
); // 45° sınırda
addFixedBox(
  3,
  0.1,
  3,
  [-2, 2.2, -9],
  rampMaterial(ACCENT.magenta),
  zQuat(55 * DEG),
); // 55° kaydırır

// Merdiven: art arda yükselen basamaklar (autostep testi).
const stepH = 0.25;
const stepD = 0.5;
for (let i = 0; i < 6; i++) {
  addFixedBox(
    stepD / 2,
    (i + 1) * stepH * 0.5,
    2,
    [6 + i * stepD, (i + 1) * stepH * 0.5, 0],
    stairMaterial(),
  );
}

// İtilecek dinamik kutular.
addDynamicBox(0.4, [2, 0.5, 4], 0xf59e0b);
addDynamicBox(0.4, [3.2, 0.5, 4], 0xf97316);
addDynamicBox(0.4, [2.4, 0.5, 6], 0xfacc15);

// ---------- Karakter ----------
const charBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 2),
);
const charCollider = world.createCollider(
  RAPIER.ColliderDesc.capsule(0.5, 0.3),
  charBody,
);

const controller = world.createCharacterController(0.01);
controller.setUp({ x: 0, y: 1, z: 0 });

// Karakter, altındaki zemin bu mesafe içindeyse ona "yapışsın".
// Eğimden inerken ya da küçük basamaklardan düşerken havalanmayı önler.
controller.enableSnapToGround(0.5);

controller.setMaxSlopeClimbAngle(45 * DEG); // 45°'ye kadar tırman
controller.setMinSlopeSlideAngle(30 * DEG); // 30°'den dikse kaymaya başla

// enableAutostep(maxHeight, minWidth, includeDynamic)
//  - maxHeight: en fazla bu yükseklikteki basamağa çıkabilir (0.4 m)
//  - minWidth : üstüne basacak en az bu kadar düz alan olmalı (0.2 m)
//  - includeDynamic: dinamik cisimleri de basamak sayar mı (true)
controller.enableAutostep(0.4, 0.2, true);

controller.setApplyImpulsesToDynamicBodies(true);
controller.setCharacterMass(1.0); // itme kuvvetini sınırlayan "karakter kütlesi"

const charMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1.0, 8, 16),
  characterMaterial(),
);
charMesh.castShadow = true;
charMesh.receiveShadow = true;
scene.add(charMesh);

const mover = new CharacterMover(charBody, charCollider, controller);

// Çarpışma normallerini gösteren neon ok havuzu.
const arrowPool: THREE.ArrowHelper[] = [];
function updateCollisionArrows(): void {
  for (const a of arrowPool) a.visible = false;
  let idx = 0;
  for (let i = 0; i < controller.numComputedCollisions(); i++) {
    const hit = controller.computedCollision(i);
    if (!hit) continue;
    const n = hit.normal1;
    const dir = new THREE.Vector3(n.x, n.y, n.z);
    if (dir.lengthSq() < 1e-6) continue;
    dir.normalize();
    const p = charBody.translation();
    const origin = new THREE.Vector3(p.x, p.y, p.z);
    let arrow = arrowPool[idx];
    if (!arrow) {
      arrow = new THREE.ArrowHelper(
        dir,
        origin,
        0.9,
        ACCENT.magenta,
        0.28,
        0.18,
      );
      scene.add(arrow);
      arrowPool[idx] = arrow;
    }
    arrow.visible = true;
    arrow.position.copy(origin);
    arrow.setDirection(dir);
    idx++;
  }
}

// ---------- Input ----------
const keys = new Set<string>();
let jumpQueued = false;
window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "Space") {
    jumpQueued = true;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

function currentInput(): MoveInput {
  const moveX = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const moveZ = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
  const jump = jumpQueued;
  jumpQueued = false;
  return { moveX, moveZ, jump };
}

// ---------- Teşhis HUD'u ----------
const hud = new Hud({
  overlay: document.getElementById("overlay") as HTMLCanvasElement,
  vy: document.getElementById("stat-vy") as HTMLElement,
  state: document.getElementById("stat-state") as HTMLElement,
  energyFill: document.getElementById("energy-fill") as HTMLElement,
});
let coyoteTimer = 999;

// ---------- Döngü ----------
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

// Sinematik kamera: hedef ve konum damping'li takip edilir.
const camTarget = new THREE.Vector3(0, 3, 2);

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  acc += dt;

  while (acc >= STEP) {
    const input = currentInput();
    mover.step(input, STEP);
    world.step();
    acc -= STEP;

    // coyote penceresini HUD için yerelde izle
    coyoteTimer = mover.grounded ? 0 : coyoteTimer + STEP;

    hud.pushVy(mover.verticalVelocity);
  }

  // (makaledeki okuma deseni — çarpışmaları tek tek gezmek):
  for (let i = 0; i < controller.numComputedCollisions(); i++) {
    const hit = controller.computedCollision(i);
    if (!hit) continue;
    // hit.normal1 → çarpışma yüzeyinin normali
    // hit.toi     → çarpışmaya kadarki "time of impact"
    // Demo bu normalleri küçük oklarla çizip iticiyi görünür kılıyor.
  }
  updateCollisionArrows();

  // Karakter mesh senkronu.
  const cp = charBody.translation();
  charMesh.position.set(cp.x, cp.y, cp.z);

  // Dinamik kutu senkronu + en yüksek enerji.
  let boxEnergy = 0;
  for (const d of dynamics) {
    const t = d.body.translation();
    const r = d.body.rotation();
    d.mesh.position.set(t.x, t.y, t.z);
    d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    const v = d.body.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    boxEnergy = Math.max(boxEnergy, 0.5 * d.mass * speed * speed);
  }

  // Kamera karakteri sinematik takip eder (konum + hedef damping).
  camTarget.lerp(new THREE.Vector3(cp.x, cp.y + 1.1, cp.z), 0.1);
  camera.position.lerp(new THREE.Vector3(cp.x, cp.y + 6, cp.z + 11), 0.06);
  camera.lookAt(camTarget);

  // Gölge frustum'unu karaktere kilitle ki gölgeler keskin kalsın.
  key.target.position.set(cp.x, cp.y, cp.z);
  key.position.set(cp.x + 9, cp.y + 17, cp.z + 7);

  const inCoyote = !mover.grounded && coyoteTimer <= mover.coyoteTime;
  hud.render({
    vy: mover.verticalVelocity,
    grounded: mover.grounded,
    inCoyote,
    boxEnergy,
  });

  // Neon glow için renderer.render yerine composer.render.
  postfx.composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.resize(window.innerWidth, window.innerHeight);
});
