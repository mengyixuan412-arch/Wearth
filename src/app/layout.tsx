import type { Metadata } from "next";

import RouteTransitionLayer from "@/components/route-transition-layer";
import ScrollShell from "@/components/scroll-shell";
import ShellGate from "@/components/shell-gate";
import { FullscreenTransitionProvider } from "@/providers/fullscreen-transition-provider";
import { PointerProvider } from "@/providers/pointer-provider";
import { ShellMediaProvider } from "@/providers/shell-media-provider";
import { ThemeModeProvider } from "@/providers/theme-mode-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "WEARTH 衣值",
  description: "衣有所值，心动有知 — 把衣橱资产和购买决策打通的个人衣橱工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeModeProvider>
          <ShellMediaProvider>
            <PointerProvider>
              <FullscreenTransitionProvider>
                <RouteTransitionLayer />
                <ShellGate>
                  <ScrollShell>{children}</ScrollShell>
                </ShellGate>
              </FullscreenTransitionProvider>
            </PointerProvider>
          </ShellMediaProvider>
        </ThemeModeProvider>
      </body>
    </html>
  );
}
