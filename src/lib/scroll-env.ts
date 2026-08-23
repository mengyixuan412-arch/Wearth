"use client";

import { useEffect, useState } from "react";
import type Lenis from "lenis";

import { getViewportSnapshot, subscribeViewport } from "./viewport-store";

export type LenisScrollSnapshot = {
  scrollTop: number;
  limit: number;
  progress: number;
  velocity: number;
  direction: number;
  viewportHeight: number;
};

const scrollListeners = new Set<() => void>();
let lenisInstance: Lenis | null = null;
let detachLenis: (() => void) | null = null;
let detachViewport: (() => void) | null = null;

let scrollSnapshot: LenisScrollSnapshot = {
  scrollTop: 0,
  limit: 1,
  progress: 0,
  velocity: 0,
  direction: 0,
  viewportHeight: 1,
};

const viewportHeight = () => {
  const vp = getViewportSnapshot();
  return vp.height > 1 ? vp.height : Math.max(1, window.innerHeight || 1);
};

const emitScroll = () => {
  for (const listener of scrollListeners) listener();
};

const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

type LenisEventPayload = { scroll?: number; limit?: number; progress?: number; velocity?: number; direction?: number };

const commitScroll = (payload?: LenisEventPayload, viewportOnly = false) => {
  const scrollTop = viewportOnly
    ? scrollSnapshot.scrollTop
    : finite(payload?.scroll, lenisInstance?.scroll ?? scrollSnapshot.scrollTop);
  const limit = Math.max(
    1,
    viewportOnly ? scrollSnapshot.limit : finite(payload?.limit, lenisInstance?.limit ?? scrollSnapshot.limit),
  );
  const progress = Math.min(
    1,
    Math.max(0, viewportOnly ? scrollSnapshot.progress : finite(payload?.progress, scrollTop / limit)),
  );
  const velocity = viewportOnly ? scrollSnapshot.velocity : finite(payload?.velocity, lenisInstance?.velocity ?? 0);
  const direction = viewportOnly ? scrollSnapshot.direction : finite(payload?.direction, lenisInstance?.direction ?? 0);
  const height = viewportHeight();

  if (
    scrollSnapshot.scrollTop !== scrollTop ||
    scrollSnapshot.limit !== limit ||
    scrollSnapshot.progress !== progress ||
    scrollSnapshot.velocity !== velocity ||
    scrollSnapshot.direction !== direction ||
    scrollSnapshot.viewportHeight !== height
  ) {
    scrollSnapshot = { scrollTop, limit, progress, velocity, direction, viewportHeight: height };
    emitScroll();
  }
};

export const bindLenisScrollBus = (instance: Lenis | null) => {
  if (lenisInstance === instance) return;
  detachLenis?.();
  detachLenis = null;
  detachViewport?.();
  detachViewport = null;
  lenisInstance = instance;

  if (!instance) {
    scrollSnapshot = { ...scrollSnapshot, velocity: 0, direction: 0, viewportHeight: viewportHeight() };
    emitScroll();
    return;
  }

  detachViewport = subscribeViewport(() => commitScroll(undefined, true));
  const onScroll = (payload: LenisEventPayload) => commitScroll(payload);
  instance.on("scroll", onScroll);
  detachLenis = () => instance.off("scroll", onScroll);
  commitScroll();
};

export const getLenisScrollSnapshot = () => scrollSnapshot;
export const subscribeLenisScroll = (listener: () => void) => {
  scrollListeners.add(listener);
  return () => {
    scrollListeners.delete(listener);
  };
};

let containerEl: HTMLElement | null = null;
let lenisRef: Lenis | null = null;
const containerListeners = new Set<(el: HTMLElement | null) => void>();

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

const edgeTarget = (el: HTMLElement | null, edge: "top" | "bottom") => {
  if (edge === "top") return 0;
  if (el) return Math.max(0, el.scrollHeight - el.clientHeight);
  const root = document.documentElement;
  const body = document.body;
  return Math.max(
    0,
    Math.max(root?.scrollHeight ?? 0, body?.scrollHeight ?? 0, root?.offsetHeight ?? 0, body?.offsetHeight ?? 0) -
      window.innerHeight,
  );
};

export const scrollEnv = {
  setContainerEl(el: HTMLElement | null) {
    containerEl = el;
    for (const listener of containerListeners) listener(containerEl);
  },
  setLenisInstance(instance: Lenis | null) {
    lenisRef = instance;
  },
  lenisScrollTo(target: number | string | HTMLElement, options?: { immediate?: boolean; lerp?: number }) {
    if (lenisRef) {
      lenisRef.scrollTo(target, { force: true, ...options });
      return;
    }
    if (typeof target !== "number") return;
    const behavior: ScrollBehavior = options?.immediate ? "auto" : "smooth";
    if (containerEl) containerEl.scrollTo({ top: target, left: 0, behavior });
    else window.scrollTo({ top: target, left: 0, behavior });
  },
  getContainerEl: () => containerEl,
  subscribeContainerEl(listener: (el: HTMLElement | null) => void) {
    containerListeners.add(listener);
    return () => {
      containerListeners.delete(listener);
    };
  },
  useContainerEl() {
    const [el, setEl] = useState<HTMLElement | null>(() => scrollEnv.getContainerEl());
    useEffect(() => scrollEnv.subscribeContainerEl((next) => setEl(next)), []);
    return el;
  },
  useScrollEdgeShortcuts({
    topKey = "t",
    bottomKey = "b",
    behavior = "smooth",
  }: { topKey?: string; bottomKey?: string; behavior?: ScrollBehavior } = {}) {
    const heldRef = useState<{ current: string | null }>(() => ({ current: null }))[0];
    useEffect(() => {
      const top = topKey.toLowerCase();
      const bottom = bottomKey.toLowerCase();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target))
          return;
        const key = event.key.toLowerCase();
        if (key !== top && key !== bottom) return;
        if (heldRef.current === key) return;
        heldRef.current = key;
        scrollEnv.scrollToEdge(key === top ? "top" : "bottom", behavior);
      };
      const onKeyUp = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target))
          return;
        if (heldRef.current === event.key.toLowerCase()) heldRef.current = null;
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, [behavior, bottomKey, topKey, heldRef]);
  },
  getScrollTopPx() {
    if (lenisRef != null) return getLenisScrollSnapshot().scrollTop;
    if (containerEl) return containerEl.scrollTop;
    return window.scrollY ?? document.documentElement.scrollTop ?? 0;
  },
  getScrollLeftPx() {
    if (containerEl) return containerEl.scrollLeft;
    return window.scrollX ?? document.documentElement.scrollLeft ?? 0;
  },
  getViewportHeightPx() {
    if (containerEl) return Math.max(1, containerEl.clientHeight || 1);
    return Math.max(1, window.innerHeight || 1);
  },
  scrollToEdge(edge: "top" | "bottom", behavior: ScrollBehavior = "smooth") {
    const target = edgeTarget(containerEl, edge);
    if (lenisRef) lenisRef.scrollTo(target, { force: true, immediate: behavior === "auto" });
    else if (containerEl) containerEl.scrollTo({ top: target, left: 0, behavior });
    else window.scrollTo({ top: target, left: 0, behavior });
  },
  scrollToTop(behavior: ScrollBehavior = "smooth") {
    scrollEnv.scrollToEdge("top", behavior);
  },
  scrollToBottom(behavior: ScrollBehavior = "smooth") {
    scrollEnv.scrollToEdge("bottom", behavior);
  },
};
