"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector2,
  Vector4,
  type WebGLRenderer,
} from "three";

import { easeInOutCubic } from "@/lib/easing";
import { scrollEnv } from "@/lib/scroll-env";
import { useIsMobileWidth } from "@/lib/viewport-store";
import type { TargetRect } from "@/webgl/dom-layer-rect-tracker";
import { domImagePlaneFragmentShader, domImagePlaneVertexShader } from "@/webgl/shaders/dom-image-plane";

const HOVER_DURATION_S = 0.42;
const POLARITY_DURATION_S = 0.8;

function configureTexture(texture: Texture, gl: WebGLRenderer, isMobile: boolean, hasHover: boolean) {
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  if (hasHover) {
    // The hover shader branches on mip level 0 only, so mipmaps would be wasted work.
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
  } else {
    texture.minFilter = LinearMipmapLinearFilter;
  }
  texture.magFilter = LinearFilter;
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy?.() ?? 1;
  texture.anisotropy = isMobile ? Math.min(4, maxAnisotropy) : Math.min(8, maxAnisotropy);
}

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

/** Smoothed scroll speed, mapped to the sideways "page curl" distortion. */
function useCurlStrength() {
  const lastScroll = useRef<number | null>(null);
  const smoothed = useRef(0);

  return useMemo(
    () => (delta: number) => {
      const dt = Math.max(1 / 240, Math.min(delta, 0.1));
      const scrollTop = scrollEnv.getScrollTopPx();
      const previous = lastScroll.current;
      lastScroll.current = scrollTop;
      const speed = previous == null ? 0 : Math.abs(scrollTop - previous) / dt;
      const target = MathUtils.clamp(speed / 800, 0, 1);
      const current = smoothed.current;
      // Attack fast, release slow.
      const tau = Math.max(target > current ? 0.025 : 0.175, 1e-4);
      const alpha = 1 - Math.exp(-dt / tau);
      const next = current + (target - current) * alpha;
      smoothed.current = next;
      return 0.06 * next;
    },
    [],
  );
}

/** Tracks hover on the DOM element that this plane is painted over. */
function useDomHover(enabled: boolean, targetRef: React.RefObject<HTMLElement | null>) {
  const hoveredRef = useRef(false);

  useLayoutEffect(() => {
    if (!enabled) {
      hoveredRef.current = false;
      return;
    }

    let disposed = false;
    let retryTimer = 0;
    let boundElement: HTMLElement | null = null;
    let unbind: (() => void) | null = null;
    let attempts = 0;

    const bind = () => {
      if (disposed) return;
      const el = targetRef.current?.parentElement;
      if (!el) {
        if (attempts++ < 120) retryTimer = window.setTimeout(bind, 50);
        return;
      }
      if (boundElement === el && unbind) return;
      unbind?.();
      boundElement = el;

      let stopTracking: (() => void) | null = null;
      const clearTracking = () => {
        stopTracking?.();
        stopTracking = null;
      };

      const onEnter = () => {
        hoveredRef.current = true;
        clearTracking();
      };

      const onLeave = (event: PointerEvent) => {
        // A mouse "leave" fired while still inside the box means an overlay stole the
        // event — keep the hover alive and watch pointermove until it really exits.
        if (event.pointerType === "mouse") {
          const rect = el.getBoundingClientRect();
          const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
          if (inside) {
            if (stopTracking) return;
            const onMove = (moveEvent: PointerEvent) => {
              if (moveEvent.pointerType !== "mouse") return;
              const bounds = el.getBoundingClientRect();
              const stillInside =
                moveEvent.clientX >= bounds.left &&
                moveEvent.clientX <= bounds.right &&
                moveEvent.clientY >= bounds.top &&
                moveEvent.clientY <= bounds.bottom;
              if (!stillInside) {
                hoveredRef.current = false;
                clearTracking();
              }
            };
            window.addEventListener("pointermove", onMove, { passive: true });
            stopTracking = () => window.removeEventListener("pointermove", onMove);
            return;
          }
        }
        hoveredRef.current = false;
      };

      const onFocusIn = () => {
        hoveredRef.current = true;
      };
      const onFocusOut = (event: FocusEvent) => {
        if (!el.contains(event.relatedTarget as Node)) hoveredRef.current = false;
      };

      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("focusin", onFocusIn);
      el.addEventListener("focusout", onFocusOut);

      unbind = () => {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("focusin", onFocusIn);
        el.removeEventListener("focusout", onFocusOut);
        clearTracking();
        unbind = null;
        boundElement = null;
      };
    };

    const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(() => bind()) : null;
    observer?.observe(document.body, { childList: true, subtree: true });
    bind();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      observer?.disconnect();
      unbind?.();
      hoveredRef.current = false;
    };
  }, [enabled, targetRef]);

  return hoveredRef;
}

export type DomImagePlaneProps = {
  ready?: boolean;
  imageUrl: string;
  hoverImageUrl?: string;
  targetRef: React.RefObject<HTMLElement | null>;
  layerKey: string;
  getTargetRect: (key: string) => TargetRect | null;
  onTextureReady?: () => void;
};

export default function DomImagePlane({
  ready = true,
  imageUrl,
  hoverImageUrl,
  targetRef,
  layerKey,
  getTargetRect,
  onTextureReady,
}: DomImagePlaneProps) {
  const meshRef = useRef<Mesh | null>(null);
  const onTextureReadyRef = useRef(onTextureReady);
  onTextureReadyRef.current = onTextureReady;

  const hasHover = !!hoverImageUrl;
  const hoveredRef = useDomHover(hasHover, targetRef);
  const hoverReadyRef = useRef(false);
  const hoverProgressRef = useRef(0);
  const polarityRef = useRef(0);

  const isMobile = useIsMobileWidth();
  const reducedMotion = usePrefersReducedMotion();
  const curlStrength = useCurlStrength();

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          map: { value: null },
          mapHover: { value: null },
          uRect: { value: new Vector4(0, 0, 1, 1) },
          uCurlStrength: { value: 0 },
          uPolarityPositive: { value: 0 },
          uLayerOpacity: { value: 1 },
          uRevealProgress: { value: 1 },
          uRevealSoftness: { value: 0 },
          uRevealDirection: { value: 1 },
          uHoverRevealProgress: { value: 0 },
          uDotPixelSize: { value: 18 },
          uViewportPx: { value: new Vector2(1, 1) },
        },
        vertexShader: domImagePlaneVertexShader,
        fragmentShader: domImagePlaneFragmentShader,
        transparent: true,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        alphaToCoverage: false,
      }),
    [],
  );

  const { size, gl } = useThree();
  const geometry = useMemo(() => new PlaneGeometry(2, 2), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const [baseTexture, hoverTexture] = useLoader(TextureLoader, [imageUrl, hoverImageUrl ?? imageUrl]);

  useEffect(() => {
    if (!baseTexture) return;
    configureTexture(baseTexture, gl, isMobile, hasHover);
    if (hoverTexture) configureTexture(hoverTexture, gl, isMobile, hasHover);

    material.uniforms.map.value = baseTexture;
    material.uniforms.uLayerOpacity.value = 1;
    material.uniforms.uRevealProgress.value = 1;
    material.uniforms.uRevealSoftness.value = 0;
    material.uniforms.uRevealDirection.value = 1;
    material.uniforms.mapHover.value = hoverTexture ?? baseTexture;
    material.uniforms.uHoverRevealProgress.value = 0;

    hoverProgressRef.current = 0;
    hoverReadyRef.current = !!hoverTexture || !hoverImageUrl;
    onTextureReadyRef.current?.();
  }, [baseTexture, hoverTexture, hasHover, hoverImageUrl, isMobile, gl, material]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_state, delta) => {
    const hide = () => {
      if (meshRef.current) meshRef.current.visible = false;
      polarityRef.current = 0;
      material.uniforms.uPolarityPositive.value = 0;
    };

    const rect = getTargetRect(layerKey);
    const hasTexture = !!material.uniforms.map.value;
    const viewportHeight = Math.max(1, size.height);
    const viewportWidth = Math.max(1, size.width);

    if (!ready || !hasTexture || !rect) return hide();
    if (rect.width <= 0 || rect.height <= 0) return hide();

    const margin = 0.25 * viewportHeight;
    const nearViewport = rect.bottom > -margin && rect.top < viewportHeight + margin;
    const farAway = rect.bottom < -(2 * viewportHeight) || rect.top > 3 * viewportHeight;
    if (!nearViewport || farAway) return hide();

    const step = Math.min(delta, 0.1) / HOVER_DURATION_S;
    const wantHover = hoverImageUrl != null && hoveredRef.current && hoverReadyRef.current ? 1 : 0;
    let hoverProgress = hoverProgressRef.current;
    if (wantHover) {
      hoverProgress = Math.min(1, hoverProgress + step);
      if (hoverProgress > 0.999) hoverProgress = 1;
    } else {
      hoverProgress = Math.max(0, hoverProgress - step);
      if (hoverProgress < 0.001) hoverProgress = 0;
    }
    hoverProgressRef.current = hoverProgress;

    if (meshRef.current) meshRef.current.visible = true;

    const curl = curlStrength(delta);

    material.uniforms.uLayerOpacity.value = 1;
    material.uniforms.uHoverRevealProgress.value = hasHover
      ? 0.5 - 0.5 * Math.cos(Math.PI * MathUtils.clamp(hoverProgress, 0, 1))
      : 0;
    (material.uniforms.uViewportPx.value as Vector2).set(viewportWidth, viewportHeight);

    // Polarity ramps 0 -> 1 (inverted -> normal) once the layer is actually on screen.
    const offScreen =
      rect.right <= 0 || rect.left >= viewportWidth || rect.bottom <= 0 || rect.top >= viewportHeight;
    let polarity: number;
    if (offScreen) {
      polarityRef.current = 0;
      polarity = 0;
    } else if (reducedMotion) {
      polarityRef.current = 1;
      polarity = 1;
    } else {
      polarityRef.current = Math.min(1, polarityRef.current + delta / POLARITY_DURATION_S);
      polarity = easeInOutCubic(polarityRef.current);
    }

    (material.uniforms.uRect.value as Vector4).set(
      rect.left / viewportWidth,
      1 - (rect.top + rect.height) / viewportHeight,
      rect.width / viewportWidth,
      rect.height / viewportHeight,
    );
    material.uniforms.uCurlStrength.value = curl;
    material.uniforms.uPolarityPositive.value = polarity;
  });

  return <mesh ref={meshRef} geometry={geometry} renderOrder={20} frustumCulled={false} material={material} />;
}
