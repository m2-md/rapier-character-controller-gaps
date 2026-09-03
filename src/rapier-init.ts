import RAPIER from "@dimforge/rapier3d-compat";

// In -compat the WASM is embedded as base64; init() decodes it and gets the
// engine ready. Skip this and World/collider calls blow up with "not initialized".
await RAPIER.init();

// The engine is up now. The gravity vector is in meters/second².
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
