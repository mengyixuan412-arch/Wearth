"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, PerspectiveCamera, Vector2, Vector3 } from "three";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";
import { customCubic } from "@/lib/easing";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { usePointer } from "@/providers/pointer-provider";

/** Camera distance range — the far end is reached once the arrow fills the screen. */
const DESKTOP_DISTANCE = { min: 24, max: 32 };
const MOBILE_DISTANCE = { min: 24, max: 32 };

const DESKTOP_BASE_FOV = 60;
const MOBILE_BASE_FOV = 38;

export type CameraParallaxProps = {
  cameraRef: React.RefObject<PerspectiveCamera | null>;
  parallaxEnabled: boolean;
  parallaxStrength: number;
  parallaxLag: number;
  parallaxRotate: number;
  leaveParallaxLag: number;
  ready: boolean;
};

export default function CameraParallax({
  cameraRef,
  parallaxEnabled,
  parallaxStrength,
  parallaxLag,
  parallaxRotate,
  leaveParallaxLag,
  ready,
}: CameraParallaxProps) {
  const { size } = useThree();
  const { uv, insideRef } = usePointer();
  const isMobile = useIsMobileWidth();

  const basePosition = useRef<Vector2 | null>(null);
  const offset = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());
  const desiredOffset = useMemo(() => new Vector3(), []);
  const desiredLook = useMemo(() => new Vector3(), []);
  const origin = useMemo(() => new Vector3(), []);
  const distance = useRef(DESKTOP_DISTANCE.min);
  const entryProgress = useRef(0);

  const range = useMemo(() => (size.width >= 1024 ? DESKTOP_DISTANCE : MOBILE_DISTANCE), [size.width]);
  const baseFov = useMemo(() => (size.width >= 1024 ? DESKTOP_BASE_FOV : MOBILE_BASE_FOV), [size.width]);

  useEffect(() => {
    const progress = MathUtils.clamp(arrowFullscreenProgressStore.getSnapshot(), 0, 1);
    distance.current = MathUtils.lerp(range.min, range.max, progress);
  }, [range]);

  // A fixed horizontal FOV: the visible world width stays constant across aspect ratios.
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const aspect = size.width / size.height;
    const fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(baseFov) / 2) / aspect));
    if (Math.abs(camera.fov - fov) > 1e-4 || Math.abs(camera.aspect - aspect) > 1e-6) {
      camera.fov = fov;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  }, [size, baseFov, cameraRef]);

  useFrame((_state, delta) => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (!basePosition.current) basePosition.current = new Vector2(camera.position.x, camera.position.y);

    const arrowProgress = MathUtils.clamp(arrowFullscreenProgressStore.getSnapshot(), 0, 1);
    distance.current = MathUtils.lerp(range.min, range.max, arrowProgress);

    // Entry dolly: start 8 units further back and ease in over 1.2s once the scene is ready.
    entryProgress.current = ready ? Math.min(entryProgress.current + delta / 1.2, 1) : 0;
    camera.position.z = MathUtils.lerp(distance.current + 8, distance.current, customCubic(entryProgress.current));

    if (parallaxEnabled && basePosition.current && !isMobile) {
      const x = (0.5 - uv.x) * 2;
      const y = (0.5 - uv.y) * 2;
      desiredOffset.set(x * parallaxStrength, y * parallaxStrength * 0.6, 0);
      desiredLook.set(-desiredOffset.x * parallaxRotate, -desiredOffset.y * parallaxRotate, 0);

      const lag = insideRef.current ? parallaxLag : leaveParallaxLag;
      offset.current.lerp(desiredOffset, lag);
      lookTarget.current.lerp(desiredLook, lag);

      camera.position.x = basePosition.current.x + offset.current.x;
      camera.position.y = basePosition.current.y + offset.current.y;
      camera.lookAt(lookTarget.current);
    } else if (basePosition.current) {
      offset.current.lerp(origin, parallaxLag);
      lookTarget.current.lerp(origin, parallaxLag);
      camera.position.x = basePosition.current.x;
      camera.position.y = basePosition.current.y;
      camera.lookAt(0, 0, 0);
    }
  }, -2);

  return null;
}
