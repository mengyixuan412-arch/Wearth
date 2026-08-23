"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Grid pitch in CSS pixels. */
const CELL = 18;
/** How long a cell takes to fade back out. */
const LIFETIME_MS = 900;
/** Hot end of the trail (nearest the cursor) → cool end, as RGB. */
const HOT = [255, 74, 158];
const COOL = [255, 176, 214];

/**
 * Pink grid trail that follows the pointer. Cells are keyed by grid coordinate
 * so a slow cursor keeps refreshing one cell instead of stacking many, and the
 * loop parks itself whenever nothing is still fading.
 */
export default function PointerTrail() {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The home page keeps its WebGL fluid pointer; the trail is for the rest.
  const enabled = pathname !== "/";

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    /** grid key -> time the cell was last touched */
    const cells = new Map<string, number>();
    let frame = 0;
    let running = false;

    const draw = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, width, height);

      for (const [key, stamp] of cells) {
        const age = (now - stamp) / LIFETIME_MS;
        if (age >= 1) {
          cells.delete(key);
          continue;
        }

        const [cx, cy] = key.split(",");
        // Ease out so the tail lingers a little rather than dropping linearly.
        const life = 1 - age;
        const alpha = life * life * 0.55;
        const mix = 1 - life;
        const r = Math.round(HOT[0] + (COOL[0] - HOT[0]) * mix);
        const g = Math.round(HOT[1] + (COOL[1] - HOT[1]) * mix);
        const b = Math.round(HOT[2] + (COOL[2] - HOT[2]) * mix);

        // Shrink as it fades, so the trail reads as a gradient rather than a stamp.
        const inset = (1 - life) * CELL * 0.22;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(
          Number(cx) * CELL + inset,
          Number(cy) * CELL + inset,
          CELL - inset * 2,
          CELL - inset * 2,
        );
      }

      if (cells.size > 0) {
        frame = requestAnimationFrame(draw);
      } else {
        running = false;
      }
    };

    const kick = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(draw);
    };

    let lastX = -1;
    let lastY = -1;

    const onPointerMove = (event: PointerEvent) => {
      const cx = Math.floor(event.clientX / CELL);
      const cy = Math.floor(event.clientY / CELL);

      // Fill the gap between samples so a fast flick leaves a continuous trail.
      if (lastX >= 0) {
        const steps = Math.max(Math.abs(cx - lastX), Math.abs(cy - lastY));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          cells.set(
            `${Math.round(lastX + (cx - lastX) * t)},${Math.round(lastY + (cy - lastY) * t)}`,
            performance.now(),
          );
        }
      }

      cells.set(`${cx},${cy}`, performance.now());
      lastX = cx;
      lastY = cy;
      kick();
    };

    const onPointerLeave = () => {
      lastX = -1;
      lastY = -1;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="z-[15] fixed inset-0 w-full h-full pointer-events-none"
    />
  );
}
