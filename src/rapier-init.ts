import RAPIER from "@dimforge/rapier3d-compat";

// -compat'ta WASM base64 gömülü; init() onu çözüp motoru hazırlar.
// Bunu atlarsan World/collider çağrıları "not initialized" ile patlar.
await RAPIER.init();

// Artık motor ayakta. Yerçekimi vektörü metre/saniye² cinsinden.
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
