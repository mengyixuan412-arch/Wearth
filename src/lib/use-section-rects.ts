"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { scrollEnv } from "@/lib/scroll-env";
import { subscribeViewport } from "@/lib/viewport-store";
import { subscribeLenisScroll } from "@/lib/scroll-env";

export type TrackedSection = {
  name: string;
  ref: React.RefObject<HTMLElement | null>;
  current_state?: string;
};

export type SectionRect = {
  name: string;
  viewportX: number;
  viewportY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ref: React.RefObject<HTMLElement | null>;
  current_state?: string;
};

const sameRect = (a: SectionRect, b: SectionRect) =>
  a.name === b.name &&
  Math.abs(a.x - b.x) <= 0.5 &&
  Math.abs(a.y - b.y) <= 0.5 &&
  Math.abs(a.width - b.width) <= 0.5 &&
  Math.abs(a.height - b.height) <= 0.5 &&
  a.current_state === b.current_state;

/**
 * Measures tracked DOM sections in scroll-container space so the WebGL layer can
 * position meshes exactly over their DOM counterparts.
 */
export function useSectionRects(sections: TrackedSection[]) {
  const [rects, setRects] = useState<SectionRect[]>([]);
  const sectionsRef = useRef(sections);

  useLayoutEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    const measure = (name: string, el: HTMLElement | null) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      let viewportX = rect.left;
      let viewportY = rect.top;
      let x = rect.left + window.scrollX;
      let y = rect.top + scrollEnv.getScrollTopPx();

      const container = scrollEnv.getContainerEl();
      if (container) {
        const containerRect = container.getBoundingClientRect();
        viewportX = rect.left - containerRect.left;
        viewportY = rect.top - containerRect.top;
        x = viewportX + container.scrollLeft;
        y = viewportY + scrollEnv.getScrollTopPx();
      }

      return { name, viewportX, viewportY, x, y, width: rect.width, height: rect.height };
    };

    const sync = () => {
      const next: SectionRect[] = [];
      for (const section of sectionsRef.current) {
        const measured = measure(section.name, section.ref.current);
        if (measured) next.push({ ...measured, ref: section.ref, current_state: section.current_state });
      }
      setRects((current) => {
        if (current.length !== next.length) return next;
        for (let i = 0; i < current.length; i++) if (!sameRect(current[i], next[i])) return next;
        return current;
      });
    };

    sync();
    const offScroll = subscribeLenisScroll(sync);
    const offViewport = subscribeViewport(sync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    const container = scrollEnv.getContainerEl();
    if (container) observer?.observe(container);
    for (const section of sectionsRef.current) {
      if (section.ref.current) observer?.observe(section.ref.current);
    }

    return () => {
      offScroll();
      offViewport();
      observer?.disconnect();
    };
  }, [sections]);

  return rects;
}
