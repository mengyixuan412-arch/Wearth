"use client";

import type { ReactNode } from "react";

import DropdownMenu from "@/components/dropdown-menu";

/**
 * 筛选下拉：图标即标签，触发器上显示的是**当前选中的值**而不是字段名
 * （字段名交给图标，一行四个控件才放得下）。
 *
 * 走 `DropdownMenu` 而不是原生 `<select>` —— 原生 option 在各浏览器里都不可定制，
 * 令牌和字体全都落不进去，一打开就跳出这套设计（`CascadeSelect` 的注释里是同一条理由）。
 * 排序、添加、筛选因此是同一种浮层，不是三种。
 *
 * 选项没有对得上的图标（季节、色系、品牌、状态都是纯文字），所以不传 `icon` ——
 * 面板的边框、阴影、选中态、动效、键盘操作仍与排序菜单完全一致。
 */
export default function FilterSelect({
  icon,
  value,
  options,
  onChange,
  label,
}: {
  icon: ReactNode;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <DropdownMenu
      label={value}
      ariaLabel={label}
      triggerIcon={<span className="shrink-0">{icon}</span>}
      triggerClassName="w-[150px] lg:w-[184px]"
      width={184}
      // 品牌那一档跟着衣橱走，可能几十条；超出就在面板内部滚。
      maxHeight={320}
      groups={[
        options.map((option) => ({
          key: option,
          label: option,
          selected: option === value,
          onSelect: () => onChange(option),
        })),
      ]}
    />
  );
}
