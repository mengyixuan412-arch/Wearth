"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useHasEnteredViewport } from "@/lib/use-has-entered-viewport";
import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=?/<>[]{}";

const DEFAULT_COLORS = {
  light: ["#c0fe04", "#607F02"],
  dark: ["#c0fe04", "#DFFF81"],
};

export type ScrambleSlot = {
  length: number;
  scramble?: string;
  settled: React.ReactNode;
  className?: string;
};

export type ScramblePart = string | ScrambleSlot;

type NormalizedPart =
  | { kind: "text"; value: string }
  | { kind: "slot"; length: number; scramble: string; settled: React.ReactNode; className?: string };

/** A single shared 40ms ticker drives every mounted ScrambleText instance. */
const tickers = new Set<(now: number) => void>();
let tickerId: number | null = null;

const subscribeTicker = (fn: (now: number) => void) => {
  tickers.add(fn);
  if (tickerId === null) {
    tickerId = window.setInterval(() => {
      const now = performance.now();
      for (const listener of tickers) listener(now);
    }, 40);
  }
  return () => {
    tickers.delete(fn);
    if (tickers.size === 0 && tickerId !== null) {
      window.clearInterval(tickerId);
      tickerId = null;
    }
  };
};

const randomChar = () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];

const renderSettled = (parts: NormalizedPart[]) =>
  parts.map((part, index) => {
    if (part.kind === "text") {
      const key = `text-${index}`;
      const lines = part.value
        .split("\n")
        .flatMap((line, i, all) => (i < all.length - 1 ? [line, <br key={`${key}-br-${i}`} />] : [line]));
      return <span key={key}>{lines}</span>;
    }
    return <span key={`slot-${index}`}>{part.settled}</span>;
  });

type ScrambleTextProps = {
  text?: string;
  parts?: ScramblePart[];
  className?: string;
  style?: React.CSSProperties;
  colors?: string[] | { light?: string[]; dark?: string[] };
  startDelayMs?: number;
  letterDelayMs?: number;
  reverse?: boolean;
  scrambleColors?: boolean;
} & Pick<
  React.HTMLAttributes<HTMLSpanElement>,
  "onClick" | "onMouseEnter" | "onMouseLeave" | "onPointerEnter" | "onPointerLeave" | "onPointerDown" | "onFocus" | "onBlur"
>;

export default function ScrambleText({
  text,
  parts,
  className,
  style,
  colors = DEFAULT_COLORS,
  startDelayMs = 0,
  letterDelayMs = 80,
  reverse = false,
  scrambleColors = true,
  ...handlers
}: ScrambleTextProps) {
  const [now, setNow] = useState(0);
  const [settled, setSettled] = useState(false);
  const { resolvedTheme } = useThemeMode();
  const { allowScrambleLines } = useRouteTransitionController();
  const { ref, hasEnteredViewport } = useHasEnteredViewport({ threshold: 0.1 });
  const startRef = useRef(0);
  const startedRef = useRef(false);

  const normalized = useMemo<NormalizedPart[]>(
    () =>
      (parts ?? [text ?? ""]).map((part) => {
        if (typeof part === "string") return { kind: "text", value: part };
        const scramble = part.scramble ?? (part.length > 0 ? " ".repeat(part.length) : "");
        return {
          kind: "slot",
          length: part.length,
          scramble: scramble.slice(0, part.length).padEnd(part.length, " "),
          settled: part.settled,
          className: part.className,
        };
      }),
    [parts, text],
  );

  const totalChars = useMemo(
    () => normalized.reduce((sum, part) => sum + (part.kind === "text" ? part.value.length : part.length), 0),
    [normalized],
  );

  const stepMs = 2 * letterDelayMs;
  const scrambleWindowMs = 2 * stepMs;

  const totalDurationMs = useMemo(
    () => startDelayMs + (totalChars > 0 ? (totalChars - 1) * letterDelayMs : 0) + scrambleWindowMs,
    [totalChars, startDelayMs, letterDelayMs, scrambleWindowMs],
  );

  useEffect(() => {
    if (settled || !hasEnteredViewport || !allowScrambleLines || startedRef.current) return;
    startedRef.current = true;
    startRef.current = performance.now();
    setNow(startRef.current);

    let unsubscribe: (() => void) | null = subscribeTicker((time) => {
      setNow(time);
      if (time - startRef.current >= totalDurationMs) {
        setSettled(true);
        unsubscribe?.();
        unsubscribe = null;
      }
    });

    return () => {
      unsubscribe?.();
      unsubscribe = null;
    };
  }, [hasEnteredViewport, allowScrambleLines, totalDurationMs, settled]);

  const elapsed = Math.max(0, now - (startRef.current + startDelayMs));
  const running = allowScrambleLines && hasEnteredViewport && now >= startRef.current + startDelayMs;

  const palette = useMemo(
    () =>
      Array.isArray(colors)
        ? colors
        : resolvedTheme === "dark"
          ? (colors.dark ?? colors.light ?? [])
          : (colors.light ?? colors.dark ?? []),
    [colors, resolvedTheme],
  );

  if (settled) {
    return (
      <span ref={ref} className={className} style={style} {...handlers}>
        {renderSettled(normalized)}
      </span>
    );
  }

  if (!running) {
    return (
      <span ref={ref} className={className} style={{ ...style, opacity: 0 }} {...handlers}>
        {renderSettled(normalized)}
      </span>
    );
  }

  let cursor = 0;

  const renderChar = (char: string, key: string) => {
    const index = reverse ? totalChars - 1 - cursor : cursor;
    cursor += 1;
    const charStart = index * letterDelayMs;
    const charEnd = charStart + scrambleWindowMs;

    if (elapsed < charStart) return <span key={key} style={{ opacity: 0 }}>{char}</span>;
    if (elapsed < charEnd) {
      const stage = Math.min(1, Math.floor((elapsed - charStart) / stepMs));
      const color = scrambleColors ? palette[stage] : undefined;
      return (
        <span key={key} style={color ? { color } : undefined}>
          {randomChar()}
        </span>
      );
    }
    return <span key={key}>{char}</span>;
  };

  return (
    <span ref={ref} className={className} style={style} {...handlers}>
      {normalized.map((part, index) => {
        if (part.kind === "text") {
          return (
            <span key={`text-${index}`}>
              {part.value.split("").map((char, charIndex) => {
                if (char === "\n") {
                  cursor += 1;
                  return <br key={`newline-${index}-${charIndex}`} />;
                }
                if (char === " ") {
                  cursor += 1;
                  return <span key={`space-${index}-${charIndex}`}> </span>;
                }
                return renderChar(char, `char-${index}-${charIndex}`);
              })}
            </span>
          );
        }
        return (
          <span key={`slot-${index}`} className={part.className}>
            {part.scramble.split("").map((char, charIndex) => renderChar(char, `slot-char-${index}-${charIndex}`))}
          </span>
        );
      })}
    </span>
  );
}
