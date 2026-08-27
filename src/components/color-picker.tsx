"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { META } from "@/components/panel";

/**
 * 取色器：饱和度/明度方块 + 色相条 + hex 读数 + 最近用色。
 *
 * 不用原生 `<input type="color">` —— 它弹的是操作系统面板，长相由系统决定，
 * 在这套白底灰线框里会突兀地跳出来，也挂不上「最近用色」这类自带信息。
 *
 * **色相单独存 state，不从 hex 反推**：纯黑和纯白的 hex 里没有色相信息，
 * 拖到方块左下角再拖回来，色相会被重置成红色。
 */

/**
 * `EyeDropper` 还没进 TS 的 DOM 类型库，用到就得自己声明一遍。
 * 只有 Chromium 系有（Chrome / Edge 95+），Safari 与 Firefox 都没有 ——
 * 所以下面按「存在才渲染」处理，不做降级弹窗。
 */
declare global {
  interface Window {
    EyeDropper?: new () => { open: (options?: { signal?: AbortSignal }) => Promise<{ sRGBHex: string }> };
  }
}

const DropperIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="block w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M10.6 2.5a1.9 1.9 0 0 1 2.7 2.7l-1.2 1.2 1 1-1.4 1.4-1-1-4.6 4.6-2.6.6.6-2.6 4.6-4.6-1-1L9.1 3.4l1 1z" strokeLinejoin="round" />
  </svg>
);

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [r + m, g + m, b + m].map((n) => Math.round(n * 255));
}

function hsvToHex(h: number, s: number, v: number) {
  return `#${hsvToRgb(h, s, v)
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function hexToHsv(hex: string) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return { h: 0, s: 0, v: 0 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

// ── 最近用色 ────────────────────────────────────────────────

const RECENT_KEY = "wearth:recent-colors";
const RECENT_MAX = 14;

/** 首次使用时的默认色板。空网格什么都不说明，不如先给一排常见衣服色。 */
const SEED_RECENT = [
  "#1F1F21", "#F2F0EC", "#8C8C8C", "#1E3A5F", "#7A93BC", "#C9AE92", "#6B4A32",
  "#8E2D3C", "#D9A8BD", "#3F5E45", "#C4574B", "#E8C25A", "#4A4A6A", "#B8B0A4",
];

export function readRecentColors(): string[] {
  if (typeof window === "undefined") return SEED_RECENT;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    // 存量不足就用默认色板补齐，网格永远是满的
    return [...parsed, ...SEED_RECENT.filter((hex) => !parsed.includes(hex))].slice(0, RECENT_MAX);
  } catch {
    return SEED_RECENT;
  }
}

/**
 * 记一笔最近用色。**只在真正存下一件衣服时调用** ——
 * 拖动过程中每一帧都是一个新颜色，边拖边记会把色板冲成一片渐变。
 */
export function rememberColor(hex: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [hex.toUpperCase(), ...parsed.filter((entry) => entry !== hex.toUpperCase())].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* 配额满了不影响主流程 */
  }
}

// ── 拖拽 ────────────────────────────────────────────────────

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 按下即捕获指针，跑出元素外也继续跟随，松开自动释放。 */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handle = useCallback(
    (event: React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onMove(clamp01((event.clientX - rect.left) / rect.width), clamp01((event.clientY - rect.top) / rect.height));
    },
    [onMove],
  );

  return {
    ref,
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as Element).setPointerCapture?.(event.pointerId);
      handle(event);
    },
    onPointerMove: (event: React.PointerEvent) => {
      if (event.buttons !== 1) return;
      handle(event);
    },
  };
}

const HANDLE =
  "absolute w-4 h-4 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none";
const HANDLE_SHADOW = { boxShadow: "0 0 0 1px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.25)" } as const;

// ── 商品取色 ───────────────────────────────────────────────

/** 取样画布的 CSS 尺寸。宽度 = 面板 `w-64` 减去 `p-3` 两侧内边距。 */
const SAMPLE_W = 232;
const SAMPLE_H = 132;
/** 放大镜：边长与倍率。9×9 源像素放到 72px，一格 8px，看得清自己压在哪。 */
const LOUPE = 72;
const ZOOM = 8;
/**
 * 取样邻域半径，2 → 5×5。
 *
 * **单像素取色在布料上基本没法用** —— 织物有纹理，褶皱有高光和阴影，
 * 取中一个高光点会得到近白色。取一小片求平均才是那件衣服的颜色
 * （Photoshop 的「取样大小」就是这件事）。
 */
const AVG = 2;

/**
 * 商品图取样条：一张按 contain 画进 canvas 的缩略图，悬停出放大镜，点击落色。
 *
 * 用 canvas 而不是 `<img>` + 坐标换算：图画进画布之后，鼠标位置到像素就是
 * 一比一的（只差一个 dpr 系数），不必再去推 `object-contain` 的留白偏移。
 * 留白保持透明，点在留白上不取色。
 *
 * **键盘走不到这里**，取色的键盘路径是下面的 hex 输入框与最近用色 ——
 * canvas 上没有可聚焦的目标，硬造一个网格出来也点不准。
 */
function ImageSampler({
  src,
  label,
  onPick,
}: {
  src: string;
  label: string;
  onPick: (hex: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; hex: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // dpr 压到 2：再高只是让 getImageData 更慢，取色精度不会变好。
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SAMPLE_W * dpr;
    canvas.height = SAMPLE_H * dpr;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  /** 读 (px, py) 周围 5×5 的平均色。全在留白上则返回 null。 */
  const readAt = (px: number, py: number) => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const size = AVG * 2 + 1;
    // 越界部分 getImageData 会补透明，下面按 alpha 过滤，不必自己裁边。
    const { data } = ctx.getImageData(px - AVG, py - AVG, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
    if (n === 0) return null;
    return `#${[r / n, g / n, b / n]
      .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
  };

  const drawLoupe = (px: number, py: number) => {
    const loupe = loupeRef.current;
    const source = canvasRef.current;
    if (!loupe || !source) return;
    const ctx = loupe.getContext("2d");
    if (!ctx) return;
    const span = LOUPE / ZOOM;
    ctx.clearRect(0, 0, loupe.width, loupe.height);
    // 关掉平滑，放大出来才是一格一格的像素，而不是一团糊。
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, px - span / 2, py - span / 2, span, span, 0, 0, loupe.width, loupe.height);
  };

  const track = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
    const py = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
    const hex = readAt(px, py);
    if (!hex) {
      setHover(null);
      return;
    }
    drawLoupe(px, py);
    setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top, hex });
  };

  // 放大镜跟着光标，但夹在画布内 —— 跟出边界会被面板的圆角裁掉。
  const loupeLeft = hover ? Math.max(0, Math.min(hover.x - LOUPE / 2, SAMPLE_W - LOUPE)) : 0;
  const loupeTop = hover ? Math.max(0, Math.min(hover.y - LOUPE - 12, SAMPLE_H - LOUPE)) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <p className={`${META} text-l1`}>{label}</p>
      <div className="relative" style={{ width: SAMPLE_W, height: SAMPLE_H }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="商品图，点击图上任意一处取那里的颜色"
          onPointerMove={track}
          onPointerLeave={() => setHover(null)}
          onClick={() => hover && onPick(hover.hex)}
          className="block border border-line rounded w-full h-full cursor-crosshair touch-none"
          style={{ width: SAMPLE_W, height: SAMPLE_H }}
        />

        {hover ? (
          <div
            aria-hidden="true"
            className="absolute flex flex-col items-center gap-1 pointer-events-none"
            style={{ left: loupeLeft, top: loupeTop }}
          >
            <canvas
              ref={loupeRef}
              width={LOUPE}
              height={LOUPE}
              className="block bg-card border-2 border-card rounded-full"
              style={{ width: LOUPE, height: LOUPE, boxShadow: "0 2px 8px rgba(20,20,28,0.28)" }}
            />
            <span
              className={`${META} px-1.5 py-0.5 rounded text-card tabular-nums`}
              style={{ background: "rgba(20,20,28,0.82)" }}
            >
              {hover.hex.replace("#", "")}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ColorPicker({
  value,
  onChange,
  footer,
  sampleImage,
  sampleLabel = "商品取色",
}: {
  value: string;
  onChange: (hex: string) => void;
  footer?: React.ReactNode;
  /**
   * 可以从上面取色的图（dataURL）。传了才渲染取样条。
   *
   * **必须是同源的 dataURL** —— 外链图会把 canvas 标记成「已污染」，
   * `getImageData` 直接抛 SecurityError。全站的图都走 `image.ts` 缩成
   * dataURL 存下来，这个条件天然成立。
   */
  sampleImage?: string | null;
  /**
   * 取样条的标题。默认「商品取色」—— 三处衣物场景取的都是那件东西的照片。
   * 档案页取的是本人照片，不是商品，那里要另给一个。
   */
  sampleLabel?: string;
}) {
  const parsed = hexToHsv(value);
  const [hue, setHue] = useState(parsed.h);
  const [text, setText] = useState(value);
  const [recent, setRecent] = useState<string[]>(SEED_RECENT);

  // localStorage 只能在挂载后读，否则服务端渲染出的色板和客户端对不上
  useEffect(() => setRecent(readRecentColors()), []);

  useEffect(() => {
    setText(value.replace("#", "").toUpperCase());
    const next = hexToHsv(value);
    if (next.s > 0.01 && next.v > 0.01) setHue(next.h);
  }, [value]);

  const sv = useDrag((x, y) => onChange(hsvToHex(hue, x, 1 - y)));
  const hueBar = useDrag((x) => {
    const h = x * 360;
    setHue(h);
    onChange(hsvToHex(h, parsed.s || 1, parsed.v || 1));
  });

  /**
   * 吸管只在 Chromium 系存在。**挂载后再探测**，不在渲染期读 `window` ——
   * 服务端渲染时它不存在，首帧按「有」画、水合时按「没有」画会报 hydration 不匹配。
   */
  const [hasDropper, setHasDropper] = useState(false);
  useEffect(() => setHasDropper(typeof window !== "undefined" && "EyeDropper" in window), []);

  const pickFromScreen = async () => {
    const Dropper = window.EyeDropper;
    if (!Dropper) return;
    try {
      const { sRGBHex } = await new Dropper().open();
      onChange(sRGBHex.toUpperCase());
    } catch {
      // 用户按 Esc 取消会 reject，这不是错误，什么都不用做。
    }
  };

  const commitText = (raw: string) => {
    const clean = raw.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(clean)) onChange(`#${clean.toUpperCase()}`);
    else setText(value.replace("#", "").toUpperCase());
  };

  return (
    <div className="flex flex-col gap-3 bg-card shadow-2xl p-3 border border-l4 rounded-xl w-64">
      {/* 饱和度 × 明度：白→本色 横向，透明→黑 纵向 */}
      <div
        {...sv}
        ref={sv.ref}
        className="relative rounded-lg w-full h-40 overflow-hidden cursor-crosshair touch-none"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
        }}
      >
        <span
          aria-hidden="true"
          className={HANDLE}
          style={{ ...HANDLE_SHADOW, left: `${parsed.s * 100}%`, top: `${(1 - parsed.v) * 100}%` }}
        />
      </div>

      {/* 色相条 */}
      <div
        {...hueBar}
        ref={hueBar.ref}
        className="relative rounded-full w-full h-4 cursor-ew-resize touch-none"
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        }}
      >
        <span
          aria-hidden="true"
          className={`${HANDLE} top-1/2`}
          style={{ ...HANDLE_SHADOW, left: `${(hue / 360) * 100}%`, backgroundColor: `hsl(${hue} 100% 50%)` }}
        />
      </div>

      {/* 读数 */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="block border border-line rounded w-7 h-7 shrink-0"
          style={{ backgroundColor: value }}
        />
        <span className={`${META} text-l1 shrink-0`}>色值</span>
        <input
          type="text"
          value={text}
          maxLength={6}
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => commitText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitText((event.target as HTMLInputElement).value);
          }}
          aria-label="色值"
          className="flex-1 bg-be/50 px-2 py-1.5 border border-line focus:border-accent rounded min-w-0 font-ui text-l1 text-xs lg:text-sm tabular-nums transition-colors duration-200 outline-none"
        />
        {/* 吸管：从屏幕上任意一个像素取色 —— 评分页最常做的就是对着上传的
            商品图判断颜色，比在方块里凭眼睛拖准得多。 */}
        {hasDropper ? (
          <button
            type="button"
            onClick={pickFromScreen}
            aria-label="从屏幕取色"
            title="从屏幕取色"
            className="flex justify-center items-center border border-line lg:hover:border-accent rounded w-7 h-7 text-l3 lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer shrink-0"
          >
            <DropperIcon />
          </button>
        ) : null}
      </div>

      {sampleImage ? <ImageSampler src={sampleImage} label={sampleLabel} onPick={onChange} /> : null}

      {/* 最近用色 */}
      <div className="flex flex-col gap-1.5">
        <p className={`${META} text-l1`}>最近用色</p>
        <div className="gap-1.5 grid grid-cols-7">
          {recent.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              aria-label={hex}
              title={hex}
              className={`rounded w-full aspect-square transition-transform duration-150 motion-reduce:transition-none lg:hover:scale-110 cursor-pointer ${
                hex.toUpperCase() === value.toUpperCase() ? "ring-2 ring-l1 ring-offset-1" : "border border-line"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      {footer ? <p className={`${META} text-l1`}>{footer}</p> : null}
    </div>
  );
}
