"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { Vector2, type Texture } from "three";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";
import { sectionMetrics } from "@/lib/section-metrics";
import type { SectionRect } from "@/lib/use-section-rects";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { useFBO } from "@/webgl/use-fbo";

/** Glass meshes live on this layer so they are excluded from the refraction capture. */
export const GLASS_LAYER = 10;

export const GLASS_CONTROLS = {
  refractPower: 0.72,
  chromaticAberration: 0.14,
  specularStrength: 1.2,
  loop: 3,
  lightZ: 0.5,

  darkShininess: 100,
  darkDiffuseness: 0.05,
  darkFresnelPower: 3,
  darkFresnelStrength: 0.72,
  darkBrightness: 0.6,
  darkContrast: 0.98,
  darkGamma: 1,
  darkSaturation: 1.2,
  darkTintMix: 1,
  darkTintColorA: "#ff9ec4",
  darkTintColorB: "#c48ea0",
  darkTintThicknessMinAlpha: 1,
  darkTintThicknessMaxAlpha: 0.4,

  lightShininess: 120,
  lightDiffuseness: 0.1,
  lightFresnelPower: 1,
  lightFresnelStrength: 0.24,
  lightBrightness: 0.78,
  lightContrast: 0.9,
  lightGamma: 1,
  lightSaturation: 1.2,
  lightTintMix: 1,
  lightTintColorA: "#ff6fa8",
  lightTintColorB: "#ffffff",
  lightTintThicknessMinAlpha: 1,
  lightTintThicknessMaxAlpha: 0.92,

  fresnelSideDirX: -1,
  fresnelSideDirY: 1,
  fresnelSideDirZ: -1,
};

export type GlassControls = typeof GLASS_CONTROLS;

export type ResolvedGlassControls = {
  refractPower: number;
  chromaticAberration: number;
  diffuseness: number;
  shininess: number;
  fresnelPower: number;
  saturation: number;
  brightness: number;
  contrast: number;
  gamma: number;
  specularStrength: number;
  fresnelStrength: number;
  fresnelSideDir: [number, number, number];
  tintMix: number;
  tintColorA: string;
  tintColorB: string;
  tintThicknessMinAlpha: number;
  tintThicknessMaxAlpha: number;
  loop: number;
};

export const resolveGlassControls = (
  controls: GlassControls,
  theme: "light" | "dark",
): ResolvedGlassControls => {
  const dark = theme === "dark";
  return {
    refractPower: controls.refractPower,
    chromaticAberration: controls.chromaticAberration,
    diffuseness: dark ? controls.darkDiffuseness : controls.lightDiffuseness,
    shininess: dark ? controls.darkShininess : controls.lightShininess,
    fresnelPower: dark ? controls.darkFresnelPower : controls.lightFresnelPower,
    saturation: dark ? controls.darkSaturation : controls.lightSaturation,
    brightness: dark ? controls.darkBrightness : controls.lightBrightness,
    contrast: dark ? controls.darkContrast : controls.lightContrast,
    gamma: dark ? controls.darkGamma : controls.lightGamma,
    specularStrength: controls.specularStrength,
    fresnelStrength: dark ? controls.darkFresnelStrength : controls.lightFresnelStrength,
    fresnelSideDir: [controls.fresnelSideDirX, controls.fresnelSideDirY, controls.fresnelSideDirZ],
    tintMix: dark ? controls.darkTintMix : controls.lightTintMix,
    tintColorA: dark ? controls.darkTintColorA : controls.lightTintColorA,
    tintColorB: dark ? controls.darkTintColorB : controls.lightTintColorB,
    tintThicknessMinAlpha: dark ? controls.darkTintThicknessMinAlpha : controls.lightTintThicknessMinAlpha,
    tintThicknessMaxAlpha: dark ? controls.darkTintThicknessMaxAlpha : controls.lightTintThicknessMaxAlpha,
    loop: controls.loop,
  };
};

type PerformancePolicy = {
  mode?: "none" | "skip-fbo";
  drivenByOverlay?: boolean;
  opaqueThreshold?: number;
  opaqueTolerance?: number;
  hysteresis?: number;
};

export const REFRACTIVE_EFFECT_POLICY = { opaqueThreshold: 0.99, opaqueTolerance: 0.005, hysteresis: 0.02 };
export const SOLID_EFFECT_POLICY = { opaqueThreshold: 0.9, opaqueTolerance: 0, hysteresis: 0.9 - 0.82 };

const saturate = (value: number) => Math.min(1, Math.max(0, value));
const normalizeProgress = (value: number | undefined) =>
  value === undefined ? 0 : saturate(value > 1 ? value / 100 : value);

/** Schmitt trigger so the FBO capture does not flicker on and off around the threshold. */
const shouldSkipCapture = (skipping: boolean, progress: number, policy?: PerformancePolicy) => {
  const threshold = saturate(policy?.opaqueThreshold ?? 0.99);
  const tolerance = saturate(policy?.opaqueTolerance ?? 0.005);
  const hysteresis = saturate(policy?.hysteresis ?? 0.02);
  const on = saturate(threshold - tolerance);
  const off = saturate(on - hysteresis);
  const t = normalizeProgress(progress);
  if (!skipping && t >= on) return true;
  if (skipping && t <= off) return false;
  return skipping;
};

const captureStride = (progress: number, isMobile: boolean) => {
  if (isMobile) return 3;
  const t = normalizeProgress(progress);
  return t > 0.75 ? 4 : t > 0.5 ? 2 : 1;
};

type GlassSystem = {
  controls: GlassControls;
  envMapBase: Texture;
  screenResolutionPx: Vector2;
  refractionResolutionPx: Vector2;
  glassLayer: number;
  sceneRefractionActiveRef: React.RefObject<boolean>;
};

const GlassContext = createContext<GlassSystem | null>(null);

export const useGlassSystem = () => {
  const ctx = useContext(GlassContext);
  if (!ctx) throw new Error("useGlassSystem must be used within GlassStage");
  return ctx;
};

export default function GlassStage({
  performancePolicy,
  sectionPosition,
  glassHostingSectionNames,
  children,
}: {
  performancePolicy?: PerformancePolicy;
  sectionPosition: SectionRect[];
  glassHostingSectionNames: string[];
  children: React.ReactNode;
}) {
  const controls = GLASS_CONTROLS;
  const { size, camera, scene, gl, viewport } = useThree();
  const isMobile = useIsMobileWidth();

  const halfWidth = Math.floor(0.5 * size.width * viewport.dpr);
  const halfHeight = Math.floor(0.5 * size.height * viewport.dpr);

  const screenResolutionPx = useMemo(
    () => gl.getDrawingBufferSize(new Vector2()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gl, size.width, size.height],
  );
  const refractionResolutionPx = useMemo(() => new Vector2(halfWidth, halfHeight), [halfWidth, halfHeight]);
  const target = useFBO(halfWidth, halfHeight, { stencilBuffer: false, depthBuffer: true, samples: 0 });

  useEffect(() => {
    camera.layers.enable(GLASS_LAYER);
  }, [camera]);

  const skippingRef = useRef(false);
  const frameRef = useRef(0);
  const refractionActiveRef = useRef(true);

  useEffect(() => {
    frameRef.current = 0;
  }, [size.width, size.height]);

  useFrame(() => {
    const mode = performancePolicy?.mode ?? "none";
    const drivenByOverlay = performancePolicy?.drivenByOverlay ?? false;
    const progress = arrowFullscreenProgressStore.getSnapshot();

    if (mode === "skip-fbo" && drivenByOverlay) {
      skippingRef.current = shouldSkipCapture(skippingRef.current, progress, performancePolicy);
    } else if (skippingRef.current) {
      skippingRef.current = false;
    }

    const hostVisible = sectionMetrics.anySectionInViewport(sectionPosition, glassHostingSectionNames);
    if (skippingRef.current || !hostVisible) {
      refractionActiveRef.current = false;
      return;
    }
    refractionActiveRef.current = true;

    if (frameRef.current++ % captureStride(progress, isMobile) !== 0) return;

    const previousMask = camera.layers.mask;
    const previousTarget = gl.getRenderTarget();
    const previousAutoClear = gl.autoClear;

    gl.setRenderTarget(target);
    gl.clear();
    camera.layers.mask = 1;
    gl.render(scene, camera);
    camera.layers.mask = previousMask;
    gl.setRenderTarget(previousTarget);
    gl.autoClear = previousAutoClear;
  }, -1);

  const value = useMemo<GlassSystem>(
    () => ({
      controls,
      envMapBase: target.texture,
      screenResolutionPx,
      refractionResolutionPx,
      glassLayer: GLASS_LAYER,
      sceneRefractionActiveRef: refractionActiveRef,
    }),
    [controls, target.texture, refractionResolutionPx, screenResolutionPx],
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}
