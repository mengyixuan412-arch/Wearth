"use client";

import { createRef, useEffect, useMemo, useRef, useState } from "react";

import DottedLink from "@/components/dotted-link";
import { WORK_ITEMS } from "@/data/work-items";
import { usePasscodeAccessLookup } from "@/providers/passcode-access-provider";

export const SELECTED_WORK_SECTION_ID = "selected-work";

export type DomImageTarget = {
  href: string;
  imageUrl: string;
  hoverImageUrl?: string;
  targetRef: React.RefObject<HTMLDivElement | null>;
};

/** Natural aspect ratios are cached across mounts so cards never re-jump on navigation. */
const aspectCache: Record<string, string> = {};

export default function SelectedWork({ onImagesChange }: { onImagesChange?: (images: DomImageTarget[]) => void }) {
  const [aspects, setAspects] = useState<Record<string, string>>(() => ({ ...aspectCache }));
  const [rowGap, setRowGap] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isAllowed = usePasscodeAccessLookup();

  const items = useMemo(() => WORK_ITEMS.filter((item) => !item.passcodeProtected || isAllowed(item.href)), [isAllowed]);

  const targetRefs = useMemo(
    () =>
      items.reduce<Record<string, React.RefObject<HTMLDivElement | null>>>((acc, item) => {
        acc[item.href] = createRef<HTMLDivElement>();
        return acc;
      }, {}),
    [items],
  );

  const domImages = useMemo<DomImageTarget[]>(
    () =>
      items.map((item) => ({
        href: item.href,
        imageUrl: item.imageUrl,
        hoverImageUrl: item.hoverImageUrl,
        targetRef: targetRefs[item.href],
      })),
    [items, targetRefs],
  );

  useEffect(() => {
    onImagesChange?.(domImages);
    return () => onImagesChange?.([]);
  }, [onImagesChange, domImages]);

  // Row gap tracks one twelfth of the grid width, so vertical rhythm matches the column gutter.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setRowGap(el.clientWidth / 12);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const commit = (url: string, width: number, height: number) => {
      if (cancelled || width <= 0 || height <= 0) return;
      const ratio = `${width} / ${height}`;
      if (aspectCache[url] !== ratio) aspectCache[url] = ratio;
      setAspects((current) => (current[url] === ratio ? current : { ...current, [url]: ratio }));
    };

    const loaders = items.map((item) => {
      const image = new window.Image();
      image.decoding = "async";
      image.onload = () => commit(item.imageUrl, image.naturalWidth, image.naturalHeight);
      image.src = item.imageUrl;
      if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
        commit(item.imageUrl, image.naturalWidth, image.naturalHeight);
      }
      return image;
    });

    return () => {
      cancelled = true;
      for (const image of loaders) image.onload = null;
    };
  }, [items]);

  return (
    <section id={SELECTED_WORK_SECTION_ID} className="px-4 lg:px-14 py-18 lg:py-24 w-full">
      <div ref={gridRef} className="grid grid-cols-12 w-full" style={{ rowGap: `${rowGap}px` }}>
        {items.map((item) => {
          const isExternal = item.href.startsWith("http://") || item.href.startsWith("https://");
          const linkClass = "group block space-y-3 p-2";
          const label = isExternal
            ? `${item.name} - ${item.year} (external)`
            : `${item.name} - ${item.year}`;

          const body = (
            <>
              <div
                ref={targetRefs[item.href]}
                aria-hidden="true"
                className="relative w-full pointer-events-none select-none"
                style={{ aspectRatio: aspects[item.imageUrl] ?? "1 / 1" }}
              >
                {item.codingProject && (
                  <span
                    className="top-0 right-0 z-10 absolute bg-selection px-1 font-mono-2 text-black text-xs uppercase pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    Coding Project
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center gap-3 min-w-0 text-xs lg:text-sm uppercase">
                <span className="flex-1 min-w-0 truncate">{item.name}</span>
                <div className="flex items-center gap-2 sm:gap-3 font-mono-2 tabular-nums whitespace-nowrap shrink-0">
                  <span>{item.year}</span>
                  {item.type !== "post" && (
                    <span className="hidden lg:inline-flex items-center gap-1" aria-hidden="true">
                      <span>{item.type}</span>
                      <span>↗</span>
                    </span>
                  )}
                </div>
              </div>
            </>
          );

          return (
            <article key={item.href} className={item.gridClass ?? "col-span-12 lg:col-span-6 xl:col-span-4"}>
              {isExternal ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass} aria-label={label}>
                  {body}
                </a>
              ) : (
                <DottedLink href={item.href} className={linkClass} aria-label={label}>
                  {body}
                </DottedLink>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
