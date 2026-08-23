"use client";

import { useMemo, useRef } from "react";

import AddItemButton from "@/components/add-item-button";
import GridOverlay from "@/components/grid-overlay";
import ScrambleText from "@/components/scramble-text";
import SignatureSign from "@/components/signature-sign";
import SiteHeader from "@/components/site-header";
import { TAGLINE } from "@/lib/nav";
import { useStatusLine } from "@/lib/season";
import { useSectionRects, type TrackedSection } from "@/lib/use-section-rects";
import HomeScene, { type SceneImageLayer } from "@/webgl/home-scene";

const ABOUT_PARAGRAPH_LINK_CLASS =
  "inline text-l1 underline underline-offset-[0.08em] decoration-solid decoration-(--label-3) transition-[text-decoration-color] duration-150 ease-out lg:[@media(hover:hover)]:hover:decoration-(--label-1)";

/** Section still to be built — keeps the scroll continuous in the meantime. */
function ComingSection({ id, zh, en, note }: { id: string; zh: string; en: string; note: string }) {
  return (
    <section id={id} className="flex flex-col justify-center gap-4 px-4 lg:px-14 py-18 lg:py-24 w-full min-h-[70svh]">
      <p className="p-2 font-mono-2 text-l3 text-xs lg:text-sm">
        <ScrambleText text={en} letterDelayMs={50} />
      </p>
      <h2
        className="p-2 font-sans font-bold text-l1 text-[9svw] lg:text-[4svw] leading-tight"
        style={{ fontVariationSettings: '"wdth" 120' }}
      >
        {zh}
      </h2>
      <p className="p-2 max-w-xl font-sans text-l2 text-base lg:text-xl leading-relaxed">{note}</p>
    </section>
  );
}

export default function Home() {
  const statusLine = useStatusLine();
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const portraitRef = useRef<HTMLDivElement | null>(null);

  const trackedSections = useMemo<TrackedSection[]>(() => [{ name: "banner", ref: bannerRef }], []);
  const sectionRects = useSectionRects(trackedSections);

  const sceneLayers = useMemo<SceneImageLayer[]>(
    () => [{ key: "about", imageUrl: "/img/m3.png", targetRef: portraitRef }],
    [],
  );

  return (
    <>
      {/* ── 主页 ───────────────────────────────────────────── */}
      <div
        ref={bannerRef}
        id="banner"
        className="relative z-10 flex flex-col justify-between px-4 lg:px-14 py-4 lg:py-7 w-full h-dvh lg:h-screen"
      >
        <SiteHeader />

        <h1 className="sr-only">WEARTH — 衣有所值，心动有知</h1>

        <div className="flex flex-col">
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

      {/* ── 认识自己 ────────────────────────────────────────── */}
      <section id="profile" className="relative z-10 grid grid-cols-12 px-4 lg:px-14 py-18 lg:py-24 lg:pb-28 w-full">
        <div className="relative col-span-12 sm:col-span-4 lg:col-span-3 p-2">
          <SignatureSign className="-top-1/32 -left-1/12 absolute w-3/4 pointer-events-none" />
          <div ref={portraitRef} className="aspect-square" />
        </div>
        <div className="flex flex-col justify-start items-start gap-6 col-span-12 sm:col-span-7 lg:col-span-8 sm:col-start-6 lg:col-start-5 text-base lg:text-xl leading-none">
          <p
            className="p-2 w-full text-l1 md:text-[4.2svw] text-xl leading-[1.3] md:leading-none select-text"
            style={{ fontFamily: '"tiktok", sans-serif' }}
          >
            <span>我用穿搭数据认识自己：衣橱里真正被穿的、被闲置的、值不值，都写在每一次记录里。</span>
          </p>
          <p
            className="p-2 w-full text-l2 md:text-[4.2svw] text-xl leading-[1.3] md:leading-none select-text"
            style={{ fontFamily: '"tiktok", sans-serif' }}
          >
            <span>
              围度决定{" "}
              <a href="#decide" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                身材适配度
              </a>
              ，城市关联当地气候与季节窗口，预算决定{" "}
              <a href="#decide" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                价格合理性
              </a>
              ，风格偏好影响{" "}
              <a href="#ootd" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                搭配推荐
              </a>
              。
            </span>
          </p>
        </div>
      </section>

      <div className="relative z-10">
        <ComingSection
          id="wardrobe"
          zh="我的衣橱"
          en="WARDROBE"
          note="按品类、季节、颜色浏览已录入的单品，每件都带穿着次数与 CPW。"
        />
        <ComingSection
          id="ootd"
          zh="穿搭日志"
          en="OOTD"
          note="以全身照为主对象的月视图日历，关联单品后自动累计穿着次数、重算 CPW。"
        />
        <ComingSection
          id="analysis"
          zh="衣橱统计"
          en="ANALYSIS"
          note="品类结构、闲置率、CPW 排行，看清衣橱这项资产的真实状况。"
        />
        <ComingSection
          id="decide"
          zh="购买评分"
          en="DECIDE"
          note="重复度、可搭配能力、价格合理性、材质养护、身材适配度，五个维度给出该不该买。"
        />
      </div>

      <GridOverlay />

      <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen">
        <HomeScene sectionPosition={sectionRects} layers={sceneLayers} />
      </div>
    </>
  );
}
