import type { Metadata } from "next";

import Header from "@/components/header";
import RouteTransitionLayer from "@/components/route-transition-layer";
import ScrollShell from "@/components/scroll-shell";
import ShellGate from "@/components/shell-gate";
import { readPasscodeAccess } from "@/lib/passcode-server";
import { FullscreenTransitionProvider } from "@/providers/fullscreen-transition-provider";
import { PasscodeAccessProvider } from "@/providers/passcode-access-provider";
import { PointerProvider } from "@/providers/pointer-provider";
import { ShellMediaProvider } from "@/providers/shell-media-provider";
import { ThemeModeProvider } from "@/providers/theme-mode-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "HAOQI©2026",
  description: "Digital Product Designer & Builder © 2026",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialAccess = await readPasscodeAccess();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeModeProvider>
          <ShellMediaProvider>
            <PointerProvider>
              <PasscodeAccessProvider initialAccess={initialAccess}>
                <FullscreenTransitionProvider>
                  <RouteTransitionLayer />
                  <ShellGate>
                    <Header />
                    <ScrollShell>{children}</ScrollShell>
                  </ShellGate>
                </FullscreenTransitionProvider>
              </PasscodeAccessProvider>
            </PointerProvider>
          </ShellMediaProvider>
        </ThemeModeProvider>
      </body>
    </html>
  );
}
