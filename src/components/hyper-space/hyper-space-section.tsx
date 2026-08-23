"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ScrollArcRings from "@/components/hyper-space/scroll-arc-rings";
import HyperSpaceStaggerText from "@/components/hyper-space/stagger-text";
import {
  ARROW_FULLSCREEN_DOM_COLOR_TRANSITION,
  useArrowFullscreenPastThreshold,
} from "@/lib/arrow-fullscreen-store";
import { scrollEnv } from "@/lib/scroll-env";
import { useLenisScrollTop } from "@/lib/scroll-hooks";
import { useHasEnteredViewport } from "@/lib/use-has-entered-viewport";
import { useWindowSize } from "@/lib/viewport-store";

export type SectionRect = { y: number; height: number } | null;

type Stage = "seg0-primary" | "seg0-secondary" | "seg1" | "end";

/** The section is 8 viewports tall; every 2 of those drive one stage. */
const STAGES: { range: [number, number]; stage: Stage }[] = [
  { range: [0, 1], stage: "seg0-primary" },
  { range: [2, 3], stage: "seg0-secondary" },
  { range: [4, 5], stage: "seg1" },
  { range: [6, 7], stage: "end" },
];

export const SEGMENT0_PRIMARY_LINES = ["Innovate", "with", "purpose"];
export const SEGMENT0_SECONDARY_LINES = ["Innovate", "with a", "human touch"];
const END_LINES = ["FUTURE-FIRST", "ALWAYS"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stageForSegment = (segment: number): Stage | null => {
  for (const entry of STAGES) {
    const [start, end] = entry.range;
    if (segment >= start && segment <= end) return entry.stage;
  }
  return null;
};

const segmentHeight = (rect: SectionRect, viewportHeight: number) => {
  const derived = rect ? rect.height / 8 : 0;
  return derived > 1 ? derived : Math.max(1, viewportHeight || scrollEnv.getViewportHeightPx());
};

function useHyperSpaceStage(rect: SectionRect, viewportHeight: number) {
  const scrollTop = useLenisScrollTop();
  const [, forceUpdate] = useState(0);
  const rectRef = useRef(rect);
  rectRef.current = rect;

  const [segmentIndex, setSegmentIndex] = useState(0);
  const [stage, setStage] = useState<Stage | null>(() => stageForSegment(0));
  const [segment0Reveal, setSegment0Reveal] = useState(false);
  const [segment0StaggerGen, setSegment0StaggerGen] = useState(0);

  const segmentRef = useRef(0);
  const stageRef = useRef<Stage | null>(stageForSegment(0));
  const revealRef = useRef(false);
  const lastRevealRef = useRef<boolean | null>(null);

  useEffect(() => {
    const onOrientationChange = () => forceUpdate((value) => value + 1);
    window.addEventListener("orientationchange", onOrientationChange, { passive: true });
    return () => window.removeEventListener("orientationchange", onOrientationChange);
  }, []);

  useEffect(() => {
    const current = rectRef.current;
    if (!current) return;

    const unit = segmentHeight(current, viewportHeight);
    const local = scrollTop - current.y;
    const segment = clamp(Math.floor(Math.max(0, local) / unit), 0, 7);
    const nextStage = stageForSegment(segment);

    if (segment !== segmentRef.current) {
      segmentRef.current = segment;
      setSegmentIndex(segment);
    }
    if (nextStage !== stageRef.current) {
      stageRef.current = nextStage;
      setStage(nextStage);
    }

    if (nextStage !== "seg0-primary" && nextStage !== "seg0-secondary") {
      lastRevealRef.current = null;
      if (revealRef.current) {
        revealRef.current = false;
        setSegment0Reveal(false);
      }
      return;
    }

    // Start revealing slightly before the section's top edge reaches the viewport.
    const shouldReveal = local >= -(0.2 * unit);
    const previous = lastRevealRef.current;

    if (previous === null) {
      lastRevealRef.current = shouldReveal;
      if (shouldReveal) {
        revealRef.current = true;
        setSegment0Reveal(true);
        setSegment0StaggerGen((value) => value + 1);
      }
      return;
    }

    if (shouldReveal !== previous) {
      lastRevealRef.current = shouldReveal;
      if (shouldReveal) {
        revealRef.current = true;
        setSegment0Reveal(true);
        setSegment0StaggerGen((value) => value + 1);
      } else {
        revealRef.current = false;
        setSegment0Reveal(false);
      }
    }
  }, [rect?.y, rect?.height, scrollTop, viewportHeight, rect]);

  const stageScrollProgress01 = useMemo(() => {
    if (!rect || !stage) return 0;
    const entry = STAGES.find((item) => item.stage === stage);
    if (!entry) return 0;
    const unit = segmentHeight(rect, viewportHeight);
    const local = scrollTop - rect.y;
    const [start, end] = entry.range;
    const from = start * unit;
    return clamp((local - from) / Math.max(1, (end + 1) * unit - from), 0, 1);
  }, [rect, viewportHeight, stage, scrollTop]);

  return { segmentIndex, stage, segment0Reveal, segment0StaggerGen, stageScrollProgress01 };
}

const HEADLINE_CLASS =
  "flex flex-col justify-center items-center col-span-12 row-span-6 font-bold text-[7.2svw] lg:text-[6.8svw] uppercase leading-none";

function Segment0({
  stage,
  reveal,
  staggerGen,
  primaryLines,
  secondaryLines,
}: {
  stage: Stage;
  reveal: boolean;
  staggerGen: number;
  primaryLines: string[];
  secondaryLines: string[];
}) {
  const isPrimary = stage === "seg0-primary";
  const variant = isPrimary ? "primary" : "secondary";
  return (
    <div className={HEADLINE_CLASS} style={{ fontVariationSettings: '"wdth" 120' }}>
      {(isPrimary ? primaryLines : secondaryLines).map((line, index) => (
        <HyperSpaceStaggerText
          key={index === 0 ? `${staggerGen}-${variant}-stable-${index}` : `${staggerGen}-${variant}-${index}`}
          text={line}
          play={reveal}
          groupDelayMs={100 * index}
        />
      ))}
    </div>
  );
}

const MANIFESTO_LINES: { className: string; lines: [string, string] }[] = [
  {
    className:
      "col-span-8 lg:col-span-4 col-start-1 lg:col-start-7 row-start-2 p-2 font-medium text-[5.6svw] lg:text-3xl leading-tight",
    lines: ["Building tomorrow's", "digital products."],
  },
  {
    className:
      "col-span-8 lg:col-span-4 col-start-5 lg:col-start-9 row-start-3 p-2 font-medium text-[5.6svw] lg:text-3xl leading-tight",
    lines: ["Independent by", "design & engineering."],
  },
  {
    className:
      "col-span-8 lg:col-span-4 col-start-1 lg:col-start-2 row-start-4 p-2 font-medium text-[5.6svw] lg:text-3xl leading-tight",
    lines: ["Clarity first.", "Delight second."],
  },
  {
    className:
      "col-span-8 lg:col-span-4 col-start-5 lg:col-start-4 row-start-5 p-2 font-medium text-[5.6svw] lg:text-3xl leading-tight",
    lines: ["Ship in small loops.", "Aim for long arcs."],
  },
];

function Segment1({ ringProgress01 }: { ringProgress01: number }) {
  return (
    <>
      <ScrollArcRings progress01={ringProgress01} />
      {MANIFESTO_LINES.map((block, index) => (
        <div key={index} className={block.className}>
          <HyperSpaceStaggerText text={block.lines[0]} />
          <br />
          <HyperSpaceStaggerText text={block.lines[1]} />
        </div>
      ))}
    </>
  );
}

function SegmentEnd() {
  const { ref, hasEnteredViewport } = useHasEnteredViewport({ threshold: 0.35, once: false });
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={HEADLINE_CLASS}
      style={{ fontVariationSettings: '"wdth" 120' }}
    >
      {END_LINES.map((line, index) => (
        <HyperSpaceStaggerText key={index} text={line} play={hasEnteredViewport} groupDelayMs={100 * index} />
      ))}
    </div>
  );
}

export default function HyperSpaceSection({
  sectionRef,
  hyperSection,
  segment0PrimaryLines = SEGMENT0_PRIMARY_LINES,
  segment0SecondaryLines = SEGMENT0_SECONDARY_LINES,
}: {
  sectionRef: React.Ref<HTMLDivElement>;
  hyperSection: SectionRect;
  segment0PrimaryLines?: string[];
  segment0SecondaryLines?: string[];
}) {
  const { height } = useWindowSize();
  const { segmentIndex, stage, segment0Reveal, segment0StaggerGen, stageScrollProgress01 } = useHyperSpaceStage(
    hyperSection,
    height,
  );
  const arrowFullscreen = useArrowFullscreenPastThreshold();

  let content: React.ReactNode = null;
  if (stage === "seg0-primary" || stage === "seg0-secondary") {
    content = (
      <Segment0
        stage={stage}
        reveal={segment0Reveal}
        staggerGen={segment0StaggerGen}
        primaryLines={segment0PrimaryLines}
        secondaryLines={segment0SecondaryLines}
      />
    );
  } else if (stage === "seg1") {
    content = <Segment1 ringProgress01={stageScrollProgress01} />;
  } else if (stage === "end") {
    content = <SegmentEnd />;
  }

  void segmentIndex;

  return (
    <div
      ref={sectionRef}
      className={`relative ${ARROW_FULLSCREEN_DOM_COLOR_TRANSITION} ${arrowFullscreen ? "text-white" : "text-l1"}`}
      style={{ height: `${8 * height}px` }}
    >
      <div
        className="top-0 sticky grid grid-cols-12 grid-rows-6 px-4 lg:px-14 py-18 lg:py-24 w-full"
        style={{ minHeight: `${height}px` }}
      >
        {content}
      </div>
    </div>
  );
}
