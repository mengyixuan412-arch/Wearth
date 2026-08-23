"use client";

import DottedLink from "@/components/dotted-link";
import { BRAND, NAV_ITEMS, SUBMARK } from "@/lib/nav";

/** Matches the tagline's typeface so the corner reads as one voice with it. */
const TITLE_FACE = "font-sans font-bold";
const TITLE_WIDTH = { fontVariationSettings: '"wdth" 120' } as const;

/**
 * The in-flow part of the banner's header. The submark and the section nav are
 * drawn by <HomeMark/> outside the scroller so they never scroll away; the
 * invisible copies here just reserve the space they used to occupy.
 */
export default function SiteHeader() {
  return (
    <header className="flex lg:flex-row flex-col justify-between items-start gap-4 lg:gap-6">
      <div className="flex flex-col gap-4 lg:gap-10 min-w-0">
        <span aria-hidden="true" className={`${TITLE_FACE} invisible p-2 text-sm lg:text-lg`} style={TITLE_WIDTH}>
          {SUBMARK}
        </span>

        <DottedLink href="/" dotted className={`${TITLE_FACE} p-2 leading-tight`} style={TITLE_WIDTH}>
          <span className="block text-l1 text-base lg:text-2xl">{BRAND.zh}</span>
          <span className="block text-l2 text-xs lg:text-lg">{BRAND.en}</span>
        </DottedLink>
      </div>

      <nav aria-hidden="true" className="invisible flex flex-wrap lg:justify-end gap-x-3 lg:gap-x-8 gap-y-1 lg:gap-y-2 w-full lg:w-auto font-mono-2">
        {NAV_ITEMS.map((item) => (
          <span key={item.anchor} className="block p-1.5 lg:p-2 leading-tight">
            <span className="block text-xs lg:text-base whitespace-nowrap">{item.zh}</span>
            <span className="block text-[10px] lg:text-sm whitespace-nowrap">{item.en}</span>
          </span>
        ))}
      </nav>
    </header>
  );
}
