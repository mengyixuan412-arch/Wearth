"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";

import {
  DOTTED_BORDER_ACTIVE_BOTTOM,
  DOTTED_BORDER_ACTIVE_BOTTOM_WHITE,
  DOTTED_BORDER_BASE,
  DOTTED_BORDER_BASE_WHITE,
} from "@/lib/dotted-border";
import { scrollEnv } from "@/lib/scroll-env";
import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";

type DottedLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: React.ReactNode;
    className?: string;
    dotted?: boolean;
    dottedTone?: "default" | "white";
    useActiveClass?: boolean;
    activeClass?: string;
  };

export default function DottedLink({
  href,
  children,
  className,
  dotted = false,
  dottedTone = "default",
  useActiveClass = false,
  activeClass,
  style,
  onClick,
  ...rest
}: DottedLinkProps) {
  const { startNavigation } = useRouteTransitionController();
  const pathname = usePathname();
  const target = typeof href === "string" ? href : href?.pathname || "";

  const base = dottedTone === "white" ? DOTTED_BORDER_BASE_WHITE : DOTTED_BORDER_BASE;
  const active = dottedTone === "white" ? DOTTED_BORDER_ACTIVE_BOTTOM_WHITE : DOTTED_BORDER_ACTIVE_BOTTOM;

  const classes = [
    dotted && base,
    dotted && target === pathname && useActiveClass && (activeClass !== undefined ? activeClass : active),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={href}
      className={classes}
      style={style}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

        event.preventDefault();
        const nextHref = typeof href === "string" ? href : href?.pathname || "";
        if (!nextHref) return;
        if (nextHref === pathname) {
          scrollEnv.lenisScrollTo(0, { lerp: 0.1 });
          return;
        }
        startNavigation(nextHref);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
