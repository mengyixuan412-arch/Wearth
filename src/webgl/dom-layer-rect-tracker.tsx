"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { scrollEnv } from "@/lib/scroll-env";

export type TargetRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type TrackedLayer = { key: string; targetRef: React.RefObject<HTMLElement | null> };

/**
 * Keeps viewport-space rects for every DOM-backed WebGL layer.
 *
 * Rects are shifted by the scroll delta every frame (cheap) and only re-measured with
 * `getBoundingClientRect` when a layer is near the viewport, or on its turn in a
 * 12-frame round-robin (so off-screen layers still refresh, just rarely).
 */
export default function DomLayerRectTracker({
  layers,
  targetRectMapRef,
}: {
  layers: TrackedLayer[];
  targetRectMapRef: React.RefObject<Record<string, TargetRect>>;
}) {
  const frameRef = useRef(0);
  const lastScroll = useRef({ top: scrollEnv.getScrollTopPx(), left: scrollEnv.getScrollLeftPx() });

  useFrame(() => {
    const frame = frameRef.current++;
    const scrollTop = scrollEnv.getScrollTopPx();
    const scrollLeft = scrollEnv.getScrollLeftPx();
    const deltaTop = scrollTop - lastScroll.current.top;
    const deltaLeft = scrollLeft - lastScroll.current.left;
    lastScroll.current.top = scrollTop;
    lastScroll.current.left = scrollLeft;

    const map = targetRectMapRef.current;
    if (deltaTop !== 0 || deltaLeft !== 0) {
      for (const rect of Object.values(map)) {
        rect.top -= deltaTop;
        rect.bottom -= deltaTop;
        rect.left -= deltaLeft;
        rect.right -= deltaLeft;
      }
    }

    const viewportHeight = scrollEnv.getViewportHeightPx();

    for (let index = 0; index < layers.length; index++) {
      const layer = layers[index];
      const el = layer.targetRef.current;
      if (!el) continue;

      const cached = map[layer.key];
      const margin = Math.max(1.5 * viewportHeight, 600);
      const near = !cached || (cached.bottom > -margin && cached.top < viewportHeight + margin);
      const scheduled = frame % 12 === index % 12;
      if (!near && !scheduled) continue;

      const rect = el.getBoundingClientRect();
      if (cached) {
        cached.left = rect.left;
        cached.top = rect.top;
        cached.width = rect.width;
        cached.height = rect.height;
        cached.right = rect.right;
        cached.bottom = rect.bottom;
        continue;
      }
      map[layer.key] = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    }
  });

  return null;
}
