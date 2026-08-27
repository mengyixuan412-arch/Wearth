"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { valueText, type ValueSize } from "@/components/form-controls";
import { dateKey, formatDate, monthMatrix, parseKey } from "@/lib/date";

/**
 * 日期选择器。触发器是一颗方框（跟着它旁边那几个输入框走），面板是一张
 * 月历浮层 —— 和 `dropdown-menu` 同一套浮层机制：portal 到 body 用 fixed
 * 定位，自己量触发器的矩形。
 *
 * **不用原生 `<input type="date">`。** 它渲染的是系统控件：各浏览器长相不同、
 * 日期格式跟着系统语言变，更要命的是没法在格子上打点 —— 而「这一天已经有
 * 记录了」正是这两处（养护、穿着）最需要一眼看见的信息。
 */

/** 淡入淡出。和下拉菜单同一档（DESIGN.md §6：浮层 500ms 的例外）。 */
const FADE_MS = 180;

/** 周一起头，和 `monthMatrix` 的矩阵一致。 */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 面板尺寸。7 列 × 34px + 左右 14px 内边距；高度用于判断朝上还是朝下展开。 */
const PANEL_W = 268;
const PANEL_H = 300;

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

/**
 * `cell` 变体的触发器外壳。**底对齐**，和 §5.5 的 `VALUE_ROW` 一个道理 ——
 * 这一格的日期要和隔壁「价格」那格的数字落在同一条基线上。
 */
const VALUE_ROW_TRIGGER =
  "group flex flex-1 items-end gap-2 bg-transparent min-w-0 text-left cursor-pointer";

const Chevron = ({ left }: { left?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d={left ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  marked,
  align = "left",
  variant = "box",
  size = "md",
  className = "",
}: {
  /** YYYY-MM-DD。 */
  value: string;
  onChange: (key: string) => void;
  /** 无障碍名，也是面板的 aria-label。 */
  label: string;
  min?: string;
  max?: string;
  /** 要在格子下方打点的日期。养护记录传已记账的日子，穿着日志传已关联的日子。 */
  marked?: string[];
  align?: "left" | "right";
  /**
   * 触发器长什么样。两处版式对触发器的要求不同，但**面板完全一样**：
   * - `box` 紧凑行里的方框（单品详情的养护 / 穿着记录），跟着旁边的输入框走；
   * - `cell` 表单格里的大号值（录入弹窗的购入日期），跟着 §5.5 的 `VALUE_TEXT` 走。
   */
  variant?: "box" | "cell";
  /** 仅 `cell` 用：值的字号档，和同一张表里其余格子取同一档。 */
  size?: ValueSize;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // 挂载后再翻成 true，淡入才有起点 —— 直接渲染成终态的话 transition 不会跑。
  const [shown, setShown] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(parseKey(value)));
  /** 键盘焦点落在哪一天。roving tabindex：只有它是 tabIndex 0。 */
  const [focusKey, setFocusKey] = useState(value);
  const [box, setBox] = useState<{ top?: number; bottom?: number; left: number; right: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const todayKey = useMemo(() => dateKey(new Date()), []);
  const markedSet = useMemo(() => new Set(marked ?? []), [marked]);
  const cells = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const outOfRange = useCallback(
    (key: string) => (max !== undefined && key > max) || (min !== undefined && key < min),
    [min, max],
  );

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
    // 每次打开都从当前值重新起算，不留上次翻到哪个月的残留。
    setCursor(startOfMonth(parseKey(value)));
    setFocusKey(value || todayKey);
    if (open) setShown(true);
    else setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  /** 焦点跟着 focusKey 走。翻月后新月份的格子渲染出来才focus得到，所以放在 effect 里。 */
  useEffect(() => {
    if (!open) return;
    dayRefs.current.get(focusKey)?.focus();
  }, [open, focusKey, cursor]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    /**
     * Esc 走**捕获阶段并掐断冒泡**：这个控件开在抽屉和弹窗里，而它们的关闭
     * 监听挂在 document 的冒泡阶段。不掐断的话按一下 Esc 会连着把外面那层
     * 一起关掉 —— 用户想收的只是这张月历。
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  /**
   * 面板 portal 到 body 用 fixed 定位，位置自己算 —— 绝对定位会被祖先的
   * `overflow` 裁掉（抽屉正文与弹窗正文都是 `overflow-y-auto`）。
   * `scroll` 用捕获阶段监听：滚的是内层容器，冒泡到 window 收不到。
   */
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom;
      // 下方站不下、且上方更宽敞时朝上展开，否则月历会被视口下沿切掉。
      const flip = below < PANEL_H + 16 && rect.top > below;
      setBox({
        top: flip ? undefined : rect.bottom + 8,
        bottom: flip ? window.innerHeight - rect.top + 8 : undefined,
        // 触发器贴着右边（抽屉就在屏幕右侧）时把面板收回视口内。
        left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_W - 8)),
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  /** 移动键盘焦点。跨出当月就把月份一起翻过去。 */
  const moveFocus = (deltaDays: number) => {
    const next = parseKey(focusKey);
    next.setDate(next.getDate() + deltaDays);
    setFocusKey(dateKey(next));
    if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) {
      setCursor(startOfMonth(next));
    }
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    // 焦点跟到新月份的同一天，翻不过去（月份短）就落到月末。
    const day = Math.min(parseKey(focusKey).getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
    setFocusKey(dateKey(new Date(next.getFullYear(), next.getMonth(), day)));
  };

  /**
   * 选中之后**不自动收起**。下拉菜单那种「停一下再关」在这里不成立 ——
   * 挑日期常常要改两次（点错一天、或者翻个月再看看），面板一落定就消失的话
   * 每次都得重新点开。让它留在原地：粉圆点落在哪一天看得清清楚楚，
   * 用户下一步点金额、点外面、按 Esc 或再点一次触发器，它自己就收了。
   */
  const pick = (key: string) => {
    if (outOfRange(key)) return;
    onChange(key);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  // 整个上/下一月都出了界就不必再翻过去。
  const prevOff = min !== undefined && dateKey(new Date(year, month, 0)) < min;
  const nextOff = max !== undefined && dateKey(new Date(year, month + 1, 1)) > max;

  const rows = Array.from({ length: 6 }, (_, row) => cells.slice(row * 7, row * 7 + 7));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}：${value ? formatDate(value) : "未选择"}`}
        className={
          variant === "cell"
            ? // 表单格：无边框，值本身就是可点的，右端一枚 chevron 提示能展开。
              `${VALUE_ROW_TRIGGER} outline-none ${className}`
            : // 紧凑行：焦点环跟着旁边几个输入框走，粉色边框，不留浏览器那圈蓝的。
              `flex items-center gap-2 bg-transparent px-2 py-1.5 border outline-none focus-visible:border-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer shrink-0 ${
                open ? "border-accent" : "border-line lg:hover:border-accent"
              } ${className}`
        }
      >
        <span
          className={
            variant === "cell"
              ? `${valueText(size)} ${value ? "text-l1" : "text-l3"} tabular-nums`
              : "font-sans text-l1 text-xs lg:text-sm leading-none tabular-nums"
          }
          style={variant === "cell" ? { fontVariationSettings: '"wdth" 105' } : undefined}
        >
          {value ? formatDate(value) : "选择日期"}
        </span>
        <span
          aria-hidden="true"
          className={`transition-colors duration-200 motion-reduce:transition-none ${
            open ? "text-accent" : "text-l3"
          }`}
        >
          <Chevron />
        </span>
      </button>

      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              data-lenis-prevent=""
              /**
               * 掐断 pointerdown 的 React 冒泡。面板 portal 到了 body，但在
               * **React 树里**它仍然是抽屉/弹窗的后代，事件照样冒上去 ——
               * 而那两层的「点外面就关」判的是 DOM `contains`，面板不在它们的
               * DOM 子树里，于是点一下日历就把整个抽屉关掉了。
               */
              onPointerDown={(event) => event.stopPropagation()}
              // z 要压过抽屉与弹窗（都是 z-50）—— 它就开在它们之上。
              className="z-[60] fixed bg-card p-3.5 border border-line rounded-2xl transition-[opacity,transform] motion-reduce:transition-none"
              style={{
                width: PANEL_W,
                top: box.top,
                bottom: box.bottom,
                ...(align === "right" ? { right: box.right } : { left: box.left }),
                // 白底上托起一层白面板，只能靠影子 —— 发丝线自己分不开两层白。
                boxShadow: "0 12px 32px rgba(20,20,28,0.10), 0 2px 6px rgba(20,20,28,0.06)",
                transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
                transitionDuration: `${FADE_MS}ms`,
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(-4px)",
              }}
            >
              {/* 月份与翻页 */}
              <div className="flex justify-between items-center mb-3">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={prevOff}
                  aria-label="上个月"
                  className={`flex justify-center items-center rounded-full w-7 h-7 transition-colors duration-200 motion-reduce:transition-none ${
                    prevOff
                      ? "text-l4 cursor-not-allowed"
                      : "text-l3 lg:hover:bg-[rgba(0,0,0,0.07)] lg:hover:text-l1 cursor-pointer"
                  }`}
                >
                  <Chevron left />
                </button>
                <p
                  aria-live="polite"
                  className="font-sans font-bold text-l1 text-sm lg:text-base leading-none tabular-nums"
                  style={{ fontVariationSettings: '"wdth" 110' }}
                >
                  {year}年{month + 1}月
                </p>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={nextOff}
                  aria-label="下个月"
                  className={`flex justify-center items-center rounded-full w-7 h-7 transition-colors duration-200 motion-reduce:transition-none ${
                    nextOff
                      ? "text-l4 cursor-not-allowed"
                      : "text-l3 lg:hover:bg-[rgba(0,0,0,0.07)] lg:hover:text-l1 cursor-pointer"
                  }`}
                >
                  <Chevron />
                </button>
              </div>

              {/* 星期行 */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((day) => (
                  <span
                    key={day}
                    className="font-ui text-[10px] text-l3 lg:text-xs text-center leading-none"
                  >
                    {day}
                  </span>
                ))}
              </div>

              {/* 日格。六行固定，翻月时面板高度不跳。 */}
              <div
                role="grid"
                aria-label={`${year}年${month + 1}月`}
                className="grid grid-cols-7 justify-items-center"
                onKeyDown={(event) => {
                  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
                  if (step !== undefined) {
                    event.preventDefault();
                    moveFocus(step);
                    return;
                  }
                  if (event.key === "PageUp" || event.key === "PageDown") {
                    event.preventDefault();
                    shiftMonth(event.key === "PageUp" ? -1 : 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setFocusKey(dateKey(new Date(year, month, 1)));
                  } else if (event.key === "End") {
                    event.preventDefault();
                    setFocusKey(dateKey(new Date(year, month + 1, 0)));
                  }
                }}
              >
                {rows.map((row, index) => (
                  // `contents` 让行只承担语义，不打断七列栅格。
                  <div key={index} role="row" className="contents">
                    {row.map(({ date, inMonth }) => {
                      const key = dateKey(date);
                      const off = outOfRange(key);
                      const on = key === value;
                      const isToday = key === todayKey;
                      return (
                        <button
                          key={key}
                          ref={(node) => {
                            if (node) dayRefs.current.set(key, node);
                            else dayRefs.current.delete(key);
                          }}
                          type="button"
                          role="gridcell"
                          aria-selected={on}
                          aria-current={isToday ? "date" : undefined}
                          // 出界的日子不加 disabled 而是 aria-disabled：
                          // disabled 的按钮接不到焦点，方向键会在它那里断掉。
                          aria-disabled={off || undefined}
                          tabIndex={key === focusKey ? 0 : -1}
                          onFocus={() => setFocusKey(key)}
                          onClick={() => pick(key)}
                          className={`relative flex justify-center items-center justify-self-center rounded-full w-8 h-8 font-sans text-xs lg:text-sm leading-none tabular-nums transition-colors duration-200 motion-reduce:transition-none outline-none focus-visible:ring-1 focus-visible:ring-l1 ${
                            off
                              ? "text-l4 cursor-not-allowed"
                              : on
                                ? // 选中态填 accent（DESIGN.md §2 指定「画在白底上的选中态填充」那一支）。
                                  // 字走 text-card 不写死白色 —— 暗色态下 accent 翻成亮粉，字得跟着翻深。
                                  "bg-accent text-card cursor-pointer"
                                : `${inMonth ? "text-l1" : "text-l3"} ${
                                    isToday ? "bg-[rgba(0,0,0,0.07)]" : ""
                                  } lg:hover:bg-[rgba(0,0,0,0.07)] cursor-pointer`
                          }`}
                        >
                          {date.getDate()}
                          {/* 这一天已经有记录。选中态翻成卡片色，黑底上才读得出。 */}
                          {markedSet.has(key) ? (
                            <span
                              aria-hidden="true"
                              className={`bottom-[3px] left-1/2 absolute rounded-full w-1 h-1 -translate-x-1/2 ${
                                on ? "bg-card" : off || !inMonth ? "bg-l4" : "bg-accent"
                              }`}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
