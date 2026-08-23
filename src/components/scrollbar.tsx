"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { scrollEnv } from "@/lib/scroll-env";
import { subscribeScrollTopPx } from "@/lib/scroll-hooks";

const RING_CIRCUMFERENCE = 2 * Math.PI * 12;
const TRACK_TOP = 6;
const TRACK_LENGTH = 188;
const MIN_THUMB = 20;
const IDLE_HIDE_MS = 2000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Desktop: draggable vertical track. Mobile: circular scroll-progress button that scrolls to top. */
export default function Scrollbar({ hidden = false }: { hidden?: boolean }) {
  const containerEl = scrollEnv.useContainerEl();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mountedOnceRef = useRef(false);
  const thumbRef = useRef<SVGPathElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [transitionReady, setTransitionReady] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const firstShowRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStateRef = useRef({ startY: 0, startScrollTop: 0 });

  useLayoutEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  const flash = useCallback((duration = IDLE_HIDE_MS) => {
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), duration);
  }, []);

  useEffect(() => {
    if (!containerEl) return;
    if (!mountedOnceRef.current) {
      mountedOnceRef.current = true;
      setMounted(true);
    }
    flash(3000);
    if (!firstShowRef.current) {
      firstShowRef.current = true;
      rafRef.current = requestAnimationFrame(() => setTransitionReady(true));
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [containerEl, flash]);

  useEffect(() => {
    if (!containerEl) return;

    const sync = () => {
      const scrollTop = scrollEnv.getScrollTopPx();
      const isScrolled = scrollTop >= 36;
      setScrolled((current) => (current === isScrolled ? current : isScrolled));

      const total = Math.max(1, containerEl.scrollHeight);
      const client = Math.max(1, containerEl.clientHeight);
      const progress = clamp(scrollTop / Math.max(1, total - client), 0, 1);
      const thumbLength = Math.max(MIN_THUMB, TRACK_LENGTH * clamp(client / total, 0, 1));
      const thumbTop = TRACK_TOP + progress * (TRACK_LENGTH - thumbLength);

      thumbRef.current?.setAttribute("d", `M 16 ${thumbTop} V ${thumbTop + thumbLength}`);
      ringRef.current?.setAttribute("stroke-dashoffset", String(RING_CIRCUMFERENCE * (1 - progress)));
    };

    sync();

    const offScroll = subscribeScrollTopPx(() => {
      sync();
      if (!draggingRef.current) flash(IDLE_HIDE_MS);
    });

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => sync()) : null;
    observer?.observe(containerEl);
    const firstChild = containerEl.firstElementChild;
    if (firstChild instanceof HTMLElement) observer?.observe(firstChild);

    const frames: number[] = [];
    let remaining = 3;
    const settle = () => {
      sync();
      remaining -= 1;
      if (remaining > 0) frames.push(requestAnimationFrame(settle));
    };
    frames.push(requestAnimationFrame(settle));

    const onLoad = () => sync();
    window.addEventListener("load", onLoad, { passive: true });

    return () => {
      offScroll();
      observer?.disconnect();
      window.removeEventListener("load", onLoad);
      for (const frame of frames) cancelAnimationFrame(frame);
    };
  }, [containerEl, flash]);

  const scrollToTop = useCallback(() => scrollEnv.scrollToTop("smooth"), []);

  const metrics = useCallback(() => {
    const el = scrollEnv.getContainerEl();
    const totalH = el
      ? el.scrollHeight
      : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1);
    const clientH = el ? el.clientHeight : Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    return { el, totalH, clientH, validH: Math.max(1, totalH - clientH) };
  }, []);

  const onDragMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const deltaY = event.clientY - dragStateRef.current.startY;
      const { totalH, clientH, validH } = metrics();
      const travel = TRACK_LENGTH - Math.max(MIN_THUMB, TRACK_LENGTH * (totalH > 0 ? clamp(clientH / totalH, 0, 1) : 1));
      if (travel <= 0) return;
      scrollEnv.lenisScrollTo(dragStateRef.current.startScrollTop + (validH / travel) * deltaY, { immediate: true });
    },
    [metrics],
  );

  const onDragEnd = useCallback(() => {
    draggingRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    document.body.style.userSelect = "";
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`pointer-events-auto top-1/2 right-0 bottom-0 z-30 fixed w-14 px-3 h-50 -translate-y-1/2 hidden lg:block ${transitionReady ? "transition-opacity duration-500" : ""} ${visible ? "opacity-100" : "opacity-0"}${hidden ? " hidden!" : ""}`}
        aria-hidden={hidden}
        onMouseEnter={() => {
          setVisible(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }}
        onMouseLeave={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
        }}
      >
        <svg
          width="32"
          height="200"
          viewBox="0 0 32 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const local = clamp((event.clientY - rect.top) * (200 / rect.height), TRACK_TOP, TRACK_TOP + TRACK_LENGTH);
            const ratio = (local - TRACK_TOP) / TRACK_LENGTH;
            const { validH } = metrics();
            scrollEnv.lenisScrollTo(ratio * validH, { immediate: false });
          }}
        >
          <path
            d="M 16 6 V 194"
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth="6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            ref={thumbRef}
            d="M 16 6 V 6"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinejoin="round"
            strokeLinecap="round"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              draggingRef.current = true;
              dragStateRef.current = { startY: event.clientY, startScrollTop: scrollEnv.getScrollTopPx() };
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              setVisible(true);
              document.body.style.userSelect = "none";
              abortRef.current?.abort();
              abortRef.current = new AbortController();
              const { signal } = abortRef.current;
              document.addEventListener("mousemove", onDragMove, { signal });
              document.addEventListener("mouseup", onDragEnd, { signal });
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </svg>
      </div>

      <div
        className={`pointer-events-auto lg:hidden right-0 bottom-0 z-30 fixed flex justify-center items-center px-6 py-6${hidden ? " hidden" : ""}`}
        role="button"
        tabIndex={hidden ? -1 : 0}
        aria-label="Scroll to top"
        aria-hidden={hidden}
        onClick={scrollToTop}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            scrollToTop();
          }
        }}
      >
        <svg
          width="24px"
          height="24px"
          viewBox="0 0 32 32"
          className={`${scrolled ? "scale-100" : "scale-50"} transition-all duration-[0.66s] ease-66 pointer-events-none`}
        >
          <circle
            r="12"
            cy="16"
            cx="16"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth={scrolled ? "4" : "8"}
            stroke="currentColor"
            strokeOpacity={scrolled ? 0.2 : 1}
            transform="rotate(-90 16 16)"
            style={{
              transition:
                "stroke-opacity 0.66s cubic-bezier(0.66, 0, 0.01, 1), stroke-width 0.66s cubic-bezier(0.66, 0, 0.01, 1)",
            }}
          />
          <circle
            ref={ringRef}
            r="12"
            cy="16"
            cx="16"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth={scrolled ? "4" : "8"}
            stroke="currentColor"
            strokeDashoffset={RING_CIRCUMFERENCE}
            strokeDasharray={RING_CIRCUMFERENCE}
            transform="rotate(-90 16 16)"
            style={{
              transition:
                "stroke-opacity 0.66s cubic-bezier(0.66, 0, 0.01, 1), stroke-width 0.66s cubic-bezier(0.66, 0, 0.01, 1)",
            }}
          />
        </svg>
      </div>
    </>
  );
}
