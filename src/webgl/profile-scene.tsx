"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useMemo, useRef } from "react";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

import type { SectionRect } from "@/lib/use-section-rects";
import CameraParallax from "@/webgl/camera-parallax";
import DomImagePlane from "@/webgl/dom-image-plane";
import DomLayerRectTracker, { type TargetRect } from "@/webgl/dom-layer-rect-tracker";
import GlassStage, { REFRACTIVE_EFFECT_POLICY } from "@/webgl/glass-stage";
import ProceduralBackground, { FLAT_PAGE_PALETTE } from "@/webgl/procedural-background";
import RouteTransitionDots from "@/webgl/route-transition-dots";
import SceneCamera from "@/webgl/scene-camera";

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
 * The original second screen's stage: a flat page-coloured backdrop with the
 * portrait drawn by WebGL and kept locked to its DOM box while Lenis scrolls.
 */
export default function ProfileScene({
  sectionPosition,
  layers,
}: {
  sectionPosition: SectionRect[];
  layers: SceneImageLayer[];
}) {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
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

        <ProceduralBackground paletteOverride={FLAT_PAGE_PALETTE} />

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
      </GlassStage>
    </Canvas>
  );
}
