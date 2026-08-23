export const domImagePlaneVertexShader = /* glsl */ `varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const domImagePlaneFragmentShader = /* glsl */ `uniform float uCurlStrength;

vec2 applyCurl(vec2 screenUv) {
  float centered = 2.0 * screenUv.y - 1.0;
  float profile = 1.0 - sqrt(max(0.0, 1.0 - centered * centered));
  float uvScale = 1.0 - profile * uCurlStrength;
  float distortedX = (screenUv.x - 0.5) * uvScale + 0.5;
  return vec2(distortedX, screenUv.y);
}

uniform sampler2D map;
uniform sampler2D mapHover;
uniform vec4 uRect;
uniform float uPolarityPositive;
uniform float uLayerOpacity;
uniform float uRevealProgress;
uniform float uRevealSoftness;
uniform float uRevealDirection;
uniform float uHoverRevealProgress;
uniform float uDotPixelSize;
uniform vec2 uViewportPx;
varying vec2 vUv;

vec3 applyPolarity(vec3 rgb) {
  float t = clamp(uPolarityPositive, 0.0, 1.0);
  return mix(1.0 - rgb, rgb, t);
}

float hoverDotCoverage(vec2 screenUv) {
  float hoverProgress = clamp(uHoverRevealProgress, 0.0, 1.0);
  if (hoverProgress <= 0.0) return 0.0;

  vec2 viewportPx = max(uViewportPx, vec2(1.0));
  float dotPx = max(2.0, uDotPixelSize);
  vec2 cellSizeUv = vec2(dotPx) / viewportPx;
  vec2 safeCellSize = max(cellSizeUv, vec2(1.0 / 4096.0));

  float rectWidthPx = max(uRect.z * uViewportPx.x, 1.0);
  float rectHeightPx = max(uRect.w * uViewportPx.y, 1.0);
  float rectAspect = max(rectWidthPx / rectHeightPx, 1e-5);
  vec2 localUv = (screenUv - uRect.xy) / uRect.zw;
  vec2 centered = localUv * 2.0 - 1.0;
  centered.x *= rectAspect;
  float distToCenter = length(centered);

  float maxRadius = sqrt(1.0 + rectAspect * rectAspect);
  // 拉长中心向外的过渡环宽度，让 hover 扩散更柔和，不会出现短促硬边
  float revealBand = max(length(safeCellSize) * 18.0, 0.08);
  float revealRadius = hoverProgress * (maxRadius + revealBand);
  float grow = clamp((revealRadius - distToCenter) / revealBand, 0.0, 1.0);
  grow = smoothstep(0.0, 1.0, grow);

  vec2 cellUv = fract(screenUv / safeCellSize);
  vec2 cellFromCenter = abs(cellUv - vec2(0.5));
  float squareExtent = mix(0.0, 0.5, grow);
  float squareDist = max(cellFromCenter.x, cellFromCenter.y);
  float squareAa = max(fwidth(squareDist), 0.0001) * 1.5;
  if (squareExtent <= squareAa) {
    return 0.0;
  }
  if (grow >= 0.999) {
    return 1.0;
  }
  float squareMask = 1.0 - smoothstep(
    squareExtent - squareAa,
    squareExtent + squareAa,
    squareDist
  );

  return squareMask;
}

/** hover 未生效时 0；此时跳过 mapHover 采样省一半 tex2D（mip-0 路径下分支安全） */
vec4 sampleSourceRgba(vec2 localUv, float hoverCoverage) {
  vec2 lu = clamp(localUv, 0.0, 1.0);
  vec4 baseColor = texture2D(map, lu);
  if (hoverCoverage < 0.001) return baseColor;
  vec4 hoverColor = texture2D(mapHover, lu);
  return mix(baseColor, hoverColor, clamp(hoverCoverage, 0.0, 1.0));
}

/** 边缘 AA；aaRef = fwidth(localUv)，下限避免除零 */
float edgeAaMask(vec2 uv, vec2 aaRef) {
  vec2 edgeDist = min(uv, 1.0 - uv);
  float xClip = smoothstep(0.0, aaRef.x, edgeDist.x);
  float yClip = smoothstep(0.0, aaRef.y, edgeDist.y);
  return xClip * yClip;
}

void main() {
  vec2 distortedScreenUv = applyCurl(vUv);
  vec2 revealLocalUv = (vUv - uRect.xy) / uRect.zw;
  vec2 localUv = (distortedScreenUv - uRect.xy) / uRect.zw;

  vec2 aa = max(fwidth(localUv), vec2(1e-5));

  float revealProgress = clamp(uRevealProgress, 0.0, 1.0);
  float revealMask = 1.0;
  if (revealProgress <= 0.001) {
    revealMask = 0.0;
  } else if (revealProgress < 0.999) {
    float revealCoord = uRevealDirection < 0.0 ? 1.0 - revealLocalUv.x : revealLocalUv.x;
    float revealFeather = max(uRevealSoftness, 0.0);
    revealMask = revealFeather <= 0.0
      ? step(revealCoord, revealProgress)
      : 1.0 - smoothstep(
          revealProgress - revealFeather,
          revealProgress + revealFeather,
          revealCoord
        );
  }

  float hoverCov = hoverDotCoverage(vUv);
  vec4 sourceColor = sampleSourceRgba(localUv, hoverCov);
  float inside = edgeAaMask(localUv, aa);
  float outA = sourceColor.a * inside * revealMask * clamp(uLayerOpacity, 0.0, 1.0);
  if (outA < 0.001) {
    discard;
  }

  vec3 sourcePolar = applyPolarity(sourceColor.rgb);
  gl_FragColor = vec4(sourcePolar, outA);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
