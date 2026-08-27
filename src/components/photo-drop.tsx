"use client";

import { useRef, useState } from "react";

import { META } from "@/components/panel";
import { downscaleImage } from "@/lib/image";

/**
 * 照片投放区。**全站四处上传共用这一个**（个人档案的全身照、录入单品的衣物照、
 * 穿搭记录的当日照、购买评分的三张商品截图），不要各写各的。
 *
 * 只负责**框本身**：边框、底色、加号、文案、读取中、读不出来、以及填充后的图。
 * 框外面的东西（标题行、「更换 / 移除」按钮、说明文字）由调用方自己摆 ——
 * 四处的外围布局本来就不一样，硬塞进来只会让参数表长成一张配置文件。
 *
 * 两档尺寸：
 *
 * - `lg` 单张主投放区。大加号 + 粗体主文案 + 一行说明。
 * - `sm` 并排的小格（评分页三连）。只有小加号和 `JPG / PNG`——
 *   一行摆三个，塞粗体标题会挤成一团，标题改由调用方写在框下。
 *
 * 空态是**常驻虚线**，不是 hover 才显形的那套点线描边（DESIGN.md §5.6）：
 * 这里的虚线是「这块地方是空的、等你放东西」的静态语义，不是交互反馈。
 * 线色用 `--frame` 而不是 `--line` —— 投放区都坐在白底或近白的卡上，
 * 暖灰 10% 在白底上会被冲得几乎看不见（同 §2「两档发丝线」）。
 */
export default function PhotoDrop({
  value,
  onChange,
  onPickMany,
  size = "lg",
  title,
  hint,
  alt = "",
  ariaLabel,
  className = "",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  /**
   * 传了它，输入框就变成可多选，缩完的一组一次性交回来（`onChange` 不再触发）。
   * 「其他图片」那种一格装多张的位置用 —— 缩图逻辑只此一份，不要在外面另写。
   */
  onPickMany?: (next: string[]) => void;
  size?: "lg" | "sm";
  /** `lg` 的粗体主文案。 */
  title?: string;
  /** `lg` 的说明行。 */
  hint?: string;
  alt?: string;
  ariaLabel?: string;
  /** 由调用方定尺寸，如 `aspect-4/5` / `flex-1` / `min-h-56`。 */
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lg = size === "lg";

  const pick = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setBusy(true);
    setError(false);

    if (onPickMany) {
      // 读不出来的那张跳过，其余照常进；一张都没成才算失败。
      const done: string[] = [];
      for (const file of list) {
        try {
          done.push(await downscaleImage(file));
        } catch {
          /* 跳过这一张 */
        }
      }
      setError(done.length === 0);
      if (done.length > 0) onPickMany(done);
    } else {
      try {
        onChange(await downscaleImage(list[0]));
      } catch {
        setError(true);
      }
    }
    setBusy(false);
  };

  return (
    <div
      className={`group relative overflow-hidden transition-colors duration-200 motion-reduce:transition-none ${
        value ? "border border-frame" : "bg-be/50 border-2 border-frame border-dashed lg:hover:border-accent"
      } ${className}`}
    >
      {value ? (
        // 用户上传的任意图片，尺寸未知，next/image 的静态优化派不上用场。
        // 一律 object-contain：截图和抠好的单品图都不能裁 —— 尺码表裁掉一角就读不全，
        // 单品裁掉袖子就认不出是哪件。
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={alt} className="w-full h-full object-contain" />
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={ariaLabel ?? (value ? "更换照片" : "上传照片")}
        className={`absolute inset-0 flex flex-col justify-center items-center cursor-pointer ${lg ? "gap-2" : "gap-1"}`}
      >
        {value ? null : (
          <>
            <span
              aria-hidden="true"
              className={`font-sans font-medium text-l1 leading-none lg:group-hover:text-accent transition-colors duration-200 motion-reduce:transition-none ${
                lg ? "text-4xl lg:text-5xl" : "text-xl"
              }`}
            >
              {busy ? "…" : "+"}
            </span>

            {lg && title ? (
              <span className="font-sans font-bold text-l1 text-sm lg:text-base">
                {busy ? "处理中…" : title}
              </span>
            ) : null}

            {error ? (
              <span className={`${META} text-accent normal-case`}>该图片无法读取，请更换一张</span>
            ) : lg ? (
              hint ? <span className="text-l2 text-[11px] lg:text-xs">{hint}</span> : null
            ) : (
              <span className={`${META} text-l3`}>{busy ? "读取中" : "JPG / PNG"}</span>
            )}
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={Boolean(onPickMany)}
        className="sr-only"
        onChange={(event) => {
          void pick(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
