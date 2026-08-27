"use client";

import { useState } from "react";

import DialogShell from "@/components/dialog-shell";
import DottedLink from "@/components/dotted-link";
import { BRAND, NAV_ITEMS, SUBMARK } from "@/lib/nav";
import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";

/** Matches the tagline's typeface so the corner reads as one voice with it. */
const TITLE_FACE = "font-sans font-bold";
const TITLE_WIDTH = { fontVariationSettings: '"wdth" 120' } as const;

/**
 * 第二行默认是 BRAND。内页传字符串可换成自己的标题，传 null 则整行留空 ——
 * 品牌名在主页讲一次就够了，内页那个位置未必需要填东西。
 */
export default function SiteHeader({ title }: { title?: string | null } = {}) {
  const [preview, setPreview] = useState(false);

  return (
    <header className="flex lg:flex-row flex-col justify-between items-start gap-4 lg:gap-6">
      <div className="flex flex-col gap-4 lg:gap-10 min-w-0">
        {/* 品牌角标：图形标识 + 文字，**两个独立的可点对象**。
            图看大图，文字回主页 —— 一块区域两种去处，所以不能再套同一个链接：
            点线描边只框住文字，框住的就是「这里会跳走」的那一半。
            图是彩色插画，按 §1 属于「主视觉」那一类，只出现在这一处角标里。 */}
        <div className="flex items-center gap-2.5 lg:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setPreview(true)}
            aria-label="查看品牌标识大图"
            aria-haspopup="dialog"
            className="block opacity-100 lg:hover:opacity-75 transition-opacity duration-200 motion-reduce:transition-none cursor-pointer shrink-0"
          >
            <img
              src="/img/logo/logo-mark.png"
              alt=""
              width={512}
              height={512}
              className="block w-12 lg:w-16 h-12 lg:h-16 object-contain"
            />
          </button>

          <DottedLink
            href="/"
            dotted
            className={`${TITLE_FACE} p-2 text-l1 text-base lg:text-xl`}
            style={TITLE_WIDTH}
          >
            {SUBMARK}
          </DottedLink>
        </div>

        {title === null ? null : title ? (
          <p className={`${TITLE_FACE} p-2 text-l1 text-base lg:text-2xl leading-tight`} style={TITLE_WIDTH}>
            {title}
          </p>
        ) : (
          <DottedLink href="/" dotted className={`${TITLE_FACE} p-2 leading-tight`} style={TITLE_WIDTH}>
            <span className="block text-l1 text-base lg:text-2xl">{BRAND.zh}</span>
            <span className="block text-l2 text-xs lg:text-lg">{BRAND.en}</span>
          </DottedLink>
        )}
      </div>

      {/* Wraps into rows on narrow screens rather than running off the viewport. */}
      <nav className="flex flex-wrap lg:justify-end gap-x-3 lg:gap-x-8 gap-y-1 lg:gap-y-2 w-full lg:w-auto font-ui">
        {NAV_ITEMS.map((item) => (
          <DottedLink
            key={item.href}
            href={item.href}
            className={`${DOTTED_BORDER_BASE} p-1.5 lg:p-2 leading-tight text-left`}
          >
            <span className="block text-l1 text-xs lg:text-base whitespace-nowrap">{item.zh}</span>
            <span className="block text-l2 text-[10px] lg:text-sm whitespace-nowrap">{item.en}</span>
          </DottedLink>
        ))}
      </nav>

      {/* 标识大图。走全站统一的弹窗外壳（§5.10），不另写一层遮罩 ——
          Portal 到 body、Esc 关闭、遮罩浓度都由它管；首页那层 Lenis 滚动容器
          也只有 Portal 出去才不会把滚轮吃掉。

          图铺在米白底 `bg-b1` 上而不是白底：稿子四边接近白，白底上会和面板融掉，
          这是首图外面要描一圈 `border-l4` 的同一个理由。 */}
      {preview ? (
        <DialogShell
          zh="品牌标识"
          en="Brand Mark"
          label="Wearth 品牌标识大图"
          onClose={() => setPreview(false)}
          panelClassName="max-w-lg"
        >
          <div className="flex justify-center items-center bg-b1 p-6 lg:p-10">
            <img
              src="/img/logo/logo-mark.png"
              alt="Wearth 品牌标识：一件挂着价签的粉色外套，压在准星网格上"
              width={512}
              height={512}
              className="block w-full max-w-sm h-auto"
            />
          </div>
        </DialogShell>
      ) : null}
    </header>
  );
}
