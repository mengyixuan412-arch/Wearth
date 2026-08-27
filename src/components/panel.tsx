"use client";

import ScrambleText from "@/components/scramble-text";

/** 小字规格。全站的角标、编号、单位、元数据都走这一档。 */
export const META = "font-ui text-[10px] lg:text-xs uppercase";
/** 大标题的宽度轴。TikTok Sans 是双轴可变字，标题一律加宽到 120。 */
export const WIDE = { fontVariationSettings: '"wdth" 120' } as const;

/**
 * 内容面板。全站表单与读数的统一骨架：一圈灰线框 + 一条页眉横线，
 * 页眉左编号（粉）、中标题、右单位说明或操作按钮。
 *
 * 内容区默认不留内边距 —— 里面的格子自己带 padding，靠 `gap-px bg-line`
 * 织出分隔线，格子边缘直接顶到框上。需要留白的内容自己包一层。
 */
export default function Panel({
  id,
  index,
  zh,
  en,
  meta,
  delay = 0,
  action,
  className = "",
  children,
}: {
  id?: string;
  index: string;
  zh: string;
  en: string;
  meta?: string;
  delay?: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`flex flex-col bg-card border border-l4 scroll-mt-4 ${className}`}>
      <header className="flex items-baseline gap-2 lg:gap-3 px-4 lg:px-5 py-3 border-line border-b">
        <span className={`${META} text-accent tabular-nums`}>{index}</span>
        <h2 className="flex items-baseline gap-2 min-w-0">
          <span className="font-sans font-bold text-l1 text-sm lg:text-base" style={WIDE}>
            {zh}
          </span>
          <span className={`${META} text-l3 truncate`}>
            <ScrambleText text={en} letterDelayMs={40} startDelayMs={delay} scrambleColors={false} />
          </span>
        </h2>
        <span aria-hidden="true" className="flex-1 min-w-2" />
        {action ?? (meta ? <span className={`${META} text-l3 shrink-0`}>{meta}</span> : null)}
      </header>

      <div className="flex flex-col flex-1">{children}</div>
    </section>
  );
}
