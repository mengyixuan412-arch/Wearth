# 还原进度与验证记录

本地：`npm run dev` → http://localhost:3000 ；参考截图：`_evidence/ref-shots/`

## 已完成 ✅

### 基础设施
- Next.js 15 + React 19 + Tailwind v4 + three r184 + R3F 9 + motion + lenis + postprocessing
- `src/app/globals.css`：设计令牌、`.dark`、作者自定义 CSS（`hsst*` / `caret-blink` / `ltBlink` / `rtSpin` / `no-scrollbar` / `[data-mdx-image-grid]`）全部逐条还原
- 字体经 `FontFace` API 加载（`display:"block"`），与线上一致

### Shell
- `ThemeModeProvider` / `ShellMediaProvider` / `PointerProvider` / `PasscodeAccessProvider` / `FullscreenTransitionProvider`
- `ShellGate`（字体就绪前整树 `invisible`）、`ScrollShell`（首页 Lenis / 其余原生）
- `Header`（HUD、快捷键、时间/天气、指针坐标、旋转地球、移动端菜单、提示面板）
- `Scrollbar`（桌面竖轨拖拽 / 移动圆形进度）、`GridOverlay`（`mix-blend-difference` 准星网格）
- `ScrambleText`（全局 40ms 节拍、确定性乱码、荧光绿配色）
- `RouteTransitionLayer`（转场 Canvas + `MaskedDotsEffect` + 加载进度条）

### 首页
- Hero / About（签名 SVG 逐笔描边）/ Selected Work（10 卡非对称网格）/ HyperSpace（8 屏 4 阶段）/ Contact
- `useSectionRects` 把 DOM 区块换算到滚动容器坐标系供 WebGL 使用

### WebGL
- `SceneCamera`（fov = `2·atan(tan(baseFov/2)/aspect)`，桌面 baseFov 60 / 移动 38）
- `CameraParallax`（入场 dolly + 指针视差）
- `ProceduralBackground`（vignette → swirl → sine → **shatter** → bokeh → output，ping-pong FBO @0.3 分辨率）
- `GlassStage`（半分辨率场景 RT，glass 在 layer 10 被排除）
- `GlassModel` ×3（hello / cursor / cnt）+ 完整 Dispersion 折射材质
- `DomImagePlane` ×11 + `DomLayerRectTracker`（DOM 矩形同步、hover 点阵揭示、滚动 curl、极性反转入场）
- `RouteTransitionDots`（由 `arrowFullscreenProgressStore` 驱动）
- `ArrowFullscreen`（光标放大占满全屏 + 屏幕空间超空间射线 shader，驱动全局进度 store）

## 视觉比对结果

| 滚动位置 | 结论 |
|---|---|
| `scrollHeight` | 本地 **12319** ＝ 线上 **12319** ✅ |
| 0%（Hero） | 背景条纹、hello 位置/尺寸、光标位置、排版 —— 与线上一致 ✅ |
| 25%（Work） | 卡片网格与图片位置一致 ✅ |
| 50%（Innovate） | 超空间射线 + 文案 + 头部反色 —— 与线上一致 ✅ |
| 75%（Rings） | 黄色环 + 四段宣言 —— 与线上一致 ✅ |
| 100%（Footer） | CRAFT & TASTE 3D 字母 + 页脚 —— 与线上一致 ✅ |

## 全部完成 ✅

| 项 | 状态 |
|---|---|
| `StarFlare` | ✅ `LensFlarePass`（downsample 0.5 / stride 2 / 6 芒 / 强度 0.7 / 阈值 0.99 / gate 0.88，明暗两套拖尾色） |
| `Stickers` | ✅ 运行时构建 2 的幂图集 + InstancedMesh 飘落粒子 + 点击迸发 |
| 指针流体 | ✅ `FluidPushPass`（curl → vorticity → divergence → 4 次 Jacobi 压力 → gradient → advect），含点阵指针拖尾 |
| 项目页 ×6 | ✅ MDX 源 + 渲染件（标题锚点 / 代码块 / 图片网格 / 下载按钮 / 文章页脚） |
| `/unlock/[slug]` | ✅ 4 位口令输入，失败抖动、成功跳转 |
| `/2026` | ✅ 未解锁时 307 → `/unlock/2026?return=%2F2026`（与线上一致） |
| `/api/passcode` | ✅ cookie 门禁，口令走 `PASSCODE_CODE` 环境变量 |

## 最终验证

```
npm run build   ✅ 12 条路由全部生成
npm run start   ✅ scrollHeight 12319（＝线上）／控制台 0 错误／字体全部加载
```

| 场景 | 结论 |
|---|---|
| 首页 0 / 25 / 50 / 75 / 100 % | 与线上一致 ✅ |
| 暗色（`prefers-color-scheme: dark`） | 深蓝背景 + 蓝色玻璃 hello，与线上一致 ✅ |
| 移动端 390×844 | 汉堡菜单、Hero 换序、模型缩放，与线上一致 ✅ |
| 项目页 ×6 | 排版/代码块/图片网格一致；`scrollHeight` 差 0–20px（远程图懒加载时序） ✅ |
| 指针流体 | 扫过时可见色散拖尾 ✅ |

## 已知取舍

- **口令**：服务端校验，前端包内没有明文，无法还原。已实现同构机制，设 `PASSCODE_CODE` 即可启用。
- **`/2026` 正文**：受口令保护，无法获取，路由已就位但缺内容文件。
- **项目页配图**：线上从 `https://mysite2026-blog-cyn6.vercel.app/blog/...` 取图，还原时保留原外链。
- **天气 API key**：原样保留（本就暴露在前端）。

## 修正记录

### 高 DPI 下指针流体失效（已修）

**现象**：Retina（dpr=2）上鼠标划过 hello 完全没有溶解/模糊效果；dpr=1 正常。

**定位**：`splat` 的 `uResolution` 是设备像素 `[2880,1800]`，着色器里
`mouseUv = uPointer / uResolution`，所以 `uPointer` 也必须是设备像素。
实测 dpr=2 时：

```
线上   max uPointer.x 2260   max |uPointerDelta| 100.0
本地   max uPointer.x 1130   max |uPointerDelta|  50.0   ← 恰好一半
```

速度场被注入到屏幕左下四分之一处，鼠标位置附近没有任何扰动，观感即"完全没效果"。

**根因**：`star-flare.tsx` 里 dpr 缓存在 `dprRef`，只在一个 `if (!composerRef.current) return;`
的 effect 中赋值；该 ref 未被填充，effect 提前返回，`dprRef` 永远停在初值 1。
dpr=1 时两种单位恰好重合，所以全部无头测试（默认 dpr=1）都没能暴露它。

**修复**：dpr 改为每帧从 `gl.getPixelRatio()` 直接读取（clamp 到 2），
`setDisplayMetrics` 移出 ref 守卫。修复后 dpr=2 实测两边均为
`max uPointer.x 2260 / max |uPointerDelta| 100.0`，视觉复核一致。

> 教训：涉及 dpr 的换算必须在 dpr≠1 下验证，dpr=1 会把两种单位系统的错误完全掩盖。
