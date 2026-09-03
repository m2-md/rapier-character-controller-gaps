// stair-probe.ts
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "./character-mover";

/** N basamaklı bir merdiven kurar, karakteri ittirir, çıkılan basamak sayısını döner. */
export function climbStairs(autostep: boolean, steps = 6): number {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const stepH = 0.25; // basamak yüksekliği (m)
  const stepD = 0.5; // basamak derinliği (m)

  // Zemin.
  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 5), g);

  // Merdiven: her basamak bir öncekinden stepH yüksek, stepD ileride.
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

  // Zirvede ulaşılan yüksekliği izle: karakter hızlı olduğu için merdivenin
  // tepesini aşıp öbür uçtan inebilir; bizi ilgilendiren en yüksek nokta.
  let maxY = 0;
  for (let i = 0; i < 240; i++) {
    mover.step(input, 1 / 60);
    world.step();
    if (i >= 15) maxY = Math.max(maxY, body.translation().y); // ilk kareler oturma
  }

  // Kapsül merkezi bastığı basamağın 0.7 m üstünde durur (halfHeight 0.4 +
  // radius 0.3). Zirve yüksekliğinden kaç basamak çıkıldığını çıkar.
  return Math.max(0, Math.round((maxY - 0.7) / stepH));
}
