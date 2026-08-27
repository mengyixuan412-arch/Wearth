"use client";

import { useEffect, useState, type RefObject } from "react";

import { META } from "@/components/panel";

/**
 * 表单页左栏的分节目录。**个人档案与购买评分共用这一份**，两页的这一栏本来就是
 * 同一个东西：编号 + 中文名 + 「填了几项 / 共几项」+ 一颗完成点，点一下跳到那一节，
 * 滚动时高亮跟着走。各写各的就会在两页之间漂出差别。
 *
 * `done / need` 由调用方算 —— 什么算「填完了」是各页自己的事：档案数的是字段，
 * 评分数的是必填三项与出没出分。这里只负责画和跳。
 */
export type NavSection = {
  /** 同时是锚点 id 与 IntersectionObserver 的观察目标，要挂在对应面板上。 */
  id: string;
  index: string;
  zh: string;
  done: number;
  need: number;
};

function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-full w-1.5 h-1.5 transition-colors duration-300 motion-reduce:transition-none ${
        done ? "bg-accent" : "border border-l3"
      }`}
    />
  );
}

export default function SectionNav({
  sections,
  ariaLabel,
  rootRef,
}: {
  sections: NavSection[];
  ariaLabel: string;
  /**
   * 滚动容器。**页面自己有内层滚动区时必须传**（档案页的 `main`）——
   * 不传就按视口观察，那是「页面自滚」那一类版式（评分页）的情形。
   */
  rootRef?: RefObject<HTMLElement | null>;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  /**
   * 高亮跟着滚动走。rootMargin 把判定带压到容器上沿附近，
   * 取带内最靠上的一节为当前节 —— 不这么压的话，屏幕下半屏的小节
   * 一露头就抢走高亮，读起来永远超前一节。
   *
   * 依赖只放 id 串：`sections` 每次渲染都是新数组（done/need 在变），
   * 放进依赖会让观察器每敲一个字就重建一次。
   */
  const ids = sections.map((section) => section.id).join(",");
  useEffect(() => {
    const nodes = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root: rootRef?.current ?? null, rootMargin: "0px 0px -68% 0px", threshold: 0 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [ids, rootRef]);

  const jumpTo = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav aria-label={ariaLabel}>
      {/* 顶上那条黑线落在 aside 的上沿 —— 和右侧面板同属一个栅格行，
          所以它和第一张面板的上边线自然在同一条水平线上。
          下面一条换成 --line，和条目之间的分隔线同色，重量才不打架。 */}
      <p className={`${META} py-3 lg:py-3.5 border-t border-t-l1 border-b border-b-line text-l1 tracking-[0.2em]`}>
        Sections
      </p>
      {sections.map((section) => {
        const current = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => jumpTo(section.id)}
            aria-current={current ? "true" : undefined}
            className="group flex items-center gap-3 py-3 lg:py-3.5 border-line border-b w-full text-left cursor-pointer"
          >
            <span
              className={`${META} tabular-nums shrink-0 transition-colors duration-200 motion-reduce:transition-none ${
                current ? "text-accent" : "text-l3"
              }`}
            >
              {section.index}
            </span>
            <span
              className={`flex-1 min-w-0 truncate text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none ${
                current ? "font-sans font-bold text-l1" : "text-l2 lg:group-hover:text-l1"
              }`}
            >
              {section.zh}
            </span>
            <span className={`${META} text-l3 tabular-nums shrink-0`}>
              {section.done}/{section.need}
            </span>
            <StatusDot done={section.done === section.need} />
          </button>
        );
      })}
    </nav>
  );
}
