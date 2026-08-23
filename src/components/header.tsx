"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ASCIISoundToggle } from "@/components/ascii-sound-toggle";
import { ASCIIThemeToggle } from "@/components/ascii-theme-toggle";
import DottedLink from "@/components/dotted-link";
import GridOverlay from "@/components/grid-overlay";
import { RotatingGlobe } from "@/components/rotating-globe";
import ScrambleText from "@/components/scramble-text";
import Scrollbar from "@/components/scrollbar";
import { CONTACT_SECTION_ID } from "@/components/sections/contact";
import { SELECTED_WORK_SECTION_ID } from "@/components/sections/selected-work";
import {
  ARROW_FULLSCREEN_DOM_COLOR_TRANSITION,
  readArrowFullscreenPastThreshold,
  useArrowFullscreenPastThreshold,
} from "@/lib/arrow-fullscreen-store";
import { DOTTED_BORDER_BASE, DOTTED_BORDER_BASE_WHITE } from "@/lib/dotted-border";
import { scrollEnv } from "@/lib/scroll-env";
import { useNearBottom } from "@/lib/scroll-hooks";
import { useBrowserName } from "@/lib/use-browser-name";
import { useHomeLoadingGate } from "@/lib/use-home-loading-gate";
import { useWeather } from "@/lib/use-weather";
import { useIsMobileWidth, useWindowSize } from "@/lib/viewport-store";
import {
  useFullscreenTransitionController,
  useRouteTransitionController,
} from "@/providers/fullscreen-transition-provider";
import { usePointerPosition } from "@/providers/pointer-provider";
import { useShellMedia } from "@/providers/shell-media-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";

export const PENDING_SCROLL_ANCHOR_SESSION_KEY = "hq:pendingScrollAnchor";

const HINT_DISMISS_KEYS = new Set(["l", "d", "a", "s", "t", "b"]);

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

export default function Header() {
  const pathname = usePathname();
  const { menuOpen, setMenuOpen } = useFullscreenTransitionController();
  const { startNavigation } = useRouteTransitionController();
  const loading = useHomeLoadingGate();

  const menuOpenedWhileWhiteRef = useRef(false);
  const [hintCount, setHintCount] = useState(0);
  const showHint = useCallback(() => setHintCount((value) => value + 1), []);
  const hideHint = useCallback(() => setHintCount((value) => Math.max(0, value - 1)), []);
  const resetHint = useCallback(() => setHintCount(0), []);

  const { theme } = useThemeMode();
  const { soundEnabled } = useShellMedia();
  const previousPrefs = useRef({ theme, soundEnabled });

  useEffect(() => {
    const prev = previousPrefs.current;
    if (prev.theme !== theme || prev.soundEnabled !== soundEnabled) {
      previousPrefs.current = { theme, soundEnabled };
      setHintCount((value) => (value > 0 ? 0 : value));
    }
  }, [theme, soundEnabled]);

  useEffect(() => {
    if (!menuOpen) menuOpenedWhileWhiteRef.current = false;
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : "";
      if (HINT_DISMISS_KEYS.has(key)) resetHint();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetHint]);

  const pointer = usePointerPosition();
  const { width, height } = useWindowSize();
  const isMobile = useIsMobileWidth();
  const browserName = useBrowserName();
  const arrowFullscreen = useArrowFullscreenPastThreshold();
  const nearBottom = useNearBottom(0.5);

  const dottedBase = arrowFullscreen ? DOTTED_BORDER_BASE_WHITE : DOTTED_BORDER_BASE;
  const burgerColor = menuOpen ? "bg-l1" : arrowFullscreen ? "bg-white" : "bg-l1";
  const burgerBar = `h-0.5 ${burgerColor} absolute transition-all duration-[1200ms] ease-66`;
  const menuOnWhite = menuOpen && menuOpenedWhileWhiteRef.current;
  const menuDotted = menuOnWhite ? DOTTED_BORDER_BASE_WHITE : DOTTED_BORDER_BASE;
  const menuToggleClass = `${DOTTED_BORDER_BASE} p-2 text-l1 uppercase cursor-pointer pointer-events-auto ${ARROW_FULLSCREEN_DOM_COLOR_TRANSITION}`;

  scrollEnv.useScrollEdgeShortcuts();

  const goToAnchor = (anchor: string) => {
    setMenuOpen(false);
    if (pathname === "/") {
      scrollEnv.lenisScrollTo(anchor, { lerp: 0.1 });
    } else {
      sessionStorage.setItem(PENDING_SCROLL_ANCHOR_SESSION_KEY, anchor);
      startNavigation("/");
    }
  };

  useEffect(() => {
    if (loading) setMenuOpen(false);
  }, [loading, setMenuOpen]);

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile, setMenuOpen]);

  const pointerX = Math.round(pointer.x * width).toString().padStart(4, "0");
  const pointerY = Math.round((1 - pointer.y) * height).toString().padStart(4, "0");

  const [clock, setClock] = useState("--:--");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const year = new Date().getFullYear();
  const weather = useWeather();
  const temp = weather?.now?.temp != null ? ` ${weather.now.temp}°C` : "";

  return (
    <>
      <header
        className={`z-50 fixed inset-0 flex flex-col justify-between font-mono-2 pointer-events-none ${ARROW_FULLSCREEN_DOM_COLOR_TRANSITION} ${arrowFullscreen ? "text-white" : "text-l1"}`}
      >
        <div className="flex justify-between items-center px-4 lg:px-14 py-4 lg:py-7 text-base">
          <DottedLink
            dotted
            dottedTone={menuOpen ? "default" : arrowFullscreen ? "white" : "default"}
            className={`p-2 font-sans font-bold uppercase pointer-events-auto ${ARROW_FULLSCREEN_DOM_COLOR_TRANSITION} ${menuOpen ? "text-l1" : ""}`}
            style={{ fontVariationSettings: '"wght" 700, "wdth" 120' }}
            href="/"
          >
            <ScrambleText text="haoqi" startDelayMs={300} scrambleColors={false} />
            <ScrambleText text=".design" startDelayMs={300} scrambleColors={false} />
          </DottedLink>

          <div className="hidden lg:flex flex-wrap justify-between items-center gap-x-3 gap-y-2 pointer-events-auto basis-1/2 xl:basis-1/3">
            <button
              type="button"
              className={`${dottedBase} p-2 uppercase cursor-pointer`}
              onClick={() => goToAnchor(`#${SELECTED_WORK_SECTION_ID}`)}
            >
              <ScrambleText text="Work" startDelayMs={300} scrambleColors={false} />
            </button>
            <button
              type="button"
              className={`${dottedBase} p-2 uppercase cursor-pointer`}
              onClick={() => goToAnchor(`#${CONTACT_SECTION_ID}`)}
            >
              <ScrambleText text="Contact" startDelayMs={300} scrambleColors={false} />
            </button>
            <ASCIIThemeToggle
              className={`${dottedBase} p-2 uppercase cursor-pointer pointer-events-auto`}
              light="THEME[L]"
              dark="THEME[D]"
              system="THEME[A]"
              startDelayMs={300}
              scrambleColors={false}
              onPointerEnter={showHint}
              onPointerLeave={hideHint}
              onPointerDown={resetHint}
            />
            <ASCIISoundToggle
              className={`${dottedBase} p-2 uppercase cursor-pointer pointer-events-auto`}
              startDelayMs={300}
              scrambleColors={false}
              onPointerEnter={showHint}
              onPointerLeave={hideHint}
              onPointerDown={resetHint}
            />
          </div>

          {!loading && (
            <div
              className="lg:hidden flex flex-row justify-end items-center gap-4 col-span-6 p-2 cursor-pointer pointer-events-auto"
              onClick={() =>
                setMenuOpen(
                  ((current: boolean) => {
                    const next = !current;
                    if (next) menuOpenedWhileWhiteRef.current = readArrowFullscreenPastThreshold();
                    return next;
                  })(menuOpen),
                )
              }
            >
              <div className="relative w-6 h-6">
                <div className={`${menuOpen ? "w-0 delay-150 opacity-0" : "w-6"} top-1.5 ${burgerBar}`} />
                <div className={`${menuOpen ? "w-0 opacity-0" : "w-6 delay-150"} bottom-1.5 ${burgerBar}`} />
                <div className={`${menuOpen ? "w-6 delay-150" : "w-0 opacity-0"} right-0 rotate-45 ${burgerBar} top-2.75`} />
                <div className={`${menuOpen ? "w-6" : "w-0 opacity-0 delay-150"} right-0 -rotate-45 ${burgerBar} bottom-2.75`} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between px-4 lg:px-14 py-4 lg:py-7">
          {pathname === "/" && nearBottom ? (
            <ScrambleText
              key="copy"
              className="p-2 uppercase"
              text={`Haoqi (c) ${year}`}
              startDelayMs={300}
              letterDelayMs={40}
              scrambleColors={false}
            />
          ) : (
            <>
              <ScrambleText
                key="time-mobile"
                className={`lg:hidden p-2 uppercase ${ARROW_FULLSCREEN_DOM_COLOR_TRANSITION} ${menuOpen ? "text-l1" : ""}`}
                text={`${clock}${temp}`}
                startDelayMs={300}
                letterDelayMs={40}
                scrambleColors={false}
              />
              <ScrambleText
                key="time-desktop"
                className="hidden lg:inline p-2 uppercase"
                text={`GMT+8 CN ${clock}${temp}`}
                startDelayMs={300}
                letterDelayMs={40}
                scrambleColors={false}
              />
            </>
          )}

          <ScrambleText
            className={`${dottedBase} hidden lg:inline lg:bottom-7 lg:left-1/2 lg:fixed p-2 lg:-translate-x-1/2 cursor-pointer pointer-events-auto`}
            onClick={() => scrollEnv.scrollToTop("smooth")}
            onPointerEnter={showHint}
            onPointerLeave={hideHint}
            onPointerDown={resetHint}
            text={`${pointerX} X ${pointerY} Y`}
            startDelayMs={300}
            letterDelayMs={40}
            scrambleColors={false}
          />

          {!loading && <RotatingGlobe className="hidden lg:block p-2 shrink-0" />}

          {menuOpen && (
            <>
              <ASCIIThemeToggle
                className={menuToggleClass}
                light="THEME[L]"
                dark="THEME[D]"
                system="THEME[A]"
                startDelayMs={300}
                scrambleColors={false}
              />
              <ASCIISoundToggle className={menuToggleClass} startDelayMs={300} scrambleColors={false} />
            </>
          )}
        </div>

        {!loading && <Scrollbar hidden={menuOpen} />}
      </header>

      {pathname === "/" && <GridOverlay />}

      <AnimatePresence>
        {hintCount > 0 && (
          <motion.div
            key="nav-hint-panel"
            className="hidden top-24 right-0 left-0 z-50 fixed lg:flex flex-row-reverse px-4 lg:px-14 w-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          >
            <div className="*:z-1 *:relative flex flex-col bg-be p-2 font-mono-2 text-l1 xl:basis-1/3 basis-1/2">
              <ScrambleText
                text="Press [L] for light mode, [D] for dark mode, [A] for auto mode, or click THEME. Press [S] to pause or resume background music, or click SOUND; your choice is saved in this browser. [T] scroll to top, [B] scroll to bottom."
                startDelayMs={0}
                letterDelayMs={10}
              />
              <br />
              <span className="flex flex-row justify-between">
                <ScrambleText text={browserName} startDelayMs={200} letterDelayMs={10} />
                <ScrambleText text={`${width} × ${height}`} startDelayMs={200} letterDelayMs={10} />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {menuOpen && (
        <div className="lg:hidden z-40 fixed inset-0 flex flex-col justify-center items-start px-6 lg:px-16 py-6 lg:py-8 font-mono-2 text-[10svw] text-l1">
          <DottedLink
            dotted
            dottedTone={menuOnWhite ? "white" : "default"}
            useActiveClass
            href="/"
            activeClass=""
            className="uppercase"
            onClick={() => setMenuOpen(false)}
          >
            <ScrambleText text="Home" startDelayMs={300} />
          </DottedLink>
          <button
            type="button"
            className={`${menuDotted} uppercase text-left cursor-pointer`}
            onClick={() => goToAnchor(`#${SELECTED_WORK_SECTION_ID}`)}
          >
            <ScrambleText text="Work" startDelayMs={400} />
          </button>
          <button
            type="button"
            className={`${menuDotted} uppercase text-left cursor-pointer`}
            onClick={() => goToAnchor(`#${CONTACT_SECTION_ID}`)}
          >
            <ScrambleText text="Contact" startDelayMs={500} />
          </button>
        </div>
      )}
    </>
  );
}
