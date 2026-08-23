"use client";

import DottedLink from "@/components/dotted-link";
import { BRAND, NAV_ITEMS, SUBMARK } from "@/lib/nav";
import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";

export default function SiteHeader() {
  return (
    <header className="flex lg:flex-row flex-col justify-between items-start gap-4 lg:gap-6 font-mono-2">
      <div className="flex flex-col gap-4 lg:gap-10 min-w-0">
        <span className="p-2 text-l1 text-xs lg:text-base">{SUBMARK}</span>

        <DottedLink href="/" dotted className="p-2 leading-tight">
          <span className="block text-l1 text-xs lg:text-base">{BRAND.zh}</span>
          <span className="block text-l2 text-[10px] lg:text-sm">{BRAND.en}</span>
        </DottedLink>
      </div>

      {/* Wraps into rows on narrow screens rather than running off the viewport. */}
      <nav className="flex flex-wrap lg:justify-end gap-x-3 lg:gap-x-8 gap-y-1 lg:gap-y-2 w-full lg:w-auto">
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
    </header>
  );
}
