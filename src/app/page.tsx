"use client";

import { useLenis } from "lenis/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import HeroIntro from "@/components/hero-intro";
import { PENDING_SCROLL_ANCHOR_SESSION_KEY } from "@/components/header";
import HyperSpaceSection from "@/components/hyper-space/hyper-space-section";
import ScrambleText from "@/components/scramble-text";
import Contact from "@/components/sections/contact";
import SelectedWork, { type DomImageTarget } from "@/components/sections/selected-work";
import SignatureSign from "@/components/signature-sign";
import { useSectionRects, type TrackedSection } from "@/lib/use-section-rects";
import HomeScene, { type SceneImageLayer } from "@/webgl/home-scene";

const HERO_HEADLINE_CLASS =
  "flex flex-col self-end order-1 lg:order-2 col-span-12 px-2 font-bold text-[7.2svw] lg:text-[6svw] 2xl:text-[5svw] xl:text-[5.6svw] uppercase leading-none";

const ABOUT_PARAGRAPH_LINK_CLASS =
  "inline text-l1 underline underline-offset-[0.08em] decoration-solid decoration-(--label-3) transition-[text-decoration-color] duration-150 ease-out lg:[@media(hover:hover)]:hover:decoration-(--label-1)";

export default function Home() {
  const [domImages, setDomImages] = useState<DomImageTarget[]>([]);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const portraitRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const hyperRef = useRef<HTMLDivElement | null>(null);

  const trackedSections = useMemo<TrackedSection[]>(
    () => [
      { name: "banner", ref: bannerRef },
      ...domImages.map(({ href, targetRef }) => ({ name: href, ref: targetRef })),
      { name: "hyper-space", ref: hyperRef },
      { name: "footer", ref: footerRef },
    ],
    [domImages],
  );

  const sectionRects = useSectionRects(trackedSections);
  const hyperSection = useMemo(() => {
    const rect = sectionRects.find((item) => item.name === "hyper-space");
    return rect ? { y: rect.y, height: rect.height } : null;
  }, [sectionRects]);

  const onImagesChange = useCallback((images: DomImageTarget[]) => setDomImages(images), []);

  // The portrait shares the same DOM-synced WebGL image pipeline as the work cards.
  const sceneLayers = useMemo<SceneImageLayer[]>(
    () => [
      { key: "about", imageUrl: "/img/m3.png", targetRef: portraitRef },
      ...domImages.map((image) => ({
        key: image.href,
        imageUrl: image.imageUrl,
        hoverImageUrl: image.hoverImageUrl,
        targetRef: image.targetRef,
      })),
    ],
    [domImages],
  );

  // A cross-page "scroll to anchor" request is replayed once Lenis is live.
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    const anchor = sessionStorage.getItem(PENDING_SCROLL_ANCHOR_SESSION_KEY);
    if (!anchor) return;
    sessionStorage.removeItem(PENDING_SCROLL_ANCHOR_SESSION_KEY);
    lenis.resize();
    requestAnimationFrame(() => {
      lenis.resize();
      lenis.scrollTo(anchor, { lerp: 0.1, force: true });
    });
  }, [lenis]);

  return (
    <>
      <div
        ref={bannerRef}
        className="grid grid-cols-12 grid-rows-[auto_1fr] px-4 lg:px-14 py-18 lg:py-24 w-full h-dvh lg:h-screen"
      >
        <div
          key="home-hero-meta"
          className="flex flex-col order-2 lg:order-1 lg:grid lg:grid-cols-12 col-span-12 font-mono text-base"
        >
          <span className="hidden lg:block lg:col-span-3 xl:col-span-2 lg:col-start-1 xl:col-start-1 p-2 font-sans font-medium text-[4svw] sm:text-2xl lg:text-3xl leading-tight">
            <ScrambleText text="Design &" startDelayMs={300} letterDelayMs={10} />
            <br />
            <ScrambleText text="Engineering" startDelayMs={300} letterDelayMs={10} />
          </span>
          <ScrambleText
            className="hidden lg:block lg:col-span-3 xl:col-span-2 lg:col-start-4 xl:col-start-5 p-2 text-balance"
            text="Thinking in systems. Designing with care."
            startDelayMs={300}
            letterDelayMs={10}
          />
          <HeroIntro
            className="col-span-12 lg:col-span-6 xl:col-span-4 lg:col-start-7 xl:col-start-9 mt-auto lg:mt-0 p-2"
            startDelayMs={300}
            letterDelayMs={10}
          />
        </div>

        <div className={HERO_HEADLINE_CLASS} style={{ fontVariationSettings: '"wdth" 120' }}>
          <ScrambleText text="I bring" startDelayMs={300} />
          <ScrambleText text="craft & taste" startDelayMs={500} />
          <ScrambleText text="to digital work" startDelayMs={700} />
        </div>
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
              I explore how to shape AI-era workflows with craft and taste, building the next generation of digital
              products.
            </span>
          </p>
          <p
            className="p-2 w-full text-l2 md:text-[4.2svw] text-xl leading-[1.3] md:leading-none select-text"
            style={{ fontFamily: '"tiktok", sans-serif' }}
          >
            <span>
              I&rsquo;m building{" "}
              <a href="https://reunimos.cc" target="_blank" rel="noopener noreferrer" className={ABOUT_PARAGRAPH_LINK_CLASS}>
                reunimos&trade;
              </a>
              , and previously worked on Alibaba{" "}
              <a
                href="https://www.alipan.com/"
                target="_blank"
                rel="noopener noreferrer"
                className={ABOUT_PARAGRAPH_LINK_CLASS}
              >
                aDrive
              </a>
              ,{" "}
              <a
                href="https://www.teambition.com/"
                target="_blank"
                rel="noopener noreferrer"
                className={ABOUT_PARAGRAPH_LINK_CLASS}
              >
                Teambition
              </a>
              , and 100offer.
            </span>
          </p>
        </div>
      </div>

      <SelectedWork onImagesChange={onImagesChange} />

      <HyperSpaceSection sectionRef={hyperRef} hyperSection={hyperSection} />

      <Contact ref={footerRef} />

      <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen">
        <HomeScene sectionPosition={sectionRects} layers={sceneLayers} />
      </div>
    </>
  );
}
