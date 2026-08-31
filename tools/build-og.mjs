/**
 * 分享卡片交付：logo + 字体 → src/app/opengraph-image.png（同图复制一份为 twitter-image.png）
 *
 *     node tools/build-og.mjs
 *     CHROME=/path/to/Chrome node tools/build-og.mjs      # 换浏览器
 *
 * 用 headless Chrome 截图，而不是 `next/og` 的 ImageResponse：**中文**。
 * ImageResponse 要显式喂进一份含中文字形的字体文件，而项目自带的三套
 * （TikTokSans / GeistMono / DepartureMono）都只有拉丁字形，为一张静态图
 * 往仓库里塞一份几 MB 的中文字体不划算。截图走系统的 PingFang SC，零依赖。
 *
 * **素材先拷进临时目录再截。** 仓库路径里有中文和方括号，Chrome 的 file:// URL
 * 处理这类路径不稳，字体和图会静默加载失败 —— 截出来的图不报错，只是字体退化。
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const W = 1200;
const H = 630;

// 和 globals.css 对齐：--background-elevated / --accent / --label-1
const BG = "#efede7";
const ACCENT = "#d53f7d";
const INK = "20,20,28";

const work = mkdtempSync(join(tmpdir(), "wearth-og-"));
try {
  copyFileSync("public/img/logo/logo-mark.png", join(work, "logo.png"));
  copyFileSync("public/fonts/TikTokSans.ttf", join(work, "TikTokSans.ttf"));
  copyFileSync("public/fonts/DepartureMono-Regular.otf", join(work, "DepartureMono.otf"));

  writeFileSync(
    join(work, "og.html"),
    `<meta charset="utf-8">
<style>
  @font-face { font-family: "TikTokSans"; src: url("TikTokSans.ttf"); }
  @font-face { font-family: "DepartureMono"; src: url("DepartureMono.otf"); }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; }

  body {
    background: ${BG};
    font-family: "TikTokSans", "PingFang SC", sans-serif;
    color: rgb(${INK});
    display: flex; align-items: center; gap: 56px;
    padding: 0 76px;
    position: relative; overflow: hidden;
  }

  /* 内页那种设计草图的栅格感，压到勉强可见，只当底纹 */
  body::before {
    content: ""; position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(${INK},.055) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(${INK},.055) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .col { position: relative; flex: 1; min-width: 0; }

  .eyebrow {
    font-family: "DepartureMono", monospace;
    font-size: 21px; letter-spacing: .34em; color: ${ACCENT};
    display: flex; align-items: center; gap: 18px;
  }
  .eyebrow::after { content: ""; flex: 1; height: 1px; background: rgba(${INK},.2); }

  h1 { margin-top: 30px; font-size: 76px; font-weight: 700; letter-spacing: .02em; line-height: 1.18; }
  h1 em { font-style: normal; color: ${ACCENT}; }

  p { margin-top: 26px; font-size: 27px; line-height: 1.62; color: rgba(${INK},.64); max-width: 19em; }

  .url {
    margin-top: 46px; font-family: "DepartureMono", monospace;
    font-size: 23px; letter-spacing: .06em; color: rgba(${INK},.5);
  }

  .art { position: relative; width: 396px; height: 396px; flex: none; }
  .art img {
    width: 100%; height: 100%; border-radius: 24px;
    box-shadow: 0 26px 60px -22px rgba(${INK},.42);
  }
</style>

<div class="col">
  <div class="eyebrow">WEARTH</div>
  <h1>衣有所值<br><em>心动</em>有知</h1>
  <p>把衣橱资产和购买决策打通的个人衣橱工具</p>
  <div class="url">getwearth.com</div>
</div>
<div class="art"><img src="logo.png" alt=""></div>
`,
  );

  const out = join(work, "og.png");
  execFileSync(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${W},${H}`,
      `--screenshot=${out}`,
      `file://${join(work, "og.html")}`,
    ],
    { stdio: "ignore" },
  );

  // Next.js 按文件名接管这两个，不用手写 <link> / <meta>
  copyFileSync(out, "src/app/opengraph-image.png");
  copyFileSync(out, "src/app/twitter-image.png");
  console.log("✓ src/app/opengraph-image.png、twitter-image.png 已更新");
} finally {
  rmSync(work, { recursive: true, force: true });
}
