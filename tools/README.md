# 模型生成

`hello` 那类「充气圆管手写体」是烘焙好的几何体，没有可改的字符串。
这里的脚本用 Blender 无头模式重新生成同类模型。

## 生成

```bash
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender

$BLENDER --background --python tools/make_script_model.py -- \
  --text Wearth \
  --font tools/fonts/Caveat.ttf \
  --thickness-ratio 0.11 \
  --lead-width 1.25 \
  --spacing 1.05 \
  --remesh 0.08 \
  --target-verts 26000 \
  --fit height \
  --out public/model/wearth.glb
```

管线：文字 → 曲线 → 圆形 bevel 扫掠 → 体素重网格化 → 减面 → 平滑 → GLB。
重网格化那步是必需的：字体轮廓在笔画转折处曲率半径小于管半径，直接 bevel 会自相交出碎片。

## 参数

| 参数 | 作用 | 备注 |
|---|---|---|
| `--thickness-ratio` | 管径 / 字高 | 原 `hello.gltf` 是 0.679。字母越多越要调小，否则字腔会被粗管跨接填死 |
| `--spacing` | 字距 | 加大可换取字腔空间，但会变宽 |
| `--fit width` | 按宽度归一化到 0.7007 | 与 `hello.gltf` 变换烘焙后的宽度一致，保证 `scale: 22` 不用动 |
| `--remesh` | 体素边长 / 管半径 | 越小越精细；配合 `--target-verts` 减面 |

## 预览

```bash
$BLENDER --background --python tools/preview_model.py -- \
  --model public/model/wearth.glb --out /tmp/preview.png
```

比整站截图快得多，用来先筛字形。

## 已知取舍

原 `hello.gltf` 是 Spline 里手工做的：字形被特意简化、加宽、留大字腔，所以粗管
（0.679）也不会糊。系统字体做不到这点——`Wearth` 6 个字母挤在同样宽度里，
字腔小约 30%，管径必须降到 0.14 才能保持通透。

## 调参必读

这套模型是给**折射玻璃材质**用的，判断标准和普通模型完全不同。

### 只看 dpr=2 的整站实拍，别信 Blender 预览

Blender 预览里清晰的笔画凹槽，进折射材质会被**完全冲掉**。粗管版本在预览里
读得很清楚，上线就是一个没有细节的团。

原作 `hello` 能读，靠的是笔画之间**真的有透空的缝**（剪影），不是表面起伏。
所以管径必须小到笔画彼此分离为止。

### 两个坑

**锁宽度会把字压小。** `--fit width` 把宽度钉成原作的 0.7007，字数一多字高就被
压下去（Wearth 曾被压到 0.2139，原作 0.2428）。字一小，字腔更挤；管一细，掠射角
面积变大，`thicknessMask` 升高让蓝色 tint 加重 —— 于是又挤又暗。**用 `--fit height`。**

**沿轮廓扫掠，不是沿中心线。** 字形轮廓包含外缘和内圈两条线，粗管会把中间的字腔
填死。原作是 Spline 里沿 `Path` 中心线扫的，所以粗管也不糊。用细笔画、大字腔的
等线体（Caveat / Comfortaa / Quicksand）可以逼近这个效果。

### 试过但不行的

| 字体 | 问题 |
|---|---|
| Snell Roundhand / Savoye / Apple Chancery | 花体笔画密，进玻璃糊成一坨 |
| Brush Script | 同上 |
| Pacifico | 笔画偏重、字腔小，粗管填死、细管发暗 |
| Caveat @ 0.34 / 0.26 / 0.22 | 管太粗，笔画粘连 |
| **Caveat @ 0.18** | **采用** |

## 颜色

hero 的 tint 用材质默认值，即与原作 `hello` 完全一致（亮色 `#009dff` → `#ffffff`，
满浓度）。若要单独调淡，给 `GlassModel` 传 `tingColor`，格式
`[lightA, lightB, darkA, darkB]`，支持 `#rrggbbaa` —— alpha 直接缩放
`tintK_beer`，且只影响这一个模型。

## 单独调整首字母

首字形可以独立于其余字母调整，两个参数：

| 参数 | 作用 |
|---|---|
| `--lead-width` | 横向拉宽（当前 `1.25`） |
| `--lead-thickness-ratio` | 单独的管径比 |

实现：文字转曲线后，按 spline 的 X 区间聚类找出最左侧字形（一个字形通常由外轮廓加
字腔共几条 spline 组成），拆成两个对象分别处理，再合并网格。

### 两个必须注意的点

**按索引匹配 spline，不能按对象身份。** `duplicate()` 之后曲线数据是新副本、spline
是全新实例，身份匹配会全部失配，导致首字母被整个删掉。

**改坐标前先把 bezier 控制柄设成 `FREE`。** `AUTO` / `ALIGNED` 的控制柄会在点移动时
被 Blender 自动重算并强制共线，于是「只缩放 X」也会把点甩到 Y 方向去 —— 表现为归一化
前的 Y 从 0.6297 涨到 0.8528，缩放因子被压小，整个词反而变窄。

**拉宽要在 bevel 之前做**，之后再缩会把圆形截面压成椭圆。拉宽首字形的同时，其余字母
要右移相同距离以保持字距。

---

# 首图生成

`build-hero.mjs` 把设计稿交付成首图。设计稿在
`首屏主视觉插图/4x1-候选-*/`，已经是 4:1，不用改画幅。

```bash
node tools/build-hero.mjs \
  ../首屏主视觉插图/4x1-候选-v5/profile-hero-4x1.png \
  public/img/hero/profile.webp
```

两件事：放大到 3344px 宽，编码 webp 并把色度采样锁成 4:4:4。

稿子是 2000px 宽，而首图在宽屏上就要显示到 1600px 左右，HiDPI 屏等于只有 0.6 倍
像素密度，直接用原稿会糊。放大补不出细节，但 lanczos3 + 轻锐化比浏览器自己的
双线性放大干净。

4:4:4 是这几张稿子的关键：webp 默认的 4:2:0 会把粉色字和细线的边缘染糊，
而稿子上到处是粉字、细网格和半调网点。

---

# 角标字标生成

`build-logo.py` 把 logo 设计稿交付成页头角标用的透明图。源稿在
`Design/wearth-logo-mark-src.png`，输出在 `public/img/logo/logo-mark.png`。

```bash
python3 tools/build-logo.py \
  ../Design/wearth-logo-mark-src.png \
  public/img/logo/logo-mark.png
```

源稿是**不透明 RGB**，交付时那圈灰白棋盘格是画进图里的，不是真透明 ——
直接引用会在角标位置露出一块灰格子方块，所以必须过这一道。

## 键背景不能只看亮度

吊牌那块米白是 `(248,244,235)`，比棋盘格的深格 `(247,247,247)` 还亮。
分开两者的是**「中性」这一维**：棋盘格三通道相等，吊牌通道差 13、浅粉衣通道差 57。
判据因此是「通道差 ≤ 6 **且** 亮度 ≥ 245」，两条都满足才算底。

| 参数 | 值 | 备注 |
|---|---|---|
| `NEUTRAL_SPREAD` | 6 | 三通道极差上限。留了余量，但离吊牌的 13 足够远 |
| `CLEAR_AT` | 245 | 中性且亮到这里就全透。**必须压在 247 以下** —— 棋盘格是 247 / 254 两格交替，设高了深的那半边会留成一片实色方块 |
| `FEATHER_AT` | 225 | 225–245 之间线性过渡，给黑色网格线的抗锯齿边留软边。全用硬阈值的话，那些线在首页粉色天空底上会镶一圈白毛边 |
| `--size` | 512 | 角标最大显示 64px，512 给到 8 倍密度，也够 favicon / 启动页用 |

换新稿时先验一遍这三个值：把新稿最浅的**画面内容**取样，确认它的通道差明显大于
`NEUTRAL_SPREAD`，否则会被当成底抠掉。

## 源稿不放 public

`public/` 里的东西会整个打进部署包。源稿 1.7MB 而页面根本不引用它，
所以留在 `Design/`，只把 255KB 的成品交付过去。
