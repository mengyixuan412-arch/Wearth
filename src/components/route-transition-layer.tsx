"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { Color, MathUtils, UnsignedByteType, type ShaderMaterial } from "three";

import { customCubic } from "@/lib/easing";
import { MaskedDotsEffect } from "@/webgl/masked-dots-effect";
import { radialMaskFragmentShader, radialMaskVertexShader } from "@/webgl/shaders/radial-mask";
import {
  useFullscreenTransitionController,
  useRouteTransitionController,
} from "@/providers/fullscreen-transition-provider";
import { useShellMedia } from "@/providers/shell-media-provider";
import { useThemeMode } from "@/providers/theme-mode-provider";

type MaskMaterialRef = React.RefObject<ShaderMaterial | null>;

function TransitionCanvas({
  children,
  ...rest
}: {
  children: (api: { maskMaterialRef: MaskMaterialRef }) => React.ReactNode;
}) {
  const maskMaterialRef = useRef<ShaderMaterial | null>(null);
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      className="z-30 fixed inset-0 pointer-events-none"
      {...rest}
    >
      {children({ maskMaterialRef })}
    </Canvas>
  );
}

/** [dark, light] — matches the `--background-elevated` token in each theme. */
const OVERLAY_COLORS = ["#191b1b", "#efede7"] as const;

function RadialMask({
  open,
  duration,
  initialProgress,
  resetKey,
  onComplete,
  materialRef,
}: {
  open: boolean;
  duration: number;
  initialProgress?: number;
  resetKey: string;
  onComplete?: (open: boolean) => void;
  materialRef?: MaskMaterialRef;
}) {
  const { resolvedTheme } = useThemeMode();
  const { size } = useThree();
  const invalidate = useThree((state) => state.invalidate);
  const fallbackRef = useRef<ShaderMaterial | null>(null);
  const ref = materialRef ?? fallbackRef;

  const [darkColor, lightColor] = OVERLAY_COLORS;
  const overlayColor = resolvedTheme === "dark" ? darkColor : lightColor;

  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color() },
      uFeather: { value: 0.8 },
      uAspect: { value: 1 },
      uHoleRadius: { value: 2 },
      uProgress: { value: 0 },
    }),
    [],
  );

  // Radius that still covers the viewport corners at any aspect ratio.
  const maxRadius = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const longest = Math.max(aspect, 1 / aspect);
    return Math.sqrt(longest * longest + 1);
  }, [size.width, size.height]);

  useEffect(() => {
    invalidate();
  }, [overlayColor, invalidate]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  }, [size.width, size.height, ref]);

  const progressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(0);
  const completedRef = useRef(false);
  const seededRef = useRef(false);

  useLayoutEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (typeof initialProgress !== "number") return;
    const seed = MathUtils.clamp(initialProgress, 0, 1);
    progressRef.current = seed;
    fromRef.current = seed;
    const radius = MathUtils.lerp(maxRadius, 0, seed);
    if (ref.current) {
      ref.current.uniforms.uHoleRadius.value = radius;
      ref.current.uniforms.uProgress.value = seed;
    }
  }, [initialProgress, maxRadius, ref]);

  useLayoutEffect(() => {
    fromRef.current = progressRef.current;
    toRef.current = open ? 1 : 0;
    startTimeRef.current = null;
    completedRef.current = false;
    invalidate();
  }, [open, resetKey, invalidate]);

  useFrame((state) => {
    const now = state.clock.getElapsedTime();
    if (startTimeRef.current === null) startTimeRef.current = now;
    const elapsed = now - startTimeRef.current;
    const t = MathUtils.clamp(elapsed / Math.max(1e-6, duration), 0, 1);
    const eased = customCubic(t);

    progressRef.current = MathUtils.lerp(fromRef.current, toRef.current, eased);
    const radius = MathUtils.lerp(maxRadius, 0, progressRef.current);

    if (ref.current) {
      ref.current.uniforms.uHoleRadius.value = radius;
      ref.current.uniforms.uProgress.value = progressRef.current;
      (ref.current.uniforms.uColor.value as Color).set(overlayColor);
    }

    if (!completedRef.current && t >= 1 - 1e-6) {
      completedRef.current = true;
      onComplete?.(open);
    }
    if (!completedRef.current && t < 1 - 1e-6) state.invalidate();
  });

  return (
    <mesh renderOrder={2000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={ref}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={radialMaskVertexShader}
        fragmentShader={radialMaskFragmentShader}
      />
    </mesh>
  );
}

function MaskedDotsPass({ maskMaterialRef, pixelSize }: { maskMaterialRef: MaskMaterialRef; pixelSize: number }) {
  const effect = useMemo(() => new MaskedDotsEffect(), []);
  const dpr = useThree((state) => state.viewport.dpr);

  useEffect(() => () => effect.dispose(), [effect]);

  useFrame(() => {
    const material = maskMaterialRef.current;
    if (!material) return;
    effect.setParams({
      pixelSize: pixelSize * dpr,
      feather: material.uniforms.uFeather.value,
      aspect: material.uniforms.uAspect.value,
      holeRadius: material.uniforms.uHoleRadius.value,
      progress: material.uniforms.uProgress.value,
      overlayColor: material.uniforms.uColor.value as Color,
    });
  }, 1);

  return (
    <EffectComposer multisampling={0} autoClear renderPriority={999} frameBufferType={UnsignedByteType}>
      <primitive object={effect} />
    </EffectComposer>
  );
}

type RouteConfig = { entryLoading: { enabled: boolean }; routeLoading: { enabled: boolean } };

const DEFAULT_ROUTE_CONFIG: RouteConfig = { entryLoading: { enabled: false }, routeLoading: { enabled: false } };
// No route reports heavy-asset progress yet, so the loading gate stays off.
const ROUTE_CONFIG: Record<string, RouteConfig> = {};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const routeConfigFor = (pathname: string): RouteConfig => {
  const config = ROUTE_CONFIG[pathname];
  if (!config) return DEFAULT_ROUTE_CONFIG;
  return {
    entryLoading: { enabled: config.entryLoading?.enabled ?? DEFAULT_ROUTE_CONFIG.entryLoading.enabled },
    routeLoading: { enabled: config.routeLoading?.enabled ?? DEFAULT_ROUTE_CONFIG.routeLoading.enabled },
  };
};

function LoadingBar({ progress, fading }: { progress: number; fading: boolean }) {
  const width = clamp(progress, 0, 100);
  return (
    <div
      className={`left-1/2 top-1/2 z-40 fixed flex h-4 w-[140px] -translate-x-1/2 -translate-y-1/2 items-center justify-center pointer-events-none ${fading ? "opacity-0" : "opacity-100"}`}
      style={{ transition: "opacity 250ms cubic-bezier(0.25, 1, 0.5, 1)" }}
      aria-hidden="true"
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-l3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-l1"
          style={{ width: `${width}%`, transition: "width 520ms cubic-bezier(0.22, 1, 0.36, 1)", willChange: "width" }}
        />
      </div>
    </div>
  );
}

type TransitionState =
  | { mode: "entry"; phase: "wait" | "reveal" }
  | { mode: "route"; phase: "cover" | "wait" | "reveal" }
  | { mode: "idle"; phase?: undefined };

type LayerState = { transition: TransitionState; shouldRenderCanvas: boolean };

type LayerAction =
  | { type: "transition"; transition: TransitionState }
  | { type: "canvas/set"; value: boolean }
  | { type: "canvas/ensure" };

function reducer(state: LayerState, action: LayerAction): LayerState {
  switch (action.type) {
    case "transition":
      return { ...state, transition: action.transition };
    case "canvas/set":
      return { ...state, shouldRenderCanvas: action.value };
    case "canvas/ensure":
      return state.shouldRenderCanvas ? state : { ...state, shouldRenderCanvas: true };
    default:
      return state;
  }
}

const hrefToPathname = (href: string | null) => {
  if (!href) return null;
  if (href.startsWith("/")) {
    const [path] = href.split("?");
    return path || "/";
  }
  try {
    return new URL(href, window.location.origin).pathname || "/";
  } catch {
    return null;
  }
};

export default function RouteTransitionLayer() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    targetHref,
    navigationReplace,
    clearNavigation,
    readyToLoadHeavy,
    heavyLoadProgress,
    setAllowScrambleLines,
  } = useRouteTransitionController();
  const { menuOpen } = useFullscreenTransitionController();
  const { fontsReady } = useShellMedia();

  const routeRef = useRef<{ routeFromPath: string | null; coverDone: boolean }>({
    routeFromPath: null,
    coverDone: false,
  });

  const [{ transition, shouldRenderCanvas }, dispatch] = useReducer(reducer, {
    transition: { mode: "entry", phase: "wait" },
    shouldRenderCanvas: true,
  });

  const currentConfig = useMemo(() => routeConfigFor(pathname), [pathname]);
  const targetPath = useMemo(() => hrefToPathname(targetHref), [targetHref]);
  const targetConfig = useMemo(
    () => (targetPath ? routeConfigFor(targetPath) : currentConfig),
    [targetPath, currentConfig],
  );

  const [fading, setFading] = useState(false);
  const [barDone, setBarDone] = useState(false);

  const rawProgress = clamp(heavyLoadProgress, 0, 100);
  // Fonts account for the first half of the bar, the heavy payload for the second.
  const progress = useMemo(
    () => (currentConfig.entryLoading.enabled ? clamp(50 * Number(!!fontsReady) + (rawProgress / 100) * 50, 0, 100) : rawProgress),
    [currentConfig.entryLoading.enabled, fontsReady, rawProgress],
  );

  const showBar =
    transition.mode === "entry" &&
    currentConfig.entryLoading.enabled &&
    (transition.phase === "wait" || transition.phase === "reveal") &&
    !barDone;

  const stateKey = transition.mode === "idle" ? "idle" : `${transition.mode}:${transition.phase}`;
  const resetKey = `${stateKey}:${targetHref ?? ""}:${menuOpen ? "1" : "0"}`;

  useEffect(() => {
    if (targetHref && transition.mode === "idle") {
      routeRef.current.routeFromPath = pathname;
      routeRef.current.coverDone = false;
      dispatch({ type: "transition", transition: { mode: "route", phase: "cover" } });
    }
  }, [targetHref, transition.mode, pathname]);

  useEffect(() => {
    if (transition.mode !== "entry" || transition.phase !== "wait") return;
    if (!currentConfig.entryLoading.enabled || (readyToLoadHeavy && fontsReady)) {
      dispatch({ type: "transition", transition: { mode: "entry", phase: "reveal" } });
    }
  }, [transition, readyToLoadHeavy, fontsReady, currentConfig]);

  useEffect(() => {
    if (transition.mode !== "route" || transition.phase !== "wait") return;
    if (!routeRef.current.coverDone || !routeRef.current.routeFromPath) return;
    if (pathname === routeRef.current.routeFromPath) return;
    if (!targetConfig.routeLoading.enabled || (readyToLoadHeavy && fontsReady)) {
      dispatch({ type: "transition", transition: { mode: "route", phase: "reveal" } });
    }
  }, [transition, readyToLoadHeavy, fontsReady, pathname, targetConfig]);

  useEffect(() => {
    if (!showBar || fading || progress < 100) return;
    let inner: number | undefined;
    const timer = window.setTimeout(() => {
      setFading(true);
      inner = window.setTimeout(() => setBarDone(true), 250);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      if (inner) window.clearTimeout(inner);
    };
  }, [progress, showBar, fading]);

  const open = transition.mode === "idle" ? menuOpen : transition.phase !== "reveal";
  const initialProgress = transition.mode === "entry" && transition.phase === "wait" ? 1 : undefined;

  const shouldHandleComplete =
    (transition.mode === "route" && transition.phase === "cover") ||
    (transition.mode === "entry" && transition.phase === "reveal") ||
    (transition.mode === "route" && transition.phase === "reveal") ||
    transition.mode === "idle";

  const onComplete = shouldHandleComplete
    ? (isOpen: boolean) => {
        if (isOpen && transition.mode === "route" && transition.phase === "cover") {
          routeRef.current.coverDone = true;
          if (targetHref) {
            setAllowScrambleLines(false);
            if (navigationReplace) router.replace(targetHref);
            else router.push(targetHref);
            dispatch({ type: "transition", transition: { mode: "route", phase: "wait" } });
          }
        }
        if (!isOpen && transition.mode !== "idle" && transition.phase === "reveal") {
          dispatch({ type: "transition", transition: { mode: "idle" } });
          clearNavigation();
          routeRef.current.routeFromPath = null;
          routeRef.current.coverDone = false;
          if (!menuOpen) dispatch({ type: "canvas/set", value: false });
        }
        if (!isOpen && transition.mode === "idle" && !menuOpen) {
          dispatch({ type: "canvas/set", value: false });
        }
      }
    : undefined;

  useEffect(() => {
    if (menuOpen || transition.mode !== "idle") dispatch({ type: "canvas/ensure" });
  }, [menuOpen, transition.mode]);

  useEffect(() => {
    if (transition.mode === "idle") {
      setAllowScrambleLines(true);
      return;
    }
    if (transition.phase !== "reveal") return;
    const timer = window.setTimeout(() => setAllowScrambleLines(true), 100);
    return () => window.clearTimeout(timer);
  }, [transition, setAllowScrambleLines]);

  const renderCanvas = shouldRenderCanvas || transition.mode !== "idle" || menuOpen;

  return (
    <>
      {renderCanvas && (
        <TransitionCanvas>
          {({ maskMaterialRef }) => (
            <>
              <RadialMask
                open={open}
                duration={0.8}
                initialProgress={initialProgress}
                resetKey={resetKey}
                onComplete={onComplete}
                materialRef={maskMaterialRef}
              />
              <MaskedDotsPass maskMaterialRef={maskMaterialRef} pixelSize={16} />
            </>
          )}
        </TransitionCanvas>
      )}
      {showBar && <LoadingBar progress={progress} fading={fading} />}
    </>
  );
}
