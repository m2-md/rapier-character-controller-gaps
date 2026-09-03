// tests/floating.test.ts — makalenin açılış iddiasının testi:
// yerçekimsiz "desired" ile kinematik karakter havada asılı kalır (y sabit).
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";

beforeAll(async () => {
  await RAPIER.init();
});

describe("havada asılı karakter", () => {
  it("desired.y = 0 ise 300 adım sonra bile y başlangıçta kalır", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50), groundBody);

    const charBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0),
    );
    const charCollider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.3),
      charBody,
    );
    const controller = world.createCharacterController(0.01);
    controller.setUp({ x: 0, y: 1, z: 0 });

    const desired = { x: 0.05, y: 0, z: 0 }; // yerçekimi YOK
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

    // Yatayda ilerledi ama dikeyde bir milimetre bile düşmedi.
    expect(charBody.translation().x).toBeGreaterThan(1);
    expect(endY).toBe(startY);
  });
});
