"use client";

import { useCallback, useSyncExternalStore } from "react";

import { getLenisScrollSnapshot, scrollEnv, subscribeLenisScroll } from "./scroll-env";

const serverScrollTop = () => 0;
const readScrollTop = () => getLenisScrollSnapshot().scrollTop;

const isNearBottom = (ratio: number) => {
  const { scrollTop, limit, viewportHeight } = getLenisScrollSnapshot();
  return Math.max(0, limit - scrollTop) <= viewportHeight * Math.min(1, Math.max(0, ratio));
};

export const subscribeScrollTopPx = (listener: () => void) => {
  const offLenis = subscribeLenisScroll(listener);
  let offNative: (() => void) | null = null;

  const attach = (el: HTMLElement | null) => {
    offNative?.();
    const target: HTMLElement | Window = el ?? window;
    target.addEventListener("scroll", listener, { passive: true });
    offNative = () => target.removeEventListener("scroll", listener);
  };

  attach(scrollEnv.getContainerEl());
  const offContainer = scrollEnv.subscribeContainerEl((el) => {
    attach(el);
    listener();
  });

  return () => {
    offLenis();
    offContainer();
    offNative?.();
    offNative = null;
  };
};

export const useLenisScrollTop = () =>
  useSyncExternalStore(subscribeLenisScroll, readScrollTop, serverScrollTop);

export const useNearBottom = (ratio = 0.5) =>
  useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => {
        let current = isNearBottom(ratio);
        return subscribeLenisScroll(() => {
          const next = isNearBottom(ratio);
          if (next !== current) {
            current = next;
            onStoreChange();
          }
        });
      },
      [ratio],
    ),
    () => isNearBottom(ratio),
    () => false,
  );
