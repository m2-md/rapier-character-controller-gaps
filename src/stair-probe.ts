// stair-probe.ts
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "./character-mover";

/** Builds a staircase of N steps, pushes the character into it, returns how many steps it climbed. */
export function climbStairs(autostep: boolean, steps = 6): number {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const stepH = 0.25; // step height (m)
  const stepD = 0.5; // step depth (m)

  // Ground.
  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 5), g);

  // Staircase: each step is stepH higher and stepD further than the previous one.
  for (let i = 0; i < steps; i++) {
    const b = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        1 + i * stepD,
        (i + 1) * stepH * 0.5,
        0,
      ),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(stepD / 2, (i + 1) * stepH * 0.5, 2),
      b,
    );
  }

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-1, 1, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.4, 0.3),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableSnapToGround(0.3);
  if (autostep) controller.enableAutostep(0.3, 0.1, false);

  const mover = new CharacterMover(body, collider, controller);
  const input: MoveInput = { moveX: 1, moveZ: 0, jump: false };

  // Track the peak height reached: the character is fast enough to overshoot the
  // top of the staircase and drop off the far end; the highest point is what we want.
  let maxY = 0;
  for (let i = 0; i < 240; i++) {
    mover.step(input, 1 / 60);
    world.step();
    if (i >= 15) maxY = Math.max(maxY, body.translation().y); // first frames are settling
  }

  // The capsule center rests 0.7 m above the step it stands on (halfHeight 0.4 +
  // radius 0.3). Derive the number of steps climbed from the peak height.
  return Math.max(0, Math.round((maxY - 0.7) / stepH));
}
