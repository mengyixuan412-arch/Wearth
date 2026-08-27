"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { META, WIDE } from "@/components/panel";

/**
 * 全站弹窗的统一外壳。**三个弹窗（录入单品 / 添加分类 / 穿搭记录）共用这一套**，
 * 不要各写各的 —— 它们是同一个层级的东西，标题字号、遮罩浓度、关闭按钮的大小
 * 只要有一处不一样，连着开两个就能看出来。
 *
 * 定死的部分：
 *
 * - **Portal 到 body。** ScrollShell 在首页会套一层 Lenis 平滑滚动容器，弹窗留在
 *   那棵子树里滚轮会被 Lenis 先接走，内部滚不动；挂到 body 上就彻底脱离它的管辖，
 *   顺带也不受任何祖先的层叠上下文影响。
 * - **遮罩 `bg-l1/25` + `backdrop-blur-md`。** 用令牌不写死色值，暗色态自动翻转。
 * - **表头两行左对齐**：上行英文小字（`tracking-[0.2em]`），下行中文标题
 *   `text-lg lg:text-2xl` + `wdth 120`。**不铺底色** —— 头与内容之间只靠一条
 *   发丝线分开，多一层灰底会让弹窗顶部显得比内容重。
 * - **入场动画在这一层，不要各写各的。** 遮罩 150ms 淡入、面板 220ms 淡入 + 上浮
 *   10px。分开跑是因为两者一起位移会让整屏都在动，看着像页面在抖。
 * - **关闭按钮方形 `w-7 lg:w-8`**，`✕`，压在表头右侧，hover 转 accent。
 *
 * 内容区自己决定底色与滚动：滚动容器**必须带 `data-lenis-prevent`**
 * （Lenis 全局接管滚轮，不加这个属性弹窗里永远收不到滚轮事件），
 * 且**不要套 `no-scrollbar`** —— 弹窗里必须让人看见还有内容没露出来。
 */
export default function DialogShell({
  zh,
  en,
  label,
  action,
  onClose,
  panelClassName = "max-w-4xl",
  children,
}: {
  /** 中文大标题。 */
  zh: string;
  /** 英文小字，Title Case 写就行，`META` 自带 uppercase。 */
  en: string;
  /** 给读屏用的完整描述。省略则回落到 `zh`。 */
  label?: string;
  /** 关闭按钮左边的额外操作，如「删除这天」。 */
  action?: React.ReactNode;
  onClose: () => void;
  /** 追加到面板上的类，主要用来定宽高。 */
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // 嵌套时两层都挂着 keydown，不拦的话按一次 Esc 会把两层一起关掉
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label ?? zh}
      className="z-50 fixed inset-0 flex justify-center items-center bg-l1/25 backdrop-blur-md p-4 lg:p-8 animate-[dialogVeil_150ms_ease-out] motion-reduce:animate-none"
      onPointerDown={(event) => {
        /* **必须拦住冒泡。** 这个壳可能嵌在另一个弹窗里（同意弹窗就开在录入弹窗上），
           portal 到 body 只改变 DOM 位置，**React 树里它仍是外层弹窗的后代** ——
           不拦的话点这里的任何一处，外层弹窗的遮罩都会判定「落点不在我的面板内」
           而把自己关掉：用户点「手动填写」，整个录入弹窗跟着消失。 */
        event.stopPropagation();
        // 只有按下在遮罩本身（不是弹窗内部）才关 —— 用 pointerdown 判断落点，
        // 从弹窗里往外拖选文字松手时才不会误关。
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`flex flex-col bg-card shadow-2xl border border-l4 w-full max-h-[88vh] overflow-hidden animate-[dialogRise_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none ${panelClassName}`}
      >
        <header className="relative flex flex-col items-start gap-2 lg:gap-2.5 pr-14 lg:pr-16 pl-5 lg:pl-7 py-4 lg:py-5 border-line border-b shrink-0">
          <p className={`${META} text-l3 tracking-[0.2em]`}>{en}</p>
          <h2 className="font-sans font-bold text-l1 text-lg lg:text-2xl leading-none" style={WIDE}>
            {zh}
          </h2>

          <div className="top-1/2 right-4 lg:right-6 absolute flex items-center gap-2 -translate-y-1/2">
            {action}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="flex justify-center items-center border border-l4 lg:hover:border-accent w-7 lg:w-8 h-7 lg:h-8 text-l2 lg:hover:text-accent text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>,
    document.body,
  );
}

/** 表头里那种次要操作按钮。删除、更换、移除都走这一个。 */
export const DIALOG_ACTION =
  "font-ui text-[10px] lg:text-xs uppercase border border-l4 bg-card px-2.5 py-1.5 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer";
