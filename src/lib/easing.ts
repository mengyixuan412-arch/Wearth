/** Numeric solver for a CSS cubic-bezier curve. */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const ax = 3 * p1x;
  const bx = 3 * (p2x - p1x) - ax;
  const cx = 1 - ax - bx;

  const ay = 3 * p1y;
  const by = 3 * (p2y - p1y) - ay;
  const cy = 1 - ay - by;

  const sampleX = (t: number) => ((cx * t + bx) * t + ax) * t;
  const sampleDerivativeX = (t: number) => (3 * cx * t + 2 * bx) * t + ax;

  const solveX = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      const slope = sampleDerivativeX(t);
      if (Math.abs(error) < 1e-7) return t;
      if (Math.abs(slope) < 1e-7) break;
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    while (low < high) {
      const sampled = sampleX(t);
      if (Math.abs(sampled - x) < 1e-7) break;
      if (x > sampled) low = t;
      else high = t;
      t = (high + low) / 2;
    }
    return t;
  };

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const t = solveX(x);
    return ((cy * t + by) * t + ay) * t;
  };
}

/** Matches the `--cubic-66` CSS token: cubic-bezier(0.66, 0, 0.01, 1). */
export const customCubic = cubicBezier(0.66, 0, 0.01, 1);

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
