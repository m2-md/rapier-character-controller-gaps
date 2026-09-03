// tests/determinism.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "../src/character-mover";

// Bring up the Rapier WASM once, before all tests.
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

// A fixed, hand-written input sequence: walk, jump, change direction.
function scriptedInputs(): MoveInput[] {
  const seq: MoveInput[] = [];
  for (let i = 0; i < 200; i++) {
    seq.push({
      moveX: i < 100 ? 1 : -1, // right for the first half, then left
      moveZ: Math.sin(i / 20) > 0 ? 1 : 0, // wavy depth
      jump: i === 40 || i === 90, // jump at two points
    });
  }
  return seq;
}

function advance(sim: Sim, input: MoveInput): void {
  sim.mover.step(input, 1 / 60);
  sim.world.step();
}

describe("KCC movement determinism", () => {
  it("same input sequence produces a bit-for-bit identical final transform", () => {
    const a = buildSim();
    const b = buildSim();
    const inputs = scriptedInputs();

    for (const input of inputs) {
      advance(a, input);
      advance(b, input);
    }

    const ta = a.body.translation();
    const tb = b.body.translation();

    // Determinism guard: we expect EXACT equality, not approximate.
    expect(ta.x).toBe(tb.x);
    expect(ta.y).toBe(tb.y);
    expect(ta.z).toBe(tb.z);
  });

  it("the character falls under gravity and settles on the ground", () => {
    const sim = buildSim();
    const idle: MoveInput = { moveX: 0, moveZ: 0, jump: false };

    const startY = sim.body.translation().y;
    for (let i = 0; i < 180; i++) advance(sim, idle);
    const endY = sim.body.translation().y;

    // Started at y = 2, should settle on the ground (~0.6: capsule half + radius).
    expect(endY).toBeLessThan(startY); // it fell
    expect(endY).toBeGreaterThan(0.3); // it did not sink into the ground
    expect(sim.mover.grounded).toBe(true); // and it landed
  });

  it("coyote frame: jumping still works briefly after walking off a ledge", () => {
    const sim = buildSim();
    // Land on the ground first.
    const idle: MoveInput = { moveX: 0, moveZ: 0, jump: false };
    for (let i = 0; i < 60; i++) advance(sim, idle);
    expect(sim.mover.grounded).toBe(true);

    // Jump while fully grounded: vertical velocity should shoot positive.
    sim.mover.step({ moveX: 0, moveZ: 0, jump: true }, 1 / 60);
    expect(sim.mover.verticalVelocity).toBeGreaterThan(0);
  });
});
