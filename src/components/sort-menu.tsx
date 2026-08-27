"use client";

import DropdownMenu from "@/components/dropdown-menu";
import type { Sort } from "@/lib/wardrobe";

const BASE = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

/* ── 维度图标。一组两条（正序 / 倒序）共用一个 —— 重复出现的图标就是分组信号，
      八行之间因此一道分隔线都不需要。 ─────────────────────────── */

/** 购入时间 —— 表盘。 */
const ClockIcon = () => (
  <svg {...BASE}>
    <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 7.4V12l3.2 1.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 单次成本 —— 硬币里一个 ¥。 */
const CoinIcon = () => (
  <svg {...BASE}>
    <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M9.2 8.6 12 11.8l2.8-3.2M12 11.8v3.8M10 12.9h4M10 14.5h4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 穿着次数 —— 回转箭头，一次穿着就是一轮。 */
const RepeatIcon = () => (
  <svg {...BASE}>
    <path d="M20.2 12a8.2 8.2 0 1 1-2.7-6.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M20.4 4.3v5.4H15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** 价格 —— 吊牌。 */
const TagIcon = () => (
  <svg {...BASE}>
    <path d="M20 4h-7.4L4 12.6 11.4 20 20 11.4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="16.1" cy="7.9" r="1.4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const SortIcon = () => (
  <svg {...BASE}>
    <path d="M4 6h14M4 12h9M4 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/**
 * 排序项分组。八条平铺，组与组之间**不画分隔线** —— 一组两条共用一个图标，
 * 重复出现的图标本身就是分组信号；再加线只会把这一列切碎，而且八条本来就是
 * 同一件事（挑一个排序方式），没有哪一刀是真分界。
 */
const GROUPS = [
  { Icon: ClockIcon, items: ["最新购入", "最早购入"] },
  { Icon: CoinIcon, items: ["单次成本（高到低）", "单次成本（低到高）"] },
  { Icon: RepeatIcon, items: ["穿着次数（多到少）", "穿着次数（少到多）"] },
  { Icon: TagIcon, items: ["价格（低到高）", "价格（高到低）"] },
] as const satisfies readonly { Icon: () => React.ReactElement; items: readonly Sort[] }[];

/**
 * wardrobe.ts 的 SORTS 加了新项却忘了在 GROUPS 补图标，会在这一行编译报错。
 * 排序项散落在两个文件里，靠人记是记不住的。
 */
type Missing = Exclude<Sort, (typeof GROUPS)[number]["items"][number]>;
const _EVERY_SORT_HAS_AN_ICON: [Missing] extends [never] ? true : never = true;
void _EVERY_SORT_HAS_AN_ICON;

export default function SortMenu({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <DropdownMenu
      label="排序"
      ariaLabel="排序方式"
      triggerIcon={<SortIcon />}
      groups={GROUPS.map(({ Icon, items }) =>
        items.map((option) => ({
          key: option,
          label: option,
          icon: <Icon />,
          selected: option === value,
          onSelect: () => onChange(option),
        })),
      )}
    />
  );
}
