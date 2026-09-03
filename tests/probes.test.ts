// tests/probes.test.ts
// This file is the concrete proof of the article's "measure, don't guess" rule: it measures
// the slope table, the autostep contrast and the push energy against real Rapier output.
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { probeSlope } from "../src/slope-probe";
import { climbStairs } from "../src/stair-probe";
import { pushBox } from "../src/push-probe";

beforeAll(async () => {
  await RAPIER.init();
});

describe("slope sweep (slope-probe)", () => {
  it("climbs shallow angles and stops climbing past the 45° limit", () => {
    const results = [15, 30, 40, 46, 55].map((a) => probeSlope(a));
    // Lay out the measured table (the table in the article body is updated from this).
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(
        `slope ${r.angleDeg}°  gain=${r.horizontalGain.toFixed(2)}m  climbed=${r.climbed}`,
      );
    }
    const g = new Map(results.map((r) => [r.angleDeg, r.horizontalGain]));

    // BELOW the 45° climb limit: the character climbs noticeably.
    expect(g.get(15)!).toBeGreaterThan(4);
    expect(g.get(30)!).toBeGreaterThan(4);
    expect(g.get(40)!).toBeGreaterThan(4);
    // The steeper it gets, the less progress (15° > 30° > 40°).
    expect(g.get(15)!).toBeGreaterThan(g.get(30)!);
    expect(g.get(30)!).toBeGreaterThan(g.get(40)!);
    // PAST the 45° threshold, a sharp drop: climbing stops, only downhill sliding is left.
    expect(g.get(40)! - g.get(46)!).toBeGreaterThan(2);
    expect(g.get(46)!).toBeLessThan(3.5);
    expect(g.get(55)!).toBeLessThan(3.5);
  });
});

describe("stair sweep (stair-probe)", () => {
  it("climbs the staircase with autostep on, gets stuck on the first step with it off", () => {
    const off = climbStairs(false);
    const on = climbStairs(true);
    // eslint-disable-next-line no-console
    console.log(`stairs autostep OFF=${off} steps, ON=${on} steps`);
    expect(on).toBeGreaterThan(off);
    expect(off).toBeLessThanOrEqual(1); // with it off it stops at the first threshold
    expect(on).toBeGreaterThanOrEqual(3); // with it on it climbs the staircase
  });
});

describe("push sweep (push-probe)", () => {
  it("pushes the box without blowing it up (peakSpeed stays around walk speed)", () => {
    const r = pushBox();
    // eslint-disable-next-line no-console
    console.log(
      `push  displacement=${r.boxDisplacement.toFixed(2)}m  peakSpeed=${r.peakSpeed.toFixed(2)}m/s  peakEnergy=${r.peakEnergy.toFixed(2)}J`,
    );
    expect(r.boxDisplacement).toBeGreaterThan(0); // the box was pushed
    expect(r.peakSpeed).toBeGreaterThan(0);
    // "Gentle shove": the box must not fly off noticeably faster than the character's walk speed (6 m/s).
    expect(r.peakSpeed).toBeLessThan(12);
  });
});
