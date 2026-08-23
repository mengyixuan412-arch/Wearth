"use client";

import { usePathname } from "next/navigation";

import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";

/** True while the home route is still waiting for its heavy (WebGL) payload. */
export function useHomeLoadingGate() {
  const pathname = usePathname();
  const { readyToLoadHeavy } = useRouteTransitionController();
  return pathname === "/" && !readyToLoadHeavy;
}
