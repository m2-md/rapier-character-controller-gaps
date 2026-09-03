// floating.ts — makalenin açılış iddiasının minimal kanıtı:
// kinematik gövde + yerçekimsiz "desired" → karakter havada asılı kalır.
import RAPIER from "@dimforge/rapier3d-compat";

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// Zemin: sabit, geniş, ince bir kutu.
const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50), groundBody);

// Karakter: kinematic-position-based gövde + kapsül collider.
// capsule(halfHeight, radius): yarım-yükseklik 0.5, yarıçap 0.3.
const charBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0),
);
const charCollider = world.createCollider(
  RAPIER.ColliderDesc.capsule(0.5, 0.3),
  charBody,
);

// Character controller. Tek argüman "offset": collider'ı yüzeylerden
// ayrı tutan minik bir boşluk (ör. 1 cm). Sıfır verirsen yüzeye yapışır
// ve sayısal titreme başlar.
const controller = world.createCharacterController(0.01);
controller.setUp({ x: 0, y: 1, z: 0 }); // "yukarı" +Y — grounded testi buna bakar

// Oyuncunun İSTEDİĞİ hareket. Sadece yatay: yerçekimi YOK.
const desired = { x: 0.05, y: 0, z: 0 };

// Controller çarpışmaları çözer ama isteği kendisi ÜRETMEZ.
controller.computeColliderMovement(charCollider, desired);
const corrected = controller.computedMovement();

// Düzeltilmiş hareketi mevcut pozisyona ekleyip gövdeye "bir sonraki
// kinematik pozisyon" olarak veriyoruz. world.step() bunu uygular.
const t = charBody.translation();
charBody.setNextKinematicTranslation({
  x: t.x + corrected.x,
  y: t.y + corrected.y,
  z: t.z + corrected.z,
});

world.step();

// --- Kanıt: yerçekimsiz istekle döngüde de y hiç değişmez ---
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
  `floating demo → başlangıç y=${startY.toFixed(4)}, 300 adım sonra y=${endY.toFixed(4)} (havada asılı)`,
);
