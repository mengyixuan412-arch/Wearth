import sharp from "sharp";

/**
 * 首图交付：设计稿 PNG → public/img/hero/*.webp
 *
 *   node tools/build-hero.mjs <设计稿.png> <输出.webp>
 *
 * 设计稿已经是 4:1，不用再改画幅，这里只做两件事：
 *
 * 1. 放大到 3344px 宽。稿子是 2000px，而首图在宽屏上的显示宽度就有 1600px 左右，
 *    HiDPI 屏等于只有 0.6 倍像素密度 —— 直接用原稿会糊。放大补不出细节，
 *    但 lanczos3 + 轻锐化比浏览器自己的双线性放大干净。
 * 2. 编码成 webp，色度采样锁 4:4:4。默认的 4:2:0 会把粉色字和细线的边缘染糊，
 *    这几张稿子上到处是粉字、细网格和半调网点，最吃这一项。
 */
const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("用法: node tools/build-hero.mjs <设计稿.png> <输出.webp>");
  process.exit(1);
}

const meta = await sharp(src).metadata();
const info = await sharp(src)
  .resize({ width: 3344, kernel: "lanczos3" })
  .sharpen({ sigma: 0.8, m1: 0.6, m2: 0.9 })
  .webp({ quality: 88, smartSubsample: true, effort: 6 })
  .toFile(out);

console.log(
  `${meta.width}x${meta.height} (${(meta.width / meta.height).toFixed(3)}:1)` +
    ` → ${info.width}x${info.height}  ${Math.round(info.size / 1024)}KB  ${out}`,
);
