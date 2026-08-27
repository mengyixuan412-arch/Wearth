"use client";

import PhotoDrop from "@/components/photo-drop";
import { META } from "@/components/panel";

/**
 * 一格截图投放位。三格并排，构成「先上传」那一步。
 *
 * 走和其余三处上传同一档 `lg` 版式（DESIGN.md §5.11）：**标题就写在框中央**，
 * 不再顶在框下。三格并排的宽度足够站下粗体主文案，框下便不必再留一行，
 * 空态因此只有一个框，三格排开是干净的三块。
 *
 * 「成分表截图」不能叫「材质图」：后者会让人去拍面料特写，而从照片判断成分
 * 不可靠（PRD 8 明确不做），材质只能读文字。命名直接决定用户拍什么。
 */
export default function ShotSlot({
  zh,
  value,
  onChange,
}: {
  zh: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <PhotoDrop
        value={value}
        onChange={onChange}
        title={zh}
        hint="JPG / PNG"
        alt={zh}
        ariaLabel={value ? `更换${zh}` : `上传${zh}`}
        className="w-full aspect-4/3"
      />

      {/* 没图的时候整行不渲染 —— 空着只会在框下留一截白（同录入单品）。 */}
      {value ? (
        <p className="flex items-baseline gap-2">
          <span className="font-sans font-bold text-l1 text-xs lg:text-sm">{zh}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`${META} ml-auto text-l3 lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer`}
          >
            移除
          </button>
        </p>
      ) : null}
    </div>
  );
}
