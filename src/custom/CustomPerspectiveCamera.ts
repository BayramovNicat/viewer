export class CustomPerspectiveCamera {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  position: { x: number; y: number; z: number };

  constructor(fov: number, aspect: number, near: number, far: number) {
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.position = { x: 0, y: 0, z: 0 };
  }

  lookAt(x: number, y: number, z: number) {
    // Simple lookAt implementation
    console.log(`Camera looking at (${x}, ${y}, ${z})`);
  }
}