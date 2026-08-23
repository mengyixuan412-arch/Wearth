"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Vector2 } from "three";

export type PointerSnapshot = { x: number; y: number; inside: boolean };

const SERVER_SNAPSHOT: PointerSnapshot = { x: 0.5, y: 0.5, inside: false };

type PointerContextValue = {
  uv: Vector2;
  insideRef: React.RefObject<boolean>;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PointerSnapshot;
  getServerSnapshot: () => PointerSnapshot;
};

const PointerContext = createContext<PointerContextValue | null>(null);

export const usePointer = () => {
  const ctx = useContext(PointerContext);
  if (!ctx) throw new Error("usePointer must be used within PointerProvider");
  return ctx;
};

export const usePointerPosition = () => {
  const ctx = usePointer();
  return useSyncExternalStore(ctx.subscribe, ctx.getSnapshot, ctx.getServerSnapshot);
};

export function PointerProvider({ children }: { children: React.ReactNode }) {
  const uv = useMemo(() => new Vector2(0.5, 0.5), []);
  const insideRef = useRef(false);
  const snapshotRef = useRef<PointerSnapshot>(SERVER_SNAPSHOT);
  const listenersRef = useRef(new Set<() => void>());
  const rafRef = useRef<number | null>(null);

  const value = useMemo<PointerContextValue>(
    () => ({
      uv,
      insideRef,
      subscribe: (listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      getSnapshot: () => snapshotRef.current,
      getServerSnapshot: () => SERVER_SNAPSHOT,
    }),
    [uv],
  );

  useEffect(() => {
    const flush = () => {
      rafRef.current = null;
      for (const listener of listenersRef.current) listener();
    };

    const commit = (next: PointerSnapshot) => {
      const prev = snapshotRef.current;
      if (prev.x === next.x && prev.y === next.y && prev.inside === next.inside) return;
      snapshotRef.current = next;
      insideRef.current = next.inside;
      uv.set(next.x, next.y);
      if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(flush);
    };

    const onPointer = (event: PointerEvent) => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      commit({ x: event.clientX / w, y: 1 - event.clientY / h, inside: true });
    };

    const onLeave = () => commit({ x: 0.5, y: 0.5, inside: false });

    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointermove", onPointer, opts);
    window.addEventListener("pointerdown", onPointer, opts);
    window.addEventListener("pointerover", onPointer, opts);
    window.addEventListener("blur", onLeave, opts);
    document.addEventListener("mouseleave", onLeave, opts);
    document.addEventListener("visibilitychange", onLeave, opts);

    return () => {
      window.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointerover", onPointer, true);
      window.removeEventListener("blur", onLeave, true);
      document.removeEventListener("mouseleave", onLeave, true);
      document.removeEventListener("visibilitychange", onLeave, true);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [insideRef, uv]);

  return <PointerContext.Provider value={value}>{children}</PointerContext.Provider>;
}
