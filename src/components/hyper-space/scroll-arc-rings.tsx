"use client";

import { memo, useId, useLayoutEffect, useRef } from "react";

const PHASE = { enterSpan: 300, exitSpan: 345, cycleDist: 300, totalDist: 600 + 345 } as const;
const RING_COUNT = 7;
const RING_INDICES = [0, 1, 2, 3, 4, 5, 6];
const RING_SPACING = 50;
const TRAVEL = 300;

/** Pre-sampled semicircle: the radius profile of a ring as it travels down the tube. */
const ARC_TABLE = (() => {
  const table = new Float32Array(TRAVEL + 1);
  for (let i = 0; i <= TRAVEL; i++) {
    const offset = i - 150;
    const value = 22500 - offset * offset;
    table[i] = value > 0 ? Math.sqrt(value) : 0;
  }
  return table;
})();

const seenPositions = new Float32Array(RING_COUNT);

const sampleArc = (position: number) => {
  if (position <= 0 || position >= TRAVEL) return 0;
  const index = position | 0;
  const fraction = position - index;
  return fraction <= 0 ? ARC_TABLE[index] : ARC_TABLE[index] + (ARC_TABLE[index + 1] - ARC_TABLE[index]) * fraction;
};

/** Collapses rings that would land on the same scanline, so strokes never double up. */
const dedupe = (position: number, count: number) => {
  for (let i = 0; i < count; i++) if (Math.abs(seenPositions[i] - position) < 0.5) return count;
  seenPositions[count] = position;
  return count + 1;
};

function layout(rings: (SVGEllipseElement | null)[], progress01: number) {
  const distance = (progress01 < 0 ? 0 : progress01 > 1 ? 1 : progress01) * PHASE.totalDist;

  let phase = 0;
  let local = distance;
  if (distance > PHASE.enterSpan) {
    if (distance <= PHASE.enterSpan + PHASE.cycleDist) {
      phase = 1;
      local = distance - PHASE.enterSpan;
    } else {
      phase = 2;
      local = distance - PHASE.enterSpan - PHASE.cycleDist;
    }
  }

  const head = phase === 0 ? (local / RING_SPACING) | 0 : 0;
  let placed = 0;

  for (let i = 0; i < RING_COUNT; i++) {
    const ring = rings[i];
    if (!ring) continue;

    let position = 0;
    let active = false;

    if (phase === 0) {
      if (local >= RING_SPACING * i) {
        position = local - ((head < 6 ? head : 6) - i) * RING_SPACING;
        active = position > 0 && position < TRAVEL;
      }
    } else if (phase === 1) {
      position = (((local + RING_SPACING * i) % TRAVEL) + TRAVEL) % TRAVEL;
      active = position > 0 && position < TRAVEL;
    } else {
      position = local + RING_SPACING * i;
      active = position > 0 && position < TRAVEL;
    }

    if (!active) {
      ring.style.visibility = "hidden";
      continue;
    }

    const radius = sampleArc(position);
    if (radius <= 0) {
      ring.style.visibility = "hidden";
      continue;
    }

    const next = dedupe(position, placed);
    if (next === placed) {
      ring.style.visibility = "hidden";
      continue;
    }
    placed = next;

    ring.style.visibility = "visible";
    ring.cx.baseVal.value = 172;
    ring.cy.baseVal.value = 22 + position;
    ring.rx.baseVal.value = radius;
    ring.ry.baseVal.value = 0.1 * radius;
  }
}

const ScrollArcRings = memo(function ScrollArcRings({
  progress01,
  size = 344,
  className = "",
}: {
  progress01: number;
  size?: number;
  className?: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const ringRefs = useRef<(SVGEllipseElement | null)[]>([]);

  useLayoutEffect(() => {
    layout(ringRefs.current, progress01);
  }, [progress01]);

  return (
    <div
      className={`pointer-events-none absolute top-1/2 left-1/2 z-0 size-(--sar-size) -translate-x-1/2 -translate-y-1/2 overflow-hidden contain-[layout_paint_style] ${className}`}
      style={{ "--sar-size": `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 344 344"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points="20,22 324,22 324,322 20,322" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {RING_INDICES.map((index) => (
            <ellipse
              key={index}
              ref={(el) => {
                ringRefs.current[index] = el;
              }}
              visibility="hidden"
              stroke="#C0FE04"
              strokeOpacity={1}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
    </div>
  );
});

export default ScrollArcRings;
