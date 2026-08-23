"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  DataTexture,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { usePointer } from "@/providers/pointer-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";
import {
  backgroundOutputFragmentShader,
  backgroundOutputVertexShader,
  backgroundPassVertexShader,
  bokehFragmentShader,
  shatterFragmentShader,
  sineFragmentShader,
  swirlFragmentShader,
  vignetteFragmentShader,
} from "@/webgl/shaders/background";

const LIGHT_BG = "#ffead6";
const LIGHT_VIGNETTE = "#6196ff";
const LIGHT_OUTPUT = "#acffb9";
const DARK_BG = "#2c4bd5";
const DARK_VIGNETTE = "#00000d";
const DARK_OUTPUT = "#00344C";

const THEME_MIX = {
  light: { outputMix: 0.65, edgeIntensity: -0.16 },
  dark: { outputMix: 0.95, edgeIntensity: -0.82 },
};

/**
 * The original site's second screen is not a gradient — it is a flat #FBFAF4
 * (the page's own `--background-deep`), with only the crosshair grid over it.
 * Feeding one colour to every stop collapses the simulation to that flat field,
 * which keeps glass refraction sampling a correct backdrop.
 */
export const FLAT_PAGE_PALETTE = {
  light: { bg: "#fbfaf4", vignette: "#fbfaf4", output: "#fbfaf4" },
  dark: { bg: "#0f1111", vignette: "#0f1111", output: "#0f1111" },
};

export type BackgroundPalette = typeof FLAT_PAGE_PALETTE;

/** Fallback focus point used on touch devices and for the passes that never track the pointer. */
const STATIC_POS = new Vector2(0.5, -0.1);

export const BACKGROUND_CONFIG = {
  resolutionScale: 0.3,
  vignette: { radius: 0.354, falloff: 1, mix: 1, displace: 0, skew: 0.54, angle: 0, edgeIntensity: 0 },
  swirl: { radius: 0.25, angle: 0.1, phase: 0, mix: 0.5, pinch: 0 },
  sine: { mixRadius: 1, frequency: 0.35, amplitude: 1.18, rotation: 0 },
  shatter: { amount: 1, spread: 0.9, angleDeg: -45, skew: 0.9, mixRadius: 1, mixRadiusInvert: 0 },
  bokeh: { radius: 0.754, tilt: 0.5, trackMouse: 0 },
  smoothing: 0.1,
  leaveSmoothing: 0.05,
};

export type BackgroundConfig = typeof BACKGROUND_CONFIG;

const toVec3 = (hex: string) => {
  const color = new Color(hex);
  return new Vector3(color.r, color.g, color.b);
};

const saturate = (value: number) => Math.min(1, Math.max(0, value));

const normalizeProgress = (value: number | undefined) =>
  value === undefined ? 0 : saturate(value > 1 ? value / 100 : value);

/** Simulation cadence drops as the fullscreen arrow takes over the screen. */
const passStride = (progress: number) => {
  const t = normalizeProgress(progress);
  return t > 0.75 ? 4 : t > 0.5 ? 2 : 1;
};

function useBlueNoise(size = 128) {
  const texture = useMemo(() => {
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.floor(255 * Math.random());
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
    const tex = new DataTexture(new Uint8Array(data), size, size, RGBAFormat);
    tex.needsUpdate = true;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    return tex;
  }, [size]);

  const resolution = useMemo(() => new Vector2(size, size), [size]);
  useEffect(() => () => texture.dispose(), [texture]);
  return { texture, resolution };
}

function FullscreenBackgroundMesh({ material }: { material: ShaderMaterial }) {
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function BackgroundSimulation({ ks, paletteOverride }: { ks: BackgroundConfig; paletteOverride?: BackgroundPalette }) {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const { resolvedTheme } = useThemeMode();
  const isMobile = useIsMobileWidth();

  const resolution = useMemo(() => new Vector2(1, 1), []);
  const sharedPos = useMemo(() => new Vector2(0.5, 0.5), []);
  const timeUniform = useMemo(() => ({ value: 0 }), []);
  const { texture: blueNoise, resolution: blueNoiseResolution } = useBlueNoise(128);

  const palette = useMemo(() => {
    const hex =
      paletteOverride?.[resolvedTheme] ??
      (resolvedTheme === "light"
        ? { bg: LIGHT_BG, vignette: LIGHT_VIGNETTE, output: LIGHT_OUTPUT }
        : { bg: DARK_BG, vignette: DARK_VIGNETTE, output: DARK_OUTPUT });
    return {
      hex,
      vec: { bg: toVec3(hex.bg), vignette: toVec3(hex.vignette), output: toVec3(hex.output) },
      mix: paletteOverride ? { ...THEME_MIX[resolvedTheme], outputMix: 0 } : THEME_MIX[resolvedTheme],
    };
  }, [paletteOverride, resolvedTheme]);

  const vec = palette.vec;
  const mix = palette.mix;

  const pipeline = useMemo(() => {
    const makeMaterial = (fragmentShader: string, extra: Record<string, { value: unknown }> = {}) =>
      new ShaderMaterial({
        vertexShader: backgroundPassVertexShader,
        fragmentShader,
        uniforms: {
          tInput: { value: null },
          uResolution: { value: resolution },
          uTime: timeUniform,
          uPos: { value: sharedPos },
          uMousePos: { value: new Vector2(0.5, 0.5) },
          uTrackMouse: { value: 1 },
          ...extra,
        },
        transparent: false,
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });

    const vignetteMaterial = makeMaterial(vignetteFragmentShader, {
      uRadius: { value: ks.vignette.radius },
      uFalloff: { value: ks.vignette.falloff },
      uMix: { value: ks.vignette.mix },
      uDisplace: { value: ks.vignette.displace },
      uSkew: { value: ks.vignette.skew },
      uAngle: { value: ks.vignette.angle },
      uEdgeIntensity: { value: mix.edgeIntensity },
      uVignetteColor: { value: vec.vignette.clone() },
      uColorAlpha: { value: 1 },
      uClearColor: { value: vec.bg.clone() },
      uTrackMouse: { value: 1 },
    });

    const swirlMaterial = makeMaterial(swirlFragmentShader, {
      uRadius: { value: ks.swirl.radius },
      uAngle: { value: ks.swirl.angle },
      uPhase: { value: ks.swirl.phase },
      uMix: { value: ks.swirl.mix },
      uPinch: { value: ks.swirl.pinch },
    });

    const sineMaterial = makeMaterial(sineFragmentShader, {
      uMixRadius: { value: ks.sine.mixRadius },
      uFrequency: { value: ks.sine.frequency },
      uAmplitude: { value: ks.sine.amplitude },
      uRotation: { value: ks.sine.rotation },
    });

    const shatterMaterial = makeMaterial(shatterFragmentShader, {
      uAmount: { value: ks.shatter.amount },
      uSpread: { value: ks.shatter.spread },
      uAngle: { value: ks.shatter.angleDeg / 360 },
      uSkew: { value: ks.shatter.skew },
      uCellScale: { value: 16 },
      uMixRadius: { value: ks.shatter.mixRadius },
      uMixRadiusInvert: { value: ks.shatter.mixRadiusInvert },
      uEasing: { value: 1 },
      uTrackMouse: { value: 0 },
      uPos: { value: new Vector2(0.5, 0.5) },
      uRoundness: { value: 0.02 },
    });

    const bokehMaterial = makeMaterial(bokehFragmentShader, {
      tBlueNoise: { value: blueNoise },
      uBlueNoiseResolution: { value: blueNoiseResolution.clone() },
      uAmount: { value: 3.125 * ks.bokeh.radius },
      uTilt: { value: ks.bokeh.tilt },
      uPos: { value: new Vector2(0.5, 0.5) },
      uTrackMouse: { value: ks.bokeh.trackMouse },
    });

    const outputMaterial = makeMaterial(backgroundOutputFragmentShader, {
      uBgColor: { value: vec.bg.clone() },
      uOutputColor: { value: vec.output.clone() },
      uLoaded: { value: 1 },
      uOutputMix: { value: mix.outputMix },
    });
    outputMaterial.vertexShader = backgroundOutputVertexShader;
    outputMaterial.depthTest = false;
    outputMaterial.depthWrite = false;
    outputMaterial.toneMapped = false;
    outputMaterial.transparent = false;
    outputMaterial.blending = NoBlending;

    const prePasses = [
      { name: "vignette", material: vignetteMaterial },
      { name: "swirl", material: swirlMaterial },
      { name: "sine", material: sineMaterial },
      { name: "shatter", material: shatterMaterial },
      { name: "bokeh", material: bokehMaterial },
    ];

    return {
      prePasses,
      outputMaterial,
      vignetteMaterial,
      shatterMaterial,
      // The shatter pass keeps its own static centre, so it never follows the pointer.
      mouseConsumers: prePasses.filter((pass) => pass.name !== "shatter"),
    };
  }, [ks, resolution, sharedPos, timeUniform, blueNoise, blueNoiseResolution, vec, mix]);

  const targets = useRef({
    read: new WebGLRenderTarget(1, 1, { depthBuffer: false }),
    write: new WebGLRenderTarget(1, 1, { depthBuffer: false }),
  });

  const frameCount = useRef(0);

  useEffect(() => {
    const width = Math.max(1, Math.floor(size.width * ks.resolutionScale));
    const height = Math.max(1, Math.floor(size.height * ks.resolutionScale));
    resolution.set(width, height);

    targets.current.read.dispose();
    targets.current.write.dispose();
    targets.current = {
      read: new WebGLRenderTarget(width, height, { depthBuffer: false }),
      write: new WebGLRenderTarget(width, height, { depthBuffer: false }),
    };

    gl.setRenderTarget(targets.current.read);
    gl.setClearColor(palette.hex.bg, 1);
    gl.clear();
    gl.setRenderTarget(null);

    frameCount.current = 0;
    pipeline.outputMaterial.uniforms.tInput.value = targets.current.read.texture;
  }, [gl, ks.resolutionScale, resolution, size.height, size.width, palette.hex.bg, pipeline]);

  useEffect(
    () => () => {
      targets.current.read.dispose();
      targets.current.write.dispose();
    },
    [],
  );

  const simScene = useMemo(() => new Scene(), []);
  const simCamera = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const simMesh = useRef<Mesh | null>(null);

  useEffect(() => {
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, pipeline.prePasses[0]?.material);
    simScene.add(mesh);
    simMesh.current = mesh;
    return () => {
      simScene.remove(mesh);
      geometry.dispose();
    };
  }, [pipeline, simScene]);

  useEffect(
    () => () => {
      pipeline.prePasses.forEach((pass) => pass.material.dispose());
      pipeline.outputMaterial.dispose();
    },
    [pipeline],
  );

  useEffect(() => {
    const track = Number(!isMobile);
    pipeline.prePasses.forEach((pass) => {
      if (pass.material.uniforms.uTrackMouse) pass.material.uniforms.uTrackMouse.value = track;
    });
    (pipeline.vignetteMaterial.uniforms.uPos.value as Vector2).copy(STATIC_POS);
    (pipeline.shatterMaterial.uniforms.uPos.value as Vector2).copy(STATIC_POS);
    const bokeh = pipeline.prePasses.find((pass) => pass.name === "bokeh");
    if (bokeh?.material.uniforms.uPos) (bokeh.material.uniforms.uPos.value as Vector2).copy(STATIC_POS);
  }, [isMobile, pipeline]);

  const smoothedPointer = useMemo(() => new Vector2(0.5, 0.5), []);
  const pointerTarget = useMemo(() => new Vector2(0.5, 0.5), []);
  const centerPos = useMemo(() => new Vector2(0.5, 0.5), []);
  const rawPointer = useMemo(() => new Vector2(0.5, 0.5), []);
  const pointer = usePointer();

  const bgCurrent = useMemo(() => vec.bg.clone(), [vec]);
  const bgTarget = useMemo(() => vec.bg.clone(), [vec]);
  const vignetteCurrent = useMemo(() => vec.vignette.clone(), [vec]);
  const vignetteTarget = useMemo(() => vec.vignette.clone(), [vec]);
  const outputCurrent = useMemo(() => vec.output.clone(), [vec]);
  const outputTarget = useMemo(() => vec.output.clone(), [vec]);

  useEffect(() => {
    bgTarget.copy(palette.vec.bg);
    vignetteTarget.copy(palette.vec.vignette);
    outputTarget.copy(palette.vec.output);
  }, [palette, bgTarget, vignetteTarget, outputTarget]);

  useFrame((state) => {
    const rt = targets.current;
    const mesh = simMesh.current;
    if (!rt || !mesh) return;

    timeUniform.value = state.clock.getElapsedTime();

    if (isMobile) {
      sharedPos.copy(STATIC_POS);
      pipeline.mouseConsumers.forEach((pass) => {
        if (pass.material.uniforms.uMousePos) (pass.material.uniforms.uMousePos.value as Vector2).copy(STATIC_POS);
      });
      (pipeline.shatterMaterial.uniforms.uPos.value as Vector2).copy(STATIC_POS);
    } else {
      rawPointer.set(saturate(pointer.uv.x), saturate(pointer.uv.y));
      if (pointer.insideRef.current) pointerTarget.copy(rawPointer);
      else pointerTarget.copy(centerPos);
      const lerpFactor = pointer.insideRef.current ? ks.smoothing : ks.leaveSmoothing;
      smoothedPointer.lerp(pointerTarget, lerpFactor);
      sharedPos.copy(smoothedPointer);
      pipeline.mouseConsumers.forEach((pass) => {
        if (pass.material.uniforms.uMousePos)
          (pass.material.uniforms.uMousePos.value as Vector2).copy(smoothedPointer);
      });
      (pipeline.shatterMaterial.uniforms.uPos.value as Vector2).copy(centerPos);
    }

    bgCurrent.lerp(bgTarget, ks.smoothing);
    vignetteCurrent.lerp(vignetteTarget, ks.smoothing);
    outputCurrent.lerp(outputTarget, ks.smoothing);

    (pipeline.vignetteMaterial.uniforms.uVignetteColor.value as Vector3).copy(vignetteCurrent);
    (pipeline.vignetteMaterial.uniforms.uClearColor.value as Vector3).copy(bgCurrent);
    (pipeline.outputMaterial.uniforms.uBgColor.value as Vector3).copy(bgCurrent);
    (pipeline.outputMaterial.uniforms.uOutputColor.value as Vector3).copy(outputCurrent);

    const renderer = state.gl;
    const arrowProgress = normalizeProgress(arrowFullscreenProgressStore.getSnapshot());
    if (arrowProgress >= 0.98) return;

    if (frameCount.current++ % Math.max(passStride(arrowProgress), 2) !== 0) return;

    for (const pass of pipeline.prePasses) {
      if (pass.material.uniforms.tInput) pass.material.uniforms.tInput.value = rt.read.texture;
      mesh.material = pass.material;
      renderer.setRenderTarget(rt.write);
      renderer.render(simScene, simCamera);
      renderer.setRenderTarget(null);
      const previous = rt.read;
      rt.read = rt.write;
      rt.write = previous;
    }
    if (pipeline.outputMaterial.uniforms.tInput) pipeline.outputMaterial.uniforms.tInput.value = rt.read.texture;
  }, -2);

  return <FullscreenBackgroundMesh material={pipeline.outputMaterial} />;
}

export default function ProceduralBackground({ paletteOverride }: { paletteOverride?: BackgroundPalette } = {}) {
  const ks = useMemo(() => BACKGROUND_CONFIG, []);
  return <BackgroundSimulation ks={ks} paletteOverride={paletteOverride} />;
}
