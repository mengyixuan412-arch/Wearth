"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  Mesh,
  ShaderMaterial,
  Vector3,
  FrontSide,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";
import { scrollEnv } from "@/lib/scroll-env";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { usePointer } from "@/providers/pointer-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";
import { resolveGlassControls, useGlassSystem } from "@/webgl/glass-stage";
import { createLightTracker } from "@/webgl/light-tracker";
import { arrowFullscreenFragmentShader, arrowFullscreenVertexShader } from "@/webgl/shaders/arrow-fullscreen";

const ACCENT_COLOR = "#009dff";
const STRIPE_COLOR_A = "#009dff";
const STRIPE_COLOR_B = "#64c3ff";
const DEFAULT_AXIS_TILT: [number, number, number] = [0, 0, 45];

type Rect = { left: number; top: number; width: number; height: number; right: number; bottom: number };

function centerGeometry(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const x = (box.min.x + box.max.x) / 2;
  const y = (box.min.y + box.max.y) / 2;
  const z = (box.min.z + box.max.z) / 2;
  if (Math.abs(x) + Math.abs(y) + Math.abs(z) < 1e-8) return;
  geometry.translate(-x, -y, -z);
  geometry.computeBoundingSphere();
}

export type ArrowFullscreenProps = {
  model?: string;
  targetRef: React.RefObject<HTMLElement | null>;
  getTargetRect: () => Rect | null;
  refMarginPx?: number;
  accentColor?: string;
  stripeColorA?: string;
  stripeColorB?: string;
  restScale?: number;
  scaleSmoothing?: number;
  maxScale?: number;
  autoPeakPadding?: number;
  modelPosition?: [number, number, number];
  rotationAxisTilt?: [number, number, number];
  scaleSpinDegrees?: number;
};

function ArrowFullscreenImpl({
  model = "model/cursor.glb",
  targetRef,
  getTargetRect,
  refMarginPx = 120,
  accentColor = ACCENT_COLOR,
  stripeColorA = STRIPE_COLOR_A,
  stripeColorB = STRIPE_COLOR_B,
  restScale = 0.1,
  scaleSmoothing = 32,
  maxScale,
  autoPeakPadding = 1.64,
  modelPosition = [0, 0, 0],
  rotationAxisTilt = DEFAULT_AXIS_TILT,
  scaleSpinDegrees = 360,
}: ArrowFullscreenProps) {
  const gltf = useLoader(GLTFLoader, model);

  const geometry = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const parts: BufferGeometry[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        const clone = (child.geometry as BufferGeometry).clone();
        clone.applyMatrix4(child.matrixWorld);
        parts.push(clone);
      }
    });
    if (parts.length === 0) return null;
    try {
      const merged = mergeGeometries(parts, true);
      centerGeometry(merged);
      return merged;
    } catch {
      const first = parts[0];
      centerGeometry(first);
      return first;
    }
  }, [gltf]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const rootRef = useRef<Group | null>(null);
  const spinRef = useRef<Group | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);

  const { size, gl, camera } = useThree();
  const { uv, insideRef } = usePointer();
  const { resolvedTheme } = useThemeMode();
  const { controls } = useGlassSystem();
  const resolved = useMemo(() => resolveGlassControls(controls, resolvedTheme), [controls, resolvedTheme]);
  const isMobile = useIsMobileWidth();
  const lightTracker = useMemo(() => createLightTracker(), []);
  const scratch = useMemo(() => new Vector3(), []);

  const scaleRef = useRef(restScale);
  const scaleSeededRef = useRef(false);
  const rectRef = useRef<Rect | null>(null);
  const canvasBoxRef = useRef<{ cssH: number; topY: number; bottomY: number } | null>(null);
  const lastScrollRef = useRef({ top: 0, left: 0 });
  const frameRef = useRef(0);
  const layoutKeyRef = useRef("");

  // Any viewport change invalidates the cached canvas box and DOM rect.
  useEffect(() => {
    const invalidate = () => {
      rectRef.current = null;
      canvasBoxRef.current = null;
      layoutKeyRef.current = "";
    };
    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", invalidate);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(invalidate);
      observer.observe(gl.domElement);
      const parent = gl.domElement.parentElement;
      if (parent) observer.observe(parent);
    }

    return () => {
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      vv?.removeEventListener("resize", invalidate);
      observer?.disconnect();
    };
  }, [gl]);

  const bounds = useMemo(() => {
    if (!geometry) return null;
    geometry.computeBoundingSphere();
    return { radius: Math.max(geometry.boundingSphere?.radius ?? 1, 1e-4) };
  }, [geometry]);

  const toRad = useCallback((deg: number) => MathUtils.degToRad(deg), []);
  const radTilt = useMemo(
    () => [toRad(rotationAxisTilt[0]), toRad(rotationAxisTilt[1]), toRad(rotationAxisTilt[2])] as const,
    [rotationAxisTilt, toRad],
  );
  const radUntilt = useMemo(() => [-radTilt[0], -radTilt[1], -radTilt[2]] as const, [radTilt]);
  const spinRadians = useMemo(() => MathUtils.degToRad(scaleSpinDegrees), [scaleSpinDegrees]);

  const uniforms = useMemo(
    () => ({
      iResolution: { value: new Vector3(1, 1, 1) },
      iTime: { value: 0 },
      uScrollDuration: { value: 2 },
      uOpacity: { value: 1 },
      uAccentColor: { value: new Color(ACCENT_COLOR) },
      uStripeColorA: { value: new Color(STRIPE_COLOR_A) },
      uStripeColorB: { value: new Color(STRIPE_COLOR_B) },
      uStripeReveal: { value: 0 },
      uLight: { value: new Vector3(4, 9, 0.5) },
      uShininess: { value: 40 },
      uDiffuseness: { value: 0.1 },
      uSpecularStrength: { value: 1.2 },
      uFresnelPower: { value: 6 },
      uFresnelStrength: { value: 1 },
      uFresnelSideDir: { value: new Vector3(-1, 0.3, 1) },
    }),
    [],
  );

  useLayoutEffect(() => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    u.uDiffuseness.value = resolved.diffuseness;
    u.uShininess.value = resolved.shininess;
    u.uFresnelPower.value = resolved.fresnelPower;
    u.uSpecularStrength.value = resolved.specularStrength;
    u.uFresnelStrength.value = resolved.fresnelStrength;
    (u.uFresnelSideDir.value as Vector3).set(...resolved.fresnelSideDir);
  }, [resolved]);

  useEffect(() => {
    const u = materialRef.current?.uniforms;
    if (!u) return;
    (u.uAccentColor.value as Color).set(accentColor);
    (u.uStripeColorA.value as Color).set(stripeColorA);
    (u.uStripeColorB.value as Color).set(stripeColorB);
  }, [accentColor, stripeColorA, stripeColorB]);

  useEffect(() => () => arrowFullscreenProgressStore.reset(), []);

  useFrame((state, delta) => {
    const root = rootRef.current;
    const mesh = meshRef.current;
    const u = materialRef.current?.uniforms;
    if (!root || !mesh || !bounds || !u) return;

    const [posX, posY, posZ] = modelPosition;
    const pixelRatio = Math.max(1, gl.getPixelRatio());
    const canvasRect = gl.domElement.getBoundingClientRect();
    const vv = window.visualViewport ?? null;

    const layoutKey = [
      Math.round(canvasRect.top),
      Math.round(canvasRect.left),
      Math.round(canvasRect.width),
      Math.round(canvasRect.height),
      pixelRatio,
      Math.round(size.width),
      Math.round(size.height),
      vv ? Math.round(100 * vv.height) / 100 : -1,
      vv ? Math.round(100 * vv.offsetTop) / 100 : -1,
      vv ? Math.round(1000 * vv.scale) / 1000 : -1,
    ].join("|");

    if (layoutKey !== layoutKeyRef.current) {
      layoutKeyRef.current = layoutKey;
      canvasBoxRef.current = null;
      rectRef.current = null;
    }

    if (!canvasBoxRef.current) {
      const box = gl.domElement.getBoundingClientRect();
      const cssH = Math.max(1, box.height > 0 ? box.height : size.height);
      const topY = box.height > 0 ? box.top : 0;
      const bottomY = box.height > 0 ? box.bottom : topY + cssH;
      canvasBoxRef.current = { cssH, topY, bottomY };
    }

    const { cssH, topY, bottomY } = canvasBoxRef.current;
    const cssW = Math.max(1, size.width);
    const targetEl = targetRef.current;
    const scrollTop = scrollEnv.getScrollTopPx();
    const scrollLeft = scrollEnv.getScrollLeftPx();

    let rect: Rect | null = null;
    if (targetEl) {
      const frame = frameRef.current++;
      if (rectRef.current && frame % 12 !== 0) {
        const deltaTop = scrollTop - lastScrollRef.current.top;
        const deltaLeft = scrollLeft - lastScrollRef.current.left;
        lastScrollRef.current.top = scrollTop;
        lastScrollRef.current.left = scrollLeft;
        if (deltaTop !== 0 || deltaLeft !== 0) {
          const cached = rectRef.current;
          cached.top -= deltaTop;
          cached.bottom -= deltaTop;
          cached.left -= deltaLeft;
          cached.right -= deltaLeft;
        }
      } else {
        const measured = targetEl.getBoundingClientRect();
        rectRef.current = {
          left: measured.left,
          top: measured.top,
          width: measured.width,
          height: measured.height,
          right: measured.right,
          bottom: measured.bottom,
        };
        lastScrollRef.current = { top: scrollTop, left: scrollLeft };
      }
      rect = rectRef.current;
    } else {
      rectRef.current = null;
      rect = getTargetRect();
    }

    if (!targetEl || !rect || rect.width <= 0 || rect.height <= 0) {
      root.visible = false;
      arrowFullscreenProgressStore.reset();
      return;
    }

    const enterMargin = Math.max(2 * refMarginPx, 480);
    const anchorY = topY + 0.5 * cssH;
    const viewport = state.viewport.getCurrentViewport(camera, scratch.set(posX, posY, posZ));

    // Once the section's top passes the anchor the arrow shrinks back to its rest size.
    const shrinkStart = anchorY + refMarginPx - rect.height;
    const shrinkEnd = Math.min(bottomY, shrinkStart + Math.max(1, cssH));
    const shrinkT =
      rect.top <= shrinkStart ? 1 : rect.top >= shrinkEnd ? 0 : 1 - MathUtils.smoothstep(rect.top, shrinkStart, shrinkEnd);
    const beforeShrink = rect.top > shrinkEnd;
    const shrinking = rect.top <= shrinkEnd && rect.top > shrinkStart;

    const restRadiusPx = Math.min(
      0.35 * cssH,
      ((bounds.radius * restScale * cssH) / Math.max(viewport.height, 1e-4)) * 0.45,
    );
    const passedAbove = rect.bottom < -restRadiusPx;
    const visible = rect.top < bottomY + enterMargin && rect.bottom > -(6 * refMarginPx) && !passedAbove;

    root.visible = visible;
    if (!visible) {
      arrowFullscreenProgressStore.reset();
      return;
    }

    const cssHeight = Math.max(1, size.height);
    (u.iResolution.value as Vector3).set(cssW * pixelRatio, cssHeight * pixelRatio, 1);
    u.iTime.value = 2 * MathUtils.clamp((bottomY - rect.top) / Math.max(1, bottomY + rect.height), 0, 1);

    const growth = MathUtils.smoothstep(
      MathUtils.clamp((anchorY - (rect.top + refMarginPx)) / Math.max(1, cssH), 0, 1),
      0,
      1,
    );

    const rectTopAnchored = rect.top + refMarginPx;
    const rectBottomAnchored = rect.bottom - refMarginPx;
    const anchoredY = beforeShrink
      ? Math.max(anchorY, rectTopAnchored)
      : shrinking
        ? anchorY
        : Math.min(anchorY, rectBottomAnchored);
    const normalizedY = (anchoredY - topY) / cssH;
    root.position.set(posX, (0.5 - normalizedY) * viewport.height + posY, posZ);

    const autoPeak = (Math.hypot(viewport.width, viewport.height) * autoPeakPadding) / bounds.radius;
    const peakScale = maxScale ?? autoPeak;
    const grownScale = MathUtils.lerp(restScale, peakScale, growth);
    const desiredScale = beforeShrink
      ? grownScale
      : shrinking
        ? MathUtils.lerp(grownScale, restScale, shrinkT)
        : restScale;

    let scale: number;
    if (scaleSmoothing <= 0) {
      scale = desiredScale;
      scaleRef.current = desiredScale;
    } else if (scaleSeededRef.current) {
      scaleRef.current = MathUtils.damp(scaleRef.current, desiredScale, scaleSmoothing, delta);
      scale = scaleRef.current;
    } else {
      scaleSeededRef.current = true;
      scale = desiredScale;
      scaleRef.current = desiredScale;
    }
    mesh.scale.setScalar(scale);

    const scaleSpan = Math.max(peakScale - restScale, 1e-6);
    const reveal = MathUtils.clamp((scale - restScale) / scaleSpan, 0, 1);
    u.uStripeReveal.value = reveal;
    arrowFullscreenProgressStore.setDampedScaleT(reveal);

    let spin = 0;
    if (shrinking) spin = spinRadians + MathUtils.clamp((shrinkT - 0.6) / 0.4, 0, 1) * spinRadians;
    else if (beforeShrink) spin = MathUtils.clamp(reveal / 0.4, 0, 1) * spinRadians;

    const spinGroup = spinRef.current;
    if (spinGroup) {
      spinGroup.rotation.x = 0;
      spinGroup.rotation.y = spin;
      spinGroup.rotation.z = 0;
    }

    const { x: lightX, y: lightY } = lightTracker.update({
      uv,
      inside: insideRef.current && !isMobile,
      camera,
      delta,
    });
    (u.uLight.value as Vector3).set(lightX, lightY, controls.lightZ);
  }, -2);

  if (!geometry) return null;

  return (
    <group ref={rootRef} visible={false}>
      <group rotation={radTilt as unknown as [number, number, number]}>
        <group ref={spinRef}>
          <group rotation={radUntilt as unknown as [number, number, number]}>
            <mesh
              ref={meshRef}
              geometry={geometry}
              renderOrder={12}
              frustumCulled={false}
              scale={[restScale, restScale, restScale]}
            >
              <shaderMaterial
                ref={materialRef}
                vertexShader={arrowFullscreenVertexShader}
                fragmentShader={arrowFullscreenFragmentShader}
                uniforms={uniforms}
                transparent
                depthWrite={false}
                depthTest
                toneMapped={false}
                side={FrontSide}
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function ArrowFullscreen(props: ArrowFullscreenProps) {
  return (
    <Suspense fallback={null}>
      <ArrowFullscreenImpl {...props} />
    </Suspense>
  );
}
