import { Pass } from "postprocessing";
import {
  Color,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import {
  fullscreenVertexShader,
  lensFlareCompositeFragmentShader,
  lensFlareFragmentShader,
} from "@/webgl/shaders/lens-flare";

export type LensFlareParams = {
  starRays: number;
  intensity: number;
  threshold: number;
  streakScale: number;
  hotspotPower: number;
  gate: number;
  tailColor: string;
};

type Options = LensFlareParams & {
  flareDownsample?: number;
  flareStride?: number;
};

/**
 * Anamorphic star-burst pass: bright pixels are extracted into a half-res buffer,
 * streaked along 4/6/8 axes, then added back over the base image.
 */
export class LensFlarePass extends Pass {
  private flareScale: number;
  private flareStride: number;
  private flareFrame = 0;
  private width = 1;
  private height = 1;

  readonly flareTarget: WebGLRenderTarget;
  readonly flareMaterial: ShaderMaterial;
  readonly compositeMaterial: ShaderMaterial;

  constructor({
    flareDownsample = 0.5,
    flareStride = 2,
    starRays,
    intensity,
    threshold,
    streakScale,
    hotspotPower,
    gate,
    tailColor,
  }: Options) {
    super("LensFlarePass");

    this.flareScale = Math.min(1, Math.max(0.2, flareDownsample));
    this.flareStride = Math.max(1, Math.floor(flareStride));

    this.flareTarget = new WebGLRenderTarget(1, 1, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    this.flareTarget.texture.colorSpace = LinearSRGBColorSpace;
    this.flareTarget.texture.generateMipmaps = false;
    this.flareTarget.texture.name = "LensFlarePass.Target";

    this.flareMaterial = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new Vector2(1, 1) },
        uEnabled: { value: 1 },
        uStarRays: { value: starRays },
        uIntensity: { value: intensity },
        uThreshold: { value: threshold },
        uStreakScale: { value: streakScale },
        uHotspotPower: { value: hotspotPower },
        uGate: { value: gate },
        uTailColor: { value: new Color(tailColor) },
      },
      vertexShader: fullscreenVertexShader,
      // The flare buffer stays linear; colour conversion happens in the composite.
      fragmentShader: lensFlareFragmentShader.replace(/#include\s+<colorspace_fragment>\s*/g, ""),
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    });

    this.compositeMaterial = new ShaderMaterial({
      uniforms: { tBase: { value: null }, tFlare: { value: null } },
      vertexShader: fullscreenVertexShader,
      fragmentShader: lensFlareCompositeFragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    });

    this.fullscreenMaterial = this.compositeMaterial;
  }

  setParams({ starRays, intensity, threshold, streakScale, hotspotPower, gate, tailColor }: LensFlareParams) {
    const u = this.flareMaterial.uniforms;
    u.uStarRays.value = starRays;
    u.uIntensity.value = intensity;
    u.uThreshold.value = threshold;
    u.uStreakScale.value = streakScale;
    u.uHotspotPower.value = hotspotPower;
    u.uGate.value = gate;
    (u.uTailColor.value as Color).set(tailColor);
  }

  setFlareDownsample(value: number) {
    this.flareScale = Math.min(1, Math.max(0.2, value));
    this.resizeFlareTarget();
  }

  setFlareStride(value: number) {
    this.flareStride = Math.max(1, Math.floor(value));
  }

  resetFlareCadence() {
    this.flareFrame = 0;
  }

  setSize(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    (this.flareMaterial.uniforms.uResolution.value as Vector2).set(this.width, this.height);
    this.resizeFlareTarget();
  }

  private resizeFlareTarget() {
    const w = Math.max(1, Math.floor(this.width * this.flareScale));
    const h = Math.max(1, Math.floor(this.height * this.flareScale));
    this.flareTarget.setSize(w, h);
    this.resetFlareCadence();
  }

  render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null, outputBuffer: WebGLRenderTarget | null) {
    if (!inputBuffer) return;

    // The streak buffer refreshes every `flareStride` frames; the composite runs every frame.
    if (this.flareFrame % this.flareStride === 0) {
      this.flareMaterial.uniforms.tDiffuse.value = inputBuffer.texture;
      this.fullscreenMaterial = this.flareMaterial;
      renderer.setRenderTarget(this.flareTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    }
    this.flareFrame += 1;

    this.compositeMaterial.uniforms.tBase.value = inputBuffer.texture;
    this.compositeMaterial.uniforms.tFlare.value = this.flareTarget.texture;
    this.fullscreenMaterial = this.compositeMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.flareTarget.dispose();
    this.flareMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}
