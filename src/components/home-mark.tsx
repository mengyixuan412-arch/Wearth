"use client";

import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";
import { NAV_ITEMS, SUBMARK } from "@/lib/nav";
import { scrollEnv } from "@/lib/scroll-env";

const TITLE_WIDTH = { fontVariationSettings: '"wdth" 120' } as const;

/**
 * Rendered outside the scroll container so it never travels with the page: the
 * submark (back to top) and the section nav stay put for the whole scroll.
 */
export default function HomeMark() {
  const goTo = (target: number | string) => scrollEnv.lenisScrollTo(target, { lerp: 0.1 });

  return (
    <div className="top-4 lg:top-7 right-4 lg:right-14 left-4 lg:left-14 z-30 fixed flex lg:flex-row flex-col justify-between items-start gap-4 lg:gap-6 pointer-events-none">
      <button
        type="button"
        onClick={() => goTo(0)}
        aria-label="回到主页"
        className={`${DOTTED_BORDER_BASE} p-2 font-sans font-bold text-l1 text-sm lg:text-lg cursor-pointer pointer-events-auto`}
        style={TITLE_WIDTH}
      >
        {SUBMARK}
      </button>

      <nav className="flex flex-wrap lg:justify-end gap-x-3 lg:gap-x-8 gap-y-1 lg:gap-y-2 w-full lg:w-auto font-mono-2 pointer-events-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.anchor}
            type="button"
            onClick={() => goTo(item.anchor === "#banner" ? 0 : item.anchor)}
            className={`${DOTTED_BORDER_BASE} p-1.5 lg:p-2 leading-tight text-left cursor-pointer`}
          >
            <span className="block text-l1 text-xs lg:text-base whitespace-nowrap">{item.zh}</span>
            <span className="block text-l2 text-[10px] lg:text-sm whitespace-nowrap">{item.en}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
