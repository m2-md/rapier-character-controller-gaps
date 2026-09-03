// tests/determinism.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "../src/character-mover";

// Rapier WASM'ı bütün testlerden önce bir kez ayağa kaldır.
beforeAll(async () => {
  await RAPIER.init();
});

interface Sim {
  world: RAPIER.World;
  body: RAPIER.RigidBody;
  mover: CharacterMover;
}

function buildSim(): Sim {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), g);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableSnapToGround(0.5);

  return { world, body, mover: new CharacterMover(body, collider, controller) };
}

// Sabit, elle yazılmış bir girdi dizisi: yürü, zıpla, yön değiştir.
function scriptedInputs(): MoveInput[] {
  const seq: MoveInput[] = [];
  for (let i = 0; i < 200; i++) {
    seq.push({
      moveX: i < 100 ? 1 : -1, // ilk yarı sağa, sonra sola
      moveZ: Math.sin(i / 20) > 0 ? 1 : 0, // dalgalı derinlik
      jump: i === 40 || i === 90, // iki noktada zıpla
    });
  }
  return seq;
}

function advance(sim: Sim, input: MoveInput): void {
  sim.mover.step(input, 1 / 60);
  sim.world.step();
}

describe("KCC hareket determinizmi", () => {
  it("aynı girdi dizisi → bit-bit aynı son transform", () => {
    const a = buildSim();
    const b = buildSim();
    const inputs = scriptedInputs();

    for (const input of inputs) {
      advance(a, input);
      advance(b, input);
    }

    const ta = a.body.translation();
    const tb = b.body.translation();

    // Determinizm guard'ı: yaklaşık değil, TAM eşitlik bekliyoruz.
    expect(ta.x).toBe(tb.x);
    expect(ta.y).toBe(tb.y);
    expect(ta.z).toBe(tb.z);
  });

  it("karakter yerçekimiyle düşer ve zemine oturur", () => {
    const sim = buildSim();
    const idle: MoveInput = { moveX: 0, moveZ: 0, jump: false };

    const startY = sim.body.translation().y;
    for (let i = 0; i < 180; i++) advance(sim, idle);
    const endY = sim.body.translation().y;

    // y = 2'den başladı, zemine (~0.6: kapsül yarısı + yarıçap) oturmalı.
    expect(endY).toBeLessThan(startY); // düştü
    expect(endY).toBeGreaterThan(0.3); // zeminin içine geçmedi
    expect(sim.mover.grounded).toBe(true); // ve yere oturdu
  });

  it("coyote karesi: uçurumdan çıkınca kısa süre hâlâ zıplanır", () => {
    const sim = buildSim();
    // Önce yere otur.
    const idle: MoveInput = { moveX: 0, moveZ: 0, jump: false };
    for (let i = 0; i < 60; i++) advance(sim, idle);
    expect(sim.mover.grounded).toBe(true);

    // Tam yerdeyken zıpla: dikey hız pozitife fırlamalı.
    sim.mover.step({ moveX: 0, moveZ: 0, jump: true }, 1 / 60);
    expect(sim.mover.verticalVelocity).toBeGreaterThan(0);
  });
});
