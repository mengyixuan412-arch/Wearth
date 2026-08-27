"use client";

import { useEffect, useId, useRef, useState } from "react";

import { META } from "@/components/panel";
import { provinceOf, type Region } from "@/lib/profile-options";

/**
 * 档案表单控件。版式语言：**白底 + 一层灰线框 + 大号数字**。
 *
 * 格子之间不留间距、只留 1px 线 —— 外层用 `gap-px bg-line`，每个格子自己
 * 铺 `bg-card`，线就是格子之间漏出来的底色。这样最后一行填不满时也不会
 * 留下半截悬空的分隔线。
 *
 * 粉色只落在「必填」标记、hover 态和步进器上：面积小、位置固定，不做填充。
 */

/** 格子内边距。上下比左右松，让大号数字有地方站。 */
/**
 * 表单格。**竖向收得比横向紧** —— 一栏里叠着七八格，每格多两像素，
 * 整栏就多出小半屏；左右留白则要撑住格子里的大号值，不能跟着收。
 */
export const CELL = "flex flex-col gap-1.5 bg-card px-4 lg:px-5 py-2.5 lg:py-3";

/**
 * 值行的公共规格。数字格的步进器（两颗按钮叠起来 43px）比选择格的单个箭头
 * （28px）高，用 items-center 会把两种格子的文字顶到不同高度；这里定死行高
 * 再底对齐，配上同一档字号，同一行里几个值的下沿才落在同一条线上。
 *
 * `min-h-11`（44px）是**下限，不是随手取的**：步进器就是 43px，再往下收
 * 它会顶破行高，价格那一格会比隔壁高出来。要更紧只能先改步进器。
 */
export const VALUE_ROW = "flex items-end gap-3 min-h-11";

/**
 * 值的字号档。同一张表里只准出现一档 —— 混用会让相邻格子的数字看起来不是
 * 同一类东西。`lg` 给整页表单（个人档案），`md` 给弹窗这种更密的版面，
 * `sm` 给购买评分的商品信息：那一栏只占 12 栏里的 5 栏，还要塞下八个字段，
 * `md` 的大号值会把每一格撑到两倍高，整栏读起来只剩几个大字。
 *
 * **药丸触发器不跟这一档。** 那一栏里「品类」是下拉、「价格」是输入框，
 * 层级上是同一类东西，但药丸是粗体加边框，同号字在药丸里的视觉重量要大一截 ——
 * 按数值对齐反而更不齐，实测过。药丸留在控件档（12/14），
 * 站在药丸位置上的占位文字也跟着药丸走，不跟这一档。
 */
export type ValueSize = "lg" | "md" | "sm";
/**
 * 值本身。`h-[1em] p-0` 是给 <input> 的：输入框的盒子默认比文字高一截，
 * 里面的字又是垂直居中的，等于整体往上浮了半截 —— 数字就会比隔壁选择格里的
 * 汉字高出几个像素。把盒高压到刚好一个字高，两边的字就同底同基线了。
 */
export const valueText = (size: ValueSize = "lg") =>
  `font-sans font-medium leading-none h-[1em] p-0 ${
    size === "lg" ? "text-3xl lg:text-4xl" : size === "md" ? "text-xl lg:text-2xl" : "text-sm lg:text-base"
  }`;

/**
 * 横排格：**标签在左、值在右**，一格就是一行。
 *
 * 给密排的窄栏用（购买评分的商品信息只占 12 栏里的 5 栏）。竖排格把标签和值
 * 上下叠，一格吃掉两行高度；八九个字段排下来，这一栏就只剩标签和留白。
 * 横排之后每格压到一行，读起来是一张规格表 —— 和单品详情抽屉的「基本信息」
 * 同一种版式，两处本来就是同一类内容。
 *
 * **只给单值字段用。** 季节那种分段、材质那种可增删的列表，值本身就不止一行，
 * 塞进右半边会把行撑开，反而比竖排更乱。
 */
export const CELL_ROW = "flex items-center gap-4 bg-card px-4 lg:px-5 py-2.5 lg:py-3 min-h-12";

/** 横排格右半边：占满剩余宽度并靠右，值的右沿因此在一栏里对齐成一条线。 */
export const CELL_ROW_VALUE = "flex flex-1 justify-end items-center gap-2 min-w-0";

/** 标签行：中文名 + 必填/选填。必填是粉的，这是参考图里唯一的强调色文字。 */
export function CellLabel({ zh, required, hint }: { zh: string; required?: boolean; hint?: string }) {
  return (
    <span className="flex items-baseline gap-2 min-w-0">
      <span className="text-l1 text-xs lg:text-sm shrink-0">{zh}</span>
      <span className={`${META} shrink-0 ${required ? "text-accent" : "text-l3"}`}>
        {required ? "必填" : "选填"}
      </span>
      {hint ? <span className={`${META} text-l3 truncate`}>{hint}</span> : null}
    </span>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 12 8" aria-hidden="true" className="w-3 h-2" fill="none">
      <path
        d={up ? "M1 6.5L6 1.5L11 6.5" : "M1 1.5L6 6.5L11 1.5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

/**
 * 大号数字格 —— 参考图的主角。
 *
 * 值仍然是字符串（见 profile-store 的注释：输入中途允许空串和半截数字），
 * 步进器只在能解析成数字时才在原值上加减；解析不出来就从 placeholder 起步，
 * 所以空表点一下「▲」会直接落到示例值上，不会变成 NaN。
 */
export function NumberCell({
  zh,
  unit,
  value,
  placeholder,
  onChange,
  required,
  step = 1,
  max = 999,
  size = "lg",
  row = false,
  className = "",
}: {
  zh: string;
  unit?: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  required?: boolean;
  step?: number;
  max?: number;
  size?: ValueSize;
  /** 横排：标签在左、值在右（见 `CELL_ROW`）。 */
  row?: boolean;
  className?: string;
}) {
  const id = useId();

  const bump = (delta: number) => {
    const current = value.trim() === "" ? Number(placeholder) : Number(value);
    const base = Number.isFinite(current) ? current : Number(placeholder);
    const next = Math.min(max, Math.max(0, base + delta));
    // 0.5 档的鞋码要留一位小数，整数档不要拖一个 ".0"。
    onChange(Number.isInteger(next) ? String(next) : next.toFixed(1));
  };

  return (
    <div className={`${row ? CELL_ROW : CELL} ${className}`}>
      <label htmlFor={id} className="shrink-0 cursor-text">
        <CellLabel zh={zh} required={required} />
      </label>

      {/* 横排时步进器与单位仍跟在数字右边，只是整块靠右；
          `items-center` 换掉竖排的 `items-end` —— 一行之内没有基线要对。 */}
      <div className={row ? CELL_ROW_VALUE : VALUE_ROW}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          maxLength={6}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${valueText(size)} flex-1 bg-transparent min-w-0 text-l1 tabular-nums outline-none placeholder:text-l3 ${
            row ? "text-right" : ""
          }`}
          style={{ fontVariationSettings: '"wdth" 105' }}
        />

        <span className="flex flex-col border border-line divide-y divide-line shrink-0">
          <button
            type="button"
            aria-label={`${zh}加 ${step}`}
            onClick={() => bump(step)}
            className="flex justify-center items-center px-2.5 py-1.5 text-l3 lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
          >
            <Chevron up />
          </button>
          <button
            type="button"
            aria-label={`${zh}减 ${step}`}
            onClick={() => bump(-step)}
            className="flex justify-center items-center px-2.5 py-1.5 text-l3 lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
          >
            <Chevron />
          </button>
        </span>

        <span className={`${META} text-l3 shrink-0 ${row ? "w-4" : "w-5 pb-1"}`}>{unit}</span>
      </div>
    </div>
  );
}

/**
 * 省市两级选择。用自建面板而不是原生 <select>：原生 option 在各浏览器里都不可
 * 定制，令牌和等宽字全都落不进去，一打开就跳出这套设计；而且原生控件做不了
 * 左右联动的两栏。
 *
 * 对外只吐城市名 —— 省份是取城市的手段，不是要存的数据，存两级会让下游
 * （季节窗口判定）多一层无谓的解包。
 */
export function CascadeSelect({
  zh,
  value,
  regions,
  onChange,
  required,
  placeholder = "选择城市",
  size = "lg",
  className = "",
}: {
  zh: string;
  value: string;
  regions: Region[];
  onChange: (next: string) => void;
  required?: boolean;
  placeholder?: string;
  size?: ValueSize;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeProvince, setActiveProvince] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  // 打开时把省份栏定位到当前城市所在的省，而不是每次都从头开始。
  const openPanel = () => {
    setActiveProvince(provinceOf(value) || regions[0]?.province || "");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const commit = (city: string) => {
    onChange(city);
    setOpen(false);
  };

  const cities = regions.find((region) => region.province === activeProvince)?.cities ?? [];

  return (
    <div ref={rootRef} className={`${CELL} relative ${className}`}>
      <CellLabel zh={zh} required={required} />

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`${VALUE_ROW} group w-full justify-between cursor-pointer`}
      >
        <span
          className={`${valueText(size)} min-w-0 truncate ${value ? "text-l1" : "text-l3"}`}
          style={{ fontVariationSettings: '"wdth" 105' }}
        >
          {value || placeholder}
        </span>
        <span
          className={`flex justify-center items-center border border-line px-2.5 py-1.5 text-l3 lg:group-hover:text-accent transition-all duration-200 motion-reduce:transition-none shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        >
          <Chevron />
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          className="top-full left-4 lg:left-5 z-30 absolute flex bg-card shadow-lg border border-l4 w-64 sm:w-72 lg:w-80 max-w-[80vw] h-56"
        >
          {/* 省 */}
          <div
            role="listbox"
            aria-label="省份"
            className="border-line border-r w-24 sm:w-28 overflow-y-auto no-scrollbar shrink-0"
          >
            {regions.map((region) => {
              const active = region.province === activeProvince;
              return (
                <button
                  key={region.province}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setActiveProvince(region.province);
                    // 直辖市与特别行政区只有一个同名城市，选到省就等于选定了。
                    if (region.cities.length === 1 && region.cities[0] === region.province) {
                      commit(region.cities[0]);
                    }
                  }}
                  className={`block px-2.5 py-1.5 w-full font-ui text-xs text-left transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                    active ? "bg-be text-l1" : "text-l2 lg:hover:text-l1"
                  }`}
                >
                  {region.province}
                </button>
              );
            })}
          </div>

          {/* 市 */}
          <div role="listbox" aria-label="城市" className="flex-1 overflow-y-auto no-scrollbar">
            {cities.map((city) => {
              const selected = city === value;
              return (
                <button
                  key={city}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => commit(city)}
                  className={`block px-2.5 py-1.5 w-full font-ui text-xs text-left transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                    selected ? "bg-accent/15 text-l1" : "text-l2 lg:hover:text-l1"
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 风格标签格。静息底色与悬停底色和穿搭日志的日历格同一套
 * （白底 + `--accent-wash` 的一层薄粉），选中则整格填成 accent 粉。
 * 文字用 text-card 而不是写死白色 —— 暗色态下 accent 翻成亮粉，字得跟着翻深。
 */
export function CheckTag({
  zh,
  en,
  checked,
  onToggle,
}: {
  zh: string;
  en: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex flex-col gap-1 px-4 lg:px-5 py-3.5 lg:py-4 text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
        checked ? "bg-accent" : "bg-card lg:hover:bg-accent-wash"
      }`}
    >
      <span className={`font-sans font-bold text-sm lg:text-base ${checked ? "text-card" : "text-l1"}`}>
        {zh}
      </span>
      <span className={`${META} truncate ${checked ? "text-card/70" : "text-l3"}`}>{en}</span>
    </button>
  );
}
