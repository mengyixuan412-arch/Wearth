"use client";

import { useRef, useState } from "react";

import PhotoDrop from "@/components/photo-drop";
import { META } from "@/components/panel";
import { downscaleImage } from "@/lib/image";

/**
 * 「其他图片」——可多张的补充截图位。和三张主截图并排，但那三张各自**喂给
 * 特定的评分维度**（价格 / 尺码 / 材质），这一格不喂任何维度，只是让用户
 * 把详情页里其余说得清楚的部分（版型图、买家秀、面料特写）一并留下来。
 *
 * 因此它不设「必传」的分量：空态和三张主截图长得一样（走 `PhotoDrop`），
 * 有图之后才展开成缩略图网格。
 *
 * **上限 6 张**：这些图不进决策记录（同 `decide/page.tsx` 的注释，存进去会
 * 很快撑爆 localStorage），只在本次评分期间留在内存里，但六张之后再多也不会
 * 让评分更准，只会让这一格越滚越长。5 张 + 一个加号刚好铺满两行，不出现滚动。
 */
const MAX = 6;

export default function ShotMulti({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  /** 一次可以选多张，逐张缩完再一起并进去；超出上限的直接丢掉。 */
  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const room = MAX - values.length;
    const picked: string[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        picked.push(await downscaleImage(file));
      } catch {
        /* 读不出来的那张跳过，其余照常 */
      }
    }
    setBusy(false);
    if (picked.length > 0) onChange([...values, ...picked]);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={(event) => {
        void pick(event.target.files);
        event.target.value = "";
      }}
    />
  );

  if (values.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {/* 空态复用 PhotoDrop 只为版式一致；它的单张 onChange 在这里转成入列。 */}
        <PhotoDrop
          value={null}
          onChange={() => {}}
          onPickMany={(picked) => onChange(picked.slice(0, MAX))}
          title="其他图片"
          hint={busy ? "处理中…" : "商品其他信息图"}
          ariaLabel="上传其他图片"
          className="w-full aspect-4/3"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="gap-1.5 grid grid-cols-3 border border-frame p-1.5 w-full aspect-4/3">
        {values.map((src, index) => (
          <div key={`${index}-${src.slice(-16)}`} className="relative bg-be/50 aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`其他图片 ${index + 1}`} className="w-full h-full object-contain" />
            {/* 常显而不是 hover 才出 —— 触屏没有 hover，藏起来就删不掉了。 */}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              aria-label={`移除其他图片 ${index + 1}`}
              className="top-0.5 right-0.5 absolute flex justify-center items-center bg-card/85 border border-frame w-4 h-4 text-l2 lg:hover:text-accent text-[9px] leading-none transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}

        {values.length < MAX ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="继续添加其他图片"
            className="flex justify-center items-center bg-be/50 border border-frame lg:hover:border-accent border-dashed aspect-square text-l3 lg:hover:text-accent text-lg leading-none transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
          >
            {busy ? "…" : "+"}
          </button>
        ) : null}
      </div>

      <p className="flex items-baseline gap-2">
        <span className="font-sans font-bold text-l1 text-xs lg:text-sm">其他图片</span>
        <span className={`${META} text-l3 tabular-nums`}>
          {values.length} / {MAX}
        </span>
        <button
          type="button"
          onClick={() => onChange([])}
          className={`${META} ml-auto text-l3 lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer`}
        >
          全部移除
        </button>
      </p>

      {input}
    </div>
  );
}
