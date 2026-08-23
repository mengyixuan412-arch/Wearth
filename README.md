# haoqi.design — 源码还原

从生产环境（https://haoqi.design/）逆向还原的完整可运行源码。

## 快速开始

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 生产构建
```

## 技术栈

Next.js 15（App Router / Turbopack）· React 19 · Tailwind CSS v4 ·
three r184 · @react-three/fiber 9 · @react-three/postprocessing · postprocessing ·
motion · lenis · next-mdx-remote · prism-react-renderer

## 目录

```
src/
  app/               路由：/ · /[slug] · /2026 · /unlock/[slug] · /api/passcode
  components/        Shell（Header / Scrollbar / GridOverlay / ScrambleText …）
    mdx/             文章渲染件（标题锚点 / 链接 / 图片网格 / 代码块 / 页脚）
    sections/        Selected Work · Contact
    hyper-space/     Innovate 8 屏滚动区（逐字进场 / 弧形环）
  content/           项目文章 MDX 源
  data/              作品数据
  lib/               视口 / 滚动 / 缓动 / 口令 / 区块度量
  providers/         Theme · ShellMedia · Pointer · Passcode · FullscreenTransition
  webgl/             3D 场景
    shaders/         全部 GLSL（逐字还原，含原始中文注释）
public/              字体 / 模型 / 贴纸 / 作品图 / BGM
analysis/            逆向分析文档（按模块）
_evidence/           线上取证：HTML / bundle / CSS / 运行时 GLSL / 参考截图
```

## 环境变量

```bash
PASSCODE_CODE=****   # /2026 的 4 位口令
```
口令由服务端校验，**原口令不在前端包内**，无法从生产环境恢复。设置该变量即可启用门禁；
未设置时 `/2026` 始终重定向到 `/unlock/2026`（与线上未解锁时行为一致）。

## 还原方法

1. **RSC flight payload** → 根 layout 的 Provider 树与路由结构
2. **SSR HTML** → 精确到每个 class 的 DOM 结构与文案
3. **Turbopack bundle** → 组件逻辑（生产包保留了导出名、className 与含中文注释的 GLSL）
4. **运行时 WebGL 拦截** → 27 个 shader 的编译后源码
5. **React fiber 遍历** → R3F 场景图与全部 uniform 实测值
6. **Playwright 逐状态比对** → 与线上截图对照修正

详见 `analysis/`。

## 已知差异

- `/2026` 正文内容不可获取（口令保护），路由已就位但内容文件缺失
- 项目页配图沿用线上图床外链 `mysite2026-blog-cyn6.vercel.app`
- 天气 API key 与线上一致（本就暴露在前端）
