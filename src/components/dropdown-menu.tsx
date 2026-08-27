"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 与药丸控件、分类 tab 同一档字：加宽 110 的粗体无衬线。 */
export const MENU_LABEL = { fontVariationSettings: '"wdth" 110' } as const;

/** 淡入 / 淡出时长。 */
const FADE_MS = 180;
/**
 * 选中之后、开始收起之前的停留。点完立刻消失的话，用户来不及看见对勾落到
 * 新的那一行上，会不确定自己到底点中了哪个 —— 这一下停留就是那句「收到了」。
 * 动作型菜单（`variant="actions"`）不需要它：点完就该去干活了。
 */
const DWELL_MS = 260;

export type MenuOption = {
  key: string;
  label: string;
  /** 可省。筛选类下拉的选项（季节、品牌名）没有对得上的图标，就不要硬凑。 */
  icon?: ReactNode;
  /** 仅 `variant="select"` 用：画底色与右侧对勾。 */
  selected?: boolean;
  onSelect: () => void;
};

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m5 12.5 4.6 4.6L19 7.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
  >
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/**
 * 带图标的下拉菜单（DESIGN.md §5.4）。触发器是 §5.3 的药丸，面板是全站唯一
 * 带外投影的浮层 —— 白底上摞白面板，发丝线自己分不开两层白。
 *
 * 两种用法：
 * - `variant="select"` 选一个值（排序），行有选中态，收起前留一下停顿；
 * - `variant="actions"` 触发一个动作（添加），无选中态，点完立即收。
 *
 * 分组只靠 `groups` 切开，**组间不画分隔线** —— 一组内共用的图标就是分组信号。
 */
export default function DropdownMenu({
  label,
  ariaLabel,
  triggerIcon,
  groups,
  width = 224,
  maxHeight,
  align = "left",
  tone = "outline",
  variant = "select",
  triggerClassName = "",
}: {
  label: string;
  ariaLabel: string;
  triggerIcon: ReactNode;
  /** 每个数组是一组，组间靠共用图标区分，不画线。 */
  groups: MenuOption[][];
  width?: number;
  /**
   * 面板高度上限，超出内部滚动。**只在放不下时才传** —— 选项一多，
   * 面板会伸出祖先的 `overflow-hidden`（弹窗就是）被齐腰切断。
   */
  maxHeight?: number;
  /** 面板贴按钮的哪一边展开。控件贴着行末时才用 right。 */
  align?: "left" | "right";
  /** outline = 描边药丸（排序）；accent = 实心强调色（添加）。 */
  tone?: "outline" | "accent";
  variant?: "select" | "actions";
  /** 追加到触发器上的类，主要用来定宽 —— 筛选栏几个控件要等宽才排得齐。 */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  // 挂载后再翻成 true，淡入才有起点 —— 直接渲染成终态的话 transition 不会跑。
  const [shown, setShown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** 面板 portal 到 body 后自己定位，见下方 useLayoutEffect。 */
  const [box, setBox] = useState<{ top: number; left: number; right: number } | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const listId = useId();

  const flat = groups.flat();
  // 打开时要把焦点落到选中项，但它不能进 effect 的依赖 —— 选中后它会变，
  // 那会让「打开」的 effect 重跑一遍，把正在淡出的面板又拉回来。
  const selectedRef = useRef(0);
  selectedRef.current = Math.max(0, flat.findIndex((option) => option.selected));

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** 先淡出，等动画跑完再卸载 —— 直接 setOpen(false) 会让面板啪地消失。 */
  const close = useCallback((refocus: boolean) => {
    clearTimers();
    setShown(false);
    if (refocus) triggerRef.current?.focus();
    timers.current.push(setTimeout(() => setOpen(false), FADE_MS));
  }, []);

  const toggle = () => {
    clearTimers();
    if (open && shown) {
      close(false);
      return;
    }
    // 淡出途中再点：面板还挂着，直接淡回来，不必等它卸载。
    if (open) setShown(true);
    else setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    optionRefs.current[selectedRef.current]?.focus();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // 面板 portal 到了 body，不在 rootRef 的子树里，两处都要认才不会点一下就关。
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  /**
   * 面板不用 `absolute` 挂在触发器旁边，而是 portal 到 body 用 `fixed` 定位。
   *
   * 绝对定位的面板会被任何祖先的 `overflow` 裁掉 —— 录入弹窗的正文就是个
   * `overflow-y-auto` 容器，成分选择的下拉在里面会被齐腰切断。脱出去之后
   * 位置得自己算，所以在这里量触发器的矩形，并跟着滚动与窗口尺寸更新。
   *
   * `scroll` 用捕获阶段监听：滚的往往是内层容器，冒泡到 window 是收不到的。
   */
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setBox({ top: rect.bottom, left: rect.left, right: window.innerWidth - rect.right });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  /** 上下键在选项间移动，Home / End 跳两端。 */
  const moveFocus = (from: number, delta: number) => {
    optionRefs.current[(from + delta + flat.length) % flat.length]?.focus();
  };

  const accent = tone === "accent";
  let index = -1;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup={variant === "select" ? "listbox" : "menu"}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={`${
          accent
            ? "flex items-center gap-1.5 bg-accent px-3.5 py-1.5 rounded-full text-card transition-opacity duration-200 motion-reduce:transition-none lg:hover:opacity-85 cursor-pointer"
            : `flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-l1 transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
                open ? "bg-[rgba(0,0,0,0.07)] border-l1" : "border-line lg:hover:border-l1"
              }`
        } ${triggerClassName}`}
      >
        {triggerIcon}
        {/* flex-1 让箭头在定宽时被顶到最右；不定宽时容器按内容收缩，它不起作用。 */}
        <span className="flex-1 min-w-0 font-sans font-bold text-xs lg:text-sm text-left truncate" style={MENU_LABEL}>
          {label}
        </span>
        <span className={accent ? "text-card/80" : "text-l3"}>
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && box
        ? createPortal(
        <div
          ref={panelRef}
          id={listId}
          role={variant === "select" ? "listbox" : "menu"}
          aria-label={ariaLabel}
          // `data-lenis-prevent`：限高滚动时同样要挡住 Lenis，否则滚轮被它先接走。
          data-lenis-prevent={maxHeight ? "" : undefined}
          /**
           * 掐断 pointerdown 的 React 冒泡。
           *
           * 面板 portal 到了 body，但在 **React 树里**它仍然是弹窗/抽屉的后代，
           * 事件照样顺着 React 树冒上去；而那两层的「点外面就关」判的是 DOM
           * `contains`，面板不在它们的 DOM 子树里 —— 于是在弹窗里点一下菜单选项，
           * 整个弹窗就跟着关了（穿搭记录里挑分类即为此症状）。
           *
           * 关自己这一层不受影响：外部点击用的是 document 上的原生监听，
           * 它判的同样是「在不在面板里」，点在面板内本来就不该关。
           */
          onPointerDown={(event) => event.stopPropagation()}
          // z 要压过弹窗（z-50）—— 录入弹窗里的成分选择就开在弹窗之上。
          className={`z-[60] fixed bg-card border border-line rounded-2xl ${
            maxHeight ? "overflow-y-auto" : "overflow-hidden"
          } transition-[opacity,transform] motion-reduce:transition-none`}
          style={{
            width,
            maxHeight,
            top: box.top + 8,
            ...(align === "right" ? { right: box.right } : { left: box.left }),
            // 白底上要托起一层白面板，只能靠影子 —— 发丝线自己分不开两层白。
            boxShadow: "0 12px 32px rgba(20,20,28,0.10), 0 2px 6px rgba(20,20,28,0.06)",
            // §6 指定的浮层缓动。时长没取 500ms —— 那是给大面积转场的，
            // 菜单跟手才对，拖半秒会让人觉得点了没反应。
            transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
            transitionDuration: `${FADE_MS}ms`,
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(-4px)",
          }}
        >
          {groups.map((group) => (
            <div key={group[0]?.key}>
              {group.map((option) => {
                index += 1;
                const at = index;
                const on = variant === "select" && option.selected === true;
                return (
                  <button
                    key={option.key}
                    ref={(node) => {
                      optionRefs.current[at] = node;
                    }}
                    type="button"
                    role={variant === "select" ? "option" : "menuitem"}
                    aria-selected={variant === "select" ? option.selected === true : undefined}
                    tabIndex={-1}
                    onClick={() => {
                      option.onSelect();
                      clearTimers();
                      if (variant === "select") {
                        // 不立刻关 —— 让对勾先落到这一行上，停 DWELL_MS 再淡出。
                        timers.current.push(setTimeout(() => close(true), DWELL_MS));
                      } else {
                        close(false);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveFocus(at, 1);
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveFocus(at, -1);
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        optionRefs.current[0]?.focus();
                      } else if (event.key === "End") {
                        event.preventDefault();
                        optionRefs.current[flat.length - 1]?.focus();
                      }
                    }}
                    // 文字与图标一律 l1（黑）—— 不用「灰 / 黑」区分选中与否，
                    // 那会让未选中的几条读起来像被禁用。
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 w-full text-l1 text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer focus-visible:bg-[rgba(0,0,0,0.05)] outline-none ${
                      on ? "bg-accent-wash" : "lg:hover:bg-[rgba(0,0,0,0.05)]"
                    }`}
                  >
                    {option.icon ? (
                      <span aria-hidden="true" className="shrink-0">
                        {option.icon}
                      </span>
                    ) : null}
                    <span className="flex-1 font-sans font-bold text-xs lg:text-sm truncate" style={MENU_LABEL}>
                      {option.label}
                    </span>
                    {on ? (
                      <span aria-hidden="true" className="text-accent shrink-0">
                        <CheckIcon />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )
        : null}
    </div>
  );
}
