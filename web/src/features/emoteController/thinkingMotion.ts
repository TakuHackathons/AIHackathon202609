import { Euler, Object3D, Quaternion } from 'three';

/** Add a subtle thinking pose on top of the idle animation, without accumulating rotation. */
export class ThinkingMotion {
  private active = false;
  private weight = 0;
  private elapsed = 0;
  private offset = new Quaternion();
  private inverse = new Quaternion();
  private angles = new Euler();
  private applied = false;

  constructor(private head: Object3D) {}

  setActive(active: boolean) {
    if (active && !this.active) this.elapsed = 0;
    this.active = active;
  }

  // Restore the animated pose before the mixer updates (including unkeyed bones).
  restore() {
    if (!this.applied) return;
    this.head.quaternion.multiply(this.inverse.copy(this.offset).invert());
    this.applied = false;
  }

  update(delta: number) {
    this.elapsed += delta;
    this.weight += ((this.active ? 1 : 0) - this.weight) * (1 - Math.exp(-delta * 6));
    if (!this.active && this.weight < 0.001) {
      this.weight = 0;
      return;
    }
    this.angles.set(
      (0.07 + Math.sin(this.elapsed * 1.3) * 0.025) * this.weight,
      Math.sin(this.elapsed * 0.7) * 0.055 * this.weight,
      (0.12 + Math.sin(this.elapsed * 0.9) * 0.025) * this.weight,
    );
    this.offset.setFromEuler(this.angles);
    this.head.quaternion.multiply(this.offset);
    this.applied = true;
  }
}
