"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type NavigationTarget = { href: string; replace?: boolean } | null;

type FullscreenTransitionContextValue = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  targetHref: string | null;
  navigationReplace: boolean;
  startNavigation: (href: string, options?: { replace?: boolean }) => void;
  clearNavigation: () => void;
  readyToLoadHeavy: boolean;
  setReadyToLoadHeavy: (ready: boolean) => void;
  heavyLoadProgress: number;
  setHeavyLoadProgress: (progress: number) => void;
  allowScrambleLines: boolean;
  setAllowScrambleLines: (allow: boolean) => void;
};

const FullscreenTransitionContext = createContext<FullscreenTransitionContextValue | null>(null);

export function useFullscreenTransitionController() {
  const ctx = useContext(FullscreenTransitionContext);
  if (!ctx) throw new Error("useFullscreenTransitionController must be used within FullscreenTransitionProvider");
  return ctx;
}

export function useRouteTransitionController() {
  const ctx = useContext(FullscreenTransitionContext);
  if (!ctx) throw new Error("useRouteTransitionController must be used within FullscreenTransitionProvider");
  return {
    targetHref: ctx.targetHref,
    navigationReplace: ctx.navigationReplace,
    startNavigation: ctx.startNavigation,
    clearNavigation: ctx.clearNavigation,
    readyToLoadHeavy: ctx.readyToLoadHeavy,
    setReadyToLoadHeavy: ctx.setReadyToLoadHeavy,
    heavyLoadProgress: ctx.heavyLoadProgress,
    setHeavyLoadProgress: ctx.setHeavyLoadProgress,
    allowScrambleLines: ctx.allowScrambleLines,
    setAllowScrambleLines: ctx.setAllowScrambleLines,
  };
}

export function FullscreenTransitionProvider({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigation, setNavigation] = useState<NavigationTarget>(null);
  const [readyToLoadHeavy, setReadyToLoadHeavy] = useState(false);
  const [heavyLoadProgress, setHeavyLoadProgress] = useState(0);
  const [allowScrambleLines, setAllowScrambleLines] = useState(false);

  const targetHref = navigation?.href ?? null;
  const navigationReplace = navigation?.replace ?? false;

  const startNavigation = useCallback((href: string, options?: { replace?: boolean }) => {
    setReadyToLoadHeavy(false);
    setHeavyLoadProgress(0);
    setNavigation((current) => current ?? { href, replace: options?.replace });
  }, []);

  const clearNavigation = useCallback(() => setNavigation(null), []);

  const value = useMemo(
    () => ({
      menuOpen,
      setMenuOpen,
      targetHref,
      navigationReplace,
      startNavigation,
      clearNavigation,
      readyToLoadHeavy,
      setReadyToLoadHeavy,
      heavyLoadProgress,
      setHeavyLoadProgress,
      allowScrambleLines,
      setAllowScrambleLines,
    }),
    [
      menuOpen,
      targetHref,
      navigationReplace,
      startNavigation,
      clearNavigation,
      readyToLoadHeavy,
      heavyLoadProgress,
      allowScrambleLines,
    ],
  );

  return <FullscreenTransitionContext.Provider value={value}>{children}</FullscreenTransitionContext.Provider>;
}
