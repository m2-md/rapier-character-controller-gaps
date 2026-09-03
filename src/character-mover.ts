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
