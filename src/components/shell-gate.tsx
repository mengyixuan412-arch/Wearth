"use client";

import { useShellMedia } from "@/providers/shell-media-provider";

/** Keeps the whole DOM shell invisible (but laid out) until the web fonts have loaded. */
export default function ShellGate({ children }: { children: React.ReactNode }) {
  const { fontsReady } = useShellMedia();
  return (
    <div className={fontsReady ? "" : "invisible pointer-events-none select-none"} aria-hidden={!fontsReady}>
      {children}
    </div>
  );
}
