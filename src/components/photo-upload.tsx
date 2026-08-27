"use client";

import PhotoDrop from "@/components/photo-drop";
import { META } from "@/components/panel";

/**
 * 个人档案的参考照片投放区。框本身走 `PhotoDrop`（全站统一），
 * 这里只加下面那行「已上传 / 更换 / 移除」。
 */
export default function PhotoUpload({
  value,
  onChange,
  fill = false,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  /** 双栏版式下由投放区吃掉面板的剩余高度，两列的下沿才能对齐。 */
  fill?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-3 ${fill ? "xl:flex-1" : ""}`}>
      <PhotoDrop
        value={value}
        onChange={onChange}
        title="上传一张清晰全身照"
        // 格式跟在拍摄要求后面，同属「传之前要知道的事」。
        // 单开一行摆在框外，它就成了一条不知道在说谁的孤立读数。
        hint="正面站立、光线均匀、轮廓完整 · JPG / PNG"
        alt="个人全身照"
        ariaLabel={value ? "更换个人全身照" : "上传个人全身照"}
        className={fill ? "aspect-4/5 xl:flex-1 xl:aspect-auto xl:min-h-80" : "aspect-4/5"}
      />

      {/*
        **空态不渲染这一行。** 原来它是空的但把高度留着（`min-h-5` + 上面的 `gap-3`），
        为的是传完图冒出「已上传 / 移除」时框不往上跳；代价是没传图的时候框底下
        一直空着 32px，而空态才是这一格大部分时间的样子。
        取舍反过来：常驻的留白比一次性的 32px 位移更碍眼。
      */}
      {value ? (
        <div className={`${META} flex justify-between items-center gap-2`}>
          <span className="text-l3">已上传</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="border border-frame px-2 py-1 text-l2 lg:hover:border-accent lg:hover:text-accent uppercase transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
          >
            移除
          </button>
        </div>
      ) : null}
    </div>
  );
}
