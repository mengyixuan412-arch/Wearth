"use client";

import { EffectComposer } from "@react-three/postprocessing";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { UnsignedByteType, Vector2 } from "three";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";
import { sectionMetrics } from "@/lib/section-metrics";
import type { SectionRect } from "@/lib/use-section-rects";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { usePointer } from "@/providers/pointer-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";
import { FluidPushPass } from "@/webgl/fluid-push-pass";
import { LensFlarePass } from "@/webgl/lens-flare-pass";
import { REFRACTIVE_EFFECT_POLICY, SOLID_EFFECT_POLICY } from "@/webgl/glass-stage";

const POINTER_ACCENT = "#ff2e88";
const POINTER_IDLE_MS = 600;

const DEFAULTS = {
  starRays: 6,
  intensity: 0.7,
  threshold: 0.99,
  streakScale: 8,
  hotspotPower: 32,
  gate: 0.88,
  tailColorLight: "#ff5fa8",
  tailColorDark: "#e0007a",
};

const saturate = (value: number) => Math.min(1, Math.max(0, value));
const normalizeProgress = (value: number) => saturate(value > 1 ? value / 100 : value);

/** Schmitt trigger shared with the glass stage, so effects switch off without flicker. */
const schmitt = (
  current: boolean,
  progress: number,
  policy: { opaqueThreshold: number; opaqueTolerance: number; hysteresis: number },
) => {
  const on = saturate(policy.opaqueThreshold - policy.opaqueTolerance);
  const off = saturate(on - policy.hysteresis);
  const t = normalizeProgress(progress);
  if (!current && t >= on) return true;
  if (current && t <= off) return false;
  return current;
};

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

type ComposerHandle = {
  inputBuffer: { setSize(w: number, h: number): void };
  outputBuffer: { setSize(w: number, h: number): void };
  passes: { setSize(w: number, h: number): void }[];
};

export default function StarFlare({
  flareDownsample = 0.5,
  sectionPosition,
  brightSourceSectionNames,
}: {
  flareDownsample?: number;
  sectionPosition: SectionRect[];
  brightSourceSectionNames: string[];
}) {
  const { size, gl } = useThree();
  const { uv, insideRef } = usePointer();
  const { resolvedTheme } = useThemeMode();
  const isMobile = useIsMobileWidth();
  const reducedMotion = usePrefersReducedMotion();

  // Streak length is authored at 1920px wide, then scaled to the current viewport.
  const streakScale = DEFAULTS.streakScale * (Math.max(1, size.width) / 1920) * (isMobile ? 2 : 1);
  const tailColor = resolvedTheme === "dark" ? DEFAULTS.tailColorDark : DEFAULTS.tailColorLight;

  const composerRef = useRef<ComposerHandle | null>(null);
  const pointerPx = useRef(new Vector2(-1, -1));
  const pointerDelta = useRef(new Vector2(0, 0));
  const lastPointerPx = useRef(new Vector2(-1, -1));
  const pointerUv = useRef(new Vector2(-1, -1));
  const solidSuspended = useRef(false);
  const overlayActive = useRef(false);
  const lastMoveAt = useRef(0);
  const flareWasEnabled = useRef(true);

  const flarePass = useMemo(
    () =>
      new LensFlarePass({
        flareDownsample,
        starRays: DEFAULTS.starRays,
        intensity: DEFAULTS.intensity,
        threshold: DEFAULTS.threshold,
        streakScale,
        hotspotPower: DEFAULTS.hotspotPower,
        gate: DEFAULTS.gate,
        tailColor,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const fluidPass = useMemo(() => new FluidPushPass({}), []);

  useEffect(() => {
    flarePass.setParams({
      starRays: DEFAULTS.starRays,
      intensity: DEFAULTS.intensity,
      threshold: DEFAULTS.threshold,
      streakScale,
      hotspotPower: DEFAULTS.hotspotPower,
      gate: DEFAULTS.gate,
      tailColor,
    });
  }, [flarePass, streakScale, tailColor]);

  useEffect(() => {
    flarePass.setFlareDownsample(flareDownsample);
  }, [flarePass, flareDownsample]);

  useEffect(() => {
    fluidPass.setPointerColor(POINTER_ACCENT);
    fluidPass.setPointerPixelSize(16);
  }, [fluidPass]);

  useEffect(
    () => () => {
      flarePass.dispose();
      fluidPass.dispose();
    },
    [flarePass, fluidPass],
  );

  useEffect(() => {
    const dpr = Math.min(gl.getPixelRatio(), 2);
    fluidPass.setDisplayMetrics(size.width, size.height, dpr);

    // Resizing the composer's own buffers is best-effort: the composer already
    // tracks the canvas, this just keeps the passes in step on DPR changes.
    const composer = composerRef.current;
    if (!composer) return;
    const width = Math.max(1, Math.floor(size.width * dpr));
    const height = Math.max(1, Math.floor(size.height * dpr));
    composer.inputBuffer.setSize(width, height);
    composer.outputBuffer.setSize(width, height);
    for (const pass of composer.passes) pass.setSize(width, height);
  }, [fluidPass, gl, size.width, size.height]);

  useFrame((_state, delta) => {
    const progress = arrowFullscreenProgressStore.getSnapshot();
    solidSuspended.current = schmitt(solidSuspended.current, progress, SOLID_EFFECT_POLICY);
    overlayActive.current = solidSuspended.current;

    const sourceVisible = sectionMetrics.anySectionInViewport(sectionPosition, brightSourceSectionNames);
    const flareEnabled = !solidSuspended.current && sourceVisible;

    if (!flareWasEnabled.current && flareEnabled) flarePass.resetFlareCadence();
    flareWasEnabled.current = flareEnabled;
    flarePass.enabled = flareEnabled;

    const pointerActive = insideRef.current && !isMobile && !reducedMotion;
    // uResolution is in device pixels, so the pointer must be too — otherwise the
    // splat lands at the wrong place on any non-1 DPR display.
    const dpr = Math.min(gl.getPixelRatio(), 2);

    if (pointerActive) {
      const x = uv.x * size.width * dpr;
      const y = uv.y * size.height * dpr;
      if (lastPointerPx.current.x >= 0 && lastPointerPx.current.y >= 0) {
        pointerDelta.current.set(x - lastPointerPx.current.x, y - lastPointerPx.current.y);
      } else {
        pointerDelta.current.set(0, 0);
      }
      pointerPx.current.set(x, y);
      lastPointerPx.current.set(x, y);
    } else {
      pointerDelta.current.multiplyScalar(0.9);
    }

    const speedSq = pointerActive ? pointerDelta.current.lengthSq() : 0;
    const now = performance.now();
    if (speedSq > 1) lastMoveAt.current = now;
    const idle = now - lastMoveAt.current > POINTER_IDLE_MS;

    const fluidEffectActive = !isMobile && !reducedMotion && !solidSuspended.current && !idle;
    const overlay = overlayActive.current;

    // Whichever pass renders last must own the screen.
    if (!flareEnabled || fluidEffectActive || overlay) {
      flarePass.renderToScreen = false;
      fluidPass.enabled = true;
      fluidPass.renderToScreen = true;
    } else {
      flarePass.renderToScreen = true;
      fluidPass.enabled = false;
    }

    fluidPass.setEffectEnabled(fluidEffectActive);
    fluidPass.setPointerOverlayEnabled(overlay);
    fluidPass.setPointer(pointerPx.current);
    fluidPass.setPointerDelta(pointerDelta.current);

    if (pointerActive) pointerUv.current.copy(uv);
    else pointerUv.current.set(-1, -1);
    fluidPass.updatePointer(pointerUv.current, pointerActive && overlay, delta);
  }, 0);

  return (
    <EffectComposer
      ref={composerRef as never}
      multisampling={0}
      autoClear
      renderPriority={998}
      frameBufferType={UnsignedByteType}
    >
      <primitive object={flarePass} />
      <primitive object={fluidPass} />
    </EffectComposer>
  );
}
