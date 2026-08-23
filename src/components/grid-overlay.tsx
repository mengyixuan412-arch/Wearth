"use client";

import { useMemo } from "react";

import { useHomeLoadingGate } from "@/lib/use-home-loading-gate";
import { useWindowSize } from "@/lib/viewport-store";

const LINE_COLOR = "rgba(255, 255, 255, 0.1)";

/** Fixed crosshair grid drawn over everything with `mix-blend-difference`. */
export default function GridOverlay() {
  const { width, height } = useWindowSize();
  const loading = useHomeLoadingGate();
  const margin = width < 1024 ? 16 : 56;

  const { verticalPath, horizontalPath, crossPath } = useMemo(() => {
    const innerWidth = Math.max(0, width - 2 * margin);
    const band = Math.max(0, height / 3 - 12);
    const secondStart = band + 24;
    const secondEnd = secondStart + band;
    const columns = width < 1280 ? 2 : 3;

    const xs = Array.from({ length: columns + 1 }, (_, i) => margin + (i / columns) * innerWidth).map(
      (x) => Math.round(x) + 0.5,
    );
    const bands = [
      { startY: 0, endY: band },
      { startY: secondStart, endY: secondEnd },
      { startY: secondEnd + 24, endY: height },
    ];
    const ys = [band + 12, secondEnd + 12];

    const vertical = bands.map(({ startY, endY }) => xs.map((x) => `M${x} ${startY}V${endY}`).join("")).join("");

    const horizontal = ys
      .map((y) => {
        if (xs.length < 2) return "";
        const first = xs[0];
        const last = xs[xs.length - 1];
        const middle = xs.slice(0, -1).map((x, i) => `M${x + 12} ${y}H${xs[i + 1] - 12}`);
        return [`M0 ${y}H${first - 12}`, ...middle, `M${last + 12} ${y}H${width}`].join("");
      })
      .join("");

    const cross = xs
      .flatMap((x) => ys.flatMap((y) => [`M${x} ${y - 6}V${y + 6}`, `M${x - 6} ${y}H${x + 6}`]))
      .join("");

    return { verticalPath: vertical, horizontalPath: horizontal, crossPath: cross };
  }, [height, margin, width]);

  if (loading) return null;

  return (
    <div className="z-20 fixed inset-0 w-full h-full pointer-events-none mix-blend-difference">
      <svg viewBox={`0 0 ${width} ${height}`} className="block" shapeRendering="crispEdges">
        <path d={verticalPath} stroke={LINE_COLOR} strokeWidth="1" fill="none" />
        <path d={horizontalPath} stroke={LINE_COLOR} strokeWidth="1" fill="none" />
        <path d={crossPath} stroke="#FFFFFF" strokeWidth="1" fill="none" opacity={0.4} />
      </svg>
    </div>
  );
}
