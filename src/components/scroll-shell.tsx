"use client";

import { addEffect } from "@react-three/fiber";
import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { bindLenisScrollBus, scrollEnv } from "@/lib/scroll-env";

/**
 * Drives Lenis from R3F's own frame loop via `addEffect`, so scroll is advanced
 * in the same frame the canvas renders. A separate rAF loop would leave WebGL
 * reading a one-frame-stale scroll value, which shows up as DOM-synced image
 * planes jittering against their placeholders during fast scrolling.
 */
function LenisBridge() {
  const lenis = useLenis();

  useEffect(() => {
    bindLenisScrollBus(lenis ?? null);
    scrollEnv.setLenisInstance(lenis ?? null);
    return () => {
      bindLenisScrollBus(null);
      scrollEnv.setLenisInstance(null);
    };
  }, [lenis]);

  useEffect(() => {
    if (!lenis) return;
    return addEffect((time) => {
      lenis.raf(time);
    });
  }, [lenis]);

  return null;
}

const SCROLLER_CLASS = "w-full h-full overflow-y-auto overscroll-contain no-scrollbar";

function SmoothScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<{ wrapper?: HTMLElement | null } | null>(null);

  useEffect(() => {
    scrollEnv.setContainerEl(ref.current?.wrapper ?? null);
    return () => scrollEnv.setContainerEl(null);
  }, []);

  return (
    <ReactLenis
      ref={ref as never}
      options={{ lerp: 0.1, smoothWheel: true, syncTouch: true, anchors: true, autoRaf: false }}
      className={SCROLLER_CLASS}
    >
      <LenisBridge />
      {children}
    </ReactLenis>
  );
}

function NativeScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEnv.setContainerEl(ref.current);
    return () => scrollEnv.setContainerEl(null);
  }, []);

  return (
    <div ref={ref} className={SCROLLER_CLASS}>
      {children}
    </div>
  );
}

export default function ScrollShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const containerEl = scrollEnv.useContainerEl();

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    const reset = () => {
      if (window.location.hash) return;
      if (containerEl) {
        containerEl.scrollTo({ top: 0, left: 0, behavior: "auto" });
        requestAnimationFrame(() => containerEl.scrollTo({ top: 0, left: 0, behavior: "auto" }));
        return;
      }
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    reset();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [containerEl]);

  useEffect(() => {
    if (!containerEl || !window.location.hash) return;
    const raw = window.location.hash.slice(1);
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {
      /* keep raw */
    }

    const jump = () => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top - containerEl.getBoundingClientRect().top + containerEl.scrollTop - 96;
      scrollEnv.lenisScrollTo(Math.max(0, top), { immediate: true });
    };

    requestAnimationFrame(() => requestAnimationFrame(jump));
  }, [pathname, containerEl]);

  return (
    <div className="fixed inset-0 w-full h-full">
      {isHome ? <SmoothScroller>{children}</SmoothScroller> : <NativeScroller>{children}</NativeScroller>}
    </div>
  );
}
