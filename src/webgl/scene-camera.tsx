"use client";

import { useThree } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { PerspectiveCamera as PerspectiveCameraImpl } from "three";

type Props = {
  makeDefault?: boolean;
  position?: [number, number, number];
  manual?: boolean;
};

/** Minimal drop-in for drei's <PerspectiveCamera makeDefault>. */
const SceneCamera = forwardRef<PerspectiveCameraImpl | null, Props>(function SceneCamera(
  { makeDefault, position = [0, 0, 0], manual },
  ref,
) {
  const set = useThree(({ set }) => set);
  const defaultCamera = useThree(({ camera }) => camera);
  const size = useThree(({ size }) => size);
  const cameraRef = useRef<PerspectiveCameraImpl>(null!);

  useImperativeHandle(ref, () => cameraRef.current, []);

  useLayoutEffect(() => {
    if (!manual && cameraRef.current) cameraRef.current.aspect = size.width / size.height;
  }, [size, manual]);

  useLayoutEffect(() => {
    cameraRef.current?.updateProjectionMatrix();
  });

  useLayoutEffect(() => {
    if (!makeDefault) return;
    set(() => ({ camera: cameraRef.current }));
    return () => set(() => ({ camera: defaultCamera }));
  }, [makeDefault, set, defaultCamera]);

  return <perspectiveCamera ref={cameraRef} position={position} />;
});

export default SceneCamera;
