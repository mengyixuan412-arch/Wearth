"use client";

import { memo, useEffect, useMemo, useRef } from "react";

/** Deterministic per-text stagger offsets, memoised so a re-render never reshuffles a line. */
const delayCache = new Map<string, number[]>();
const SEP = "\u0000";

function fnv1a(seed: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export function staggerDelays(text: string, count: number, spreadMs: number, variant?: string) {
  const key = [text, count, spreadMs, variant ?? ""].join(SEP);
  const cached = delayCache.get(key);
  if (cached) return cached;

  const random = mulberry32(fnv1a(variant ? text + SEP + variant : text));
  const delays =
    count <= 0
      ? []
      : count === 1
        ? [0]
        : Array.from({ length: count }, (_, index) => {
            const linear = (index / (count - 1)) * spreadMs * 0.7;
            const jitter = random() * spreadMs * 0.35;
            return Math.min(spreadMs, linear + jitter);
          });

  delayCache.set(key, delays);
  return delays;
}

type Props = {
  text: string;
  className?: string;
  durationSec?: number;
  staggerSpreadMs?: number;
  groupDelayMs?: number;
  play?: boolean;
};

const HyperSpaceStaggerText = memo(function HyperSpaceStaggerText({
  text,
  className,
  durationSec = 0.23,
  staggerSpreadMs = 290,
  groupDelayMs = 0,
  play = true,
}: Props) {
  const chars = useMemo(() => Array.from(text), [text]);
  const [inDelays, outDelays] = useMemo(
    () => [
      staggerDelays(text, chars.length, staggerSpreadMs),
      staggerDelays(text, chars.length, staggerSpreadMs, "out"),
    ],
    [chars.length, staggerSpreadMs, text],
  );

  const hasPlayedRef = useRef(false);
  useEffect(() => {
    if (play) hasPlayedRef.current = true;
  }, [play]);

  if (!play && !hasPlayedRef.current) {
    return (
      <span className={className} style={{ opacity: 0 }}>
        {text}
      </span>
    );
  }

  return (
    <span className={className}>
      {chars.map((char, index) => {
        const delay = ((play ? inDelays : outDelays)[index] + groupDelayMs) / 1000;
        return (
          <span
            key={`${index}-${char}`}
            className="hsst-char"
            style={{
              opacity: Number(!play),
              animationName: play ? "hsstFadeIn" : "hsstFadeOut",
              animationDuration: `${durationSec}s`,
              animationDelay: `${delay}s`,
              animationTimingFunction: "linear",
              animationFillMode: "forwards",
            }}
          >
            {char === " " ? "\u00a0" : char}
          </span>
        );
      })}
    </span>
  );
});

export default HyperSpaceStaggerText;
