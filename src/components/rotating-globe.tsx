"use client";

import { useEffect, useState } from "react";

import { useHasEnteredViewport } from "@/lib/use-has-entered-viewport";

const MERIDIAN = "M24 23C11.8497 23 2 18.0751 2 12C2 5.92487 11.8497 1 24 1";
const STROKE = { stroke: "currentColor", strokeWidth: 1, vectorEffect: "non-scaling-stroke" } as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export function RotatingGlobe({ className }: { className?: string }) {
  const { ref, hasEnteredViewport } = useHasEnteredViewport({ threshold: 0.1 });
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      style={
        reducedMotion
          ? undefined
          : {
              opacity: hasEnteredViewport ? 1 : 0,
              transitionProperty: "opacity",
              transitionDuration: "300ms",
              transitionTimingFunction: "ease",
              transitionDelay: hasEnteredViewport ? "600ms" : "0ms",
              willChange: "opacity",
            }
      }
    >
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse {...STROKE} strokeWidth={1} cx="24" cy="12" rx="22" ry="11" />
        <path {...STROKE} d="M2 12H46" />
        {reducedMotion || !hasEnteredViewport ? (
          <path {...STROKE} d={MERIDIAN} />
        ) : (
          Array.from({ length: 6 }, (_, index) => (
            <g key={`m-${index}`} transform="translate(24 12)">
              <g>
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  dur="2600ms"
                  repeatCount="indefinite"
                  values="1 1;-1 1"
                  keyTimes="0;1"
                  calcMode="spline"
                  keySplines="0.42 0 0.58 1"
                  begin={`-${(2600 * index) / 6}ms`}
                />
                <path {...STROKE} d={MERIDIAN} transform="translate(-24 -12)" />
              </g>
            </g>
          ))
        )}
      </svg>
    </div>
  );
}
