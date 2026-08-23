"use client";

import AddItemButton from "@/components/add-item-button";
import GridOverlay from "@/components/grid-overlay";
import SiteHeader from "@/components/site-header";
import { useStatusLine } from "@/lib/season";
import { TAGLINE } from "@/lib/nav";
import HeroScene from "@/webgl/hero-scene";

export default function Home() {
  const statusLine = useStatusLine();

  return (
    <>
      <div className="z-10 fixed inset-0 flex flex-col justify-between px-4 lg:px-14 py-4 lg:py-7 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <SiteHeader />

        {/* The wordmark is WebGL; the DOM only carries its accessible name. */}
        <h1 className="sr-only">WEARTH — 衣有所值，心动有知</h1>

        <div className="flex flex-col">
          {/* The button stretches to this row, so its top meets the Chinese
              line's top and its bottom meets the English line's bottom. */}
          <div className="flex justify-between items-stretch gap-4 lg:gap-6">
            <div className="flex flex-col gap-1 min-w-0">
              <p
                className="tagline-zh font-sans font-bold text-l1 text-[7.4svw] sm:text-6xl leading-tight"
                style={{ fontVariationSettings: '"wdth" 120' }}
              >
                {TAGLINE.zh}
              </p>
              <p
                className="tagline-en lg:whitespace-nowrap font-sans font-bold text-l1 text-[6.4svw] sm:text-5xl leading-tight"
                style={{ fontVariationSettings: '"wdth" 120' }}
              >
                {TAGLINE.en}
              </p>
            </div>

            <div className="tagline-square self-end lg:self-start shrink-0 w-20 h-20">
              <AddItemButton />
            </div>
          </div>

          <p className="mt-3 lg:mt-4 font-mono-2 text-l1 text-xs lg:text-base tabular-nums">{statusLine}</p>
        </div>
      </div>

      <GridOverlay />

      <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen">
        <HeroScene />
      </div>
    </>
  );
}
