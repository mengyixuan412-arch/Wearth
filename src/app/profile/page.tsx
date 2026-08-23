"use client";

import { useMemo, useRef } from "react";

import GridOverlay from "@/components/grid-overlay";
import ScrambleText from "@/components/scramble-text";
import SignatureSign from "@/components/signature-sign";
import SiteHeader from "@/components/site-header";
import { useSectionRects, type TrackedSection } from "@/lib/use-section-rects";
import ProfileScene, { type SceneImageLayer } from "@/webgl/profile-scene";

const ABOUT_PARAGRAPH_LINK_CLASS =
  "inline text-l1 underline underline-offset-[0.08em] decoration-solid decoration-(--label-3) transition-[text-decoration-color] duration-150 ease-out lg:[@media(hover:hover)]:hover:decoration-(--label-1)";

export default function ProfilePage() {
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const portraitRef = useRef<HTMLDivElement | null>(null);

  const trackedSections = useMemo<TrackedSection[]>(() => [{ name: "banner", ref: bannerRef }], []);
  const sectionRects = useSectionRects(trackedSections);

  // The portrait rides the same DOM-synced WebGL image pipeline as the original.
  const sceneLayers = useMemo<SceneImageLayer[]>(
    () => [{ key: "about", imageUrl: "/img/m3.png", targetRef: portraitRef }],
    [],
  );

  return (
    <>
      <div ref={bannerRef} className="px-4 lg:px-14 py-4 lg:py-7 w-full">
        <SiteHeader />
      </div>

      <div className="grid grid-cols-12 px-4 lg:px-14 py-18 lg:py-24 lg:pb-28 w-full">
        <div className="relative col-span-12 sm:col-span-4 lg:col-span-3 p-2">
          <SignatureSign className="-top-1/32 -left-1/12 absolute w-3/4 pointer-events-none" />
          <div ref={portraitRef} className="aspect-square" />
        </div>
        <div className="flex flex-col justify-start items-start gap-6 col-span-12 sm:col-span-7 lg:col-span-8 sm:col-start-6 lg:col-start-5 text-base lg:text-xl leading-none">
          <p
            className="p-2 w-full text-l1 md:text-[4.2svw] text-xl leading-[1.3] md:leading-none select-text"
            style={{ fontFamily: '"tiktok", sans-serif' }}
          >
            <span>
              我用穿搭数据认识自己：衣橱里真正被穿的、被闲置的、值不值，都写在每一次记录里。
            </span>
          </p>
          <p
            className="p-2 w-full text-l2 md:text-[4.2svw] text-xl leading-[1.3] md:leading-none select-text"
            style={{ fontFamily: '"tiktok", sans-serif' }}
          >
            <span>
              围度决定{" "}
              <a href="/decide" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                身材适配度
              </a>
              ，城市关联当地气候与季节窗口，预算决定{" "}
              <a href="/decide" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                价格合理性
              </a>
              ，风格偏好影响{" "}
              <a href="/ootd" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                搭配推荐
              </a>
              。
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 lg:px-14 pb-18 lg:pb-24 font-mono-2 text-base">
        <ScrambleText text="PROFILE" startDelayMs={300} />
        <ScrambleText text="Know yourself, then know your wardrobe." startDelayMs={500} />
      </div>

      <GridOverlay />

      <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen">
        <ProfileScene sectionPosition={sectionRects} layers={sceneLayers} />
      </div>
    </>
  );
}
