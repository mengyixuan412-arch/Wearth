import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";

/**
 * Keeps the specular light source orbiting at a fixed radius, its angle easing toward
 * wherever the pointer is on the z = 0 plane.
 */
export function createLightTracker() {
  const baseX = 4;
  const baseY = 9;
  const radius = Math.hypot(baseX, baseY);
  const baseAngle = Math.atan2(baseY, baseX);

  let targetAngle = baseAngle;
  let currentAngle = baseAngle;

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 0, 1), -0);
  const hit = new Vector3();
  const position = new Vector2(baseX, baseY);

  const get = () => ({ x: position.x, y: position.y });

  return {
    update({ uv, inside, camera, delta }: { uv: Vector2; inside: boolean; camera: Camera; delta: number }) {
      ndc.set(2 * uv.x - 1, 2 * uv.y - 1);
      raycaster.setFromCamera(ndc, camera);

      const intersection = raycaster.ray.intersectPlane(plane, hit);
      const hasHit = intersection !== null;
      if (hasHit) hit.copy(intersection);

      const tracking = inside && hasHit;
      const x = -hit.x;
      const y = -hit.y;
      if (tracking && x * x + y * y > 1e-6) targetAngle = Math.atan2(y, x);

      const desired = tracking ? targetAngle : baseAngle;
      const previous = currentAngle;
      const shortest = Math.atan2(Math.sin(desired - previous), Math.cos(desired - previous));
      currentAngle = previous + shortest * (1 - Math.exp(-6 * delta));

      position.x = radius * Math.cos(currentAngle);
      position.y = radius * Math.sin(currentAngle);
      return get();
    },
    get,
    reset(x = baseX, y = baseY) {
      currentAngle = Math.atan2(y, x);
      position.set(radius * Math.cos(currentAngle), radius * Math.sin(currentAngle));
    },
  };
}
