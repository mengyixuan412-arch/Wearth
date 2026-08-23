"use client";

import { useRouter } from "next/navigation";

import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";

/**
 * Primary action, built to read as the same moulded blue glass as the 3D cursor:
 * the background refracts through a translucent body, with a lighter bevelled
 * rim and a top-left specular rather than a flat filled circle. It fills its
 * wrapper, which on desktop is stretched to the height of the tagline pair.
 */
export default function AddItemButton({ href = "/wardrobe/new" }: { href?: string }) {
  const router = useRouter();
  const { startNavigation } = useRouteTransitionController();

  return (
    <button
      type="button"
      aria-label="录入新衣服"
      onClick={() => {
        router.prefetch?.(href);
        startNavigation(href);
      }}
      className="group relative flex justify-center items-center backdrop-blur-[6px] backdrop-saturate-150 rounded-full w-full h-full transition-transform duration-[0.66s] ease-66 cursor-pointer pointer-events-auto lg:hover:scale-105"
      style={{
        background:
          "radial-gradient(125% 125% at 32% 20%, rgba(242,124,173,0.95) 0%, rgba(213,63,125,0.94) 38%, rgba(196,48,110,0.96) 78%, rgba(180,40,98,0.97) 100%)",
        boxShadow: [
          "inset 0 3px 6px rgba(255,196,221,0.80)",
          "inset 0 -9px 18px rgba(239,121,170,0.55)",
          "inset 0 0 0 2px rgba(238,122,172,0.95)",
          "0 14px 30px rgba(196,45,108,0.32)",
          "0 2px 6px rgba(196,45,108,0.24)",
        ].join(", "),
      }}
    >
      {/* Specular hotspot, mirroring the highlight on the 3D cursor. */}
      <span
        aria-hidden="true"
        className="top-[13%] left-[19%] absolute blur-[5px] rounded-full w-1/3 h-1/4 -rotate-12 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 70%)" }}
      />

      {/* Chromatic edge, the dispersion the glass shader gives the wordmark. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-70 rounded-full pointer-events-none"
        style={{
          background:
            "conic-gradient(from 210deg, rgba(255,255,255,0) 0deg, rgba(255,120,176,0.4) 70deg, rgba(255,255,255,0) 150deg, rgba(255,255,255,0) 250deg, rgba(255,150,140,0.32) 320deg, rgba(255,255,255,0) 360deg)",
          maskImage: "radial-gradient(circle, transparent 62%, #000 82%, #000 100%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 62%, #000 82%, #000 100%)",
        }}
      />

      {/* Dotted ring on hover, consistent with every other interactive element. */}
      <span
        aria-hidden="true"
        className="absolute -inset-2 border-2 border-transparent lg:group-hover:border-l1 border-dotted rounded-full transition-colors duration-200 pointer-events-none"
      />

      {/* Debossed into the glass rather than laid on top: a shadow stroke
          offset down-right, then the lit stroke above it. */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="relative w-[31%] h-[31%] transition-transform duration-[0.66s] ease-66 lg:group-hover:rotate-90"
      >
        <g transform="translate(0.7 0.9)">
          <path
            d="M16 6.5V25.5M6.5 16H25.5"
            stroke="rgba(140,28,74,0.50)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M16 6.5V25.5M6.5 16H25.5"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>

    </button>
  );
}
