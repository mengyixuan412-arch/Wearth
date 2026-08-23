"use client";

import { useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { sectionMetrics } from "@/lib/section-metrics";
import type { SectionRect } from "@/lib/use-section-rects";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { usePointer } from "@/providers/pointer-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";
import { createLightTracker } from "@/webgl/light-tracker";
import { resolveGlassControls, useGlassSystem } from "@/webgl/glass-stage";
import { dispersionFragmentShader, dispersionVertexShader } from "@/webgl/shaders/dispersion";

const DRACO_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

const configureLoader = (loader: GLTFLoader) => {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  loader.setDRACOLoader(draco);
};

/** Re-centres a geometry on its own bounding-box centre. */
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

/** Parses `#rrggbbaa` / `#rgba` / `rgba(...)` into a colour plus a separate alpha. */
function parseColorWithAlpha(input: string) {
  const color = new Color(input);
  let alpha = 1;
  const trimmed = input.trim();

  if (trimmed.startsWith("#")) {
    if (trimmed.length === 9) alpha = parseInt(trimmed.slice(7, 9), 16) / 255;
    else if (trimmed.length === 5) {
      const nibble = trimmed.slice(4, 5);
      alpha = parseInt(nibble + nibble, 16) / 255;
    }
  } else {
    const match = trimmed.match(/^rgba?\(([^)]+)\)$/i);
    if (match) {
      const parts = match[1].split(",").map((part) => part.trim());
      if (parts.length === 4) {
        const value = parseFloat(parts[3]);
        if (!Number.isNaN(value)) alpha = Math.min(Math.max(value, 0), 1);
      }
    }
  }

  return { color, alpha };
}

const createDispersionUniforms = () => ({
  uTexture: { value: null as unknown },
  uIorR: { value: 1.15 },
  uIorY: { value: 1.16 },
  uIorG: { value: 1.18 },
  uIorC: { value: 1.22 },
  uIorB: { value: 1.22 },
  uIorP: { value: 1.22 },
  uRefractPower: { value: 0.24 },
  uChromaticAberration: { value: 0.24 },
  uSaturation: { value: 1 },
  uShininess: { value: 40 },
  uDiffuseness: { value: 0.1 },
  uFresnelPower: { value: 6 },
  uBrightness: { value: 1 },
  uContrast: { value: 1 },
  uGamma: { value: 1 },
  uSpecularStrength: { value: 1.2 },
  uFresnelStrength: { value: 1 },
  uFresnelSideDir: { value: new Vector3(-1, 0.3, 1) },
  uTintColorA: { value: new Vector4(1, 1, 1, 1) },
  uTintColorB: { value: new Vector4(1, 1, 1, 1) },
  uTintLocalYRange: { value: new Vector2(0, 1) },
  uTintEnabled: { value: 0 },
  uTintMix: { value: 0.8 },
  uTintThicknessMinAlpha: { value: 0.35 },
  uTintThicknessMaxAlpha: { value: 1 },
  uDark: { value: 0 },
  uLoop: { value: 6 },
  uSceneRefractionEnabled: { value: 1 },
  uRgbRefraction: { value: 0 },
  uLight: { value: new Vector3(4, 9, 0.5) },
  uScreenResolutionPx: { value: new Vector2() },
});

/** Gentle idle bob, disabled on touch devices. */
const floatOffset = (enabled: boolean, time: number) =>
  enabled ? 0.18 * Math.sin(1.2 * time) + 0.06 * Math.sin(0.6 * time) : 0;

export type GlassModelProps = {
  model: string;
  modelPosition?: [number, number, number];
  rotationAxisTilt?: [number, number, number];
  rotation?: [number, number, number];
  beforeRotation?: [number, number, number];
  afterRotation?: [number, number, number];
  scale?: number;
  floatingMotion?: boolean;
  onReady?: () => void;
  tintEnabled?: boolean;
  scrollSyncFactor?: number;
  sectionPosition: SectionRect[];
  sectionName?: string;
  tingColor?: string[];
};

export default function GlassModel({
  model,
  modelPosition = [0, 0, 0],
  rotationAxisTilt = [0, 0, 0],
  rotation = [0, 0, 0],
  beforeRotation,
  afterRotation,
  scale = 1,
  floatingMotion = true,
  onReady,
  tintEnabled = false,
  scrollSyncFactor = 1,
  sectionPosition,
  sectionName = "footer",
  tingColor,
}: GlassModelProps) {
  const { resolvedTheme } = useThemeMode();
  const { controls, envMapBase, screenResolutionPx, glassLayer, sceneRefractionActiveRef } = useGlassSystem();
  const resolved = useMemo(() => resolveGlassControls(controls, resolvedTheme), [controls, resolvedTheme]);

  const tint = useMemo(() => {
    const dark = resolvedTheme === "dark";
    const a = resolved.tintColorA;
    const b = resolved.tintColorB;
    if (!tingColor) return { tintColorA: a, tintColorB: b };
    return {
      tintColorA: dark ? tingColor[2] || a : tingColor[0] || a,
      tintColorB: dark ? tingColor[3] || b : tingColor[1] || b,
    };
  }, [resolvedTheme, resolved.tintColorA, resolved.tintColorB, tingColor]);

  const lightZ = controls.lightZ;
  const { uv, insideRef } = usePointer();

  const meshRef = useRef<Mesh | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const rootRef = useRef<Group | null>(null);
  const spinRef = useRef<Group | null>(null);
  const visibleRef = useRef<boolean | null>(null);
  const readyFiredRef = useRef(false);
  const readyFramesRef = useRef(0);

  const isMobile = useIsMobileWidth();
  const lightTracker = useMemo(() => createLightTracker(), []);
  const scratch = useMemo(() => new Vector3(), []);
  const floating = floatingMotion && !isMobile;

  const section = useMemo(() => sectionMetrics.findSection(sectionPosition, sectionName), [sectionPosition, sectionName]);

  const entryRotation = beforeRotation ?? rotation;
  const toRad = useCallback((deg: number) => MathUtils.degToRad(deg), []);
  const radEntry = useMemo(
    () => [toRad(entryRotation[0]), toRad(entryRotation[1]), toRad(entryRotation[2])] as const,
    [entryRotation, toRad],
  );
  const radRest = useMemo(() => [toRad(rotation[0]), toRad(rotation[1]), toRad(rotation[2])] as const, [rotation, toRad]);
  const radAfter = useMemo(
    () => (afterRotation ? ([toRad(afterRotation[0]), toRad(afterRotation[1]), toRad(afterRotation[2])] as const) : null),
    [afterRotation, toRad],
  );
  const radTilt = useMemo(
    () => [toRad(rotationAxisTilt[0]), toRad(rotationAxisTilt[1]), toRad(rotationAxisTilt[2])] as const,
    [rotationAxisTilt, toRad],
  );
  const radUntilt = useMemo(() => [-radTilt[0], -radTilt[1], -radTilt[2]] as const, [radTilt]);

  const gltf = useLoader(GLTFLoader, model, configureLoader);

  const geometry = useMemo(() => {
    if (!gltf) return null;
    gltf.scene.updateMatrixWorld(true);
    const geometries: BufferGeometry[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof Mesh && child.geometry) {
        const clone = (child.geometry as BufferGeometry).clone();
        clone.applyMatrix4(child.matrixWorld);
        geometries.push(clone);
      }
    });
    if (geometries.length === 0) return null;
    try {
      const merged = mergeGeometries(geometries, true);
      centerGeometry(merged);
      return merged;
    } catch {
      const first = geometries[0];
      centerGeometry(first);
      return first;
    }
  }, [gltf]);

  const localYRange = useMemo<[number, number]>(() => {
    if (!geometry) return [0, 1];
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return [0, 1];
    const min = box.min.y;
    const max = box.max.y;
    return Math.abs(max - min) < 1e-6 ? [min, min + 1] : [min, max];
  }, [geometry]);

  const uniforms = useMemo(() => createDispersionUniforms(), []);

  useEffect(() => {
    meshRef.current?.layers.set(glassLayer);
  }, [geometry, glassLayer]);

  useLayoutEffect(() => {
    const u = materialRef.current?.uniforms;
    if (!u) return;

    u.uTexture.value = envMapBase;
    u.uRefractPower.value = resolved.refractPower;
    u.uChromaticAberration.value = resolved.chromaticAberration;
    u.uDiffuseness.value = resolved.diffuseness;
    u.uShininess.value = resolved.shininess;
    u.uFresnelPower.value = resolved.fresnelPower;
    u.uSaturation.value = resolved.saturation;
    u.uBrightness.value = resolved.brightness;
    u.uContrast.value = resolved.contrast;
    u.uGamma.value = resolved.gamma;
    u.uSpecularStrength.value = resolved.specularStrength;
    u.uFresnelStrength.value = resolved.fresnelStrength;
    (u.uFresnelSideDir.value as Vector3).set(...resolved.fresnelSideDir);
    u.uTintMix.value = resolved.tintMix;

    // Mobile drops to at most two refraction iterations and the cheaper RGB path.
    const loop = isMobile ? Math.min(resolved.loop, 2) : resolved.loop;
    u.uLoop.value = loop;
    u.uRgbRefraction.value = Number(loop <= 3);

    const a = parseColorWithAlpha(tint.tintColorA);
    const b = parseColorWithAlpha(tint.tintColorB);
    (u.uTintColorA.value as Vector4).set(a.color.r, a.color.g, a.color.b, a.alpha);
    (u.uTintColorB.value as Vector4).set(b.color.r, b.color.g, b.color.b, b.alpha);
    (u.uTintLocalYRange.value as Vector2).set(localYRange[0], localYRange[1]);
    u.uTintThicknessMinAlpha.value = resolved.tintThicknessMinAlpha;
    u.uTintThicknessMaxAlpha.value = resolved.tintThicknessMaxAlpha;
    u.uTintEnabled.value = Number(!!tintEnabled);
    u.uDark.value = Number(resolvedTheme === "dark");
  }, [resolved, tint, tintEnabled, envMapBase, resolvedTheme, localYRange, isMobile]);

  useEffect(() => {
    const u = materialRef.current?.uniforms;
    if (u) (u.uScreenResolutionPx.value as Vector2).set(screenResolutionPx.x, screenResolutionPx.y);
  }, [screenResolutionPx]);

  const isVisible = useCallback(() => {
    if (!section) return sectionName === "banner";
    return sectionMetrics.isSectionInViewport(
      section,
      sectionMetrics.getScrollTopPx(),
      sectionMetrics.getViewportHeightPx(),
    );
  }, [section, sectionName]);

  /** `entry` ramps 0→1 as the section scrolls in; `after` continues 0→1 once it is fully past. */
  const rotationPhases = useCallback(() => {
    if (!section) return { entry: 1, after: Number(!!afterRotation) };
    const viewportHeight = sectionMetrics.getViewportHeightPx();
    const scrollTop = sectionMetrics.getScrollTopPx();
    if (viewportHeight <= 0) return { entry: 1, after: Number(!!afterRotation) };
    const bottom = scrollTop + viewportHeight;
    const { topDocY } = sectionMetrics.readSectionContentLayout(section);
    const t = (bottom - topDocY) / (bottom - scrollTop);
    return { entry: MathUtils.clamp(t, 0, 1), after: MathUtils.clamp(t - 1, 0, 1) };
  }, [afterRotation, section]);

  useFrame(() => {
    const u = materialRef.current?.uniforms;
    if (u) u.uSceneRefractionEnabled.value = Number(!!sceneRefractionActiveRef.current);
  }, 0);

  useFrame((state, delta) => {
    const { camera } = state;
    const visible = isVisible();

    if (rootRef.current && visibleRef.current !== visible) {
      visibleRef.current = visible;
      rootRef.current.visible = visible;
    }

    if (onReady && !readyFiredRef.current) {
      readyFramesRef.current += 1;
      if (readyFramesRef.current >= 5) {
        readyFiredRef.current = true;
        onReady();
      }
    }

    if (!visible) return;

    if (rootRef.current && section) {
      const z = modelPosition[2];
      const viewportWorldHeight = state.viewport.getCurrentViewport(camera, scratch.set(0, 0, z)).height;
      const worldY = sectionMetrics.scrollSyncedWorldYFromAnchorDocY({
        anchorDocY: sectionMetrics.getSectionContentCenterDocY(section),
        scrollTopPx: sectionMetrics.getScrollTopPx(),
        viewportHeightPx: sectionMetrics.getViewportHeightPx(),
        viewportWorldHeight,
        scrollSyncFactor,
      });
      const bob = floating ? floatOffset(true, state.clock.getElapsedTime()) : 0;
      rootRef.current.position.y = worldY + modelPosition[1] + bob;
    }

    if (spinRef.current) {
      const { entry, after } = rotationPhases();
      let x = MathUtils.lerp(radEntry[0], radRest[0], entry);
      let y = MathUtils.lerp(radEntry[1], radRest[1], entry);
      let z = MathUtils.lerp(radEntry[2], radRest[2], entry);
      if (radAfter) {
        x = MathUtils.lerp(x, radAfter[0], after);
        y = MathUtils.lerp(y, radAfter[1], after);
        z = MathUtils.lerp(z, radAfter[2], after);
      }
      spinRef.current.rotation.x = MathUtils.damp(spinRef.current.rotation.x, x, 6, delta);
      spinRef.current.rotation.y = MathUtils.damp(spinRef.current.rotation.y, y, 6, delta);
      spinRef.current.rotation.z = MathUtils.damp(spinRef.current.rotation.z, z, 6, delta);
    }

    const { x: lightX, y: lightY } = lightTracker.update({
      uv,
      inside: insideRef.current && !isMobile,
      camera,
      delta,
    });
    const u = materialRef.current?.uniforms;
    if (u) (u.uLight.value as Vector3).set(lightX, lightY, lightZ);
  }, -2);

  if (!geometry) return null;

  return (
    <group ref={rootRef} visible={false} position={modelPosition}>
      <group rotation={radTilt as unknown as [number, number, number]}>
        <group ref={spinRef} rotation={radEntry as unknown as [number, number, number]}>
          <group rotation={radUntilt as unknown as [number, number, number]}>
            <mesh ref={meshRef} geometry={geometry} scale={[scale, scale, scale]}>
              <shaderMaterial
                ref={materialRef}
                vertexShader={dispersionVertexShader}
                fragmentShader={dispersionFragmentShader}
                uniforms={uniforms}
                toneMapped={false}
                transparent
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
