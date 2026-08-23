"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";

/**
 * 全站表单控件。第 2 节铁律三「交互反馈用点线，不用填充」在这里的落法：
 * 静息态只有一条 --line 细底线，hover 变点线，聚焦变实线 l1。
 * 唯一的填充是多选框的选中态 —— 那是状态不是反馈，必须一眼可数。
 */

const LABEL_ZH = "text-l1 text-xs lg:text-sm";
const LABEL_EN = "font-mono-2 text-l3 text-[10px] lg:text-xs uppercase";
const UNDERLINE =
  "flex items-baseline gap-1.5 border-b border-line border-dotted transition-colors duration-200 " +
  "motion-reduce:transition-none group-hover:border-l3 focus-within:border-l1 focus-within:border-solid";
const VALUE = "min-w-0 flex-1 bg-transparent py-1 font-mono-2 text-l1 text-sm lg:text-base tabular-nums outline-none placeholder:text-l3";

export function FieldLabel({ zh, en }: { zh: string; en: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={LABEL_ZH}>{zh}</span>
      <span className={LABEL_EN}>{en}</span>
    </span>
  );
}

export function UnderlineInput({
  zh,
  en,
  unit,
  value,
  onChange,
  inputMode = "decimal",
  maxLength = 6,
}: {
  zh: string;
  en: string;
  unit?: string;
  value: string;
  onChange: (next: string) => void;
  inputMode?: "decimal" | "numeric" | "text";
  maxLength?: number;
}) {
  return (
    <label className="group flex flex-col gap-1 p-2 cursor-text">
      <FieldLabel zh={zh} en={en} />
      <span className={UNDERLINE}>
        <input
          type="text"
          inputMode={inputMode}
          maxLength={maxLength}
          value={value}
          placeholder="—"
          onChange={(event) => onChange(event.target.value)}
          className={VALUE}
        />
        {unit ? <span className={`${LABEL_EN} shrink-0`}>{unit}</span> : null}
      </span>
    </label>
  );
}

/**
 * 下拉选择。用自建面板而不是原生 <select>：原生 option 在各浏览器里都不可
 * 定制，粉/米色令牌和等宽字全都落不进去，一打开就跳出这套设计。
 */
export function DottedSelect({
  zh,
  en,
  value,
  options,
  onChange,
  placeholder = "—",
}: {
  zh: string;
  en: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

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

  return (
    <div ref={rootRef} className="group relative flex flex-col gap-1 p-2">
      <FieldLabel zh={zh} en={en} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`${UNDERLINE} cursor-pointer text-left`}
      >
        <span className={`${VALUE} ${value ? "text-l1" : "text-l3"}`}>{value || placeholder}</span>
        <span
          aria-hidden="true"
          className={`shrink-0 font-mono-2 text-l3 text-[10px] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="top-full right-2 left-2 z-30 absolute bg-be shadow-lg mt-1 border border-line max-h-56 overflow-y-auto no-scrollbar"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`block px-3 py-1.5 w-full font-mono-2 text-xs lg:text-sm text-left transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                  selected ? "bg-selection/15 text-l1" : "text-l2 lg:hover:text-l1"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** 多选标签。选中即填满 —— 一屏八个，靠明暗一眼数得出选了几个。 */
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
      className={`${DOTTED_BORDER_BASE} flex items-center gap-2 p-2 cursor-pointer`}
    >
      <span
        aria-hidden="true"
        className={`shrink-0 border w-3 h-3 transition-colors duration-200 motion-reduce:transition-none ${
          checked ? "bg-l1 border-l1" : "border-l3"
        }`}
      />
      <span
        className={`text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none ${
          checked ? "text-l1" : "text-l2"
        }`}
      >
        {zh}
      </span>
      <span className={LABEL_EN}>{en}</span>
    </button>
  );
}
