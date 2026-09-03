// push-probe.ts
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "./character-mover";

export interface PushResult {
  peakEnergy: number; // highest kinetic energy the box saw (J)
  peakSpeed: number; // highest speed (m/s)
  boxDisplacement: number; // how far the box was pushed (m)
}

export function pushBox(): PushResult {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), g);

  // The dynamic box to be pushed.
  const boxBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(1.5, 0.5, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.4, 0.4, 0.4).setDensity(1.0),
    boxBody,
  );
  const boxMass = boxBody.mass();

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-1, 0.9, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableSnapToGround(0.5);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(1.0);

  const mover = new CharacterMover(body, collider, controller);
  const input: MoveInput = { moveX: 1, moveZ: 0, jump: false };

  const startX = boxBody.translation().x;
  let peakEnergy = 0;
  let peakSpeed = 0;

  for (let i = 0; i < 180; i++) {
    mover.step(input, 1 / 60);
    world.step();

    const v = boxBody.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const energy = 0.5 * boxMass * speed * speed;
    peakSpeed = Math.max(peakSpeed, speed);
    peakEnergy = Math.max(peakEnergy, energy);
  }

  return {
    peakEnergy,
    peakSpeed,
    boxDisplacement: boxBody.translation().x - startX,
  };
}
