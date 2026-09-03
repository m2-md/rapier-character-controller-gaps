// tests/probes.test.ts
// Bu dosya makalenin "ölç, tahmin etme" kuralının somut kanıtı: eğim tablosunu,
// autostep karşıtlığını ve itme enerjisini gerçek Rapier çıktısıyla ölçer.
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { probeSlope } from "../src/slope-probe";
import { climbStairs } from "../src/stair-probe";
import { pushBox } from "../src/push-probe";

beforeAll(async () => {
  await RAPIER.init();
});

describe("eğim taraması (slope-probe)", () => {
  it("düşük açıları tırmanır, 45° limitini aşınca tırmanamaz", () => {
    const results = [15, 30, 40, 46, 55].map((a) => probeSlope(a));
    // Ölçülen tabloyu göz önüne ser (makale gövdesindeki tablo bununla güncellenir).
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(
        `slope ${r.angleDeg}°  gain=${r.horizontalGain.toFixed(2)}m  climbed=${r.climbed}`,
      );
    }
    const g = new Map(results.map((r) => [r.angleDeg, r.horizontalGain]));

    // 45° climb limitinin ALTINDA: karakter belirgin biçimde tırmanır.
    expect(g.get(15)!).toBeGreaterThan(4);
    expect(g.get(30)!).toBeGreaterThan(4);
    expect(g.get(40)!).toBeGreaterThan(4);
    // Dik oldukça ilerleme azalır (15° > 30° > 40°).
    expect(g.get(15)!).toBeGreaterThan(g.get(30)!);
    expect(g.get(30)!).toBeGreaterThan(g.get(40)!);
    // 45° eşiğini AŞINCA sert düşüş: tırmanma durur, sadece iniş kayması kalır.
    expect(g.get(40)! - g.get(46)!).toBeGreaterThan(2);
    expect(g.get(46)!).toBeLessThan(3.5);
    expect(g.get(55)!).toBeLessThan(3.5);
  });
});

describe("basamak taraması (stair-probe)", () => {
  it("autostep açıkken merdiven çıkılır, kapalıyken ilk basamağa takılır", () => {
    const off = climbStairs(false);
    const on = climbStairs(true);
    // eslint-disable-next-line no-console
    console.log(`stairs autostep OFF=${off} basamak, ON=${on} basamak`);
    expect(on).toBeGreaterThan(off);
    expect(off).toBeLessThanOrEqual(1); // kapalıyken ilk eşikte durur
    expect(on).toBeGreaterThanOrEqual(3); // açıkken merdiveni çıkar
  });
});

describe("itme taraması (push-probe)", () => {
  it("kutuyu iter ama patlatmaz (peakSpeed yürüme hızı mertebesinde)", () => {
    const r = pushBox();
    // eslint-disable-next-line no-console
    console.log(
      `push  displacement=${r.boxDisplacement.toFixed(2)}m  peakSpeed=${r.peakSpeed.toFixed(2)}m/s  peakEnergy=${r.peakEnergy.toFixed(2)}J`,
    );
    expect(r.boxDisplacement).toBeGreaterThan(0); // kutu itildi
    expect(r.peakSpeed).toBeGreaterThan(0);
    // "Nazik itiş": kutu karakterin yürüme hızından (6 m/s) belirgin hızlı fırlamamalı.
    expect(r.peakSpeed).toBeLessThan(12);
  });
});
