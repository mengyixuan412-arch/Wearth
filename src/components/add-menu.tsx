"use client";

import DropdownMenu from "@/components/dropdown-menu";

const BASE = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
const S = { stroke: "currentColor", strokeWidth: 1.7, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** 添加衣服分类 —— 标签页，带一个加号。 */
const FolderPlusIcon = () => (
  <svg {...BASE}>
    <path d="M3.4 6.6a2 2 0 0 1 2-2h3.3l2 2.4h7.9a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2Z" {...S} />
    <path d="M12 10.6v5.2M9.4 13.2h5.2" {...S} />
  </svg>
);

/** 添加衣服单品 —— 衣架。 */
const HangerIcon = () => (
  <svg {...BASE}>
    <path d="M12 8.6V7.4a2.1 2.1 0 1 1 2.1-2.1" {...S} />
    <path d="M12 8.6 3.6 15.1c-.9.7-.4 2.1.7 2.1h15.4c1.1 0 1.6-1.4.7-2.1L12 8.6Z" {...S} />
  </svg>
);

const PlusIcon = () => (
  <span aria-hidden="true" className="text-sm leading-none">
    +
  </span>
);

/**
 * 「添加」按钮。两条都是动作而不是选值，所以走 `variant="actions"` ——
 * 没有选中态，点完立即收起，不留那 260ms 的停顿（那是给「看清自己选了哪个」的）。
 */
export default function AddMenu({
  onAddCategory,
  onAddItem,
}: {
  onAddCategory: () => void;
  onAddItem: () => void;
}) {
  return (
    <DropdownMenu
      label="添加"
      ariaLabel="添加"
      triggerIcon={<PlusIcon />}
      tone="accent"
      variant="actions"
      width={196}
      groups={[
        [
          { key: "category", label: "添加衣服分类", icon: <FolderPlusIcon />, onSelect: onAddCategory },
          { key: "item", label: "添加衣服单品", icon: <HangerIcon />, onSelect: onAddItem },
        ],
      ]}
    />
  );
}
