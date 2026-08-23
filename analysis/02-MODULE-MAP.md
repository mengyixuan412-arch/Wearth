# 模块 2 — Bundle 模块地图（反混淆索引）

Turbopack 生产包保留了**导出名、className 字符串、GLSL 源码（含中文注释）**，
因此可逐模块还原成可读源码。格式：
```js
(globalThis.TURBOPACK ||= []).push([currentScript, ID, (ctx) => { ... }, ID2, (ctx) => {...}, ...])
// ctx.i(ID) = import 模块   ctx.s([...]) = 导出声明
```

工具：`_evidence/split.mjs` 切分 → `_evidence/modules/*.js`；
`_evidence/beautified/*.js` 为 prettier 美化后的整块；`_evidence/module-index.json` 为索引。

## 2.1 应用模块（App）

| ID | 导出 | 职责 |
|---|---|---|
| **31713** | `default` | **首页 page**（含 Hero/About/Innovate/Scene 等全部内部组件，401KB） |
| 34841 | `default` | `RouteTransitionLayer` — 转场 Canvas（z-30）+ 加载进度条 |
| 82536 | `default` | `ShellGate` — 字体就绪前整树 `invisible pointer-events-none select-none` |
| 88106 | `default`, `PENDING_SCROLL_ANCHOR_SESSION_KEY` | **Header / HUD** |
| 95212 | `default` | `ScrollShell` — `/` 用 Lenis，其余用原生滚动容器 |
| 90975 | `ThemeModeProvider`, `useThemeMode` | 主题（localStorage `theme`） |
| 23525 | `ShellMediaProvider`, `useShellMedia` | 字体 FontFace 加载 + BGM（localStorage `sound`） |
| 16265 | `PointerProvider`, `usePointer`, `usePointerPosition` | 指针 UV（y 翻转） |
| 73475 | `FullscreenTransitionProvider`, `useFullscreenTransitionController`, `useRouteTransitionController` | 转场/菜单/重资源加载状态 |
| 4278 | `PasscodeAccessProvider`, `PasscodeUnlockScreen`, `usePasscodeAccessLookup`, `usePasscodeAllowed`, `submitPasscodeUnlock`, `logoutPasscodeAccess`, `notifyPasscodeAccessChanged` | 口令门禁（`/api/passcode`） |
| 58116 | `PASSCODE`, `buildPasscodeUnlockHref`, `emptyPasscodeAccessState`, `isPasscodeProtectedPath`, `primaryPasscodePath`, `sanitizePasscodeReturnTo`, `scopeToPath` | 口令工具（`slotCount: 4`） |
| 28116 | `PASSCODE_LOCKED_CHAR_CLASS`, `PASSCODE_LOCKED_SCRAMBLE_CLASS`, `passcodeLockedPlaceholderText`, `revealBrandLabel`, `revealBrandLabelLength` | 遮罩品牌名（见 2.3） |
| 83039 | `WORK_ITEMS`, `workHrefToPath` | 作品数据 |
| 45556 | `default`, `SELECTED_WORK_SECTION_ID`(=`selected-work`) | Selected Work 区块 |
| 28192 | `CONTACT_SECTION_ID`(=`contact`) | Contact 区块 |
| 71358 | `default` | **ScrambleText** — 全站文字乱码进场 |
| 19668 | `useHasEnteredViewport` | IntersectionObserver hook |
| 80894 | `default` | `DottedLink` — 走转场的 Link |
| 41242 | `DOTTED_BORDER_BASE(_WHITE)`, `DOTTED_BORDER_ACTIVE_BOTTOM(_WHITE)` | 点线边框 class 常量 |
| 34655 | `useViewport`, `useIsMobile`, `getViewportSnapshot`, `subscribeViewport` | 视口 store（`useIsMobile` = width<1024） |
| 30468 | `useWindowSize` | 同上包装 |
| 90270 | `bindLenisScrollBus`, `getLenisScrollSnapshot`, `subscribeLenisScroll` | Lenis 滚动总线 |
| 29680 | `scrollEnv` | 滚动环境（容器/Lenis 实例/快捷键 T/B/滚动到边） |
| 35231 | `useLenisScrollTop`, `useNearBottom`, `subscribeScrollTopPx` | 滚动派生 hook |
| 62291 | `useIsMobileWidth` | — |
| 1111 | `arrowFullscreenProgressStore`, `readArrowFullscreenPastThreshold`, `useArrowFullscreenPastThreshold`, `ARROW_FULLSCREEN_DOM_COLOR_TRANSITION` | **3D 箭头全屏进度**（驱动 DOM 变白） |
| 54262 | `RotatingGlobe` | 右下角旋转地球 SVG |
| 97839 | `useHomeLoadingGate` | `pathname==='/' && !readyToLoadHeavy` |
| 13717 | `default` | **网格叠加层**（z-20 `mix-blend-difference` 十字准星） |
| 72443 | `default` | 自定义滚动条（桌面竖轨 / 移动圆形进度） |
| 65536 | `useWeather` | 和风天气 |
| 95428 / 96716 | `ASCIIThemeToggle` / `ASCIISoundToggle` | HUD 开关 |
| 92959 | `useBrowserName` | 浏览器名（HUD 提示面板） |
| 54450 | `ArticleFooter` | 文章页页脚 |
| 93325 / 46318 / 78825 / 71289 / 31250 | `MdxPre` / `MdxImg` / `MdxTableOfContents` / `MdxA` / `scrollToMdxAnchorTarget` | MDX 渲染件 |

## 2.2 第三方模块

`three`(21348/6121) · `@react-three/fiber`(3543 `useThree`, 72137 `useFrame`, 3199 `extend/createPortal`, 85765 `useLoader`) ·
`postprocessing`(43050) · `lenis/react`(14194 `ReactLenis/useLenis`) ·
`motion`(50245 `motion`, 11818 `AnimatePresence`, 63927/39198/10401/84047/74032/68223 内部) ·
`axios`(50620 同 chunk) · `next/link`(49936) · `next/navigation`(76973)

## 2.3 遮罩品牌名解码

```js
const CODES = [85, 106, 108, 85, 112, 108];
revealBrandLabel = () => CODES.map(c => String.fromCharCode(c - 1)).join("");  // "TikTok"
revealBrandLabelLength = () => 6;
passcodeLockedPlaceholderText = () => "■■■■■■";
```
首页自我介绍中的 `■■■■■■` 与首个作品项 `/2026` 的标题共用此机制；
明文只在通过 `/api/passcode` 校验后由服务端下发的 cookie 解锁。**口令本身不在前端包内**。

## 2.4 关键常量

```js
SELECTED_WORK_SECTION_ID = "selected-work"
CONTACT_SECTION_ID       = "contact"
PENDING_SCROLL_ANCHOR_SESSION_KEY = "hq:pendingScrollAnchor"
PASSCODE = { slotCount: 4 }
HUD 快捷键 = new Set(["l","d","a","s","t","b"])   // 主题 L/D/A、声音 S、滚动 T/B
Lenis options = { lerp: 0.1, smoothWheel: true, syncTouch: true, anchors: true, autoRaf: false }
转场遮罩色 = ["#191b1b" (dark), "#efede7" (light)]
ScrambleText 字符集 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=?/<>[]{}"
ScrambleText 配色   = { light: ["#c0fe04","#607F02"], dark: ["#c0fe04","#DFFF81"] }
ScrambleText 节拍   = 全局 40ms interval；每字 step = 2×letterDelay，乱码窗口 = 2×step
网格叠加线色 = rgba(255,255,255,0.1)，十字 #FFFFFF @0.4，mix-blend-difference
Innovate 文案变体 = ["Innovate","with","purpose"] / ["Innovate","with a","human touch"]
```
