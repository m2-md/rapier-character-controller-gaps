# Rapier KCC — Yerçekimi, Eğim, Basamak, İtme

"Karakter Neden Havada Asılı Kaldı: Rapier'ın Kinematik Controller'ı Yalnızca Öteleme
Yapar" makalesinin çalışan kodu. Rapier'ın hazır `KinematicCharacterController`'ı
(KCC) yalnızca çarpışmaya göre öteleme (translation) yapar — yerçekimi, coyote karesi,
eğim limiti, basamak çıkma (autostep) ve kutu itme senin işin. Bu repo o boşlukları
doldurur ve hepsini **tarayıcı açmadan, deterministik testle** kanıtlar.

Çekirdek fikir: bütün hareket mantığı (`src/character-mover.ts`) render'dan ayrık.
Ne `THREE.Mesh` görür, ne kamera, ne `requestAnimationFrame`. Bu yüzden iki özdeş
Rapier dünyasını aynı girdiyle koşturup son transform'ların **bit-bit** aynı olduğunu
`toBe` ile ispatlayabiliyoruz.

## Sürümler

- `@dimforge/rapier3d-compat@0.19.3` — WASM base64 gömülü; **hiçbir Vite eklentisi
  gerekmez**. Tek kural: `new RAPIER.World(...)`'tan önce `await RAPIER.init()`.
- `three@0.185.1` — sadece görselleştirme demosu (WebGLRenderer).
- Vite + TypeScript + Vitest, npm.

## Kurulum

```bash
npm install
```

## Test (çekirdek kanıt — tarayıcı gerekmez)

```bash
npm test
```

7 test yeşil olmalı:

- **determinism** (3): aynı girdi dizisi → iki dünyada `toBe` ile bit-bit aynı son
  transform; karakter yerçekimiyle düşüp zemine oturuyor; yerdeyken zıplama dikey
  hızı yukarı fırlatıyor (coyote).
- **floating** (1): yerçekimsiz `desired.y = 0` ile kinematik karakter 300 adım
  sonra bile `y`'de kalıyor — makalenin açılış iddiasının kanıtı.
- **probes** (3): eğim/basamak/itme sondaları gerçek Rapier çıktısıyla ölçülüyor.

Ölçülen somut sayılar (probe testlerinin `console.log`'undan):

| Sonda | Sonuç |
|---|---|
| Eğim (15°→55°) | 10.56 → 8.25 → 6.29 → **2.69** → 2.78 m; 45° eşiğinde tırmanma kesiliyor |
| Basamak (autostep) | kapalı **0** basamak, açık **6** basamak |
| İtme | kutu 8.93 m sürükleniyor, peakSpeed **5.42 m/s** (yürüme hızı 6'nın altında → patlamıyor), peakEnergy 7.52 J |

## Çalıştırma (görsel demo)

```bash
npm run dev
```

Tarayıcıda `http://localhost:5173/` açılır. **`file://` ile AÇMA** — Vite dev sunucusu
olmadan WASM ve modüller yüklenmez, boş ekran görürsün.

Sunum katmanı "dark cinematic + neon glow": ACES tone mapping, gömülü
`RoomEnvironment` PBR yansımaları, gölge atan ışıklar ve `UnrealBloomPass` ile
neon parlama; sol üstte glassmorphism cam bir teşhis paneli.

Demoda üçüncü şahıs kapsül bir karakter var:

- **WASD** ile yürür, **Boşluk** ile zıplar.
- Sahnede düz zemin, 30°/45°/55° rampalar, bir merdiven ve itilecek dinamik kutular.
- Sol üstteki overlay hareket katmanının canlı hâlini gösterir: dikey hız eğrisi
  (düşüş-zıplama parabolü), `grounded` lambası, coyote penceresi ve kutu iterken
  yükselen enerji çubuğu. Çarpışma normalleri sahnede küçük kırmızı oklarla çizilir.

Karakter 45°'ye kadar rampaları tırmanır, daha diklerde tırmanmayı bırakır; merdiveni
autostep ile çıkar; kutuları patlatmadan önüne katıp iter.

## Build

```bash
npm run build
```

`tsc && vite build`. `vite.config.ts` build hedefini `esnext`'e çeker çünkü `main.ts`
açılışta top-level `await RAPIER.init()` çağırır.

## Dosya yapısı

```
src/
  rapier-init.ts      # -compat + await RAPIER.init() bootstrap deseni
  character-mover.ts  # ÇEKIRDEK: yerçekimi (Euler vy), coyote, snap; render'dan ayrık
  slope-probe.ts      # döndürülmüş rampa (quaternion) → probeSlope(angleDeg)
  stair-probe.ts      # merdiven kutuları → climbStairs(autostep)
  push-probe.ts       # dinamik kutu → pushBox() peakEnergy/peakSpeed
  main.ts             # three.js görselleştirme + input + overlay teşhis
  demos/
    floating.ts       # "havada asılı karakter" minimal kanıtı (yerçekimsiz desired)
tests/
  determinism.test.ts # iki dünya bit-bit aynı; düşme; coyote
  floating.test.ts    # y sabit kalır (havada asılı)
  probes.test.ts      # eğim tablosu, autostep karşıtlığı, itme enerjisi
```

## Alınan dersler (makalede de anlatılır)

- Kinematik gövde dünyanın yerçekimini **umursamaz**. Dikey hareketi `desired.y`'ye
  sen koymazsan karakter havada asılı kalır.
- Yerdeyken `vy`'yi sıfır değil küçük bir negatif (`-2`) yap; `enableSnapToGround` ile
  birlikte merdiven titremesini önler.
- `enableAutostep` kapalıyken 25 cm'lik basamak bile karakteri durdurur (görünmez
  duvar). Açıkken merdivenin tepesine çıkar.
- Kutu iterken `setCharacterMass`'ı küçük tut; büyük kütle = fizik patlaması
  (kinetik enerji fırlar). Enerjiyi ölçerek "nazik itiş"i sayıyla ayarla.
- Rapier determinizmi **aynı sürüm + aynı platform** için geçerlidir; farklı
  CPU/OS arasında kayan nokta farkları çıkabilir. Test aynı build içinde sağlam bir
  guard'dır.

## Lisans

MIT
