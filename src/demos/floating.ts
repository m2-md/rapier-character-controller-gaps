// floating.ts — the minimal proof of the article's opening claim:
// kinematic body + gravity-free "desired" → the character hangs in mid-air.
import RAPIER from "@dimforge/rapier3d-compat";

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// Ground: a fixed, wide, thin box.
const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50), groundBody);

// Character: kinematic-position-based body + capsule collider.
// capsule(halfHeight, radius): half-height 0.5, radius 0.3.
const charBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0),
);
const charCollider = world.createCollider(
  RAPIER.ColliderDesc.capsule(0.5, 0.3),
  charBody,
);

// Character controller. The single argument is the "offset": a tiny gap that
// keeps the collider away from surfaces (e.g. 1 cm). Pass zero and it sticks to
// the surface and numerical jitter starts.
const controller = world.createCharacterController(0.01);
controller.setUp({ x: 0, y: 1, z: 0 }); // "up" is +Y — the grounded test looks at this

// The movement the player WANTS. Horizontal only: NO gravity.
const desired = { x: 0.05, y: 0, z: 0 };

// The controller resolves collisions but does not PRODUCE the request itself.
controller.computeColliderMovement(charCollider, desired);
const corrected = controller.computedMovement();

// We add the corrected movement to the current position and hand it to the body
// as the "next kinematic position". world.step() applies it.
const t = charBody.translation();
charBody.setNextKinematicTranslation({
  x: t.x + corrected.x,
  y: t.y + corrected.y,
  z: t.z + corrected.z,
});

world.step();

// --- Proof: with a gravity-free request y never changes in the loop either ---
const startY = charBody.translation().y;
for (let i = 0; i < 300; i++) {
  controller.computeColliderMovement(charCollider, desired);
  const c = controller.computedMovement();
  const p = charBody.translation();
  charBody.setNextKinematicTranslation({
    x: p.x + c.x,
    y: p.y + c.y,
    z: p.z + c.z,
  });
  world.step();
}
const endY = charBody.translation().y;
// eslint-disable-next-line no-console
console.log(
  `floating demo → start y=${startY.toFixed(4)}, after 300 steps y=${endY.toFixed(4)} (hanging in mid-air)`,
);
