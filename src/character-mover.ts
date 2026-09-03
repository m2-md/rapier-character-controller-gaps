// character-mover.ts
import type RAPIER from "@dimforge/rapier3d-compat";

export interface MoveInput {
  moveX: number; // horizontal request, -1..1
  moveZ: number; // depth request, -1..1
  jump: boolean; // was the jump key pressed on this frame
}

export class CharacterMover {
  private vy = 0; // vertical velocity (m/s)
  private airTime = 0; // time elapsed since we last left the ground (s)

  readonly coyoteTime = 0.1; // 100 ms of jump grace after leaving the ground
  private readonly gravity = -30; // heavier than the real 9.81, for "feel"
  private readonly jumpSpeed = 9; // v²/2g ≈ 1.35 m jump ceiling
  private readonly moveSpeed = 6; // horizontal walk speed (m/s)

  constructor(
    private readonly body: RAPIER.RigidBody,
    private readonly collider: RAPIER.Collider,
    private readonly controller: RAPIER.KinematicCharacterController,
  ) {}

  step(input: MoveInput, dt: number): void {
    // computedGrounded(): the result of the PREVIOUS computeColliderMovement.
    // That is, "did we touch the ground last frame". Exactly what coyote needs.
    const grounded = this.controller.computedGrounded();
    this.airTime = grounded ? 0 : this.airTime + dt;

    if (grounded && this.vy <= 0) {
      // Grounded and falling: pin vertical velocity to a small downward force.
      // Together with snapToGround this keeps the character "glued" to the floor.
      this.vy = -2;
    } else {
      // We are airborne: gravity accumulates velocity (Euler).
      this.vy += this.gravity * dt;
    }

    // Coyote: if less than coyoteTime has passed since ground contact, jump is on.
    const canJump = this.airTime <= this.coyoteTime;
    if (input.jump && canJump) {
      this.vy = this.jumpSpeed;
      this.airTime = this.coyoteTime + 1; // "burn" the coyote: no double jump
    }

    // The request: horizontal speeds + accumulated vertical speed, dt turns all into distance.
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
