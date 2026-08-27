import type { Category } from "@/lib/wardrobe";

/**
 * 一级品类图标。**线稿、单色、走 currentColor** ——
 * DESIGN.md 第 1 节铁律二：界面元素一律低饱和，彩色只出现在 3D 与图片里。
 * 彩色 emoji 会在一列灰线里跳出来，把视觉重量从衣服本身抢走。
 *
 * 规格对齐 `filter-icons.tsx`：24×24 视框、1.7 描边、无填充。
 */
const BASE = { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
const S = { stroke: "currentColor", strokeWidth: 1.7, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** 内搭 —— T 恤：领口、肩袖、直筒身。 */
const TopIcon = () => (
  <svg {...BASE}>
    <path d="M9 3.6 4.4 6.1 3.2 9.6l2.9 1.2v9.6h11.8v-9.6l2.9-1.2-1.2-3.5L15 3.6" {...S} />
    <path d="M9 3.6c.7 1.7 1.7 2.6 3 2.6s2.3-.9 3-2.6" {...S} />
  </svg>
);

/** 裤子 —— 长裤：腰头 + 两条裤管，中间开衩。 */
const BottomIcon = () => (
  <svg {...BASE}>
    <path d="M6 3.6h12l1 16.8h-4.6L12 11.4l-2.4 9H5Z" {...S} />
    <path d="M6 6.6h12" {...S} />
  </svg>
);

/** 外套 —— 大衣：翻领 + 门襟对开。 */
const CoatIcon = () => (
  <svg {...BASE}>
    <path d="M9.2 3.6 4.6 6.1 3.4 9.8l2.6 1v9.6h12v-9.6l2.6-1-1.2-3.7-4.6-2.5" {...S} />
    <path d="M9.2 3.6 12 7.4l2.8-3.8M12 7.4v13" {...S} />
  </svg>
);

/** 半身裙 —— A 字裙：腰头一道，下摆外扩。 */
const SkirtIcon = () => (
  <svg {...BASE}>
    <path d="M7.2 4.4h9.6l3.4 15.2H3.8Z" {...S} />
    <path d="M7.2 7.6h9.6" {...S} />
  </svg>
);

/** 连体装 —— 连衣裙：收腰后下摆展开。 */
const DressIcon = () => (
  <svg {...BASE}>
    <path d="M9 3.6 6.6 6.2l2.6 2.1-2.9 12.1h11.4l-2.9-12.1 2.6-2.1L15 3.6" {...S} />
    <path d="M9 3.6c.7 1.7 1.7 2.6 3 2.6s2.3-.9 3-2.6" {...S} />
  </svg>
);

/** 鞋 —— 侧面剪影：鞋头上翘，鞋帮到鞋底。 */
const ShoeIcon = () => (
  <svg {...BASE}>
    <path d="M2.8 19.4v-6.2h3.5l2.9-3.4c.9-1 2.4-.8 3 .4l1.1 2.2 5.6 2c1.4.5 2.3 1.8 2.3 3.3v1.7Z" {...S} />
    <path d="M9.4 12.6l2.4 1.9M2.8 16.6h18.4" {...S} />
  </svg>
);

/** 包 —— 手提包：包身 + 提手。 */
const BagIcon = () => (
  <svg {...BASE}>
    <path d="M4.4 8.2h15.2l-1.1 12.2H5.5Z" {...S} />
    <path d="M8.6 8.2V6.4a3.4 3.4 0 0 1 6.8 0v1.8" {...S} />
  </svg>
);

/** 帽子 —— 帽冠 + 帽檐。 */
const HatIcon = () => (
  <svg {...BASE}>
    <path d="M6.6 14.4V10.2a5.4 5.4 0 0 1 10.8 0v4.2" {...S} />
    <path d="M3.2 14.6h17.6c0 2-3.9 3.4-8.8 3.4s-8.8-1.4-8.8-3.4Z" {...S} />
  </svg>
);

/** 首饰 —— 项链：颈链弧线 + 坠子。（原「配饰」图标，配饰改用眼镜） */
const JewelryIcon = () => (
  <svg {...BASE}>
    <path d="M5.6 4.2c.4 7.4 3.3 11.1 6.4 11.1s5.9-3.7 6.4-11.1" {...S} />
    <circle cx="12" cy="18.4" r="2.6" {...S} />
  </svg>
);

/** 配饰 —— 眼镜：两片镜圈 + 鼻梁与镜腿。 */
const AccessoryIcon = () => (
  <svg {...BASE}>
    <circle cx="6.7" cy="13.6" r="3.7" {...S} />
    <circle cx="17.3" cy="13.6" r="3.7" {...S} />
    <path d="M10.4 13.2c.5-.8 2.7-.8 3.2 0M3 11.6l2.1-3.2M21 11.6l-2.1-3.2" {...S} />
  </svg>
);

const ICONS: Record<Category, () => React.ReactElement> = {
  内搭: TopIcon,
  外套: CoatIcon,
  裤子: BottomIcon,
  半身裙: SkirtIcon,
  连体装: DressIcon,
  鞋: ShoeIcon,
  包: BagIcon,
  帽子: HatIcon,
  首饰: JewelryIcon,
  配饰: AccessoryIcon,
};

export default function CategoryIcon({
  category,
  className = "w-5 h-5",
}: {
  category: Category;
  className?: string;
}) {
  const Icon = ICONS[category];
  if (!Icon) return null;
  return (
    <span className={`block ${className}`}>
      <Icon />
    </span>
  );
}
