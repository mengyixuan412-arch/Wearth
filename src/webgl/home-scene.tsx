"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, type PerspectiveCamera as PerspectiveCameraImpl } from "three";

import { sectionMetrics } from "@/lib/section-metrics";
import type { SectionRect } from "@/lib/use-section-rects";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";
import ArrowFullscreen from "@/webgl/arrow-fullscreen";
import CameraParallax from "@/webgl/camera-parallax";
import GlassModel from "@/webgl/glass-model";
import DomImagePlane from "@/webgl/dom-image-plane";
import DomLayerRectTracker, { type TargetRect } from "@/webgl/dom-layer-rect-tracker";
import GlassStage, { REFRACTIVE_EFFECT_POLICY } from "@/webgl/glass-stage";
import ProceduralBackground from "@/webgl/procedural-background";
import RouteTransitionDots from "@/webgl/route-transition-dots";
import SceneCamera from "@/webgl/scene-camera";
import StarFlare from "@/webgl/star-flare";
import Stickers from "@/webgl/stickers";

/** Model keys that must finish loading before the entry curtain lifts. */
const REQUIRED_MODEL_KEYS = ["hello", "h_star", "cnt"];

const OVERLAY_COLORS = ["#0F1111", "#FBFAF4"];
const GLASS_HOSTING_SECTIONS = ["banner", "footer"];
const PERFORMANCE_POLICY = { mode: "skip-fbo" as const, drivenByOverlay: true, ...REFRACTIVE_EFFECT_POLICY };

const CAMERA_PARALLAX = {
  parallaxEnabled: true,
  parallaxStrength: 1.4,
  parallaxLag: 0.18,
  parallaxRotate: 0.12,
  leaveParallaxLag: 0.05,
};

const HERO_MODEL = "model/wearth.glb";

const CURSOR_TINT = ["#009dff", "#009dff", "#64c3ff", "#64c3ff"];
const CNT_TINT = ["#FFFFFF", "#009dff", "#8e9dc4", "#64c3ff"];

/** Clears the per-frame section-layout cache before anything else reads it. */
function SectionLayoutFrame() {
  useFrame((state) => {
    sectionMetrics.beginSectionLayoutFrame(state.internal.frames);
  }, -1000);
  return null;
}

export type SceneImageLayer = {
  key: string;
  imageUrl: string;
  hoverImageUrl?: string;
  targetRef: React.RefObject<HTMLElement | null>;
};

export default function HomeScene({
  sectionPosition,
  layers,
}: {
  sectionPosition: SectionRect[];
  layers: SceneImageLayer[];
}) {
  const [modelsReady, setModelsReady] = useState<Record<string, boolean>>({});
  const [textureState, setTextureState] = useState<{ signature: string; map: Record<string, boolean> }>({
    signature: "",
    map: {},
  });

  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const hyperSectionRef = useMemo(
    () => sectionMetrics.findSection(sectionPosition, "hyper-space")?.ref ?? null,
    [sectionPosition],
  );
  const [hyperNearViewport, setHyperNearViewport] = useState(false);
  const isMobile = useIsMobileWidth();
  const { setReadyToLoadHeavy, setHeavyLoadProgress } = useRouteTransitionController();

  const markModelReady = useCallback((key: string) => {
    setModelsReady((current) => (current[key] ? current : { ...current, [key]: true }));
  }, []);

  const targetRectMapRef = useRef<Record<string, TargetRect>>({});
  const getTargetRect = useCallback((key: string) => targetRectMapRef.current[key] ?? null, []);
  const trackedLayers = useMemo(
    () => layers.map((layer) => ({ key: layer.key, targetRef: layer.targetRef })),
    [layers],
  );

  const layerSignature = useMemo(
    () => layers.map((layer) => `plain:${layer.key}:${layer.imageUrl}:${layer.hoverImageUrl ?? ""}`).join("|"),
    [layers],
  );

  const markTextureReady = useCallback(
    (key: string) => {
      setTextureState((current) => {
        const map = current.signature === layerSignature ? current.map : {};
        if (map[key]) return current.signature === layerSignature ? current : { signature: layerSignature, map };
        return { signature: layerSignature, map: { ...map, [key]: true } };
      });
    },
    [layerSignature],
  );

  const allModelsReady = REQUIRED_MODEL_KEYS.every((key) => modelsReady[key]);
  const allTexturesReady =
    layers.length === 0 ||
    layers.every((layer) => textureState.signature === layerSignature && textureState.map[layer.key]);
  const ready = allModelsReady && allTexturesReady;

  const total = REQUIRED_MODEL_KEYS.length + layers.length;
  const doneModels = REQUIRED_MODEL_KEYS.reduce((sum, key) => (modelsReady[key] ? sum + 1 : sum), 0);
  const doneTextures = layers.reduce(
    (sum, layer) => (textureState.signature === layerSignature && textureState.map[layer.key] ? sum + 1 : sum),
    0,
  );
  const progress = total === 0 ? 100 : ((doneModels + doneTextures) / total) * 100;

  // The arrow only mounts near the hyper-space section; 480px of slack pre-warms it.
  useEffect(() => {
    if (!hyperSectionRef) return;
    let observer: IntersectionObserver | null = null;
    let raf = 0;
    let attempts = 0;

    const attach = () => {
      const el = hyperSectionRef.current;
      if (el) {
        observer = new IntersectionObserver(([entry]) => setHyperNearViewport(entry.isIntersecting), {
          root: null,
          rootMargin: "480px 0px 480px 0px",
          threshold: 0,
        });
        observer.observe(el);
        return;
      }
      if (++attempts < 120) raf = requestAnimationFrame(attach);
    };

    attach();
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      setHyperNearViewport(false);
    };
  }, [hyperSectionRef]);

  useEffect(() => {
    setReadyToLoadHeavy(false);
    setHeavyLoadProgress(0);
  }, [setReadyToLoadHeavy, setHeavyLoadProgress]);

  useEffect(() => {
    setHeavyLoadProgress(MathUtils.clamp(progress, 0, 100));
  }, [progress, setHeavyLoadProgress]);

  useEffect(() => {
    if (!ready) return;
    setHeavyLoadProgress(100);
    setReadyToLoadHeavy(true);
  }, [ready, setReadyToLoadHeavy, setHeavyLoadProgress]);

  return (
    <Canvas dpr={[1, 2]}>
      <SectionLayoutFrame />
      <SceneCamera ref={cameraRef} makeDefault position={[0, 0, 22]} />
      <RouteTransitionDots overlayColors={OVERLAY_COLORS} overlayPixelSize={4} />
      <GlassStage
        performancePolicy={PERFORMANCE_POLICY}
        sectionPosition={sectionPosition}
        glassHostingSectionNames={GLASS_HOSTING_SECTIONS}
      >
        <DomLayerRectTracker layers={trackedLayers} targetRectMapRef={targetRectMapRef} />
        <CameraParallax cameraRef={cameraRef} {...CAMERA_PARALLAX} ready={ready} />

        <Suspense fallback={null}>
          <GlassModel
            model={HERO_MODEL}
            scrollSyncFactor={0.72}
            modelPosition={[-0.1, 0, 2]}
            beforeRotation={[0, 240, 0]}
            afterRotation={[0, 90, 0]}
            rotation={[0, 4, 0]}
            scale={isMobile ? 19 : 22}
            sectionPosition={sectionPosition}
            sectionName="banner"
            onReady={() => markModelReady("hello")}
            tintEnabled
          />
          <GlassModel
            model="model/cursor.glb"
            scrollSyncFactor={0.72}
            modelPosition={isMobile ? [6.6, -5.6, -3] : [11.6, -4.2, -3]}
            rotationAxisTilt={[0, 0, 45]}
            beforeRotation={[0, 0, 0]}
            afterRotation={[0, 720, 0]}
            scale={0.1}
            sectionPosition={sectionPosition}
            sectionName="banner"
            tintEnabled
            tingColor={CURSOR_TINT}
            onReady={() => markModelReady("h_star")}
          />
          <GlassModel
            model="model/cnt.gltf"
            beforeRotation={[-180, 0, 0]}
            rotation={[0, 0, 0]}
            scale={19}
            sectionPosition={sectionPosition}
            sectionName="footer"
            tintEnabled
            tingColor={CNT_TINT}
            onReady={() => markModelReady("cnt")}
          />
          <Stickers sectionPosition={sectionPosition} sectionName="banner" />
        </Suspense>

        <ProceduralBackground />

        {hyperSectionRef && hyperNearViewport && (
          <ArrowFullscreen
            targetRef={hyperSectionRef}
            getTargetRect={() => getTargetRect("hyper-space")}
            scaleSpinDegrees={180}
          />
        )}

        <Suspense fallback={null}>
          {layers.map((layer) => (
            <DomImagePlane
              key={layer.key}
              ready={ready}
              imageUrl={layer.imageUrl}
              hoverImageUrl={layer.hoverImageUrl}
              targetRef={layer.targetRef}
              layerKey={layer.key}
              getTargetRect={getTargetRect}
              onTextureReady={() => markTextureReady(layer.key)}
            />
          ))}
        </Suspense>

        <StarFlare sectionPosition={sectionPosition} brightSourceSectionNames={GLASS_HOSTING_SECTIONS} />
      </GlassStage>
    </Canvas>
  );
}
