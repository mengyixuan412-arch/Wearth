"use client";

/**
 * 从一张图里取出衣服的主色调。**在浏览器里算，不问模型。**
 *
 * 模型只会返回**色系**（粉/红/蓝这十来个闭集值），代码拿到之后填的是
 * `FAMILY_SWATCH["粉"]` —— 一个固定的示意色。所以藕粉和桃粉填进去是同一个值。
 * 而真值就在用户刚上传的那张图里：精确、即时、免费、**不外发**、断网也能用。
 *
 * 色值这种东西模型也给不准 —— 它会返回一个看起来合理的 `#E8C4C8`，
 * 但那是「粉色大概长这样」，不是这张图里的粉。
 */

/** 算的时候把图缩到这个长边。再大只是让 `getImageData` 更慢，主色不会更准。 */
const SAMPLE_EDGE = 96;

/** 每通道量化到 32 级（5 bit）。太细会把同一片布的明暗噪点拆成不同桶。 */
const LEVELS = 32;
const STEP = 256 / LEVELS;

/** 不透明才算数。抠图给的透明底就是靠这条排掉的。 */
const OPAQUE = 200;

/** 近白像素多半是背景/打光过曝，不是衣服。**不排近黑** —— 黑衣服太常见。 */
const isBlownOut = (r: number, g: number, b: number) => r > 244 && g > 244 && b > 244;

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

async function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * 主色调。取不出来返回 `null`（图坏了、整张透明、全是白底）。
 *
 * **用直方图的众数，不用平均值。** 平均会把衣服和背景搅成一坨 ——
 * 白墙前的红上衣平均出来是粉的，那个颜色画面里根本不存在。
 * 先按量化桶投票选出最大的那一桶，再对落在这一桶里的真实像素求平均，
 * 既避开了搅浑，又保住了精度。
 *
 * @param src        dataURL。**优先传抠图结果** —— 透明底把「哪些像素是衣服」
 *                   这个最难的问题直接解决了。
 * @param centreOnly 没有抠图时传 true：只取中心 60% 的区域。衣服一般在画面中间，
 *                   而衣架、手、页面按钮在边上。
 */
export async function dominantColor(src: string, centreOnly = false): Promise<string | null> {
  const image = await load(src);
  if (!image?.width || !image.height) return null;

  const scale = Math.min(1, SAMPLE_EDGE / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, w, h);

  const box = centreOnly
    ? { x: Math.floor(w * 0.2), y: Math.floor(h * 0.2), w: Math.ceil(w * 0.6), h: Math.ceil(h * 0.6) }
    : { x: 0, y: 0, w, h };

  let data: Uint8ClampedArray;
  try {
    ({ data } = ctx.getImageData(box.x, box.y, box.w, box.h));
  } catch {
    // 理论上到不了这里：全站的图都是 dataURL，同源。跨源图会污染画布直接抛。
    return null;
  }

  const votes = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < OPAQUE || isBlownOut(r, g, b)) continue;
    const key =
      (Math.floor(r / STEP) << 10) | (Math.floor(g / STEP) << 5) | Math.floor(b / STEP);
    const cell = votes.get(key);
    if (cell) {
      cell.n += 1;
      cell.r += r;
      cell.g += g;
      cell.b += b;
    } else {
      votes.set(key, { n: 1, r, g, b });
    }
  }

  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const cell of votes.values()) if (!best || cell.n > best.n) best = cell;
  if (!best) return null;

  return hex(best.r / best.n, best.g / best.n, best.b / best.n);
}
