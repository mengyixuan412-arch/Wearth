"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useMemo, useRef } from "react";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

import { useLenisScrollTop } from "@/lib/scroll-hooks";
import type { SectionRect } from "@/lib/use-section-rects";
import { useIsMobileWidth, useWindowSize } from "@/lib/viewport-store";
import CameraParallax from "@/webgl/camera-parallax";
import DomImagePlane from "@/webgl/dom-image-plane";
import DomLayerRectTracker, { type TargetRect } from "@/webgl/dom-layer-rect-tracker";
import GlassModel from "@/webgl/glass-model";
import GlassStage, { REFRACTIVE_EFFECT_POLICY } from "@/webgl/glass-stage";
import ProceduralBackground, { FLAT_PAGE_PALETTE } from "@/webgl/procedural-background";
import RouteTransitionDots from "@/webgl/route-transition-dots";
import SceneCamera from "@/webgl/scene-camera";
import StarFlare from "@/webgl/star-flare";
import Stickers from "@/webgl/stickers";

const OVERLAY_COLORS = ["#0F1111", "#FBFAF4"];
const PERFORMANCE_POLICY = { mode: "skip-fbo" as const, drivenByOverlay: true, ...REFRACTIVE_EFFECT_POLICY };

const CAMERA_PARALLAX = {
  parallaxEnabled: true,
  parallaxStrength: 1.4,
  parallaxLag: 0.18,
  parallaxRotate: 0.12,
  leaveParallaxLag: 0.05,
};

export type SceneImageLayer = {
  key: string;
  imageUrl: string;
  hoverImageUrl?: string;
  targetRef: React.RefObject<HTMLElement | null>;
};

/**
 * One stage for the whole scroll. The banner keeps the procedural sky; once the
 * hero is scrolled past, the palette target flips to the flat page colour and
 * the existing per-frame lerp carries it across — the same smoothed handover
 * the original site does between its screens.
 */
export default function HomeScene({
  sectionPosition,
  layers,
}: {
  sectionPosition: SectionRect[];
  layers: SceneImageLayer[];
}) {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const isMobile = useIsMobileWidth();
  const scrollTop = useLenisScrollTop();
  const { height } = useWindowSize();

  const pastHero = scrollTop > Math.max(1, height) * 0.45;

  const targetRectMapRef = useRef<Record<string, TargetRect>>({});
  const getTargetRect = useCallback((key: string) => targetRectMapRef.current[key] ?? null, []);
  const trackedLayers = useMemo(
    () => layers.map((layer) => ({ key: layer.key, targetRef: layer.targetRef })),
    [layers],
  );

  return (
    <Canvas dpr={[1, 2]}>
      <SceneCamera ref={cameraRef} makeDefault position={[0, 0, 22]} />
      <RouteTransitionDots overlayColors={OVERLAY_COLORS} overlayPixelSize={4} />

      <GlassStage
        performancePolicy={PERFORMANCE_POLICY}
        sectionPosition={sectionPosition}
        glassHostingSectionNames={[]}
      >
        <DomLayerRectTracker layers={trackedLayers} targetRectMapRef={targetRectMapRef} />
        <CameraParallax cameraRef={cameraRef} {...CAMERA_PARALLAX} ready />

        <Suspense fallback={null}>
          <GlassModel
            model="model/wearth.glb"
            scrollSyncFactor={0.72}
            modelPosition={[0, 0.6, 0]}
            rotation={[0, 0, 0]}
            beforeRotation={[0, 0, 0]}
            scale={isMobile ? 15 : 22}
            sectionPosition={sectionPosition}
            sectionName="banner"
            tintEnabled
          />
          <Stickers sectionPosition={sectionPosition} sectionName="banner" />
        </Suspense>

        <ProceduralBackground paletteOverride={pastHero ? FLAT_PAGE_PALETTE : undefined} />

        <Suspense fallback={null}>
          {layers.map((layer) => (
            <DomImagePlane
              key={layer.key}
              ready
              imageUrl={layer.imageUrl}
              hoverImageUrl={layer.hoverImageUrl}
              targetRef={layer.targetRef}
              layerKey={layer.key}
              getTargetRect={getTargetRect}
              onTextureReady={() => {}}
            />
          ))}
        </Suspense>

        <StarFlare sectionPosition={sectionPosition} brightSourceSectionNames={["banner"]} />
      </GlassStage>
    </Canvas>
  );
}
