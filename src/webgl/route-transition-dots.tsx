"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, Vector2, type ShaderMaterial } from "three";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";

import { useThemeMode } from "@/providers/theme-mode-provider";

const vertexShader = /* glsl */ `
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `;

const fragmentShader = /* glsl */ `
          precision highp float;

          varying vec2 vUv;

          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uPixelSize;
          uniform float uRadiusScale;
          uniform vec2 uResolution;

          void main() {
            float a = clamp(uOpacity, 0.0, 1.0);

            vec2 normalizedPixelSize = vec2(
              uPixelSize / max(uResolution.x, 1.0),
              uPixelSize / max(uResolution.y, 1.0)
            );

            vec2 safePixelSize = max(normalizedPixelSize, vec2(1e-6));
            vec2 cellUV = fract(vUv / safePixelSize);

            // 与 route_transition 点阵一致：透明度直接映射圆半径。
            float radius = uRadiusScale * a;
            float distanceFromCenter = distance(cellUV, vec2(0.5));
            float aa = fwidth(distanceFromCenter) * 1.5;
            float circleMask = smoothstep(radius, radius - aa, distanceFromCenter);

            gl_FragColor = vec4(uColor, circleMask);
            #include <colorspace_fragment>
          }
`;

/** In-scene dot-matrix overlay, kept in sync with the route transition's own dot mask. */
export default function RouteTransitionDots({
  overlayColors = ["#0F1111", "#FBFAF4"],
  overlayPixelSize = 8,
  overlayRadiusScale = 0.9,
}: {
  overlayColors?: [string, string] | string[];
  overlayPixelSize?: number;
  overlayRadiusScale?: number;
}) {
  const { resolvedTheme } = useThemeMode();
  const { size } = useThree();
  const materialRef = useRef<ShaderMaterial | null>(null);
  const [darkColor, lightColor] = overlayColors;

  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color() },
      uOpacity: { value: 0 },
      uPixelSize: { value: overlayPixelSize },
      uRadiusScale: { value: overlayRadiusScale },
      uResolution: { value: new Vector2(size.width, size.height) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    (material.uniforms.uColor.value as Color).set(resolvedTheme === "dark" ? darkColor : lightColor);
  }, [resolvedTheme, darkColor, lightColor]);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    (material.uniforms.uResolution.value as Vector2).set(size.width, size.height);
    material.uniforms.uPixelSize.value = overlayPixelSize;
    material.uniforms.uRadiusScale.value = overlayRadiusScale;
  }, [size.width, size.height, overlayPixelSize, overlayRadiusScale]);

  // Opacity is driven entirely by how far the fullscreen arrow has taken over the screen.
  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    const progress = arrowFullscreenProgressStore.getSnapshot();
    material.uniforms.uOpacity.value = Math.min(1, Math.max(0, progress > 1 ? progress / 100 : progress));
  });

  return (
    <mesh frustumCulled={false} renderOrder={10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}
