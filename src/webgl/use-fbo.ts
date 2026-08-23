"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { DepthTexture, FloatType, HalfFloatType, LinearFilter, WebGLRenderTarget } from "three";

type FBOSettings = {
  samples?: number;
  depth?: boolean;
  depthBuffer?: boolean;
  stencilBuffer?: boolean;
};

/** Local stand-in for drei's useFBO. */
export function useFBO(width?: number, height?: number, settings: FBOSettings = {}) {
  const size = useThree((state) => state.size);
  const viewport = useThree((state) => state.viewport);

  const targetWidth = typeof width === "number" ? width : size.width * viewport.dpr;
  const targetHeight = typeof height === "number" ? height : size.height * viewport.dpr;

  const { samples = 0, depth, ...rest } = settings;
  const wantsDepthTexture = depth != null ? depth : settings.depthBuffer;

  const target = useMemo(() => {
    const rt = new WebGLRenderTarget(targetWidth, targetHeight, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      type: HalfFloatType,
      ...rest,
    });
    if (wantsDepthTexture) rt.depthTexture = new DepthTexture(targetWidth, targetHeight, FloatType);
    rt.samples = samples;
    return rt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    target.setSize(targetWidth, targetHeight);
    if (samples) target.samples = samples;
  }, [samples, target, targetWidth, targetHeight]);

  useEffect(() => () => target.dispose(), [target]);

  return target;
}
