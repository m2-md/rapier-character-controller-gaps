// slope-probe.ts
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "./character-mover";

export interface SlopeResult {
  angleDeg: number;
  horizontalGain: number; // rampada ne kadar ileri gidebildi (m)
  climbed: boolean;
}

/** Verilen açıda bir rampa kurar, karakteri N kare yukarı yürütür, ilerlemeyi ölçer. */
export function probeSlope(angleDeg: number, frames = 120): SlopeResult {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  // Rampa: bir kutuyu Z ekseni etrafında döndürüp eğimli düzlem yapıyoruz.
  const rad = angleDeg * (Math.PI / 180);
  const half = Math.sin(rad / 2);
  const rampBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(10, 0.1, 10)
      // Quaternion: Z ekseni etrafında rad kadar dönüş.
      .setRotation({ x: 0, y: 0, z: half, w: Math.cos(rad / 2) }),
    rampBody,
  );

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-4, 3, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableSnapToGround(0.5);
  controller.setMaxSlopeClimbAngle(45 * (Math.PI / 180));
  controller.setMinSlopeSlideAngle(30 * (Math.PI / 180));

  const mover = new CharacterMover(body, collider, controller);
  const input: MoveInput = { moveX: 1, moveZ: 0, jump: false };

  const startX = body.translation().x;
  for (let i = 0; i < frames; i++) {
    mover.step(input, 1 / 60);
    world.step();
  }
  const gain = body.translation().x - startX;

  return { angleDeg, horizontalGain: gain, climbed: gain > 1.0 };
}
