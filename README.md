# Rapier KCC — Gravity, Slopes, Stairs, Pushing

Working code for the article "Why Your Character Hangs in Mid-Air: Rapier's Kinematic
Controller Only Does Translation". Rapier's stock `KinematicCharacterController`
(KCC) only resolves translation against collisions — gravity, the coyote frame,
the slope limit, stepping up stairs (autostep) and pushing boxes are your job.
This repo fills those gaps and proves every one of them **with deterministic tests,
without opening a browser**.

Core idea: all of the movement logic (`src/character-mover.ts`) is decoupled from
rendering. It never sees a `THREE.Mesh`, never a camera, never
`requestAnimationFrame`. That is why we can run two identical Rapier worlds on the
same input and prove the final transforms are **bit-for-bit** identical with `toBe`.

## Versions

- `@dimforge/rapier3d-compat@0.19.3` — WASM embedded as base64; **no Vite plugin is
  needed**. One rule only: `await RAPIER.init()` before `new RAPIER.World(...)`.
- `three@0.185.1` — only for the visualization demo (WebGLRenderer).
- Vite + TypeScript + Vitest, npm.

## Install

```bash
npm install
```

## Tests (the core proof — no browser required)

```bash
npm test
```

7 tests should be green:

- **determinism** (3): the same input sequence → bit-for-bit identical final
  transform in two worlds via `toBe`; the character falls under gravity and settles
  on the ground; jumping while grounded launches vertical velocity upward (coyote).
- **floating** (1): with gravity-free `desired.y = 0` the kinematic character is
  still at the same `y` after 300 steps — proof of the article's opening claim.
- **probes** (3): the slope / stair / push probes are measured against real Rapier
  output.

The concrete measured numbers (from the probe tests' `console.log`):

| Probe | Result |
|---|---|
| Slope (15°→55°) | 10.56 → 8.25 → 6.29 → **2.69** → 2.78 m; climbing cuts out at the 45° threshold |
| Stairs (autostep) | off **0** steps, on **6** steps |
| Push | box is dragged 8.93 m, peakSpeed **5.42 m/s** (below the walk speed of 6 → no explosion), peakEnergy 7.52 J |

## Running it (visual demo)

```bash
npm run dev
```

Opens at `http://localhost:5173/` in the browser. **Do NOT open it with `file://`** —
without the Vite dev server the WASM and the modules will not load and you get a
blank screen.

The presentation layer is "dark cinematic + neon glow": ACES tone mapping, embedded
`RoomEnvironment` PBR reflections, shadow-casting lights and neon glow via
`UnrealBloomPass`; a glassmorphism diagnostics panel in the top left.

The demo has a third-person capsule character:

- Walks with **WASD**, jumps with **Space**.
- The scene has flat ground, 30°/45°/55° ramps, a staircase and dynamic boxes to push.
- The overlay in the top left shows the movement layer live: the vertical velocity
  curve (the fall-jump parabola), the `grounded` lamp, the coyote window and the
  energy bar rising while a box is pushed. Collision normals are drawn in the scene
  as small red arrows.

The character climbs ramps up to 45° and stops climbing on anything steeper; it goes
up the staircase with autostep; it shoves the boxes ahead of it without blowing
them up.

## Build

```bash
npm run build
```

`tsc && vite build`. `vite.config.ts` pulls the build target up to `esnext` because
`main.ts` calls top-level `await RAPIER.init()` on startup.

## File layout

```
src/
  rapier-init.ts      # -compat + await RAPIER.init() bootstrap pattern
  character-mover.ts  # CORE: gravity (Euler vy), coyote, snap; decoupled from render
  slope-probe.ts      # rotated ramp (quaternion) → probeSlope(angleDeg)
  stair-probe.ts      # staircase boxes → climbStairs(autostep)
  push-probe.ts       # dynamic box → pushBox() peakEnergy/peakSpeed
  main.ts             # three.js visualization + input + diagnostics overlay
  demos/
    floating.ts       # minimal proof of the "character hanging in mid-air" (gravity-free desired)
tests/
  determinism.test.ts # two worlds bit-for-bit identical; falling; coyote
  floating.test.ts    # y stays constant (hanging in mid-air)
  probes.test.ts      # slope table, autostep contrast, push energy
```

## Lessons learned (also covered in the article)

- A kinematic body **does not care** about the world's gravity. If you don't put the
  vertical motion into `desired.y` yourself, the character hangs in mid-air.
- While grounded, set `vy` to a small negative value (`-2`) rather than zero;
  together with `enableSnapToGround` this prevents stair jitter.
- With `enableAutostep` off, even a 25 cm step stops the character dead (an invisible
  wall). With it on, the character walks to the top of the staircase.
- Keep `setCharacterMass` small when pushing boxes; a large mass = physics explosion
  (kinetic energy shoots up). Measure the energy to tune the "gentle shove" by number.
- Rapier's determinism holds for the **same version + same platform**; floating-point
  differences can show up across CPUs/OSes. The test is a solid guard within the same
  build.

## License

MIT
