export const fullscreenVertexShader = /* glsl */ `varying vec2 vUv;void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}`;

export const lensFlareFragmentShader = /* glsl */ `uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uEnabled;
uniform float uIntensity;
uniform float uThreshold;
uniform float uStreakScale;
uniform float uHotspotPower;
uniform float uGate;
uniform float uStarRays;

uniform vec3 uTailColor;

const float TAIL_MIX = 1.0;
const float TAIL_START = 0.0;
const float TAIL_FALLOFF = 0.5;

varying vec2 vUv;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float brightMask(float lum) {
  // 适配 LDR/sRGB：阈值一般在 0.8~0.95
  float x = max(lum - uThreshold, 0.0);
  float m = x / max(1.0 - uThreshold, 1e-5);
  // smoothstep(0,1,m) 的多项式形式（避免多余 clamp；smoothstep 本身会夹紧）
  m = clamp(m, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  float hp = max(uHotspotPower, 1.0);
  if (hp > 1.01) {
    m = pow(m, hp);
  }

  // 线性软门控：减少断裂感且便宜
  float gate = clamp(uGate, 0.0, 1.0);
  float gm = (m - gate) / max(1.0 - gate, 1e-5);
  gm = clamp(gm, 0.0, 1.0);
  return m * gm;
}

vec3 sampleBright(vec2 uv) {
  vec3 c = texture2D(tDiffuse, uv).rgb;
  return c * brightMask(luma(c));
}

vec3 streak(vec2 dirPx) {
  vec3 acc = vec3(0.0);
  // 固定 8 次采样：用“半步相位”打散离散采样间隙（更像连续直线），且不引入 sin/exp
  vec2 pixel = floor(vUv * uResolution);
  float h = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
  float phase = step(0.5, h) * 0.5; // 0 或 0.5（半步）
  for (int i = 1; i <= 8; i++) {
    float fi = float(i);
    // 增加步长以维持拖尾长度 (原 1 -> 1.5)
    float dist = fi * 1.5 + phase;
    // 放缓衰减：视觉上更“长”，同时保持成本低
    float w = 1.0 / (1.0 + dist * 0.22);
    w *= w;

    // 末端颜色：中心偏白，越靠近末端越靠近 uTailColor
    float t = clamp(dist / 8.0, 0.0, 1.0);
    float start = clamp(TAIL_START, 0.0, 0.95);
    float tt = clamp((t - start) / max(1.0 - start, 1e-5), 0.0, 1.0);
    tt = pow(tt, max(TAIL_FALLOFF, 0.001));
    vec3 ramp = mix(vec3(1.0), uTailColor, clamp(TAIL_MIX, 0.0, 1.0) * tt);

    vec2 o = dirPx * dist;
    acc += sampleBright(vUv + o) * (w * ramp);
    acc += sampleBright(vUv - o) * (w * ramp);
  }
  return acc;
}

void main() {
  vec3 flare = vec3(0.0);
  if (uEnabled >= 0.5 && uIntensity > 0.0001) {
    vec3 base = texture2D(tDiffuse, vUv).rgb;
    vec2 px = (1.0 / max(uResolution, vec2(1.0))) * uStreakScale;

    // 中心热点（让亮点像“星芒”有核心）
    flare += base * brightMask(luma(base)) * 1.2;
    // 4/6/8 芒：每条 streak 是“一条线”（包含正反两个方向）
    // 4 芒：0° + 90°（十字）
    // 6 芒：0° + (+60°) + (-60°)（三条线）
    // 8 芒：0° + 90° + (+45°) + (-45°)
    if (uStarRays >= 7.5) {
      // 8 rays
      flare += streak(vec2(px.x, 0.0));
      flare += streak(vec2(0.0, px.y));
      const float c45 = 0.70710678;
      flare += streak(vec2(px.x * c45, px.y * c45));
      flare += streak(vec2(px.x * c45, -px.y * c45));
    } else if (uStarRays >= 5.5) {
      // 6 rays（整体旋转 30°，保证有一根竖线）：90° + (+30°) + (-30°)
      flare += streak(vec2(0.0, px.y));
      const float c30 = 0.8660254;
      const float s30 = 0.5;
      flare += streak(vec2(px.x * c30, px.y * s30));
      flare += streak(vec2(px.x * c30, -px.y * s30));
    } else {
      // 4 rays
      flare += streak(vec2(px.x, 0.0));
      flare += streak(vec2(0.0, px.y));
    }

    // 保持核心尽量中性（末端颜色由 streak 内的 ramp 控制）
  }

  flare *= (uIntensity * 0.75);
  gl_FragColor = vec4(flare, 1.0);
  #include <colorspace_fragment>
}`;

export const lensFlareCompositeFragmentShader = /* glsl */ `uniform sampler2D tBase;
uniform sampler2D tFlare;

varying vec2 vUv;

void main() {
  vec3 base = texture2D(tBase, vUv).rgb;
  vec3 flare = texture2D(tFlare, vUv).rgb;

  gl_FragColor = vec4(base + flare, 1.0);
  #include <colorspace_fragment>
}
`;
