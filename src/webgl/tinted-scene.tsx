"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

import CameraParallax from "@/webgl/camera-parallax";
import ProceduralBackground, { type BackgroundPalette } from "@/webgl/procedural-background";
import RouteTransitionDots from "@/webgl/route-transition-dots";
import SceneCamera from "@/webgl/scene-camera";

const OVERLAY_COLORS = ["#0F1111", "#FBFAF4"];

const CAMERA_PARALLAX = {
  parallaxEnabled: true,
  parallaxStrength: 1.4,
  parallaxLag: 0.18,
  parallaxRotate: 0.12,
  leaveParallaxLag: 0.05,
};

/**
 * Background-only stage. With no palette it renders the banner's own colours,
 * so an inner page shares exactly the home page's background.
 *
 * `background={false}` 留下一个透明画布，只跑点阵转场 —— 页面自己用 CSS 铺底时
 * 仍然需要这一层，否则切到这条路由时点阵转场会断掉（DESIGN.md 5.3）。
 */
export default function TintedScene({
  palette,
  background = true,
}: { palette?: BackgroundPalette; background?: boolean } = {}) {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);

  return (
    <Canvas dpr={[1, 2]}>
      <SceneCamera ref={cameraRef} makeDefault position={[0, 0, 22]} />
      <RouteTransitionDots overlayColors={OVERLAY_COLORS} overlayPixelSize={4} />
      {background ? (
        <>
          <CameraParallax cameraRef={cameraRef} {...CAMERA_PARALLAX} ready />
          <ProceduralBackground paletteOverride={palette} />
        </>
      ) : null}
    </Canvas>
  );
}
