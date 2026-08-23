"use client";

import { useEffect, useState } from "react";

import ScrambleText from "@/components/scramble-text";
import { useThemeMode, type ThemeMode } from "@/providers/theme-mode-provider";

const THEME_CYCLE: ThemeMode[] = ["light", "dark", "system"];

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

type Props = {
  light?: string;
  dark?: string;
  system?: string;
  startDelayMs?: number;
  scrambleColors?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

export function ASCIIThemeToggle({
  light = "1",
  dark = "2",
  system = "3",
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  startDelayMs = 600,
  scrambleColors = true,
  ...rest
}: Props) {
  const { theme, setTheme } = useThemeMode();
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "l") {
        setInteracted(true);
        setTheme("light");
      } else if (key === "d") {
        setInteracted(true);
        setTheme("dark");
      } else if (key === "a") {
        setInteracted(true);
        setTheme("system");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTheme]);

  const cycle = () => {
    const index = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(index + 1) % THEME_CYCLE.length]);
  };

  const label = theme === "light" ? light : theme === "dark" ? dark : system;

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Theme: ${theme}`}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        setInteracted(true);
        cycle();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setInteracted(true);
          cycle();
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      {...rest}
    >
      <ScrambleText key={theme} text={label} startDelayMs={interacted ? 100 : startDelayMs} scrambleColors={scrambleColors} />
    </span>
  );
}
