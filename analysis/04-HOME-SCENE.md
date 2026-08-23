# 模块 4 — 首页 DOM 与 3D 场景组成

## 4.1 首页 DOM 结构（`app/page.tsx`）

```
<div ref=banner  class="grid grid-cols-12 grid-rows-[auto_1fr] px-4 lg:px-14 py-18 lg:py-24 w-full h-dvh lg:h-screen">
  <div key="home-hero-meta" class="flex flex-col order-2 lg:order-1 lg:grid lg:grid-cols-12 col-span-12 font-mono text-base">
    <span …>Design & <br/> Engineering</span>              // ScrambleText ×2, delay 300, letter 10
    <ScrambleText>Thinking in systems. Designing with care.</ScrambleText>
    <HeroIntro/>                                           // 含口令遮罩
  </div>
  <div class="… text-[7.2svw] lg:text-[6svw] …" style='wdth 120'>
    I bring (300) / craft & taste (500) / to digital work (700)
  </div>
</div>

<div class="grid grid-cols-12 px-4 lg:px-14 py-18 lg:py-24 lg:pb-28 w-full">
  <div class="relative col-span-12 sm:col-span-4 lg:col-span-3 p-2">
     <SignatureSign/>  <div ref=portrait class="aspect-square"/>   // 肖像由 WebGL 画
  </div>
  <div …>两段大字 + reunimos/aDrive/Teambition 外链</div>
</div>

<SelectedWork onImagesChange/>          // section#selected-work
<HyperSpaceSection ref=hyper/>          // 高度 = 8 × 视口
<Contact ref=footer/>                   // footer#contact

<div class="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen"><HomeScene/></div>
```

> **验证**：本地 `scrollHeight = 12319`，与线上 1440×900 完全一致。

被追踪的 DOM 区块（供 WebGL 定位）：`banner` / `portrait` / `hyper-space` / `footer`，
经 `useSectionRects` 换算到滚动容器坐标系。

## 4.2 HyperSpace（Innovate）区块

高度 `8 × 视口高`，内层 `sticky top-0`。按 `floor((scrollTop - sectionY) / (height/8))` 得 segment 0..7：

| segment | stage | 内容 |
|---|---|---|
| 0-1 | `seg0-primary` | `Innovate / with / purpose` |
| 2-3 | `seg0-secondary` | `Innovate / with a / human touch` |
| 4-5 | `seg1` | `ScrollArcRings` + 四段宣言文案 |
| 6-7 | `end` | `FUTURE-FIRST / ALWAYS` |

`HyperSpaceStaggerText`：逐字 `hsstFadeIn/Out`，`durationSec 0.23`，`staggerSpreadMs 290`，
延迟 = `线性(0.7×spread) + FNV1a→mulberry32 确定性抖动(0.35×spread)`，组间 `100ms × index`。

`ScrollArcRings`：7 个 `<ellipse stroke=#C0FE04 strokeWidth=2>`，viewBox 344×344，
沿 y 从 22 走到 322（`TRAVEL=300`），半径取半圆查表 `sqrt(22500-(t-150)²)`，`ry = 0.1·rx`；
三阶段：进场(0-300) → 循环(300-600) → 退场(600-945)。

## 4.3 3D 场景组成（`HomeScene`）

```jsx
<Canvas dpr={[1,2]}>
  <RendererConfig/>                                  // tone mapping / colorspace
  <PerspectiveCamera makeDefault position={[0,0,22]}/>
  <RouteTransitionDots overlayColors={…} overlayPixelSize={4}/>
  <GlassStage performancePolicy sectionPosition glassHostingSectionNames>
    <DomLayerRectTracker layers targetRectMapRef/>
    <CameraParallax cameraRef parallaxEnabled parallaxStrength=1.4 parallaxLag=0.18
                    parallaxRotate=0.12 leaveParallaxLag=0.05 ready/>
    <GlassModel model="model/hello.gltf"  scrollSyncFactor=0.72 modelPosition=[-0.1,0,2]
                beforeRotation=[0,240,0] afterRotation=[0,90,0] rotation=[0,4,0]
                scale={isMobile?19:22} sectionName="banner" tintEnabled/>
    <GlassModel model="model/cursor.glb" scrollSyncFactor=0.72
                modelPosition={isMobile?[6.6,-5.6,-3]:[11.6,-4.2,-3]}
                rotationAxisTilt=[0,0,45] beforeRotation=[0,0,0] afterRotation=[0,720,0]
                scale=0.1 sectionName="banner" tintEnabled
                tingColor={["#009dff","#009dff","#64c3ff","#64c3ff"]}/>
    <ProceduralBackground/>
    <GlassModel model="model/cnt.gltf" beforeRotation=[-180,0,0] rotation=[0,0,0]
                scale=19 sectionName="footer" tintEnabled
                tingColor={["#FFFFFF","#009dff","#8e9dc4","#64c3ff"]}/>
    <Stickers sectionPosition sectionName="banner"/>
    {layers.map(l => <DomImagePlane ready imageUrl hoverImageUrl targetRef layerKey getTargetRect onTextureReady/>)}
    {hyperInView && <ArrowFullscreen targetRef getTargetRect scaleSpinDegrees={180}/>}
    <StarFlare sectionPosition brightSourceSectionNames/>
  </GlassStage>
</Canvas>
```

### 加载门禁
场景把加载进度回报给 `FullscreenTransitionProvider`：
```
总数 w = 必备模型数(hello / h_star / cnt) + 图片层数
已完成 = 模型 onReady 数 + 纹理 onTextureReady 数
setHeavyLoadProgress(clamp(已完成 / w * 100, 0, 100))
全部完成 → setHeavyLoadProgress(100); setReadyToLoadHeavy(true)
```
> 进度条最终值 = `50 × fontsReady + heavyLoadProgress/2`。
> **未接场景时页面会永远停在 50%**，这是首屏被遮罩挡住的原因。

### 相机
`position=[0,0,22]`，`fov` 随视口比例动态计算（实测：桌面可视世界宽度恒为 **27.7198**，
移动端为 **16.5228**）：
```
fovY = 2 · atan( (W0 / aspect) / 2 / z ) · 180/π
```
视差：指针驱动，`strength 1.4`、`lag 0.18`、`rotate 0.12`、离开时 `lag 0.05`。

## 4.4 待实现清单（WebGL）

- [ ] `RendererConfig` + 相机 fov 公式
- [ ] `ProceduralBackground`（多 pass FBO：`005/006/007/008/009` → `011`）
- [ ] `GlassStage`（场景 RT，供折射采样 `uTexture` 720×450 = 视口/2）
- [ ] `GlassModel` + Dispersion 材质（`018/019`）
- [ ] `DomImagePlane`（`016/017`）+ DOM 矩形同步
- [ ] `Stickers`（4096×2048 图集）
- [ ] `StarFlare`（`020/021`）
- [ ] `ArrowFullscreen`（`025/026`，驱动 `arrowFullscreenProgressStore`）
- [ ] `RouteTransitionDots`（页面内点阵，`pixelSize 4`）
- [ ] 流体指针（`024` + Navier-Stokes passes `4d3f3b68_15..20`）
