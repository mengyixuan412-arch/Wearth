"use client";

import { scrollEnv } from "@/lib/scroll-env";
import type { SectionRect } from "@/lib/use-section-rects";

type SectionLayout = { topDocY: number; height: number };

let layoutFrame = -1;
const layoutCache = new Map<string, SectionLayout>();

/** Reads a tracked section's document-space box, cached for the duration of one frame. */
export const readSectionContentLayout = (section: SectionRect): SectionLayout => {
  const name = section.name;
  if (name && layoutFrame >= 0) {
    const cached = layoutCache.get(name);
    if (cached) return cached;
  }

  const el = section.ref?.current;
  if (!el) {
    const fallback = { topDocY: section.y, height: section.height };
    if (name && layoutFrame >= 0) layoutCache.set(name, fallback);
    return fallback;
  }

  const rect = el.getBoundingClientRect();
  const container = scrollEnv.getContainerEl();
  const layout = container
    ? {
        topDocY: rect.top - container.getBoundingClientRect().top + scrollEnv.getScrollTopPx(),
        height: rect.height,
      }
    : { topDocY: rect.top + scrollEnv.getScrollTopPx(), height: rect.height };

  if (name && layoutFrame >= 0) layoutCache.set(name, layout);
  return layout;
};

export const findSection = (sections: SectionRect[] | null | undefined, name: string) =>
  sections ? (sections.find((section) => section.name === name) ?? null) : null;

export const isSectionInViewport = (section: SectionRect, scrollTop: number, viewportHeight: number) => {
  const { topDocY, height } = readSectionContentLayout(section);
  const top = topDocY - scrollTop;
  return top + height > 0 && top < viewportHeight;
};

export const sectionMetrics = {
  getScrollTopPx: scrollEnv.getScrollTopPx,
  getScrollLeftPx: scrollEnv.getScrollLeftPx,
  getViewportHeightPx: scrollEnv.getViewportHeightPx,
  findSection,
  beginSectionLayoutFrame(frame: number) {
    if (frame === layoutFrame) return;
    layoutCache.clear();
    layoutFrame = frame;
  },
  getSectionContentCenterDocY(section: SectionRect) {
    const { topDocY, height } = readSectionContentLayout(section);
    return topDocY + 0.5 * height;
  },
  readSectionContentLayout,
  sectionCenterInViewportPx(section: SectionRect, scrollTop: number, offset = 0) {
    const { topDocY, height } = readSectionContentLayout(section);
    return topDocY - scrollTop + height / 2 + offset;
  },
  isSectionInViewport,
  anySectionInViewport(sections: SectionRect[] | null, names: string[] | null) {
    if (!sections || !names || names.length === 0) return true;
    const viewportHeight = scrollEnv.getViewportHeightPx();
    const scrollTop = scrollEnv.getScrollTopPx();
    for (const name of names) {
      const section = findSection(sections, name);
      if (section && isSectionInViewport(section, scrollTop, viewportHeight)) return true;
    }
    return false;
  },
  viewportPxToWorldY: (px: number, viewportHeightPx: number, viewportWorldHeight: number) =>
    (0.5 - px / Math.max(1, viewportHeightPx || 1)) * viewportWorldHeight,
  /**
   * Places an object so it tracks a DOM anchor while scrolling, with `scrollSyncFactor`
   * controlling how tightly it follows (1 = locked to the DOM, 0 = fixed on screen).
   */
  scrollSyncedWorldYFromAnchorDocY({
    anchorDocY,
    scrollTopPx,
    viewportHeightPx,
    viewportWorldHeight,
    anchorOffsetPx = 0,
    scrollSyncFactor = 1,
  }: {
    anchorDocY: number;
    scrollTopPx: number;
    viewportHeightPx: number;
    viewportWorldHeight: number;
    anchorOffsetPx?: number;
    scrollSyncFactor?: number;
  }) {
    const height = Math.max(1, viewportHeightPx || 1);
    return (
      (0.5 - (anchorDocY + anchorOffsetPx) / height) * viewportWorldHeight +
      (scrollTopPx / height) * viewportWorldHeight * scrollSyncFactor
    );
  },
  showAtDocumentYFromSection: (section: SectionRect) => section.y - section.height,
};
