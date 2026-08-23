import { BlendFunction, Effect } from "postprocessing";
import { Color, Uniform } from "three";

const fragmentShader = /* glsl */ `uniform float pixelSize;

uniform float uFeather;
uniform float uAspect;
uniform float uHoleRadius;
uniform float uProgress;
uniform vec3 uOverlayColor;

void dotsMainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 normalizedPixelSize = pixelSize / resolution;
    // 用传入的 inputColor.a 驱动圆点大小：越不透明圆点越大，越透明圆点越小。
    float a = clamp(inputColor.a, 0.0, 1.0);

    vec2 cellUV = fract(uv / normalizedPixelSize);

    // 透明度 -> 圆点半径：a=1 时覆盖整个 cell，避免蒙版填充区漏出底图。
    // sqrt(2)/2 是单位正方形中心到角的距离。
    float radius = 0.8 * a;
    vec2 circleCenter = vec2(0.5, 0.5);

    float distanceFromCenter = distance(cellUV, circleCenter);
    float aa = fwidth(distanceFromCenter) * 1.5;
    float circleMask = smoothstep(radius, radius - aa, distanceFromCenter);

    // 输出为 mask：rgb/alpha 都是 circleMask，供后期用来替换 opacity。
    outputColor = vec4(vec3(circleMask), circleMask);
}

float radialMaskAlpha(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  if (uAspect > 1.0) {
    p.x *= uAspect;
  } else {
    p.y /= max(uAspect, 0.0001);
  }

  float d = length(p);
  float edge = max(uFeather, uHoleRadius * 0.12);

  // 洞内为 0，洞外为 1。
  float alphaHole = smoothstep(uHoleRadius, uHoleRadius + edge, d);

  // 与 radial_mask.frag.glsl 保持一致：末段补满针孔。
  float fillMix = smoothstep(0.92, 1.0, uProgress);
  return mix(alphaHole, 1.0, fillMix);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // 用蒙版 alpha 直接驱动点阵大小（0=最小，1=最大），不再只处理过渡带。
  // 为了让点阵在一个 cell 内保持一致：用 cell 中心点的 alpha 驱动圆点大小。
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 cellId = floor(uv / normalizedPixelSize);
  vec2 uvCellCenter = (cellId + vec2(0.5)) * normalizedPixelSize;
  float cellAlpha = clamp(radialMaskAlpha(uvCellCenter), 0.0, 1.0);

  vec4 dotOut;
  dotsMainImage(vec4(0.0, 0.0, 0.0, cellAlpha), uv, dotOut);
  float dotMask = clamp(dotOut.a, 0.0, 1.0);

  float finalAlpha = dotMask;

  // 直接输出 overlay 颜色（预乘 alpha），避免颜色混合导致点边黑描边。
  vec3 outRgb = uOverlayColor * finalAlpha;
  outputColor = vec4(outRgb, finalAlpha);
}
`;

export type MaskedDotsParams = {
  pixelSize?: number;
  feather?: number;
  aspect?: number;
  holeRadius?: number;
  progress?: number;
  overlayColor?: Color;
};

export class MaskedDotsEffect extends Effect {
  pixelSize: number;
  feather: number;
  aspect: number;
  holeRadius: number;
  progress: number;
  overlayColor: Color;

  private readonly _uPixelSize: Uniform;
  private readonly _uFeather: Uniform;
  private readonly _uAspect: Uniform;
  private readonly _uHoleRadius: Uniform;
  private readonly _uProgress: Uniform;
  private readonly _uOverlayColor: Uniform;
  private _dirty = true;

  constructor({
    pixelSize = 32,
    feather = 0.5,
    aspect = 1,
    holeRadius = 2,
    progress = 0,
    overlayColor = new Color(1, 1, 1),
  }: MaskedDotsParams = {}) {
    const uniforms = new Map<string, Uniform>([
      ["pixelSize", new Uniform(pixelSize)],
      ["uFeather", new Uniform(feather)],
      ["uAspect", new Uniform(aspect)],
      ["uHoleRadius", new Uniform(holeRadius)],
      ["uProgress", new Uniform(progress)],
      ["uOverlayColor", new Uniform(overlayColor.clone())],
    ]);

    super("MaskedDotsEffect", fragmentShader, { uniforms, blendFunction: BlendFunction.SRC });

    this.pixelSize = pixelSize;
    this.feather = feather;
    this.aspect = aspect;
    this.holeRadius = holeRadius;
    this.progress = progress;
    this.overlayColor = overlayColor.clone();

    this._uPixelSize = uniforms.get("pixelSize")!;
    this._uFeather = uniforms.get("uFeather")!;
    this._uAspect = uniforms.get("uAspect")!;
    this._uHoleRadius = uniforms.get("uHoleRadius")!;
    this._uProgress = uniforms.get("uProgress")!;
    this._uOverlayColor = uniforms.get("uOverlayColor")!;
  }

  setParams(params: MaskedDotsParams) {
    let dirty = false;
    const assign = <K extends "pixelSize" | "feather" | "aspect" | "holeRadius" | "progress">(key: K) => {
      const value = params[key];
      if (typeof value === "number" && value !== this[key]) {
        this[key] = value;
        dirty = true;
      }
    };
    assign("pixelSize");
    assign("feather");
    assign("aspect");
    assign("holeRadius");
    assign("progress");
    if (params.overlayColor && !this.overlayColor.equals(params.overlayColor)) {
      this.overlayColor.copy(params.overlayColor);
      dirty = true;
    }
    if (dirty) this._dirty = true;
  }

  update() {
    if (!this._dirty) return;
    this._dirty = false;
    this._uPixelSize.value = this.pixelSize;
    this._uFeather.value = this.feather;
    this._uAspect.value = this.aspect;
    this._uHoleRadius.value = this.holeRadius;
    this._uProgress.value = this.progress;
    (this._uOverlayColor.value as Color).copy(this.overlayColor);
  }
}
