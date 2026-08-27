"""
角标字标交付：设计稿 PNG → public/img/logo/logo-mark.png

    python3 tools/build-logo.py <设计稿.png> <输出.png> [--size 512]

设计稿是**不透明 RGB**，交付时那圈灰白棋盘格是画进图里的，不是真透明 ——
直接引用会在页头角标的位置露出一块灰格子方块。这里把它抠掉。

三件事：按颜色键出棋盘格底、裁掉空边并补回正方形、缩到交付尺寸。

键背景不能只看亮度：吊牌那块米白是 (248,244,235)，比棋盘格的深格 (247,247,247)
还亮。**分开的是「中性」这一维** —— 棋盘格是纯灰（三通道相等），吊牌通道差 13、
浅粉衣通道差 57。所以判据是「通道差够小 且 够亮」，两条都满足才算底。
"""

import argparse
import sys

try:
    from PIL import Image
    import numpy as np
except ImportError:
    sys.exit("需要 Pillow 与 numpy：pip3 install pillow numpy")


# ── 抠底参数 ────────────────────────────────────────────────
# 三通道极差不超过它才算「中性灰」。设计稿里最接近中性的画面内容是吊牌（13），
# 留 6 的余量既盖得住 JPEG 式的轻微偏色，又离吊牌足够远。
NEUTRAL_SPREAD = 6

# 中性像素亮到这个值就是底，全透。
# **必须压在 247 以下** —— 棋盘格是 247 与 254 两格交替，阈值设高了深的那半边
# 会留成一片实色方块，比不抠还难看。
CLEAR_AT = 245

# 中性像素在 [FEATHER_AT, CLEAR_AT) 之间做线性过渡，给黑色网格线的抗锯齿边留一层
# 软边。全用硬阈值的话，那些线在粉色天空底上会镶一圈白毛边。
FEATHER_AT = 225


def cut(src: Image.Image) -> Image.Image:
    rgb = np.asarray(src.convert("RGB"))
    a = rgb.astype(np.int16)
    neutral = (a.max(2) - a.min(2)) <= NEUTRAL_SPREAD
    lum = a.min(2)

    alpha = np.full(lum.shape, 255.0, dtype=np.float32)
    alpha[neutral & (lum >= CLEAR_AT)] = 0
    ramp = neutral & (lum >= FEATHER_AT) & (lum < CLEAR_AT)
    alpha[ramp] = (CLEAR_AT - lum[ramp]) / (CLEAR_AT - FEATHER_AT) * 255

    return Image.fromarray(np.dstack([rgb, alpha.astype(np.uint8)]))


def square(im: Image.Image) -> Image.Image:
    """裁掉全透的空边，再补回正方形 —— 角标位是等宽高的格子，不补会被压变形。"""
    box = im.getbbox()
    if box:
        im = im.crop(box)
    w, h = im.size
    side = max(w, h)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - w) // 2, (side - h) // 2))
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src", help="设计稿 PNG（不透明，带棋盘格底）")
    p.add_argument("out", help="输出 PNG（RGBA）")
    # 角标最大显示 64px，512 给到 8 倍密度，也够 favicon / 启动页那类大尺寸场合用。
    p.add_argument("--size", type=int, default=512, help="输出边长，默认 512")
    args = p.parse_args()

    src = Image.open(args.src)
    im = square(cut(src))
    im = im.resize((args.size, args.size), Image.LANCZOS)
    im.save(args.out, optimize=True)

    opaque = (np.asarray(im)[:, :, 3] > 0).mean() * 100
    print(f"{src.size[0]}x{src.size[1]} → {args.size}x{args.size} RGBA，画面占 {opaque:.0f}%")


if __name__ == "__main__":
    main()
