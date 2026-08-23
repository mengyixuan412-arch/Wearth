"use client";

import { useSyncExternalStore } from "react";

export type ViewportSnapshot = {
  width: number;
  height: number;
  visualViewportHeight: number;
  dpr: number;
  orientation: "landscape" | "portrait";
};

const SERVER_SNAPSHOT: ViewportSnapshot = {
  width: 1,
  height: 1,
  visualViewportHeight: 1,
  dpr: 1,
  orientation: "portrait",
};

let snapshot: ViewportSnapshot = SERVER_SNAPSHOT;
let listening = false;
let teardown: (() => void) | null = null;
const listeners = new Set<() => void>();

function read(): ViewportSnapshot {
  const width = Math.max(1, window.innerWidth || 1);
  const height = Math.max(1, window.innerHeight || 1);
  const visualViewportHeight = Math.max(1, window.visualViewport?.height ?? height);
  return {
    width,
    height,
    visualViewportHeight,
    dpr: Math.max(1, window.devicePixelRatio || 1),
    orientation: width >= height ? "landscape" : "portrait",
  };
}

function measure() {
  const next = read();
  if (
    next.width !== snapshot.width ||
    next.height !== snapshot.height ||
    next.visualViewportHeight !== snapshot.visualViewportHeight ||
    next.dpr !== snapshot.dpr ||
    next.orientation !== snapshot.orientation
  ) {
    snapshot = next;
    for (const listener of listeners) listener();
  }
}

function ensureListening() {
  if (listening) return;
  listening = true;
  const onResize = () => measure();
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });
  const vv = window.visualViewport;
  vv?.addEventListener("resize", onResize, { passive: true });
  measure();
  teardown = () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    vv?.removeEventListener("resize", onResize);
    teardown = null;
    listening = false;
  };
}

export const subscribeViewport = (listener: () => void) => {
  listeners.add(listener);
  ensureListening();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) teardown?.();
  };
};

export const getViewportSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

export const useViewport = () => useSyncExternalStore(subscribeViewport, getViewportSnapshot, getServerSnapshot);

export const useIsMobile = () => useViewport().width < 1024;
export const useIsMobileWidth = () => useIsMobile();

export const useWindowSize = () => {
  const { width, height } = useViewport();
  return { width, height };
};
