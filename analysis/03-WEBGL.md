# 模块 3 — WebGL 层（全站视觉核心）

> 全部 GLSL 已在运行时通过 `gl.shaderSource` 拦截**原样捕获**，存于 `_evidence/glsl-runtime/*.glsl`（27 个）。
> 场景图与全部 uniform 实测值存于 `_evidence/r3f-scroll.json`。**无需猜测，可逐字移植。**

## 3.1 画布与渲染器

DOM（在 root layout 中，`children` 之前）：
```html
<div class="z-30 fixed inset-0 pointer-events-none"
     style="position:relative;width:100%;height:100%;overflow:hidden;pointer-events:auto">
  <div style="width:100%;height:100%"><canvas style="display:block"></canvas></div>
</div>
```
> 注意外层同时有 Tailwind 的 `pointer-events-none` 和内联 `pointer-events:auto` —— 内联胜出。
> 这是 `@react-three/fiber` `<Canvas>` 的标准 DOM 产物（外层 div = `style` prop，内层 = container）。

WebGL context attributes（实测）：
```js
{ alpha:true, depth:true, stencil:false, antialias:true,
  premultipliedAlpha:true, preserveDrawingBuffer:false,
  powerPreference:'high-performance', failIfMajorPerformanceCaveat:false }
```

相机：`PerspectiveCamera`，`position=[0,0,24]`（首屏）→ `[0,0,32]`（滚动后），
`fov=39.68334042751597`（1440×900 实测）、`near=0.1`、`far=2000`。
> fov 为**动态计算**（随视口变化），实现时需先测多视口 fov 拟合公式；
> z=24/fov=39.683 时可视世界高度 = 2·24·tan(19.8417°) ≈ **17.325 单位**，
> 即 1440×900 下 **≈51.95 px / 世界单位**。

后处理：使用 **pmndrs `postprocessing`** 的 `EffectComposer` / `EffectMaterial`
（shader `002/003.glsl`，`SHADER_NAME EffectMaterial`），只挂了 1 个自定义 effect `e0`，
uniform 前缀 `e0*`：`e0PixelSize / e0UFeather / e0UAspect / e0UHoleRadius / e0UProgress / e0UOverlayColor`
→ 即**全屏路由转场**（像素化圆孔 iris wipe），对应 `FullscreenTransitionProvider`。

## 3.2 场景图（renderOrder 从后到前）

| ro | 对象 | 几何 | 材质 / 用途 |
|---|---|---|---|
| **-10** | 背景全屏面 | Plane | `BackgroundOutput` shader（`011.glsl`），**不透明、NoBlending、depthWrite=false** |
| 0 | `hello` 组 | BufferGeometry 24020 顶点（`model/hello.gltf`） | Dispersion 折射材质（`019.glsl`），scale **22** |
| 0 | `cursor` 组 | BufferGeometry 681 顶点（`model/cursor.glb`） | 同上，scale **0.1**，pos `[11.6,-4.17,-3]` |
| 0 | `cnt` 组（CRAFT&TASTE） | BufferGeometry 50959 顶点（`model/cnt.gltf`） | 同上，scale **19**，首屏 `visible=false` |
| 0 | 贴纸面 | Plane | `map` = **4096×2048 图集**（12 张 sticker 合成） |
| **10** | 路由转场点阵面 | Plane | `RouteTransitionDots`（`4d3f...glsl`，带中文注释） |
| **12** | 大号 3D 光标 | cursor 几何 681 顶点 | **Stripe/Phong** shader（`026.glsl`），scale 4.3286，滚动后出现 |
| **20** | 11 张图片面 | Plane ×11 | `ImagePlane`（`017.glsl`），DOM 矩形同步 |

### 图片面（ro=20）—— DOM↔WebGL 同步渲染
Selected Work 的卡片缩略图**不是 `<img>`**：DOM 里只有一个空的
`<div aria-hidden style="aspect-ratio:1/1">` 占位，图片由 WebGL 平面按 `uRect`
（归一化屏幕矩形 `[x, y, w, h]`）绘制在对应位置。

实测配对（`map` / `mapHover`）：
| 卡片 | map | mapHover |
|---|---|---|
| （关于区肖像） | `img/m3.png` | `img/m3.png` |
| Reunimos™ | `work/reunimos01.png` | `work/reunimos02.png` |
| Inspire Mono | `work/inspire_mono_01.png` | `work/inspire_mono_02.png` |
| Wasm design utils | `work/wasm01.png` | `work/wasm02.png` |
| VectorSymbols | `work/vs01.png` | `work/vs02.png` |
| DarkSide | `work/ds01.png` | `work/ds02.png` |
| aDrive | `work/ali01.png` | `work/ali02.png` |
| Shore Icon | `work/si.png` | `work/si02.png` |
| Teambition | `work/c4.png` | `work/c4.png` |
| FoF: See Hear Touch | `work/s01.png` | `work/s02.png` |
| FoF: Design System | `work/sd01.png` | `work/sd02.png` |

肖像面实测 uniform（1440×900，滚动到关于区）：
```
uRect = [0.0444, -0.4667, 0.2194, 0.3511]   // x,y,w,h（归一化）
uCurlStrength = 0     uPolarityPositive = 0
uLayerOpacity = 1     uRevealProgress = 1    uRevealSoftness = 0
uRevealDirection = 1  uHoverRevealProgress = 0
uDotPixelSize = 18    uViewportPx = [1440, 900]
```
`017.glsl` 逻辑：点阵（dot-matrix）遮罩揭示 + hover 交叉淡入 `mapHover` + curl 噪声位移。

## 3.3 折射材质 `Dispersion`（`019.glsl` + `018.glsl`）

`hello` / `cursor` / `cnt` 三个模型共用同一套 ShaderMaterial，实测 uniform：
```
uTexture = <场景 RT 720×450>     // 半分辨率场景色缓冲，用于背面折射
uIorR=1.15  uIorY=1.16  uIorG=1.18  uIorC=1.22  uIorB=1.22  uIorP=1.22
uRefractPower=0.72      uChromaticAberration=0.14
uSaturation=1.2         uShininess=120        uDiffuseness=0.1
uFresnelPower=1         uBrightness=0.78      uContrast=0.9   uGamma=1
uSpecularStrength=1.2   uFresnelStrength=0.24 uFresnelSideDir=[-1,1,-1]
uTintLocalYRange        uTintEnabled=1  uTintMix=1
uTintThicknessMinAlpha=1  uTintThicknessMaxAlpha=0.92
uDark=0                 uLoop=3               // 多次折射迭代
uSceneRefractionEnabled=1  uRgbRefraction=1
uLight=[4,9,0.5]        uScreenResolutionPx=[1440,900]
```
每个模型的**渐变着色（tint）**不同：
| 模型 | uTintColorA | uTintColorB | uTintLocalYRange |
|---|---|---|---|
| hello | `[0,0.3372,1,1]` 蓝 | `[1,1,1,1]` 白 | `[-0.1214, 0.1214]` |
| cursor | `[0,0.3372,1,1]` 蓝 | `[0,0.3372,1,1]` 蓝 | `[-12.5, 12.5]` |
| cnt | `[1,1,1,1]` 白 | `[0,0.3372,1,1]` 蓝 | `[-0.244, 0.244]` |

蓝色 `rgb(0, 0.3372, 1)` = **#0056FF**。渐变沿模型局部 Y 轴。
`uLoop=3` = 三次折射采样循环（`uTexture` 为上一帧场景 RT，需 **双 pass**：先渲染非折射物体到 RT，
再以 RT 为输入渲染折射物体）。

`021.glsl` 为**星芒/光晕**（`uStarRays / uStreakScale / uHotspotPower / uTailColor / uThreshold`），
即首屏 "hello" 上的十字星闪光。

## 3.4 程序化背景系统（多 pass FBO）

背景不是贴图，是一套 **ping-pong FBO 模拟**，最终由 `011.glsl` 输出：
```
tInput        = <RT 432×270>        // = 视口 × 0.3
uResolution   = [432, 270]
uTime         = 递增
uPos          = [0.5, 0.5]
uMousePos     = [0.5, 0.5]   uTrackMouse = 1
uBgColor      = [1, 0.8228, 0.6724]     // #FFD2AC 暖奶油
uOutputColor  = [0.4125, 1, 0.4851]     // #69FF7C 绿
uLoaded       = 1
uOutputMix    = 0.65
```
参与模拟的 pass（各自独立 fragment shader）：
| 文件 | 关键 uniform | 推测职责 |
|---|---|---|
| `005.glsl` | `uRadius uFalloff uMix uDisplace uSkew uAngle uVignetteColor uClearColor uEdgeIntensity` | 基底渐变 + 暗角 + 位移 |
| `006.glsl` | `uRadius uAngle uPhase uTime uMix uPos` | 径向相位波纹 |
| `007.glsl` | `uMixRadius uFrequency uAmplitude uRotation uTime uMousePos uTrackMouse` | 波形/curl 扰动（跟随鼠标） |
| `008.glsl` | `uAmount uSpread uAngle uTime uSkew uCellScale uMixRadiusInvert uEasing` | **径向条纹/胞元**（即 Innovate 区的超空间光线） |
| `009.glsl` | `uAmount uTilt uBlueNoiseResolution uTrackMouse` | 蓝噪声抖动 / 颗粒 |
| `024.glsl` | `uVelocity uSimSize uDisplacementStrength uChromaticBoost uTrail uTrailStrength uTrailCount uPointerColor uPointerOpacity uPointerDotRadius uPointerPixelSize` | **指针流体速度场 + 拖尾 + 点阵指针** |
| `011.glsl` | 上表 | 合成输出（`uOutputMix` 混合 `uOutputColor`） |

> 首屏的天蓝底 + 斜向焦散光斑、Innovate 区的黑底超空间射线，
> **都是同一套背景系统在不同参数下的形态**（由滚动进度驱动 `uAmount/uSpread/uAngle/uCellScale/颜色`）。

## 3.5 转场 shader

- `001.glsl`：`uColor uFeather uAspect uHoleRadius uProgress` → 圆孔 iris + 羽化
- `4d3f3b68dbbde33a.js` 内联的点阵 shader（带中文注释 *"与 route_transition 点阵一致：透明度直接映射圆半径"*）：
  `uColor uOpacity uPixelSize(=4) uRadiusScale(=0.9) uResolution` → 页面级点阵遮罩，`ro=10`

## 3.6 实现顺序建议

1. 建 `<SceneCanvas>`（R3F Canvas，属性同 3.1），先只放背景面 + `011/010.glsl`
2. 移植背景多 pass FBO 链（005→009→011），用实测 uniform 作为初值
3. 加载 3 个模型 + `Dispersion` 材质（019/018），对齐 tint 与 scale
4. `ImagePlane`（017）+ DOM 矩形同步 hook（`useBoundingRect` → `uRect`）
5. 星芒（021）、大光标（026）、贴纸图集
6. 转场 composer（001 + postprocessing）

## 3.7 待测

- fov 随视口的计算公式（需多视口采样拟合）
- 滚动进度 → 各 uniform 的映射曲线（需按滚动位置逐点采样 uniform）
- 4096×2048 贴纸图集的 UV 布局（12 张，推测 4×3 网格）
