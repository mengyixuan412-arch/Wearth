"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { useHasEnteredViewport } from "@/lib/use-has-entered-viewport";

const HAOQI_PATHS = [
  {
    order: 0,
    d: "M138.27 11.7729C123.15 39.3885 106.223 85.497 102.06 100.029C98.6588 111.899 98.3721 128.792 98.6271 131.165",
    strokeWidth: 4,
  },
  {
    order: 1,
    d: "M78.2326 42.073C68.2519 91.6846 24.5171 161.888 11.6117 145.082C-3.90668 124.872 84.4229 80.042 149.127 70.3141C129.181 76.883 121.731 89.3385 127.224 93.3199C137.212 100.559 148.931 80.9071 154.826 68.4373C154.826 68.4373 145.919 84.0047 152.863 86.4553C163.666 90.2674 183.35 47.449 193.768 55.6123C200.863 61.1719 187.995 78.0438 180.889 75.6465C176.521 74.173 179.98 64.5401 184.583 59.6902C186.629 62.1747 192.878 65.6969 201.5 59.9093C210.123 54.1218 217.989 47.6358 220.844 45.1163",
    strokeWidth: 4,
  },
  {
    order: 2,
    d: "M235.554 43.4299C221.979 37.3731 206.4 60.4017 215.719 63.1233C224.115 65.5752 234.431 48.0119 239.203 40.1227C237.612 42.7522 234.822 53.6736 235.156 66.1976C235.574 81.8524 228.174 116.927 217.431 114.674C206.687 112.422 217.712 80.3645 242.778 57.3701C262.83 38.9746 269.549 28.9006 270.402 26.163C266.375 32.0516 260.249 44.2468 267.959 45.919C275.669 47.5912 298.148 19.8335 308.423 5.74565",
    strokeWidth: 4,
  },
  { order: 3, d: "M274.89 10.4194L274.409 16.157", strokeWidth: 5 },
];

/**
 * 手写体 "Girl"，同一个 viewBox、同一套逐笔描画。笔序按真实书写走：
 * G → i 竖 → r → l，点最后补 —— 和写字时抬笔回来点 i 的顺序一致。
 */
const GIRL_PATHS = [
  {
    order: 0,
    d: "M156 46C150 32 132 22 112 26C86 32 68 58 70 84C72 108 94 120 114 114C134 108 144 88 138 74C134 66 124 70 118 74C130 71 146 70 158 68",
    strokeWidth: 4,
  },
  { order: 1, d: "M176 68C174 84 173 98 175 110", strokeWidth: 4 },
  {
    order: 2,
    d: "M196 110C198 94 199 80 197 68C199 76 205 70 212 67C216 65 220 66 222 69",
    strokeWidth: 4,
  },
  {
    order: 3,
    d: "M244 110C242 86 248 54 259 34C265 23 274 25 271 39C268 55 253 80 246 95C241 105 250 112 264 108",
    strokeWidth: 4,
  },
  { order: 4, d: "M178 50L178 54", strokeWidth: 5 },
];

const SIGN_VARIANTS = { haoqi: HAOQI_PATHS, girl: GIRL_PATHS };

export type SignVariant = keyof typeof SIGN_VARIANTS;

/** Stroke speed: every path is drawn at a constant 720 user-units per second. */
const DRAW_UNITS_PER_SECOND = 720;
const INITIAL_DELAY_S = 0.5;
const GAP_S = 0.03;

const SIGN_STYLES = `
        .svg-sign__path {
          opacity: 0;
          fill: none;
          stroke-linecap: butt;
        }
        .svg-sign.is-drawing .svg-sign__path {
          animation:
            svg-sign-show 0s linear var(--path-delay) forwards,
            svg-sign-draw var(--path-dur) cubic-bezier(0.65, 0, 0.35, 1) var(--path-delay) forwards;
        }
        @keyframes svg-sign-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes svg-sign-show {
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .svg-sign.is-drawing .svg-sign__path {
            animation: none;
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
      `;

export default function SignatureSign({
  className,
  variant = "haoqi",
}: {
  className?: string;
  variant?: SignVariant;
}) {
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [measured, setMeasured] = useState(false);
  const paths = useMemo(() => [...SIGN_VARIANTS[variant]].sort((a, b) => a.order - b.order), [variant]);
  const { ref, hasEnteredViewport } = useHasEnteredViewport({
    once: false,
    threshold: 0.15,
    rootMargin: "0px 0px -8% 0px",
  });

  useLayoutEffect(() => {
    let delay = INITIAL_DELAY_S;
    for (const path of pathRefs.current) {
      if (!path) continue;
      const length = path.getTotalLength();
      const duration = length / DRAW_UNITS_PER_SECOND;
      path.style.setProperty("--path-len", String(length));
      path.style.setProperty("--path-dur", `${duration}s`);
      path.style.setProperty("--path-delay", `${delay}s`);
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      delay += duration + GAP_S;
    }
    setMeasured(true);
  }, [paths]);

  return (
    <>
      <style>{SIGN_STYLES}</style>
      <svg
        ref={ref as React.Ref<SVGSVGElement>}
        viewBox="0 0 320 154"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`svg-sign${measured && hasEnteredViewport ? " is-drawing" : ""}${className ? ` ${className}` : ""}`}
        aria-hidden
      >
        {paths.map((path, index) => (
          <path
            key={path.order}
            ref={(el) => {
              pathRefs.current[index] = el;
            }}
            className="svg-sign__path"
            d={path.d}
            stroke="#FF2E88"
            strokeWidth={path.strokeWidth}
            fill="none"
          />
        ))}
      </svg>
    </>
  );
}
