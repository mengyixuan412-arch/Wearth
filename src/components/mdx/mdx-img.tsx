"use client";

import { useState } from "react";

export const MDX_IMG_ELEMENT_TAG = "span";

export function MdxImg({ src, alt = "", className, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span data-mdx-figure="true" className="my-6 block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={typeof src === "string" ? src : ""}
        alt={alt}
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={[
          "block w-full h-auto cursor-zoom-in select-none border border-line bg-[rgba(var(--label-d),0.05)]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ opacity: loaded ? 1 : 0 }}
        {...rest}
      />
    </span>
  );
}

/** Consecutive figures share one responsive grid. */
export function ImageGrid({
  cols = 1,
  colsLg = 2,
  children,
}: {
  cols?: number;
  colsLg?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      data-mdx-image-grid="true"
      className="my-6 grid w-full min-w-0 items-start gap-4 [&_[data-mdx-figure]]:my-0 [&_[data-mdx-figure]]:min-w-0"
      style={
        {
          "--mdx-image-grid-cols": cols,
          "--mdx-image-grid-cols-lg": colsLg,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
