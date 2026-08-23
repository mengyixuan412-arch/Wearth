"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  MathUtils,
  Object3D,
  Plane,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  ShaderMaterial,
  FrontSide,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  Group,
} from "three";

import { arrowFullscreenProgressStore } from "@/lib/arrow-fullscreen-store";
import { sectionMetrics } from "@/lib/section-metrics";
import type { SectionRect } from "@/lib/use-section-rects";
import { useIsMobileWidth } from "@/lib/viewport-store";
import { REFRACTIVE_EFFECT_POLICY, SOLID_EFFECT_POLICY } from "@/webgl/glass-stage";

export const STICKER_IMAGES = Array.from(
  { length: 12 },
  (_, index) => `/sticker_img/s_${String(index + 1).padStart(2, "0")}.png`,
);

const CONFIG = {
  particleCount: STICKER_IMAGES.length,
  spawnWidth: 32,
  clickSpawnWidth: 24,
  spawnHeight: 24,
  clickSpawnHeight: 24,
  positionY: 24,
  fallDistance: 48,
  zDepth: 4,
  zOffset: -6,
  windStrength: 1.8,
  windFrequency: 0.3,
  scale: 1.4,
  clickScale: 1.4,
  rotationSpeed: 0.8,
  fallSpeed: 1.8,
  enterDurationRatio: 0.05,
};

type Config = typeof CONFIG;

const MAX_INSTANCES = 2048;
const MAX_ONE_SHOTS = 384;
const SORT_LIMIT = 96;

const vertexShader = /* glsl */ `
attribute vec4 uvRect;

varying vec2 vAtlasUv;

void main() {
  vAtlasUv = uvRect.xy + uv * uvRect.zw;

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D map;

varying vec2 vAtlasUv;

void main() {
  vec4 color = texture2D(map, vAtlasUv);
  if (color.a < 0.01) discard;

  gl_FragColor = color;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

type Particle = {
  position: Vector3;
  startY: number;
  fallSpeed: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  textureIndex: number;
  windPhase: number;
  windAmplitude: number;
  emitAt: number;
  hasStarted: boolean;
  dead: boolean;
  isOneShot: boolean;
  originX: number;
  originY: number;
  originZ: number;
};

const nextPowerOfTwo = (value: number) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, value))));

const imageOf = (texture: Texture) => {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image) return null;
  const { width, height } = image;
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) return null;
  return image as CanvasImageSource & { width: number; height: number };
};

/** Packs every sticker into one power-of-two atlas and records per-sprite UV rects. */
function buildAtlas(textures: Texture[]) {
  const images = textures.map(imageOf);
  if (images.some((image) => !image)) return null;
  const frames = images as (CanvasImageSource & { width: number; height: number })[];

  const maxWidth = Math.max(...frames.map((f) => f.width));
  const maxHeight = Math.max(...frames.map((f) => f.height));
  const columns = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / columns);
  const cellWidth = maxWidth + 4;
  const cellHeight = maxHeight + 4;
  const atlasWidth = nextPowerOfTwo(columns * cellWidth);
  const atlasHeight = nextPowerOfTwo(rows * cellHeight);

  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, atlasWidth, atlasHeight);

  const uvRects = new Float32Array(4 * frames.length);
  const aspects: number[] = [];

  frames.forEach((frame, index) => {
    const row = Math.floor(index / columns);
    const x = (index % columns) * cellWidth + 2;
    const y = row * cellHeight + 2;
    ctx.drawImage(frame, x, y, frame.width, frame.height);
    const offset = 4 * index;
    uvRects[offset] = (x + 0.5) / atlasWidth;
    uvRects[offset + 1] = 1 - (y + frame.height - 0.5) / atlasHeight;
    uvRects[offset + 2] = (frame.width - 1) / atlasWidth;
    uvRects[offset + 3] = (frame.height - 1) / atlasHeight;
    aspects[index] = frame.width / frame.height;
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, uvRects, aspects };
}

function respawn(particle: Particle, config: Config, mode: "scroll" | "click" = "scroll") {
  const spawnHeight = mode === "click" ? config.clickSpawnHeight : config.spawnHeight;
  const jitter = Math.min(0.5 * Math.max(spawnHeight, 0), 8);
  const y =
    mode === "click"
      ? config.positionY + (2 * Math.random() - 1) * jitter
      : config.positionY + Math.random() * Math.max(spawnHeight, 0);

  particle.position.set(
    particle.originX + (Math.random() - 0.5) * (mode === "click" ? config.clickSpawnWidth : config.spawnWidth),
    particle.originY + y,
    particle.originZ + (Math.random() - 0.5) * config.zDepth + config.zOffset,
  );
  particle.startY = particle.position.y;
  particle.fallSpeed = config.fallSpeed * (0.6 + 0.8 * Math.random());
  particle.rotation = Math.random() * Math.PI * 2;
  particle.rotationSpeed = (Math.random() - 0.5) * config.rotationSpeed * 2;
  particle.scale = mode === "click" ? config.clickScale : config.scale;
  particle.windPhase = Math.random() * Math.PI * 2;
  particle.windAmplitude = 0.3 + Math.random() * config.windStrength;
  particle.dead = false;
  particle.hasStarted = true;
  particle.emitAt = 0;
}

const freeIndices: number[] = [];

/** Picks a sprite that is not already on screen, so the same sticker never doubles up. */
const pickUnusedTexture = (count: number, used: Set<number>) => {
  if (count <= 0) return 0;
  if (used.size >= count) return Math.floor(Math.random() * count);
  freeIndices.length = 0;
  for (let i = 0; i < count; i++) if (!used.has(i)) freeIndices.push(i);
  return freeIndices[Math.floor(Math.random() * freeIndices.length)];
};

/** Insertion sort by depth, keeping the draw order back-to-front. */
const insertByDepth = (list: Particle[], particle: Particle) => {
  const z = particle.position.z;
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (list[mid].position.z <= z) low = mid + 1;
    else high = mid;
  }
  list.push(particle);
  for (let i = list.length - 1; i > low; i--) list[i] = list[i - 1];
  list[low] = particle;
};

const shuffled = (length: number) => {
  const values = Array.from({ length }, (_, i) => i);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
};

function createParticles(count: number, textureCount: number, isOneShot = false): Particle[] {
  const particles = Array.from({ length: count }, () => ({
    position: new Vector3(),
    startY: 0,
    fallSpeed: 0,
    rotation: 0,
    rotationSpeed: 0,
    scale: 1,
    textureIndex: Math.floor(Math.random() * textureCount),
    windPhase: 0,
    windAmplitude: 0,
    emitAt: 0,
    hasStarted: true,
    dead: false,
    isOneShot,
    originX: 0,
    originY: 0,
    originZ: 0,
  }));

  if (count > 0 && count <= textureCount) {
    const order = shuffled(textureCount);
    for (let i = 0; i < count; i++) particles[i].textureIndex = order[i];
  }
  return particles;
}

const prune = (particles: Particle[]) => {
  const alive = particles.filter((p) => !p.isOneShot || !p.dead);
  const looping = alive.filter((p) => !p.isOneShot);
  const oneShots = alive.filter((p) => p.isOneShot);
  if (oneShots.length <= MAX_ONE_SHOTS) return alive;
  oneShots.sort((a, b) => b.emitAt - a.emitAt);
  return looping.concat(oneShots.slice(0, MAX_ONE_SHOTS));
};

const saturate = (v: number) => Math.min(1, Math.max(0, v));
const normalizeProgress = (v: number) => saturate(v > 1 ? v / 100 : v);

const schmitt = (
  current: boolean,
  progress: number,
  policy: { opaqueThreshold: number; opaqueTolerance: number; hysteresis: number },
) => {
  const on = saturate(policy.opaqueThreshold - policy.opaqueTolerance);
  const off = saturate(on - policy.hysteresis);
  const t = normalizeProgress(progress);
  if (!current && t >= on) return true;
  if (current && t <= off) return false;
  return current;
};

export default function Stickers({
  images = STICKER_IMAGES,
  particlesPerBurst,
  showAtVh,
  sectionPosition,
  sectionName = "footer",
}: {
  images?: string[];
  particlesPerBurst?: number;
  showAtVh?: number;
  sectionPosition: SectionRect[];
  sectionName?: string;
}) {
  const groupRef = useRef<Group | null>(null);
  const meshRef = useRef<InstancedMesh | null>(null);
  const { camera, gl } = useThree();

  const raycaster = useRef(new Raycaster());
  const ndc = useRef(new Vector2());
  const plane = useRef(new Plane(new Vector3(0, 0, 1), 0));
  const particles = useRef<Particle[]>([]);
  const seeded = useRef(false);
  const elapsed = useRef(0);
  const nextEmitAt = useRef(0);
  const usedTextures = useRef(new Set<number>());
  const drawList = useRef<Particle[]>([]);
  const dummy = useRef(new Object3D());
  const localPoint = useRef(new Vector3());
  const solidSuspended = useRef(false);
  const refractiveSuspended = useRef(false);
  const isMobile = useIsMobileWidth();

  const config = useMemo<Config>(
    () => ({ ...CONFIG, particleCount: Math.max(1, particlesPerBurst ?? images.length) }),
    [images.length, particlesPerBurst],
  );

  const loaded = useLoader(TextureLoader, images);
  const textures = useMemo(() => (Array.isArray(loaded) ? loaded : [loaded]), [loaded]);
  const decoded = useMemo(() => textures.length > 0 && textures.every((t) => !!imageOf(t)), [textures]);
  const atlas = useMemo(() => (decoded ? buildAtlas(textures) : null), [decoded, textures]);

  useEffect(() => () => atlas?.texture.dispose(), [atlas]);

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(2, 2);
    geo.setAttribute("uvRect", new InstancedBufferAttribute(new Float32Array(4 * MAX_INSTANCES), 4));
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      atlas
        ? new ShaderMaterial({
            uniforms: { map: { value: atlas.texture } },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            side: FrontSide,
            toneMapped: false,
          })
        : null,
    [atlas],
  );
  useEffect(() => () => material?.dispose(), [material]);

  useEffect(() => {
    if (!atlas || seeded.current) return;
    seeded.current = true;
    elapsed.current = 0;
    nextEmitAt.current = 0;
    const seedParticles = createParticles(config.particleCount, atlas.aspects.length, false);
    for (const particle of seedParticles) respawn(particle, config, "scroll");
    particles.current = seedParticles;
  }, [atlas, config]);

  const burst = useCallback(
    (origin: Vector3) => {
      if (!atlas) return;
      const shot = createParticles(config.particleCount, atlas.aspects.length, true);
      let at = 0.05 * Math.random();
      for (const particle of shot) {
        particle.hasStarted = false;
        particle.dead = false;
        particle.emitAt = at;
        at += 0.04 + 0.04 * Math.random();
      }
      for (const particle of shot) {
        particle.originX = origin.x;
        particle.originY = origin.y - config.positionY;
        particle.originZ = 0;
        particle.emitAt += elapsed.current;
      }
      particles.current = prune(particles.current.concat(shot));
    },
    [atlas, config],
  );

  /** Scroll position at which looping stickers start falling. */
  const scrollThreshold = useMemo(() => {
    const section = sectionMetrics.findSection(sectionPosition, sectionName);
    if (!section) return Infinity;
    return section.y + section.height / 2 - sectionMetrics.getViewportHeightPx();
  }, [sectionPosition, sectionName]);

  useFrame((_state, delta) => {
    const progress = arrowFullscreenProgressStore.getSnapshot();
    solidSuspended.current = schmitt(solidSuspended.current, progress, SOLID_EFFECT_POLICY);
    refractiveSuspended.current = schmitt(refractiveSuspended.current, progress, REFRACTIVE_EFFECT_POLICY);
    if (refractiveSuspended.current) return;

    const mesh = meshRef.current;
    if (!mesh || !atlas || !seeded.current) {
      if (mesh) {
        mesh.count = 0;
        mesh.visible = false;
      }
      return;
    }

    const step = Math.min(delta, 0.1);
    elapsed.current += step;
    const now = elapsed.current;
    const list = particles.current;

    const scrollTop = sectionMetrics.getScrollTopPx();
    const loopingActive = Number.isFinite(scrollThreshold)
      ? Number(scrollTop >= scrollThreshold)
      : !showAtVh || showAtVh <= 0
        ? 1
        : Number(scrollTop >= sectionMetrics.getViewportHeightPx() * showAtVh);

    const { fallDistance, windFrequency } = config;
    const used = usedTextures.current;
    used.clear();
    for (const p of list) if (!p.isOneShot && !p.dead && p.hasStarted) used.add(p.textureIndex);

    const draw = drawList.current;
    draw.length = 0;
    let anyDied = false;

    for (const p of list) {
      if (!(p.isOneShot || loopingActive === 1)) continue;
      if (!p.hasStarted) {
        if (now < p.emitAt) continue;
        respawn(p, config, "click");
        p.hasStarted = true;
      }
      if (p.dead) {
        if (p.isOneShot) anyDied = true;
        continue;
      }

      p.position.y -= p.fallSpeed * step;
      p.position.x += Math.sin(now * windFrequency + p.windPhase) * p.windAmplitude * step;
      p.rotation += p.rotationSpeed * step;

      const travelled = MathUtils.clamp((p.startY - p.position.y) / fallDistance, 0, 1);
      const enter = config.enterDurationRatio;
      let fade = 1;
      if (enter > 0 && travelled < enter) fade = travelled / enter;
      else if (travelled > 0.9) fade = (1 - travelled) / 0.1;
      fade = MathUtils.clamp(fade, 0, 1);

      if (p.position.y < p.startY - fallDistance) {
        if (p.isOneShot) {
          p.dead = true;
          anyDied = true;
          continue;
        }
        used.delete(p.textureIndex);
        p.textureIndex = pickUnusedTexture(atlas.aspects.length, used);
        p.emitAt = Math.max(nextEmitAt.current, now) + (0.04 + 0.04 * Math.random());
        nextEmitAt.current = p.emitAt;
        p.hasStarted = false;
        continue;
      }

      p.scale = fade;
      if (draw.length < SORT_LIMIT) insertByDepth(draw, p);
      else draw.push(p);
    }

    if (anyDied) particles.current = prune(list.filter((p) => !p.isOneShot || !p.dead));
    if (draw.length > SORT_LIMIT) draw.sort((a, b) => a.position.z - b.position.z);

    const uvRect = geometry.getAttribute("uvRect") as InstancedBufferAttribute;
    const count = Math.min(draw.length, MAX_INSTANCES);
    const proxy = dummy.current;

    for (let i = 0; i < count; i++) {
      const p = draw[i];
      const aspect = atlas.aspects[p.textureIndex] ?? 1;
      const size = (p.isOneShot ? config.clickScale : config.scale) * p.scale;
      const offset = 4 * p.textureIndex;
      proxy.position.copy(p.position);
      proxy.rotation.set(0, 0, p.rotation);
      proxy.scale.set(size * aspect, size, 1);
      proxy.updateMatrix();
      mesh.setMatrixAt(i, proxy.matrix);
      uvRect.setXYZW(i, atlas.uvRects[offset], atlas.uvRects[offset + 1], atlas.uvRects[offset + 2], atlas.uvRects[offset + 3]);
    }

    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    uvRect.needsUpdate = true;
  });

  // A deliberate click (not a drag, not a text selection) throws a burst of stickers.
  useEffect(() => {
    if (isMobile) return;
    const canvas = gl.domElement;
    if (!canvas) return;

    type Press = { id: number; pointerType: string; startX: number; startY: number; startAt: number; cancelled: boolean };
    let press: Press | null = null;

    const spawnAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      ndc.current.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.current.setFromCamera(ndc.current, camera);
      const hit = new Vector3();
      if (!raycaster.current.ray.intersectPlane(plane.current, hit)) return;
      const local = localPoint.current;
      local.copy(hit);
      groupRef.current?.worldToLocal(local);
      burst(local);
    };

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      if ((event.pointerType === "mouse" || event.pointerType === "pen") && event.button !== 0) return;
      press = {
        id: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        startAt: event.timeStamp || performance.now(),
        cancelled: false,
      };
    };

    const onMove = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id || press.cancelled) return;
      const dx = event.clientX - press.startX;
      const dy = event.clientY - press.startY;
      const slop = press.pointerType === "touch" ? 10 : 4;
      if (dx * dx + dy * dy > slop * slop) press.cancelled = true;
    };

    const onUp = (event: PointerEvent) => {
      const current = press;
      press = null;
      if (!current || event.pointerId !== current.id) return;
      if (current.cancelled) return;
      if ((event.timeStamp || performance.now()) - current.startAt > 600) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return;
      if (solidSuspended.current) return;
      spawnAt(event.clientX, event.clientY);
    };

    const onCancel = (event: PointerEvent) => {
      if (press && event.pointerId === press.id) press = null;
    };

    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onDown, opts);
    window.addEventListener("pointermove", onMove, opts);
    window.addEventListener("pointerup", onUp, opts);
    window.addEventListener("pointercancel", onCancel, opts);

    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
    };
  }, [camera, gl.domElement, isMobile, burst]);

  return (
    <group ref={groupRef}>
      {atlas && material ? (
        <instancedMesh ref={meshRef} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} />
      ) : null}
    </group>
  );
}
