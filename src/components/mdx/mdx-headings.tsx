"use client";

import { isValidElement, useCallback, type ReactNode } from "react";

import { scrollEnv } from "@/lib/scroll-env";

export const MDX_HEADING_ANCHOR_OFFSET_PX = 96;

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-12 text-2xl leading-tight lg:mt-14 lg:text-[28px]",
  2: "mt-10 text-xl leading-tight lg:mt-12 lg:text-2xl",
  3: "mt-8 text-lg leading-snug lg:mt-10 lg:text-xl",
  4: "mt-7 text-base leading-snug lg:mt-8 lg:text-lg",
  5: "mt-6 text-sm leading-snug lg:mt-7 lg:text-[17px]",
  6: "mt-6 text-sm leading-snug uppercase tracking-wide lg:mt-6 lg:text-base lg:normal-case lg:tracking-normal",
};

function scrollToTarget(el: HTMLElement) {
  const container = scrollEnv.getContainerEl();
  if (container) {
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      MDX_HEADING_ANCHOR_OFFSET_PX;
    scrollEnv.lenisScrollTo(Math.max(0, top), { lerp: 0.1 });
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const scrollToMdxAnchorTarget = (el: HTMLElement) => scrollToTarget(el);

const anchorHref = (id: string) => `#${encodeURIComponent(id)}`;

function toPlainText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(toPlainText).join("");
  if (isValidElement(node)) return toPlainText((node.props as { children?: ReactNode }).children);
  return "";
}

/** Slug generation keeps CJK characters, mirroring the original heading ids. */
const slugify = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "-")
    .replace(/[^\w一-鿿-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || undefined;

function createHeading(level: number) {
  const Heading = ({
    children,
    id,
    className,
    ...rest
  }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const plain = toPlainText(children);
    const headingId = id || slugify(plain);

    const onClick = useCallback(
      async (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!headingId) return;
        event.preventDefault();
        const target = typeof document !== "undefined" ? document.getElementById(headingId) : null;
        if (target) scrollToTarget(target);
        const hash = anchorHref(headingId);
        history.replaceState(null, "", hash);
        const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
        try {
          await navigator.clipboard?.writeText(url);
        } catch {
          /* clipboard is best-effort */
        }
      },
      [headingId],
    );

    const classes = [
      "group relative scroll-mt-24 font-semibold tracking-tight text-l1 [&:first-child]:mt-0",
      HEADING_CLASSES[level],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const content = headingId ? (
      <a
        href={anchorHref(headingId)}
        onClick={onClick}
        aria-label={`Copy link to ${plain}`}
        className="relative inline-block text-inherit no-underline"
      >
        <span
          aria-hidden="true"
          className="absolute top-0 right-full mr-2 hidden text-l3 opacity-0 transition-opacity select-none lg:inline lg:group-hover:opacity-100 lg:hover:text-l1"
        >
          #
        </span>
        {children}
      </a>
    ) : (
      children
    );

    const Tag = `h${level}` as "h1";
    return (
      <Tag id={headingId} className={classes} {...rest}>
        {content}
      </Tag>
    );
  };

  Heading.displayName = `MdxH${level}`;
  return Heading;
}

export const MdxH1 = createHeading(1);
export const MdxH2 = createHeading(2);
export const MdxH3 = createHeading(3);
export const MdxH4 = createHeading(4);
export const MdxH5 = createHeading(5);
export const MdxH6 = createHeading(6);
