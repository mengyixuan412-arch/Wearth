import { Pass } from "postprocessing";
import {
  Color,
  HalfFloatType,
  LinearFilter,
  MathUtils,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

import {
  advectFragmentShader,
  clearFragmentShader,
  curlFragmentShader,
  divergenceFragmentShader,
  fluidDisplayFragmentShader,
  fluidVertexShader,
  gradientFragmentShader,
  pressureFragmentShader,
  vorticityFragmentShader,
} from "@/webgl/shaders/fluid";

const POINTER_ACCENT = "#c0fe04";
const TRAIL_LENGTH = 16;
const TRAIL_COUNT = 14;

/** Dot-matrix pointer trail drawn on top of the fluid display. */
class PointerOverlay {
  cssResolution = new Vector2(1, 1);
  devicePixelRatio = 1;
  trail = Array.from({ length: TRAIL_LENGTH }, () => new Vector2(0.5, 0.5));
  trailStrength = Array.from({ length: TRAIL_LENGTH }, () => 0);
  lastPointerCell = new Vector2(-1, -1);
  pixelSize = 16;

  uniforms = {
    uTrail: { value: this.trail },
    uTrailStrength: { value: this.trailStrength },
    uTrailCount: { value: TRAIL_COUNT },
    uPointerColor: { value: new Color(POINTER_ACCENT) },
    uPointerOpacity: { value: 1 },
    uPointerDotRadius: { value: 0.8 },
    uPointerPixelSize: { value: this.pixelSize },
    uResolution: { value: new Vector2(1, 1) },
    uDevicePixelRatio: { value: this.devicePixelRatio },
  };

  setColor(color: string) {
    (this.uniforms.uPointerColor.value as Color).set(color);
  }

  setPixelSize(size: number) {
    this.pixelSize = size;
    this.uniforms.uPointerPixelSize.value = size;
  }

  setDisplayMetrics(width: number, height: number, dpr: number) {
    this.cssResolution.set(Math.max(1, width), Math.max(1, height));
    this.devicePixelRatio = Math.max(1, dpr);
    this.uniforms.uDevicePixelRatio.value = this.devicePixelRatio;
  }

  setResolution(width: number, height: number) {
    this.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  }

  /** Pushes a new trail sample whenever the pointer crosses into a new dot cell. */
  updatePointer(uv: Vector2, active: boolean, delta: number) {
    const cellW = Math.max(this.pixelSize / Math.max(this.cssResolution.x, 1), 1e-6);
    const cellH = Math.max(this.pixelSize / Math.max(this.cssResolution.y, 1), 1e-6);

    for (let i = active ? 1 : 0; i < TRAIL_COUNT; i += 1) {
      this.trailStrength[i] = MathUtils.damp(this.trailStrength[i], 0, 2, delta);
    }

    if (!active) {
      this.lastPointerCell.set(-1, -1);
      return;
    }

    const cellX = Math.floor(uv.x / cellW);
    const cellY = Math.floor(uv.y / cellH);
    if (cellX !== this.lastPointerCell.x || cellY !== this.lastPointerCell.y) {
      for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
        this.trail[i].copy(this.trail[i - 1]);
        this.trailStrength[i] = this.trailStrength[i - 1];
      }
      this.lastPointerCell.set(cellX, cellY);
    }
    this.trail[0].set(uv.x, uv.y);
    this.trailStrength[0] = 1;
  }
}

const createTarget = (width: number, height: number) =>
  new WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    type: HalfFloatType,
  });

const createMaterial = (fragmentShader: string, uniforms: Record<string, { value: unknown }>) =>
  new ShaderMaterial({
    uniforms,
    vertexShader: fluidVertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
  });

export type FluidPushOptions = {
  strength?: number;
  radius?: number;
  velocityScale?: number;
  chromaticStrength?: number;
  pressureIterations?: number;
  curlStrength?: number;
  velocityDissipation?: number;
  simResolution?: number;
};

/**
 * Navier-Stokes pointer push: the cursor injects velocity, the field is made
 * divergence-free, and the result warps the rendered frame.
 */
export class FluidPushPass extends Pass {
  private readonly simResolution: number;
  private simWidth = 1;
  private simHeight = 1;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private readonly pressureIterations: number;

  effectEnabled = true;
  pointerOverlayEnabled = true;

  private readonly resolution = new Vector2(1, 1);
  private readonly pointerOverlay = new PointerOverlay();
  private readonly pointer = new Vector2(-1, -1);
  private readonly pointerDelta = new Vector2(0, 0);

  private velocityRead = createTarget(1, 1);
  private velocityWrite = createTarget(1, 1);
  private readonly curlTarget = createTarget(1, 1);
  private readonly vortTarget = createTarget(1, 1);
  private readonly divergenceTarget = createTarget(1, 1);
  private readonly pressureA = createTarget(1, 1);
  private readonly pressureB = createTarget(1, 1);
  private readonly projectedVelocityTarget = createTarget(1, 1);

  private readonly curlMaterial: ShaderMaterial;
  private readonly vorticityMaterial: ShaderMaterial;
  private readonly divergenceMaterial: ShaderMaterial;
  private readonly clearMaterial: ShaderMaterial;
  private readonly pressureMaterial: ShaderMaterial;
  private readonly gradientMaterial: ShaderMaterial;
  private readonly advectMaterial: ShaderMaterial;
  private readonly displayMaterial: ShaderMaterial;

  constructor({
    strength = 0.3,
    radius = 1.5,
    velocityScale = 1,
    chromaticStrength = 0.002,
    pressureIterations = 4,
    curlStrength = 0,
    velocityDissipation = 3,
    simResolution = 160,
  }: FluidPushOptions = {}) {
    super("FluidPushPass");
    this.simResolution = simResolution;
    this.pressureIterations = pressureIterations;

    const texel = new Vector2(1, 1);
    const viewport = new Vector2(1, 1);

    this.curlMaterial = createMaterial(curlFragmentShader, {
      uVelocity: { value: null },
      uTexelSize: { value: texel.clone() },
    });

    this.vorticityMaterial = createMaterial(vorticityFragmentShader, {
      uVelocity: { value: null },
      uCurl: { value: null },
      uTexelSize: { value: texel.clone() },
      uResolution: { value: viewport.clone() },
      uPointer: { value: this.pointer },
      uPointerDelta: { value: this.pointerDelta },
      uCurlStrength: { value: curlStrength },
      uSplatRadius: { value: Math.max(0.002 * radius, 5e-4) },
      uSplatForce: { value: Math.max(3000 * velocityScale, 0) },
    });

    this.divergenceMaterial = createMaterial(divergenceFragmentShader, {
      uVelocity: { value: null },
      uTexelSize: { value: texel.clone() },
    });

    this.clearMaterial = createMaterial(clearFragmentShader, {});

    this.pressureMaterial = createMaterial(pressureFragmentShader, {
      uPressure: { value: null },
      uDivergence: { value: null },
      uTexelSize: { value: texel.clone() },
    });

    this.gradientMaterial = createMaterial(gradientFragmentShader, {
      uVelocity: { value: null },
      uPressure: { value: null },
      uTexelSize: { value: texel.clone() },
    });

    this.advectMaterial = createMaterial(advectFragmentShader, {
      uVelocity: { value: null },
      uProjectedVelocity: { value: null },
      uTexelSize: { value: texel.clone() },
      uDissipation: { value: velocityDissipation },
    });

    this.displayMaterial = createMaterial(fluidDisplayFragmentShader, {
      tDiffuse: { value: null },
      uVelocity: { value: null },
      uSimSize: { value: new Vector2(simResolution, simResolution) },
      uDisplacementStrength: { value: Math.max(strength / 0.3, 0) },
      uChromaticBoost: { value: Math.max(chromaticStrength / 0.004, 0) },
      uEffectEnabled: { value: 1 },
      ...this.pointerOverlay.uniforms,
    });

    this.fullscreenMaterial = this.displayMaterial;
  }

  setEffectEnabled(enabled: boolean) {
    this.effectEnabled = enabled;
    this.displayMaterial.uniforms.uEffectEnabled.value = Number(!!enabled);
  }

  setPointerOverlayEnabled(enabled: boolean) {
    this.pointerOverlayEnabled = enabled;
    this.displayMaterial.uniforms.uPointerOpacity.value = enabled ? 1 : 0;
  }

  setPointerColor(color: string) {
    this.pointerOverlay.setColor(color);
  }

  setPointerPixelSize(size: number) {
    this.pointerOverlay.setPixelSize(size);
    if (this.pointerOverlayEnabled) this.displayMaterial.uniforms.uPointerOpacity.value = 1;
  }

  setDisplayMetrics(width: number, height: number, dpr: number) {
    this.pointerOverlay.setDisplayMetrics(width, height, dpr);
  }

  updatePointer(uv: Vector2, active: boolean, delta: number) {
    this.pointerOverlay.updatePointer(uv, active, delta);
  }

  setPointer(value: Vector2) {
    this.pointer.copy(value);
  }

  setPointerDelta(value: Vector2) {
    this.pointerDelta.copy(value);
  }

  setSize(width: number, height: number) {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);

    const base = this.simResolution;
    const aspect = this.viewportWidth / this.viewportHeight;
    if (aspect > 1) {
      this.simWidth = Math.round(base * aspect);
      this.simHeight = base;
    } else {
      this.simWidth = base;
      this.simHeight = Math.round(base / Math.max(aspect, 1e-4));
    }

    for (const target of [
      this.velocityRead,
      this.velocityWrite,
      this.curlTarget,
      this.vortTarget,
      this.divergenceTarget,
      this.pressureA,
      this.pressureB,
      this.projectedVelocityTarget,
    ]) {
      target.setSize(this.simWidth, this.simHeight);
    }

    const texelX = 1 / this.simWidth;
    const texelY = 1 / this.simHeight;
    const viewport = new Vector2(this.viewportWidth, this.viewportHeight);
    const simSize = new Vector2(this.simWidth, this.simHeight);

    this.resolution.copy(viewport);
    this.pointerOverlay.setResolution(this.viewportWidth, this.viewportHeight);

    for (const material of [
      this.curlMaterial,
      this.vorticityMaterial,
      this.divergenceMaterial,
      this.pressureMaterial,
      this.gradientMaterial,
      this.advectMaterial,
    ]) {
      const texel = material.uniforms.uTexelSize;
      if (texel) (texel.value as Vector2).set(texelX, texelY);
    }

    (this.vorticityMaterial.uniforms.uResolution.value as Vector2).copy(viewport);
    (this.displayMaterial.uniforms.uSimSize.value as Vector2).copy(simSize);
  }

  render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null, outputBuffer: WebGLRenderTarget | null) {
    if (!inputBuffer) return;
    const previousTarget = renderer.getRenderTarget();

    if (this.effectEnabled) {
      this.curlMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
      this.renderMaterial(renderer, this.curlMaterial, this.curlTarget);

      this.vorticityMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
      this.vorticityMaterial.uniforms.uCurl.value = this.curlTarget.texture;
      this.renderMaterial(renderer, this.vorticityMaterial, this.vortTarget);

      this.divergenceMaterial.uniforms.uVelocity.value = this.vortTarget.texture;
      this.renderMaterial(renderer, this.divergenceMaterial, this.divergenceTarget);

      this.renderMaterial(renderer, this.clearMaterial, this.pressureA);

      let read = this.pressureA;
      let write = this.pressureB;
      for (let i = 0; i < this.pressureIterations; i += 1) {
        this.pressureMaterial.uniforms.uPressure.value = read.texture;
        this.pressureMaterial.uniforms.uDivergence.value = this.divergenceTarget.texture;
        this.renderMaterial(renderer, this.pressureMaterial, write);
        const swap = read;
        read = write;
        write = swap;
      }

      this.gradientMaterial.uniforms.uVelocity.value = this.vortTarget.texture;
      this.gradientMaterial.uniforms.uPressure.value = read.texture;
      this.renderMaterial(renderer, this.gradientMaterial, this.projectedVelocityTarget);

      this.advectMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
      this.advectMaterial.uniforms.uProjectedVelocity.value = this.projectedVelocityTarget.texture;
      this.renderMaterial(renderer, this.advectMaterial, this.velocityWrite);
      this.swapVelocityTargets();
    }

    this.displayMaterial.uniforms.tDiffuse.value = inputBuffer.texture;
    this.displayMaterial.uniforms.uVelocity.value = this.velocityRead.texture;
    this.fullscreenMaterial = this.displayMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previousTarget);
  }

  dispose() {
    for (const target of [
      this.velocityRead,
      this.velocityWrite,
      this.curlTarget,
      this.vortTarget,
      this.divergenceTarget,
      this.pressureA,
      this.pressureB,
      this.projectedVelocityTarget,
    ]) {
      target.dispose();
    }
    for (const material of [
      this.curlMaterial,
      this.vorticityMaterial,
      this.divergenceMaterial,
      this.clearMaterial,
      this.pressureMaterial,
      this.gradientMaterial,
      this.advectMaterial,
      this.displayMaterial,
    ]) {
      material.dispose();
    }
  }

  private renderMaterial(renderer: WebGLRenderer, material: ShaderMaterial, target: WebGLRenderTarget) {
    this.fullscreenMaterial = material;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  private swapVelocityTargets() {
    const swap = this.velocityRead;
    this.velocityRead = this.velocityWrite;
    this.velocityWrite = swap;
  }
}
