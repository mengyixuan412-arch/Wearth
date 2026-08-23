"use client";

import { useRef, useState } from "react";

import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";

/** 长边上限。原图直接进 localStorage 会撑爆 5MB 配额，必须先缩。 */
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.82;

/** 按长边等比缩到 MAX_EDGE 以内，输出 JPEG dataURL。 */
async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export default function PhotoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await downscale(file));
    } catch {
      setError("这张图读不出来，换一张试试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`${DOTTED_BORDER_BASE} relative border border-line w-full aspect-4/5 overflow-hidden`}
      >
        {value ? (
          // 用户上传的任意图片，尺寸未知，next/image 的静态优化派不上用场。
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="个人全身照" className="w-full h-full object-cover" />
        ) : null}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 flex flex-col justify-center items-center gap-1 cursor-pointer"
          aria-label={value ? "更换个人全身照" : "上传个人全身照"}
        >
          {value ? null : (
            <>
              <span className="text-l2 text-sm lg:text-base">
                {busy ? "处理中…" : "上传个人全身照"}
              </span>
              <span className="font-mono-2 text-l3 text-[10px] lg:text-xs uppercase">
                Upload Full-Body Photo
              </span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex justify-between items-center gap-2 min-h-5 font-mono-2 text-[10px] lg:text-xs uppercase">
        {error ? (
          <span className="text-l1">{error}</span>
        ) : (
          <span className="text-l3">{value ? "已上传" : "JPG / PNG"}</span>
        )}
        {value ? (
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={`${DOTTED_BORDER_BASE} p-1 text-l2 lg:hover:text-l1 uppercase cursor-pointer`}
            >
              更换
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className={`${DOTTED_BORDER_BASE} p-1 text-l2 lg:hover:text-l1 uppercase cursor-pointer`}
            >
              移除
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
