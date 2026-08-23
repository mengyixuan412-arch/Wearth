export const radialMaskVertexShader = /* glsl */ `varying vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const radialMaskFragmentShader = /* glsl */ `precision highp float;

uniform vec3 uColor;
uniform float uFeather;
uniform float uAspect;
uniform float uHoleRadius;
uniform float uProgress;

varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  if (uAspect > 1.0) {
    p.x *= uAspect;
  } else {
    p.y /= max(uAspect, 0.0001);
  }

  float d = length(p);

  float edge = max(uFeather, uHoleRadius * 0.12);

  // 洞内为 0，洞外为 1。
  float alphaHole = smoothstep(uHoleRadius, uHoleRadius + edge, d);

  // 只在动画结束前一小段把"针孔"补满，让洞像是彻底消失。
  float fillMix = smoothstep(0.92, 1.0, uProgress);
  float alpha = mix(alphaHole, 1.0, fillMix);
  // 预乘 alpha，避免透明像素携带 rgb 导致后期采样出现黑边/暗圈。
  gl_FragColor = vec4(uColor * alpha, alpha);
  #include <colorspace_fragment>
}
`;
