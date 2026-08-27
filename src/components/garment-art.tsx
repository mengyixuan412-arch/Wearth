const INK = "#141414";

/**
 * Flat sticker silhouettes, one per sub-category, sharing the closet's language:
 * heavy black outline over a flat fill, no gradients. Stands in for cut-out
 * photography until real garment shots exist.
 */
const SHAPES: Record<string, (c: string) => React.ReactNode> = {
  衬衫: (c) => (
    <>
      <path d="M38 24 60 16l22 8 14 12-10 10v46a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V44L24 36z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M52 18 60 30l8-12M60 30v54" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
  T恤: (c) => (
    <>
      <path d="M40 24h40l16 12-10 10v44a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V46L24 36z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M48 24a12 9 0 0 0 24 0" fill="none" stroke={INK} strokeWidth="3.4" />
    </>
  ),
  针织衫毛衣: (c) => (
    <>
      <path d="M40 24h40l18 14-12 12v42a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V50L22 38z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M42 40v50M54 38v52M66 38v52M78 40v50" stroke={INK} strokeWidth="2.4" opacity="0.45" />
    </>
  ),
  开衫: (c) => (
    <>
      <path d="M40 22h40l18 16-12 10v46a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V48L22 38z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M60 24v74" stroke={INK} strokeWidth="3.4" />
      <circle cx="60" cy="46" r="2.6" fill={INK} />
      <circle cx="60" cy="62" r="2.6" fill={INK} />
      <circle cx="60" cy="78" r="2.6" fill={INK} />
    </>
  ),
  牛仔裤: (c) => (
    <>
      <path d="M38 16h44l4 24-4 60H66l-4-44-4 44H40l-4-60z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M38 28h44" stroke={INK} strokeWidth="3" />
      <path d="M46 34v10M74 34v10" stroke={INK} strokeWidth="2.6" opacity="0.5" />
    </>
  ),
  半身裙: (c) => (
    <>
      <path d="M42 18h36l14 74a4 4 0 0 1-4 5H32a4 4 0 0 1-4-5z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M42 18h36v10H42z" fill={c} stroke={INK} strokeWidth="3.4" />
      <path d="M52 30 46 92M68 30l6 62" stroke={INK} strokeWidth="2.4" opacity="0.45" />
    </>
  ),
  连衣裙: (c) => (
    <>
      <path d="M46 16h28l10 12-8 10 14 50a4 4 0 0 1-4 6H34a4 4 0 0 1-4-6l14-50-8-10z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M52 38h16" stroke={INK} strokeWidth="3" opacity="0.5" />
    </>
  ),
  西装外套: (c) => (
    <>
      <path d="M40 20h40l18 16-12 12v44a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V48L22 36z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M52 20 60 44l8-24M60 44v52" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
  大衣: (c) => (
    <>
      <path d="M40 18h40l20 16-14 12v52a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V46L20 34z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M60 20v82" stroke={INK} strokeWidth="3.4" />
      <path d="M34 62h14M72 62h14" stroke={INK} strokeWidth="3" opacity="0.5" />
    </>
  ),
  羽绒棉服: (c) => (
    <>
      <path d="M40 20h40l18 14-12 12v52a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V46L22 34z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M34 48h52M34 64h52M34 80h52" stroke={INK} strokeWidth="2.8" opacity="0.55" />
      <path d="M60 22v80" stroke={INK} strokeWidth="3" />
    </>
  ),
  运动鞋: (c) => (
    <>
      <path d="M20 76c0-14 8-18 12-26l8-16 12 6-2 12 34 14c6 2 10 6 10 12v6H24a4 4 0 0 1-4-4z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M20 84h76" stroke={INK} strokeWidth="4" />
      <path d="M52 60l10-8M62 66l10-8" stroke={INK} strokeWidth="3" opacity="0.5" />
    </>
  ),
  单肩斜挎: (c) => (
    <>
      <path d="M32 44h56l6 50a4 4 0 0 1-4 5H30a4 4 0 0 1-4-5z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M42 44V30a18 18 0 0 1 36 0v14" fill="none" stroke={INK} strokeWidth="4" />
      <path d="M32 62h56" stroke={INK} strokeWidth="3" opacity="0.5" />
    </>
  ),
  围巾丝巾: (c) => (
    <>
      <path d="M30 24c18 10 42 10 60 0l8 14c-20 12-56 12-76 0z" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M44 40l-6 54h16l4-38M76 40l6 54H66" fill={c} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    </>
  ),
};

const FALLBACK = SHAPES.T恤;

export default function GarmentArt({ sub, color }: { sub: string; color: string }) {
  const draw = SHAPES[sub] ?? FALLBACK;
  return (
    <svg viewBox="0 0 120 110" className="w-full h-full" role="img" aria-hidden="true">
      {draw(color)}
    </svg>
  );
}
