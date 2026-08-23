"use client";

import { useCallback, useSyncExternalStore } from "react";

export const ARROW_FULLSCREEN_DOM_COLOR_TRANSITION =
  "transition-colors duration-300 ease-out motion-reduce:transition-none";

type Mode = "gte" | "lte";

const compare = (mode: Mode, value: number, threshold: number) =>
  mode === "gte" ? value >= threshold : value <= threshold;

let dampedScaleT = 0;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

export const arrowFullscreenProgressStore = {
  getSnapshot: () => dampedScaleT,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setDampedScaleT(value: number) {
    const next = Math.min(1, Math.max(0, value));
    if (Math.abs(next - dampedScaleT) <= 0.001) return;
    dampedScaleT = next;
    emit();
  },
  reset() {
    if (dampedScaleT !== 0) {
      dampedScaleT = 0;
      emit();
    }
  },
};

export const readArrowFullscreenPastThreshold = (threshold = 0.5) =>
  arrowFullscreenProgressStore.getSnapshot() >= threshold;

export const useArrowFullscreenPastThreshold = (
  threshold = 0.5,
  options?: { mode?: Mode; getServerSnapshot?: () => boolean },
) => {
  const mode = options?.mode ?? "gte";
  const getServerSnapshot = options?.getServerSnapshot ?? (() => compare(mode, 0, threshold));
  const { subscribe, getSnapshot } = arrowFullscreenProgressStore;

  return useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => {
        let current = compare(mode, getSnapshot(), threshold);
        return subscribe(() => {
          const next = compare(mode, getSnapshot(), threshold);
          if (next !== current) {
            current = next;
            onStoreChange();
          }
        });
      },
      [subscribe, getSnapshot, threshold, mode],
    ),
    () => compare(mode, getSnapshot(), threshold),
    getServerSnapshot,
  );
};
