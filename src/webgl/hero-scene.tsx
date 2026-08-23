"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

import { useIsMobileWidth } from "@/lib/viewport-store";
import type { SectionRect } from "@/lib/use-section-rects";
import CameraParallax from "@/webgl/camera-parallax";
import GlassModel from "@/webgl/glass-model";
import GlassStage, { REFRACTIVE_EFFECT_POLICY } from "@/webgl/glass-stage";
import ProceduralBackground from "@/webgl/procedural-background";
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

/**
 * Single-screen hero. There is nothing to scroll here, so the section list is
 * empty — GlassModel then parks at `modelPosition` instead of tracking a DOM
 * anchor, and the stage keeps its refraction capture always on.
 */
export default function HeroScene() {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const isMobile = useIsMobileWidth();
  const sections = useMemo<SectionRect[]>(() => [], []);

  return (
    <Canvas dpr={[1, 2]}>
      <SceneCamera ref={cameraRef} makeDefault position={[0, 0, 22]} />
      <RouteTransitionDots overlayColors={OVERLAY_COLORS} overlayPixelSize={4} />

      <GlassStage
        performancePolicy={PERFORMANCE_POLICY}
        sectionPosition={sections}
        glassHostingSectionNames={[]}
      >
        <CameraParallax cameraRef={cameraRef} {...CAMERA_PARALLAX} ready />

        <Suspense fallback={null}>
          <GlassModel
            model="model/wearth.glb"
            modelPosition={[0, 0.6, 0]}
            rotation={[0, 0, 0]}
            beforeRotation={[0, 0, 0]}
            scale={isMobile ? 15 : 22}
            sectionPosition={sections}
            sectionName="banner"
            tintEnabled
          />
          <Stickers sectionPosition={sections} sectionName="banner" />
        </Suspense>

        <ProceduralBackground />

        <StarFlare sectionPosition={sections} brightSourceSectionNames={[]} />
      </GlassStage>
    </Canvas>
  );
}
