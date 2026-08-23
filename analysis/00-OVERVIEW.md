# haoqi.design 还原工程 — 总览

线上目标：https://haoqi.design/ · 部署：Vercel · 构建：Next.js App Router + Turbopack
证据目录：`_evidence/`（线上 HTML / JS chunk / CSS / shader）· 资源目录：`public/`（已完整下载）

## 1. 技术栈（从 bundle 指纹确认）

| 项 | 结论 | 证据 |
|---|---|---|
| 框架 | Next.js（App Router，RSC，Turbopack 构建） | `x-powered-by: Next.js`、`__next_f` flight payload、`turbopack-*.js` chunk |
| React | 19（`$Sreact.fragment` / `ClientPageRoot` / `OutletBoundary` 为 Next 15+ RSC 协议） | flight payload |
| 样式 | Tailwind CSS v4 + lightningcss | `@layer theme` + `--spacing` 计算式 + `--lightningcss-light/dark` |
| 3D | three.js **r184** + `@react-three/fiber` | `REVISION "184"`、`useFrame`、`R3F`、`invalidate` |
| 模型加载 | GLTFLoader + DRACOLoader + KTX2 + Meshopt（three 内置） | bundle 字符串 |
| 动画 | `motion`（framer-motion 新包名） | `MotionConfigContext` / `AnimatePresence` / `motionValue` / `framerAppearId` |
| 平滑滚动 | **Lenis** | `lenis` × 38 |
| 后处理 | `EffectComposer`（three/examples） | bundle |
| 未使用 | gsap / drei / zustand / next-themes / radix / howler | 指纹为 0 |

> 注：PMREM 着色器被**自定义改写**为 GGX VNDF 重要性采样（Heitz 2018），带 `GGX_SAMPLES` 宏 —
> 说明作者对 three 的 `PMREMGenerator` 做了 patch 以获得更干净的环境反射。见 `_evidence/assets/shaders/`。

## 2. 路由地图

| 路由 | 状态 | 说明 |
|---|---|---|
| `/` | 200 | 首页（Hero / About / Selected Work / Innovate / Contact） |
| `/reunimos` | 200 | 项目页 |
| `/inspire_mono` | 200 | 项目页 |
| `/wasm_design_utils` | 200 | 项目页 |
| `/adrive` | 200 | 项目页（aDrive 阿里云盘） |
| `/shore_icon` | 200 | 项目页 |
| `/teambition` | 200 | 项目页 |
| `/2026` | 307 → `/unlock/2026?return=%2F2026` | **口令保护**页 |
| `/unlock/[slug]` | 200 | 口令输入页 |
| `/work` `/about` `/archive` `/lab` `/blog` | 404 | 不存在 |

`/2026` 的门禁由 `PasscodeAccessProvider` 提供，SSR 时注入 `initialAccess={"/2026": false}`。

## 3. 根 Layout 组件树（来自 RSC flight payload，100% 可信）

```
<html lang="en" suppressHydrationWarning>
  <body>
    <ThemeModeProvider>          // 主题：light / dark / system，写 .dark class 到 <html>
      <ShellMediaProvider>       // 断点 / 媒体查询上下文
        <PointerProvider>        // 指针位置上下文（供 3D 光标 + 坐标读数用）
          <PasscodeAccessProvider initialAccess={{"/2026": false}}>
            <FullscreenTransitionProvider>   // 路由切换点阵转场
              <A/>               // chunk 34841 — 全屏 WebGL 层（canvas z-30）
              <B>                // chunk 82536 — Shell 容器
                <C/>             // chunk 88106 — Header/HUD
                <D>              // chunk 95212 — 滚动容器（Lenis）
                  {children}
                </D>
              </B>
            </FullscreenTransitionProvider>
          </PasscodeAccessProvider>
        </PointerProvider>
      </ShellMediaProvider>
    </ThemeModeProvider>
  </body>
</html>
```

Provider 的原始导出名已确认：`ThemeModeProvider` / `ShellMediaProvider` / `PointerProvider` /
`PasscodeAccessProvider` / `FullscreenTransitionProvider`（其余为 default 导出，名字需从 DOM 反推）。

## 4. 设计令牌（完整还原，Tailwind v4 `@theme`）

```css
--font-sans: "tiktok", sans-serif;        /* TikTokSans.ttf，可变 wght 100-900 + wdth */
--font-mono: "mono", monospace;           /* GeistMono[wght].ttf，可变 wght */
--font-mono-2: "tronica-mono", monospace; /* DepartureMono-Regular.otf，400 */

/* light */
--label: 0,0,0;  --label-d: 54,54,48;  --background-deep: 251,250,244;
--label-1: rgba(var(--label),1);
--label-2: rgba(var(--label-d),.6);
--label-3: rgba(var(--label-d),.32);
--label-4: rgba(var(--label-d),.18);
--line:    rgba(var(--label-d),.1);
--background-1: rgb(var(--background-deep));
--background-elevated: #efede7;
--cubic-66: cubic-bezier(.66,0,.01,1);
--selection-bg: #c0fe04;     /* 荧光绿，也是签名 SVG 的 stroke 色 */

/* dark（.dark 类） */
--label: 255,255,255;  --label-d: 230,232,232;  --background-deep: 15,17,17;
--label-4: rgba(var(--label-d),.16);  --line: rgba(var(--label-d),.08);
--background-elevated: #191b1b;
```

Tailwind 别名：`l1 l2 l3 line b1 be selection` → `text-l1` / `bg-b1` / `bg-selection` 等；
`ease-66` → `--cubic-66`；`font-mono-2` → tronica-mono。

代码高亮令牌（`--code-comment/string/number/keyword/function/tag/operator`）说明**存在代码块渲染**，
出现在项目页（`/inspire_mono` 等）。

## 5. 静态资源清单（已全量下载至 `public/`）

- `fonts/TikTokSans.ttf`（768K）· `fonts/GeistMono[wght].ttf`（168K）· `fonts/DepartureMono-Regular.otf`（84K）
- `model/hello.gltf`（2.1M，Spline 导出的 "hello" 手写体 3D 路径）
- `model/cnt.gltf`（3.5M，大量 `Path` 节点）
- `model/cursor.glb`（40K，3D 鼠标指针）
- `bgm.mp3`（964K，背景音乐，由 Header 的 `SOUND[|]` 控制）
- `img/m3.png`（作者肖像照）
- `sticker_img/s_01..s_12.png`（12 张贴纸）
- `work/*.png`（19 张，项目卡片缩略图，多数为 `xx01`/`xx02` 成对 = 默认/hover）
- `icon.svg` · `apple-icon.png`

**外部依赖**：
- 项目页正文配图来自 `https://mysite2026-blog-cyn6.vercel.app/blog/{adrive,mono,shore}/*` —
  说明原项目名可能叫 **mysite2026**，且内容图床是另一个 Vercel 部署。
- 天气：`https://devapi.qweather.com/v7/weather/now?location=101020100&key=c6e1eaf8bbac4c9f91b50e630e9ad750`
  （101020100 = 上海；key 已暴露在前端，还原时原样保留）

## 6. 首页区块结构（来自 SSR DOM，见 `_evidence/body-tree.txt`）

1. **WebGL 层** `div.z-30.fixed.inset-0` > canvas（全屏，pointer-events:auto）
2. **加载进度条** `z-40` 居中 140×6px 胶囊，`bg-l3` 轨 + `bg-l1` 填充，`width` 过渡 520ms `cubic-bezier(.22,1,.36,1)`
3. **Header/HUD** `header.z-50.fixed.inset-0`（上下两条）
   - 上左：`haoqi` + `.design`（font-sans bold，`font-variation-settings:"wght" 700,"wdth" 120`）
   - 上右（lg+）：`Work` `Contact` `THEME[A]` `SOUND[|]`
   - 下左：`--:--`（mobile）/ `GMT+8 CN --:--`（lg，水合后补时间+气温）
   - 下中（lg，fixed bottom-7 居中）：`0001 X 0001 Y` 光标坐标
   - 交互态：`before:` 伪元素 2px **dotted** 边框，hover 时 `border-l1`
4. **滚动容器** `div.fixed.inset-0` > `div.overflow-y-auto.overscroll-contain.no-scrollbar`
   （原生滚动被接管，`document` 不滚动 → scrollHeight 恒为视口高）
5. **Hero** 12 栏网格，`h-dvh lg:h-screen`
   - 左：`Design & / Engineering`（sans medium `text-3xl`）
   - 中：`Thinking in systems. Designing with care.`
   - 右：自我介绍，中间嵌 `■■■■■■` 口令遮罩（`PasscodeAccessProvider`，点击输入口令揭示公司名）
   - 底：`I bring / craft & taste / to digital work`（`text-[7.2svw] lg:text-[6svw]`，`wdth 120`）
6. **About** 12 栏
   - 左：手写签名 SVG（viewBox `0 0 320 154`，4 条 path，`stroke:#C0FE04`，`.svg-sign` 逐笔描边动画，
     用 `--path-delay` / `--path-dur` CSS 变量驱动 `stroke-dashoffset`）
   - 右：两段大字（`md:text-[4.2svw]`，`font-family:"tiktok"`），第二段含 reunimos™ / aDrive / Teambition 外链
7. **Selected Work** `section#selected-work` — 9 张卡片，非对称 12 栏布局（每张卡 `aspect-ratio:1/1`）
   `Coding Project` 角标为 `bg-selection` 荧光绿。清单见 `10-CONTENT-INVENTORY.md`
8. **Innovate** 粘性区块：外层 `height:8px` + 内层 `sticky top-0`（滚动视差钉住）
   文案 `Innovate / with / purpose`
9. **Footer** `footer#contact` `h-dvh`：`Let's / Create / Something / Extraordinary` 阶梯排版 +
   邮箱 `curiosity.wen@gmail.com` + Twitter/X · Figma · GitHub

## 7. 文字进场动画约定

所有需要进场的文本被包成 `<span style="opacity:0"><span>文本</span></span>`，
SSR 时整个内容树外裹 `div.invisible.pointer-events-none.select-none[aria-hidden]`，
水合完成后由 JS 逐个揭示。→ 需要一个 `<Reveal>`/`<AnimatedText>` 组件承担此职责。

## 8. 模块拆分与执行顺序

| # | 模块 | 产出文档 | 状态 |
|---|---|---|---|
| 0 | 总览与技术栈 | `00-OVERVIEW.md` | ✅ |
| 1 | 设计系统（令牌/字体/Tailwind 配置） | `01-DESIGN-SYSTEM.md` | ⬜ |
| 2 | Shell 层（Providers / Header HUD / 滚动容器 / 转场） | `02-SHELL.md` | ⬜ |
| 3 | WebGL 场景（背景 shader / hello 模型 / 3D 光标 / cnt） | `03-WEBGL.md` | ⬜ |
| 4 | 首页各区块（DOM + 响应式 + 动画） | `04-HOME.md` | ⬜ |
| 5 | 项目页模板与内容 | `05-PROJECT-PAGES.md` | ⬜ |
| 6 | 口令门禁 `/2026` + `/unlock/[slug]` | `06-PASSCODE.md` | ⬜ |
| 7 | 音频 / 天气 / 贴纸 等外围交互 | `07-PERIPHERALS.md` | ⬜ |
| 8 | 内容清单（所有文案与链接） | `10-CONTENT-INVENTORY.md` | ⬜ |
| 9 | 视觉比对与修正记录 | `90-VISUAL-DIFF-LOG.md` | ⬜ |

## 9. 关键不确定项（待验证）

- `cnt.gltf` 的用途未定（3.5M，大量 Path 节点）— 疑似 `/2026` 页或 Innovate 区块使用
- 背景天蓝色 + 斜向焦散光斑：是 shader 程序生成还是环境贴图？bundle 中仅有 1 个自定义 fragment
  shader（点阵），说明背景很可能来自 **three 内置材质 + 自定义 PMREM 环境**，需实测
- 12 张贴纸的出现位置与交互（拖拽？hover 触发？）
- `SOUND[|]` 的 `|` 是动态波形字符（bundle 中疑似有字符动画）
