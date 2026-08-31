import type { Metadata } from "next";

import PointerTrail from "@/components/pointer-trail";
import RouteTransitionLayer from "@/components/route-transition-layer";
import ScrollShell from "@/components/scroll-shell";
import Scrollbar from "@/components/scrollbar";
import ShellGate from "@/components/shell-gate";
import { FullscreenTransitionProvider } from "@/providers/fullscreen-transition-provider";
import { PointerProvider } from "@/providers/pointer-provider";
import { ShellMediaProvider } from "@/providers/shell-media-provider";
import { ThemeModeProvider } from "@/providers/theme-mode-provider";

import "./globals.css";

const SITE_URL = "https://getwearth.com";
const TITLE = "Wearth·衣值";
const DESCRIPTION = "衣有所值，心动有知 — 把衣橱资产和购买决策打通的个人衣橱工具";

export const metadata: Metadata = {
  /**
   * **`metadataBase` 不能省。** 同目录下的 `opengraph-image.png` 靠它拼成绝对
   * URL —— 微信、飞书、Slack 的抓取器只认绝对地址，缺了这一条它们读不到图，
   * 链接就退化成一条光秃秃的蓝字。
   *
   * 写死自有域名而不是读 `VERCEL_URL`：后者是带哈希的单次部署地址，每推一次
   * 就变，抓取器缓存到的会是一个很快失效的图片地址。
   */
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
                <PointerTrail />
                <Scrollbar />
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
