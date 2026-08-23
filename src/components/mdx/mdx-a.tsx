"use client";

import DottedLink from "@/components/dotted-link";
import { scrollToMdxAnchorTarget } from "@/components/mdx/mdx-headings";

const LINK_CLASS =
  "text-[color:var(--label-1)] underline underline-offset-4 decoration-[color:var(--label-3)] transition-colors lg:hover:decoration-[color:var(--label-2)]";

function onHashClick(event: React.MouseEvent<HTMLAnchorElement>) {
  const href = event.currentTarget.getAttribute("href") ?? "";
  if (!href.startsWith("#") || href === "#") return;
  const id = decodeURIComponent(href.slice(1));
  const target = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!target) return;
  event.preventDefault();
  scrollToMdxAnchorTarget(target);
  history.replaceState(null, "", href);
}

export function MdxA({
  children,
  href,
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const classes = [LINK_CLASS, className].filter(Boolean).join(" ");
  const target = href ?? "";

  if (!target || target.startsWith("#")) {
    return (
      <a href={target} className={classes} onClick={target.startsWith("#") ? onHashClick : undefined} {...rest}>
        {children}
      </a>
    );
  }
  if (target.startsWith("//")) {
    return (
      <a href={`https:${target}`} className={classes} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  if (/^https?:\/\//i.test(target)) {
    return (
      <a href={target} className={classes} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  if (target.startsWith("mailto:") || target.startsWith("tel:")) {
    return (
      <a href={target} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  if (target.startsWith("/")) {
    return (
      <DottedLink href={target} className={classes} {...rest}>
        {children}
      </DottedLink>
    );
  }
  return (
    <a href={target} className={classes} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}
