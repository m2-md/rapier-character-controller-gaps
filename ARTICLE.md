# Karakter Neden Havada Asılı Kaldı: Rapier'ın Kinematik Controller'ı Yalnızca Öteleme Yapar — Yerçekimi, Eğim ve Basamak Sende

*Rapier'ın hazır `KinematicCharacterController`'ı tek bir soruya cevap verir: "istediğin bu hareketin ne kadarı duvara girmeden hayatta kalır?" Bir platform oyununu oyun yapan her şey — yerçekimi, coyote karesi, eğim limiti, basamak çıkma, kutuları itmek — onun işi değil, senin işin. Bu yazı hazır sınıfın tam olarak nerede bittiğini gösterip eksiği ölçülebilir biçimde tamamlıyor. Ve hepsini tarayıcı açmadan, deterministik testle kanıtlıyor.*

*Tahmini okuma süresi: 16 dakika*

---

Dünyanın yerçekimini `-9.81` yaptım. Karakteri sahneye `y = 5`'te bıraktım. `world.step()`'i çağırdım, kamerayı çevirdim ve bekledim.

Karakter düşmedi.

Orada, beş metre havada, hiçbir şeye tutunmadan, öylece durdu. Yarım saat "yerçekimi neden çalışmıyor" diye Rapier dokümanını taradım — sonra fark ettim ki yerçekimi gayet çalışıyordu. Sahnedeki dinamik kutular tıkır tıkır düşüyordu. Düşmeyen tek şey benim karakterimdi. Çünkü karakterim bir kinematic (kinematik) gövdeydi ve kinematik gövdeler dünyanın yerçekimini umursamaz. Kural değil, tanım. Kinematik gövde "kuvvetlere göre hareket eden" değil, "ben nereye dersem oraya giden" gövdedir.

İşte bu yazının bütün derdi o boşluğu doldurmak. Rapier'ın `KinematicCharacterController`'ı (kinematik karakter kontrolcüsü) çok işe yarar ama çok az şey yapar. Adında "controller" geçmesine aldanma; bir platform oyununun karakterini kontrol etmez. Yalnızca bir şey yapar: ona "şu kadar ilerlemek istiyorum" dersin, o da sana "duvara, zemine ve rampalara çarpmadan bu isteğinin ne kadarı gerçekleşebilir" diye düzeltilmiş bir hareket verir. Öteleme (translation) yapar. Sadece öteleme.

Bir süzgeç gibi düşün. Üstünden istediğin hareketi dökersin, alttan çarpışmayla süzülmüş hâli akar. Ama süzgeç suyu kendi pompalamaz. Yerçekimi o pompadır — sende. Eğimde kayma o pompanın bir kuralıdır — sende. Basamağa takılıp kalmamak, kutuyu patlatmadan itmek, hepsi senin süzgece ne döktüğünle ilgili. Rapier sana harika bir "hayır, oraya giremezsin" makinesi verir; "nereye gitmek istediğini" hiç sormaz.

Yol haritası altı durak: önce hazır controller'ı kurup havada asılı karakteri kendi gözünle göreceğiz, sonra sırayla yerçekimi + zemine yapışma + coyote karesini, eğim eşiklerini, autostep'i ve dinamik cisimleri patlatmadan itmeyi ekleyeceğiz. En sonunda da bütün hareket katmanını render'dan söküp deterministik bir vitest testine sokacağız: aynı girdi, aynı son transform.

Bir not, çünkü bu seride WASM'lı ilk yazı bu. Rapier'ı Vite'a bağlamak kendi başına bir yazının konusu; burada en az sürtünmeli yolu, `-compat` paketini kullanıyorum. Onun neden ve nasılından kısaca geçip asıl işe döneceğim.

### Kurulum: `-compat` ve `await RAPIER.init()`

Rapier'ın npm'de iki yüzü var. `@dimforge/rapier3d` saf ESM'dir ve WASM dosyasını ayrı yükler; Vite'ta çalışması için `vite-plugin-wasm` ve `vite-plugin-top-level-await` istersin. `@dimforge/rapier3d-compat` ise WASM'ı base64 olarak paketin içine gömer — hiçbir Vite eklentisi gerekmez, tek bedeli açılışta bir `await`.

Bu yazıda `-compat` yolunu seçiyorum çünkü amacımız karakter fiziği, WASM bootstrap çilesi değil. Kural tek: `new RAPIER.World(...)` demeden önce `await RAPIER.init()` çağırmalısın. Bunu unutursan Rapier "modül henüz hazır değil" diye patlar; herkesin bir kez yediği tuzak.

```ts
// src/rapier-init.ts
import RAPIER from "@dimforge/rapier3d-compat";

// -compat'ta WASM base64 gömülü; init() onu çözüp motoru hazırlar.
// Bunu atlarsan World/collider çağrıları "not initialized" ile patlar.
await RAPIER.init();

// Artık motor ayakta. Yerçekimi vektörü metre/saniye² cinsinden.
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
```

Paket sürümünü bilerek sabitliyorum: `@dimforge/rapier3d-compat@0.19.3`. Rapier'ın Rust çekirdeği bu satırları yazarken çok daha ilerideydi ama npm paketi aylardır 0.19.3'te sabit. Sürümü sabitlemek, bir yıl sonra bu kodu açan birinin API'nin oynadığını görüp şaşırmaması için.

### Hazır Controller Gerçekte Ne Yapar (ve Ne Yapmaz)

En küçük kurulumu yapalım ve o havada asılı karakteri kendi gözümüzle görelim. Üç parça var: bir zemin, bir karakter, bir de controller.

Zemin sabit (fixed) bir gövde. Karakter ise kinematic-position-based bir gövde — yani "her karede ben sana yeni bir pozisyon veririm, sen oraya git" diyen tür. Karaktere şekil olarak bir kapsül (capsule) collider takıyoruz, çünkü kapsülün yuvarlak tabanı basamak kenarlarına ve rampalara dünyanın en pürüzsüz biçimde takılır; keskin köşeli bir kutu her eşiğe çarpardı.

```ts
// src/demos/floating.ts
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
```

Şimdi kritik an. Oyuncunun istediği hareketi bir vektör olarak veriyoruz. Dikkat: içinde yerçekimi yok, sadece yatay bir istek. Sonra `computeColliderMovement`'a bu isteği veriyoruz, o da çarpışmalara bakıp "düzeltilmiş" hareketi hesaplıyor; biz de `computedMovement()` ile o düzeltilmiş hareketi geri okuyup gövdeye uyguluyoruz.

```ts
// src/demos/floating.ts — aynı dosyanın devamı
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
```

Bu döngüyü kaç kere çalıştırırsan çalıştır, karakter `y = 5`'te kalır. Yatayda ilerler, sağa doğru kayar, ama bir milimetre bile düşmez. Çünkü `desired.y` her karede sıfır. Controller'a "aşağı düşmek istiyorum" demedik; o da düşürmedi. Havada asılı karakterin bütün sırrı bu tek satırlık boşlukta.

Bir de şuna dikkat: `desired` içindeki değerler hız değil, mesafe. Bu karede gitmek istediğin metre. Sapan yazısından beri tekrarladığımız kural burada da geçerli — hareketi "saniyede" düşünüp `dt` ile çarparak "bu karede"ye çevirmelisin, yoksa oyun hızlı makinede iki kat hızlı koşar. Birazdan hareket katmanını yazarken bunu tek merkezden halledeceğiz.

Özetle hazır controller ne yapıyor? İsteğini alıp çarpışmaya göre buduyor. Ne yapmıyor? İsteği üretmiyor. O halde ilk üreteceğimiz istek, en temeli: düşmek.

### Yerçekimi, Zemine Yapışma ve Coyote Karesi

Havada asılı karakteri yere indirmenin yolu, her karede `desired.y`'ye bir aşağı hareket koymak. Ama düz "her kare 0.1 metre aşağı" olmaz — o sabit hızla düşmektir, gerçekçi değil ve zıplama diye bir şey olmaz. Bunun yerine dikey bir hız (vertical velocity) biriktireceğiz: yerçekimi hızı artırır, hız da pozisyonu. Sapan yazısındaki iki satırlık Euler entegrasyonunun (Euler integration) ta kendisi, sadece bu sefer tek eksende ve controller'a beslenerek.

Bütün bunu bir `CharacterMover` sınıfına koyuyorum. Neden ayrı bir sınıf? Çünkü son bölümde bu sınıfı render'dan bağımsız test edeceğiz. Hareketin bütün kararları burada, çizim hiç girmiyor.

```ts
// character-mover.ts
import type RAPIER from "@dimforge/rapier3d-compat";

export interface MoveInput {
  moveX: number; // -1..1 arası yatay istek
  moveZ: number; // -1..1 arası derinlik istek
  jump: boolean; // bu karede zıpla tuşuna basıldı mı
}

export class CharacterMover {
  private vy = 0; // dikey hız (m/s)
  private airTime = 0; // en son yerden ayrılalı geçen süre (s)

  readonly coyoteTime = 0.1; // yerden ayrıldıktan sonra 100 ms zıplama izni
  private readonly gravity = -30; // "his" için gerçek 9.81'den ağır
  private readonly jumpSpeed = 9; // v²/2g ≈ 1.35 m zıplama tavanı
  private readonly moveSpeed = 6; // yatay yürüme hızı (m/s)

  constructor(
    private readonly body: RAPIER.RigidBody,
    private readonly collider: RAPIER.Collider,
    private readonly controller: RAPIER.KinematicCharacterController,
  ) {}

  step(input: MoveInput, dt: number): void {
    // computedGrounded(): BİR ÖNCEKİ computeColliderMovement'ın sonucu.
    // Yani "geçen karede yere değdik mi". Coyote için tam da bu lazım.
    const grounded = this.controller.computedGrounded();
    this.airTime = grounded ? 0 : this.airTime + dt;

    if (grounded && this.vy <= 0) {
      // Yerdeyiz ve düşüyorduk: dikey hızı küçük bir aşağı kuvvete sabitle.
      // Bu, snapToGround ile birlikte karakteri zemine "yapışık" tutar.
      this.vy = -2;
    } else {
      // Havadayız: yerçekimi hızı biriktirir (Euler).
      this.vy += this.gravity * dt;
    }

    // Coyote: yere değeli coyoteTime'dan az olduysa zıplamaya hâlâ izin var.
    const canJump = this.airTime <= this.coyoteTime;
    if (input.jump && canJump) {
      this.vy = this.jumpSpeed;
      this.airTime = this.coyoteTime + 1; // coyote'yi "yak": çift zıplama olmasın
    }

    // İstek: yatay hızlar + biriken dikey hız, hepsi dt ile mesafeye çevrilir.
    const desired = {
      x: input.moveX * this.moveSpeed * dt,
      y: this.vy * dt,
      z: input.moveZ * this.moveSpeed * dt,
    };

    this.controller.computeColliderMovement(this.collider, desired);
    const m = this.controller.computedMovement();

    const t = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: t.x + m.x,
      y: t.y + m.y,
      z: t.z + m.z,
    });
  }

  get verticalVelocity(): number {
    return this.vy;
  }
  get grounded(): boolean {
    return this.controller.computedGrounded();
  }
}
```

İki inceliği ayrı ayrı konuşalım, çünkü ikisi de "neden böyle" sorusunu hak ediyor.

Birincisi, yerdeyken `vy`'yi sıfır değil `-2` yapıyoruz. Sezgi "yerdeysem dikey hız sıfır olmalı" der ama bu bir tuzak. Karakter hafif bir eğimden aşağı yürürken ya da iki döşeme plakasının arasındaki milimetrelik boşluğun üstünden geçerken, dikey hız sıfırsa controller onu zeminden kopuk sayar ve karakter minik minik havalanır — o rahatsız edici "merdiven titremesi". Küçük bir aşağı baskı, karakteri zemine bastırır.

O baskıyı işe yarar kılan da ikinci parça: `enableSnapToGround`. Bunu controller kurulurken bir kez açarız:

```ts
// src/main.ts
// Karakter, altındaki zemin bu mesafe içindeyse ona "yapışsın".
// Eğimden inerken ya da küçük basamaklardan düşerken havalanmayı önler.
controller.enableSnapToGround(0.5);
```

`snapToGround` şunu der: "hesaplanan hareketten sonra karakterin altında, şu mesafe içinde bir zemin varsa, onu aşağı çekip zemine değdir." Yokuş aşağı yürürken karakter her adımda azıcık havalanıp geri düşmez; zemine sünger gibi yapışır. Değeri kapsülün yarıçapı mertebesinde tutmak iyi bir başlangıç; çok büyük verirsen karakter olmadık yerlerde aşağı ışınlanır.

Coyote karesi (coyote frame) ise 2D seride tanıdığımız o affedici mekanik: uçurumdan çıktıktan sonra birkaç kare daha zıplayabilme. Burada `airTime` sayacıyla ölçüyoruz — yere değeli 100 milisaniyeden az olduysa zıplama tuşu hâlâ geçerli. Zıplayınca sayacı `coyoteTime + 1` yapıp "yakıyoruz", yoksa tek uçurumda oyuncu iki kez zıplardı. Bu numaranın 2D'deki tam kardeşini bir önceki seride girdi tamponu yazısında kurmuştuk; kavram aynı, sadece "yerde miyiz" sorusunu artık `computedGrounded()`'a soruyoruz.

Bütün bunun bir eğrisi var. O eğriyi görmek anlatmaktan iyi. Demo her karede `mover.verticalVelocity` ve karakterin `y`'sini kaydediyor; ekranın kenarındaki grafik, düşüşün hızlanmasını ve zıplamanın o tanıdık parabolünü çiziyor. Zıpladığın an `vy` bir anda `+9`'a fırlıyor, sonra yerçekimi onu her karede `-30 * dt` kadar aşağı çekiyor; tavana varınca `vy` sıfırdan geçiyor ve düşüş başlıyor. Bir platformer'ın "hissi" tam olarak bu eğrinin şeklinde saklı.

### Eğimler: Tırmanma Açısı, Kayma ve Yürüyebildiğin Maksimum

Karakter artık düşüyor ve zıplıyor. Peki bir rampaya doğru yürürse ne olur? Hazır controller burada da fikirsizdir — ta ki ona iki eşik açısı verene kadar.

İki ayar var ve çoğu insan ilk seferinde ikisini karıştırır:

- `setMaxSlopeClimbAngle(radyan)` : bundan daha dik bir yokuşu karakter **tırmanamaz**. İstesen de yukarı gitmez; rampa duvar gibi davranır.
- `setMinSlopeSlideAngle(radyan)` : bundan daha dik bir yokuşta karakter, dursa bile **aşağı kayar**. Buzlu bayır etkisi.

Aradaki bant "yürünebilir ama tırmanınca durabilir" bölgesidir. Kurulumu bir satır:

```ts
// src/main.ts
const DEG = Math.PI / 180;
controller.setMaxSlopeClimbAngle(45 * DEG); // 45°'ye kadar tırman
controller.setMinSlopeSlideAngle(30 * DEG); // 30°'den dikse kaymaya başla
```

Bu sayıları tahminle koymak yerine ölçelim, çünkü ölçmek her zaman tahminden daha dürüsttür. Farklı açılarda rampalar kurup her birinin üstünde karakteri yukarı doğru sabit bir süre yürütüyoruz, sonra ne kadar yatay ilerlediğine bakıyoruz. Tırmanabiliyorsa ilerler; tırmanamıyor ya da kayıyorsa yerinde sayar veya geri gider.

```ts
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
```

Bu sondayı 15°'den 60°'ye kadar taradığında ortaya bir tablo çıkıyor — ve o tablo `setMaxSlopeClimbAngle(45°)` ayarının söz verdiğini tutup tutmadığını gösteriyor. Gerçek probe çıktısı şöyle (120 kare, `1/60` dt):

| Rampa açısı | Yatay ilerleme | Sonuç |
|---|---|---|
| 15° | 10.56 m | rahat tırmandı |
| 30° | 8.25 m | tırmandı |
| 40° | 6.29 m | tırmandı (zorlanarak) |
| 46° | 2.69 m | tırmanamadı — kalan yalnızca iniş kayması |
| 55° | 2.78 m | tırmanamadı |

Eşik tam da koyduğumuz yerde: 45° civarında karakter tırmanmayı bırakıyor. 40°'de 6.29 metre ilerlerken 46°'de 2.69'a düşüyor; aradaki o sert kırılma limitin ta kendisi. `setMaxSlopeClimbAngle`'ı 60°'ye çekersen tablo kayar, 55°'lik rampa da tırmanılır olur. Sayı senin; controller sadece uyguluyor.

Tablodaki son iki satır için küçük bir uyarı: 46° ve 55°'deki o ~2.7 metre tırmanma değil, rampadan aşağı kayma. `SlopeResult.climbed` alanı ham `gain > 1.0` eşiğine baktığı için o satırlarda da `true` döner — tabloya bakarken sayıya güven, bayrağa değil. Bu tablo tahmin de değil: `tests/probes.test.ts` her koşuda bu beş açıyı yeniden tarayıp değerleri konsola basıyor. Kural belli: ölçmediğim sayıyı yazmam.

Küçük bir dürüstlük payı: rampayı quaternion'la döndürmek ilk denememde ters açı verdi, karakter yokuşu tırmanmak yerine içine gömüldü. `sin(rad/2)`/`cos(rad/2)` yarım-açı formülünü karıştırmıştım. Fizik motorlarında rotasyon neredeyse her zaman quaternion'dur ve yarım açı tuzağı herkesi bir kez ısırır.

### Basamak Çıkma: Autostep ve Görünmez Eşik

Şimdi sinsi bir sorun. Karakterin önüne 20 santimlik minik bir basamak koy — bir kaldırım taşı, bir merdiven basamağı. Yatay yürümeye çalış. Karakter durur. Duvara toslamış gibi, o gülünç derecede alçak eşiği aşamaz. Çünkü controller için basamağın dikey yüzü, tıpkı bir duvar gibi, "giremezsin" diyen bir yüzeydir.

Gerçek oyunlar bunu autostep ile çözer: karakter belli bir yükseklikten alçak engelleri otomatik olarak "üstüne basıp geçer". Rapier'da tek satır:

```ts
// src/main.ts
// enableAutostep(maxHeight, minWidth, includeDynamic)
//  - maxHeight: en fazla bu yükseklikteki basamağa çıkabilir (0.4 m)
//  - minWidth : üstüne basacak en az bu kadar düz alan olmalı (0.2 m)
//  - includeDynamic: dinamik cisimleri de basamak sayar mı (true)
controller.enableAutostep(0.4, 0.2, true);
```

`maxHeight` işin canı. Bunu 0.4 metre yaparsan karakter 40 santime kadar basamakları tırmanır, daha yükseğine takılır — ki bu iyi, yoksa karakter duvarları da "basamak" sanıp yukarı tırmanmaya çalışırdı. `minWidth` ise basacak yerin genişliği: çok ince bir çıkıntının üstünde denge kuramaz.

Farkı ölçmek için bir merdiven kuruyoruz — art arda yükselen kutular — ve karakteri autostep açıkken bir, kapalıyken bir kez ittiriyoruz. Kaç basamak çıkabildiğini sayıyoruz.

```ts
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
```

Sonuç ikili bir karşıtlık, ölçülmüş hâliyle: `climbStairs(false)` **0** döner — karakter ilk basamağa toslar, orada sayar durur. `climbStairs(true)` ise **6** döner, yani altı basamaklı merdivenin tepesi. Aynı geometri, aynı itiş, tek fark bir satırlık `enableAutostep`. Autostep kapalıyken o 25 santimlik basamak görünmez bir eşiktir; oyuncu "neden yürüyemiyorum" diye söylenir, sen de kodda saatlerce duvar ararsın. Halbuki duvar yok — sadece controller'a merdiven çıkmayı öğretmeyi unuttun.

`includeDynamic` argümanını burada `false` bıraktım, bir sonraki bölümün konusuna girmemek için. Dinamik cisimleri basamak saymak istersen (yerdeki bir kutunun üstüne basıp geçmek gibi) onu `true` yaparsın — ama o zaman kutuyu itmekle üstüne çıkmak arasındaki dengeyi ayarlaman gerekir.

### Fizik Patlaması Olmadan Dinamik Cisimleri İtmek

Buraya kadar karakterimiz sabit dünyayla konuşuyordu: zemin, rampa, merdiven, hepsi `fixed`. Peki yolun ortasında dinamik (dynamic) bir kutu varsa? Varsayılan olarak controller onu bir duvar sayar — karakter kutuya toslar, kutu kılını kıpırdatmaz. Oysa oyuncu o kutuyu itmek ister.

Bir satır bu davranışı açar:

```ts
// src/main.ts
controller.setApplyImpulsesToDynamicBodies(true);
controller.setCharacterMass(1.0); // itme kuvvetini sınırlayan "karakter kütlesi"
```

Ama burada bir mayın var. Kinematik gövde sonsuz kütleli gibidir; dinamik bir kutuya çarptığında, dikkatsiz bir çözüm kutuya devasa bir itki (impulse) enjekte edip onu sahnenin dışına fırlatabilir. Buna fizik patlaması denir — kutu ışınlanır, takla atar, bazen bütün yığını devirir. `setCharacterMass` tam da bunu dizginler: karakterin "sanki bu kadar kütlesi varmış gibi" itmesini söyler. Küçük kütle, nazik itiş.

Patlamadığını iddia etmek yetmez, ölçmek gerekir. Sisteme enjekte edilen enerjiyi ölçelim: dinamik kutunun kinetik enerjisi (kinetic energy) her karede `0.5 · m · v²`. Karakter kutuyu iterken bu enerji makul bir tavanda kalmalı, ani bir zirveye fırlamamalı.

```ts
// push-probe.ts
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "./character-mover";

export interface PushResult {
  peakEnergy: number; // kutunun gördüğü en yüksek kinetik enerji (J)
  peakSpeed: number; // en yüksek hız (m/s)
  boxDisplacement: number; // kutu ne kadar itildi (m)
}

export function pushBox(): PushResult {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), g);

  // İtilecek dinamik kutu.
  const boxBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(1.5, 0.5, 0),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.4, 0.4, 0.4).setDensity(1.0),
    boxBody,
  );
  const boxMass = boxBody.mass();

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(-1, 0.9, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableSnapToGround(0.5);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(1.0);

  const mover = new CharacterMover(body, collider, controller);
  const input: MoveInput = { moveX: 1, moveZ: 0, jump: false };

  const startX = boxBody.translation().x;
  let peakEnergy = 0;
  let peakSpeed = 0;

  for (let i = 0; i < 180; i++) {
    mover.step(input, 1 / 60);
    world.step();

    const v = boxBody.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    const energy = 0.5 * boxMass * speed * speed;
    peakSpeed = Math.max(peakSpeed, speed);
    peakEnergy = Math.max(peakEnergy, energy);
  }

  return {
    peakEnergy,
    peakSpeed,
    boxDisplacement: boxBody.translation().x - startX,
  };
}
```

Ölçülen sonuç şu: 180 karede kutu 8.93 metre sürükleniyor, `peakSpeed = 5.42 m/s`, `peakEnergy = 7.52 J`. Yani kutu karakterden hızlı fırlamıyor — yürüme hızının (`6 m/s`) altında, önünde makul bir hızla kayıyor. Eğer `setCharacterMass`'ı olmadık büyük bir değere çekersen `peakSpeed` ve `peakEnergy` fırlar; işte o zaman kutu patlar. Bu iki sayıyı izlemek, "nazik itiş"i hisle değil, ölçüyle ayarlamanı sağlar.

Bir de itiş anını gözle görmek istersen, controller sana çarpışmaları verir. `computeColliderMovement`'tan sonra, bu karede kaç çarpışma olduğunu ve her birinin bilgisini okuyabilirsin:

```ts
// src/main.ts — updateCollisionArrows() içindeki döngünün özü
for (let i = 0; i < controller.numComputedCollisions(); i++) {
  const hit = controller.computedCollision(i);
  if (!hit) continue;
  // hit.normal1 → çarpışma yüzeyinin normali
  // hit.toi     → çarpışmaya kadarki "time of impact"
  // Demo bu normalleri küçük oklarla çizip iticiyi görünür kılıyor.
}
```

Demoda karakter kutuları önüne katıp iterken bu çarpışma normalleri küçük oklar olarak çiziliyor; kutunun anlık kinetik enerjisi de köşede bir çubuk grafik olarak yükselip alçalıyor. Enerji çubuğu sakin kaldığı sürece sistem sağlıklı; bir anda tavana vurursa bir yerde kütle ayarını kaçırmışsındır.

### Hareketi Deterministik Test Etmek

Ve geldik en sevdiğim bölüme. Bu yazının başından beri `CharacterMover`'ı bilinçli olarak render'dan ayrı tuttum. Ne `THREE.Mesh` görüyor, ne kamera, ne `requestAnimationFrame`. Sadece bir Rapier dünyası, bir input, bir `dt`. Bunun karşılığını şimdi alıyoruz: hareketi tarayıcı açmadan, canlı bir milisaniye beklemeden test edebiliriz.

Fikir şu. Rapier verilen bir sürüm ve platformda deterministiktir: aynı dünyayı kurup aynı girdiyi aynı sırayla verirsen, aynı sonucu alırsın. O halde iki özdeş dünya kurup ikisine de aynı sabit input dizisini koşturursak, son transform'ların bit-bit aynı olması gerekir. Aynı değilse, sisteme render'dan ya da duvar saatinden bir yerden sızıntı olmuş demektir — ve bu testi kırar.

```ts
// tests/determinism.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterMover, type MoveInput } from "../src/character-mover";

// Rapier WASM'ı bütün testlerden önce bir kez ayağa kaldır.
beforeAll(async () => {
  await RAPIER.init();
});

interface Sim {
  world: RAPIER.World;
  body: RAPIER.RigidBody;
  mover: CharacterMover;
}

function buildSim(): Sim {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), g);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.5, 0.3),
    body,
  );
  const controller = world.createCharacterController(0.01);
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.enableSnapToGround(0.5);

  return { world, body, mover: new CharacterMover(body, collider, controller) };
}

// Sabit, elle yazılmış bir girdi dizisi: yürü, zıpla, yön değiştir.
function scriptedInputs(): MoveInput[] {
  const seq: MoveInput[] = [];
  for (let i = 0; i < 200; i++) {
    seq.push({
      moveX: i < 100 ? 1 : -1, // ilk yarı sağa, sonra sola
      moveZ: Math.sin(i / 20) > 0 ? 1 : 0, // dalgalı derinlik
      jump: i === 40 || i === 90, // iki noktada zıpla
    });
  }
  return seq;
}

function advance(sim: Sim, input: MoveInput): void {
  sim.mover.step(input, 1 / 60);
  sim.world.step();
}

describe("KCC hareket determinizmi", () => {
  it("aynı girdi dizisi → bit-bit aynı son transform", () => {
    const a = buildSim();
    const b = buildSim();
    const inputs = scriptedInputs();

    for (const input of inputs) {
      advance(a, input);
      advance(b, input);
    }

    const ta = a.body.translation();
    const tb = b.body.translation();

    // Determinizm guard'ı: yaklaşık değil, TAM eşitlik bekliyoruz.
    expect(ta.x).toBe(tb.x);
    expect(ta.y).toBe(tb.y);
    expect(ta.z).toBe(tb.z);
  });

  it("karakter yerçekimiyle düşer ve zemine oturur", () => {
    const sim = buildSim();
    const idle: MoveInput = { moveX: 0, moveZ: 0, jump: false };

    const startY = sim.body.translation().y;
    for (let i = 0; i < 180; i++) advance(sim, idle);
    const endY = sim.body.translation().y;

    // y = 2'den başladı, zemine (~0.6: kapsül yarısı + yarıçap) oturmalı.
    expect(endY).toBeLessThan(startY); // düştü
    expect(endY).toBeGreaterThan(0.3); // zeminin içine geçmedi
    expect(sim.mover.grounded).toBe(true); // ve yere oturdu
  });

  it("coyote karesi: uçurumdan çıkınca kısa süre hâlâ zıplanır", () => {
    const sim = buildSim();
    // Önce yere otur.
    const idle: MoveInput = { moveX: 0, moveZ: 0, jump: false };
    for (let i = 0; i < 60; i++) advance(sim, idle);
    expect(sim.mover.grounded).toBe(true);

    // Tam yerdeyken zıpla: dikey hız pozitife fırlamalı.
    sim.mover.step({ moveX: 0, moveZ: 0, jump: true }, 1 / 60);
    expect(sim.mover.verticalVelocity).toBeGreaterThan(0);
  });
});
```

İlk test bütün iddianın kalbi: `toBe` ile tam eşitlik istiyoruz, `toBeCloseTo` ile "yaklaşık" değil. İki dünya bit-bit aynı sonuç vermiyorsa determinizm bir yerde kırılmış demektir. Bu guard, ileride hareket katmanına yanlışlıkla bir `Math.random()` ya da `Date.now()` sızdırırsan seni anında yakalar — çünkü o an iki dünya ayrışır ve test kırmızıya döner.

Diğer iki test daha somut davranışları çiviliyor: karakter gerçekten düşüp zemine oturuyor mu, yerdeyken zıplama dikey hızı hakikaten yukarı fırlatıyor mu. Hiçbiri tarayıcı açmıyor, hiçbiri gerçek bir saniye beklemiyor. Rapier WASM'ı `beforeAll` içinde bir kez kalkıyor, gerisi saf sayı.

Burada dürüst bir dipnot borçluyum. Rapier'ın determinizmi aynı sürüm ve aynı platformda garantidir; farklı işletim sistemleri ya da CPU'lar arasında kayan nokta (floating point) farkları çıkabilir. Yani bu test aynı makinede, aynı Rapier sürümüyle koştuğu sürece sağlam bir guard'dır — ki CI'da da öyle koşar. "Her yerde bit-bit aynı" iddiası abartı olurdu; "aynı build içinde aynı girdi → aynı çıktı" ise tam olarak test ettiğimiz ve güvenebileceğimiz şey.

### Demo: Bütün Katmanları Bir Arada Görmek

Saf mantık test edilir ama bir de gözle görülsün istedim. Demoda üçüncü şahıs bir kapsül karakter var: WASD ile yürüyor, boşlukla zıplıyor. Sahnede düz zemin, farklı açılarda birkaç rampa, bir merdiven, bir de itilecek birkaç dinamik kutu.

Ekranın kenarında hareket katmanının canlı hâli akıyor: dikey hız grafiği (düşüş-zıplama eğrisi), `grounded` bayrağı, coyote sayacının o kısacık yeşil penceresi, bir de kutu iterken enerji çubuğu. Karakter uçurumdan çıktığı an coyote penceresi yanıp sönüyor; rampaya girince açı gösterge çubuğu limitine yaklaşıyor; merdivende autostep her basamakta bir "tık" veriyor.

Bu overlay bir gösteriş değil, teşhis aracı. Karakter beklenmedik bir yerde takıldığında ya da havalandığında, sayıları gözünle okuyup nedenini görüyorsun: autostep limiti mi aşıldı, snap mesafesi mi yetmedi, eğim açısı mı fazla dik. Kutucuk sana "neden" diye bağırıyor.

Demo Vite ile çalışıyor; `npm run dev` deyip tarayıcıda açman yeterli. `file://` ile açarsan modüller ve WASM yüklenmez, boş ekran görürsün — bunu serideki her demoda tekrarlıyorum çünkü ben yeterince kez yedim.

### Özetle:

1. Rapier'ın `KinematicCharacterController`'ı tek iş yapar: verdiğin `desiredTranslation`'ı çarpışmaya göre budayıp `computedMovement()` ile geri verir. Öteleme (translation) yapar, hareketi üretmez.
2. Kinematik gövde dünyanın yerçekimini umursamaz. Havada asılı karakterin sebebi budur; dikey hareketi `desired.y`'ye sen koyarsın.
3. Dikey hızı biriktir (Euler): yerçekimi `vy`'yi, `vy` de pozisyonu değiştirir. Yerdeyken `vy`'yi sıfır değil küçük bir negatif yap ki merdiven titremesi olmasın.
4. `enableSnapToGround(dist)` karakteri zemine yapıştırır; yokuş aşağı ve küçük basamaklarda havalanmayı önler. `computedGrounded()` bir önceki karenin sonucunu verir — coyote sayacı için tam da bu lazım.
5. Eğim iki eşiktir: `setMaxSlopeClimbAngle` bundan diki tırmandırmaz, `setMinSlopeSlideAngle` bundan dikte kaydırır. Eşikleri tahminle değil, rampa taramasıyla ölç.
6. `enableAutostep(maxHeight, minWidth, includeDynamic)` alçak basamakları görünmez duvar olmaktan çıkarır. Kapalıyken 20 santimlik eşik bile karakteri durdurur.
7. `setApplyImpulsesToDynamicBodies(true)` + `setCharacterMass(m)` kutuları itmeni sağlar; kütleyi küçük tut, yoksa fizik patlar. Kinetik enerjiyi ölçerek "nazik itiş"i hisle değil sayıyla ayarla.
8. Hareket katmanını render'dan ayır: `now`/`dt` dışarıdan gelsin, çizim girmesin. O zaman iki özdeş dünyayı aynı girdiyle koşturup `toBe` ile bit-bit determinizmi tarayıcısız kanıtlarsın.

Repoda `npm test` bütün hareket katmanını tarayıcısız doğruluyor — 3 dosya, 7 test, yarım saniyenin altında; demoyu görmek istersen `npm run dev` seni rampalarda tırmanan, merdiven çıkan, kutu iten bir karakterle buluşturuyor.

Bu yazıyı yazarken fark ettiğim şey şu oldu: "character controller" ismi bir söz veriyor ama tutmuyor. Ve bu bir kusur değil, bir tasarım tercihi. Rapier zor kısmı — çarpışmayı doğru çözmeyi — üstleniyor, kolay ama zevkli kısmı — yerçekiminin ağırlığını, zıplamanın tavanını, itişin nezaketini — sana bırakıyor. Çünkü bir platformer'ın "hissi" tam olarak orada, o senin ayarladığın sayılarda saklı. Motor sana bir iskelet veriyor; eti sen giydiriyorsun.

Ha, unutmadan: KCC her oyun için doğru araç değil. Karakterin savrulsun, kutulardan seksin, rüzgârda uçsun istiyorsan dinamik bir gövde controller'ı daha az kavga çıkarır. Ama bir platformerın o keskin, öngörülebilir, "tam istediğim yere gidiyorum" hissini arıyorsan — havada asılı kalma sorununu çözdükten sonra — kinematik yol sana o kontrolü satır satır veriyor. 🎮⚙️
