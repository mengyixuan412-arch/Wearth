"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { META } from "@/components/panel";
import { dateKey, monthMatrix, parseKey, today as todayKeyOf } from "@/lib/date";
import { FRAME } from "@/lib/layout";
import type { OotdMap } from "@/lib/ootd-store";

/**
 * 单品详情里的「挑哪几天穿过」浮层。
 *
 * **它是穿搭日志那张日历的缩印版**，不是一个通用日期选择器：格子里放的是当天
 * 那张 OOTD 照片，竖版 3:4、白纸细线分格，和 `/ootd` 同一种纸。挑日期是盲选 ——
 * 用户记不住 8 月 12 号穿的是哪套；把照片摆出来，点哪张是看着定的。
 *
 * **任何过去的日子都能点**，那天有没有传过照片都行 —— 点没照片的一天会就地建一条
 * 只有单品的 OOTD 记录（PRD 6.4 允许「先传照片、稍后关联」，反过来同样成立）。
 * 未来的日子点不动：还没穿过的一天不该给 CPW 的分母加数。
 */

/** 淡入淡出。和下拉菜单、日期选择器同一档（DESIGN.md §6）。 */
const FADE_MS = 180;

/** 周一起头，和 `monthMatrix` 的矩阵一致。 */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const SERIF = { fontFamily: 'Georgia, "Times New Roman", "Songti SC", serif' } as const;

/** 面板尺寸。7 列 × 42px + 左右内边距；高度用于判断朝上还是朝下展开。 */
const PANEL_W = 322;
const PANEL_H = 400;

/**
 * 「要当文字读」的那一档粉（DESIGN.md §2：`#D53F7D`，对比度约 4:1）。
 * 走令牌而不是从 `analysis-charts` 里 import 常量 —— 那是整套图表件，
 * 为一个色号把它拉进衣橱这条路由的包里不值。
 */
const PINK_INK = "var(--accent)";

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

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

const CalendarIcon = () => (
  <svg viewBox="0 0 14 14" aria-hidden="true" className="block w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.1">
    <rect x="1.5" y="2.8" width="11" height="9.7" rx="1" />
    <path d="M1.5 5.6h11M4.6 1.5v2.4M9.4 1.5v2.4" strokeLinecap="round" />
  </svg>
);

export default function WearCalendar({
  worn,
  records,
  onLink,
  onUnlink,
}: {
  /** 这件衣服已关联的日期键，倒序。 */
  worn: string[];
  records: OotdMap;
  onLink: (day: string) => void;
  onUnlink: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // 挂载后再翻成 true，淡入才有起点 —— 直接渲染成终态的话 transition 不会跑。
  const [shown, setShown] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  /** 面板落点。`side` 只用来决定进场往哪个方向推那 4px。 */
  const [box, setBox] = useState<
    { top?: number; bottom?: number; left: number; side: "right" | "down" | "up" } | null
  >(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const todayKey = useMemo(() => todayKeyOf(), []);
  const wornSet = useMemo(() => new Set(worn), [worn]);
  const cells = useMemo(() => monthMatrix(cursor.getFullYear(), cursor.getMonth()), [cursor]);

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
    // 每次打开都回到「最近有记录的那个月」，翻月的残留不留到下次。
    setCursor(startOfMonth(parseKey(worn[0] ?? todayKey)));
    if (open) setShown(true);
    else setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // 掐断冒泡，否则抽屉挂在 document 上的 Esc 监听会把整个抽屉一起关掉。
      event.stopPropagation();
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    // 捕获阶段先接：抽屉的 Esc 也挂在 document 上，谁先拿到谁说了算。
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  /**
   * 面板 portal 到 body 用 fixed 定位，位置自己量 —— 绝对定位会被抽屉正文的
   * `overflow-y-auto` 裁掉。
   *
   * **优先从按钮右沿向右浮出。** 抽屉是贴右边的 `max-w-xl`（576px），按钮又在它的
   * 左内边距上，右边正好铺得下这块 322px 的面板；朝下开则会盖住底下的备注那几节，
   * 一张月历有六行，盖掉的是整屏。
   *
   * 右边塞不下（窄屏抽屉铺满）才退回上下展开，仍然装不下就朝上开。
   * `scroll` 用捕获阶段监听：滚的是抽屉内层容器，冒泡到 window 收不到。
   */
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      /** 面板与按钮的距离，同时也是贴视口边的留白。 */
      const GAP = 8;

      if (window.innerWidth - rect.right - GAP * 2 >= PANEL_W) {
        // 纵向跟着按钮走，再夹回视口里 —— 按钮滚到很靠下时面板不该跟着掉出去。
        const top = Math.min(Math.max(GAP, rect.top), Math.max(GAP, window.innerHeight - PANEL_H - GAP));
        setBox({ top, left: rect.right + GAP, side: "right" });
        return;
      }

      const below = window.innerHeight - rect.bottom;
      const left = Math.min(rect.left, Math.max(GAP, window.innerWidth - PANEL_W - GAP));
      setBox(
        below < PANEL_H && rect.top > below
          ? { bottom: window.innerHeight - rect.top + GAP, left, side: "up" }
          : { top: rect.bottom + GAP, left, side: "down" },
      );
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const shiftMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        /**
         * 和同一张抽屉里「+ 添加材质成分」「+ 添加养护记录」**同一颗按钮**。
         *
         * 这三颗做的是同一类事 —— 给这一节加一行 —— 还连着出现在三个相邻分节里，
         * 长成两种语言就会读成两种东西。§5.3 那套药丸壳管的是页面级的分段 / 筛选 /
         * 排序 / 分页（衣橱首图下那条），不是区块内的操作。
         *
         * 唯一的差别是把「+」换成日历图标：它是这颗按钮真正多出来的信息 ——
         * 点开的是一张月历，不是就地展开的一行表单。
         */
        className={`${META} flex items-center gap-1.5 border px-3 py-2 transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
          open ? "border-accent text-accent" : "border-line text-l2 lg:hover:border-accent lg:hover:text-accent"
        }`}
      >
        <CalendarIcon />
        添加穿搭记录
      </button>

      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="勾选这件衣服穿过的日子"
              data-lenis-prevent=""
              /**
               * 掐断 pointerdown 的 React 冒泡。面板 portal 到了 body，但在
               * **React 树里**它仍是抽屉的后代，事件照样冒上去 —— 而抽屉的
               * 「点外面就关」判的是 DOM `contains`，面板不在它的 DOM 子树里，
               * 于是点一下日历就把整个抽屉关掉了（和 `date-picker` 同一个坑）。
               */
              onPointerDown={(event) => event.stopPropagation()}
              // z 要压过抽屉与弹窗（都是 z-50）—— 它就开在它们之上。
              className="z-[60] fixed bg-card p-3 border border-line rounded-2xl transition-[opacity,transform] motion-reduce:transition-none"
              style={{
                width: PANEL_W,
                top: box.top,
                bottom: box.bottom,
                left: box.left,
                // 白底上托起一层白面板，只能靠影子 —— 发丝线自己分不开两层白。
                boxShadow: "0 12px 32px rgba(20,20,28,0.10), 0 2px 6px rgba(20,20,28,0.06)",
                transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
                transitionDuration: `${FADE_MS}ms`,
                opacity: shown ? 1 : 0,
                // 从哪边浮出就往哪边推：向右开的推 X，上下开的推 Y。
                transform: shown
                  ? "translate(0, 0)"
                  : box.side === "right"
                    ? "translateX(-4px)"
                    : `translateY(${box.side === "up" ? 4 : -4}px)`,
              }}
            >
              {/* 刊头：和 /ootd 一样是花体月份 + 年份，缩到浮层的尺度 */}
              <div className="flex justify-between items-center mb-2.5">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="上个月"
                  className="flex justify-center items-center rounded-full w-7 h-7 text-l3 lg:hover:bg-[rgba(0,0,0,0.07)] lg:hover:text-l1 transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
                >
                  <Chevron left />
                </button>
                <p aria-live="polite" className="text-l1 text-base italic leading-none tabular-nums" style={SERIF}>
                  {year}年{month + 1}月
                </p>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="下个月"
                  className="flex justify-center items-center rounded-full w-7 h-7 text-l3 lg:hover:bg-[rgba(0,0,0,0.07)] lg:hover:text-l1 transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
                >
                  <Chevron />
                </button>
              </div>

              {/* 白纸从星期行开始，内部靠细线分格 —— 和 /ootd 那张表同一种纸 */}
              <div className="bg-white overflow-hidden" style={{ border: `1px solid ${FRAME}` }}>
                <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${FRAME}` }}>
                  {WEEKDAYS.map((day, index) => (
                    <p
                      key={day}
                      className="py-1 text-xs text-center italic leading-none"
                      style={{
                        ...SERIF,
                        color: PINK_INK,
                        borderLeft: index === 0 ? undefined : `1px solid ${FRAME}`,
                      }}
                    >
                      {day}
                    </p>
                  ))}
                </div>

                <div role="grid" aria-label={`${year}年${month + 1}月`} className="grid grid-cols-7">
                  {cells.map(({ date, inMonth }, index) => {
                    const key = dateKey(date);
                    const record = records[key];
                    const photo = record?.photo ?? null;
                    const on = wornSet.has(key);
                    // 未来的日子不给点 —— 还没穿过的一天不该给 CPW 的分母加数。
                    const future = key > todayKey;

                    return (
                      <div
                        key={key}
                        role="gridcell"
                        className="relative min-w-0 aspect-3/4"
                        style={{
                          borderLeft: index % 7 === 0 ? undefined : `1px solid ${FRAME}`,
                          borderTop: index < 7 ? undefined : `1px solid ${FRAME}`,
                        }}
                      >
                        <button
                          type="button"
                          disabled={future}
                          aria-pressed={future ? undefined : on}
                          aria-label={`${date.getMonth() + 1} 月 ${date.getDate()} 日${
                            future ? "，还没到" : on ? "，已关联，点击取消" : "，点击关联这天的穿搭"
                          }`}
                          onClick={() => (on ? onUnlink(key) : onLink(key))}
                          className={`block relative w-full h-full overflow-hidden transition-colors duration-200 motion-reduce:transition-none ${
                            future ? "cursor-not-allowed" : "cursor-pointer lg:hover:bg-selection/[0.05]"
                          }`}
                        >
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt=""
                              className={`w-full h-full object-cover transition-opacity duration-200 motion-reduce:transition-none ${
                                on ? "opacity-100" : "opacity-70"
                              }`}
                            />
                          ) : null}

                          {/*
                            日历上只有这一种标记：**这件穿过这天**。

                            「这天有没有别的穿搭记录」不标 —— 那对当前这件衣服没有
                            行动含义，而多一种粉点只会让人先去猜自己选中了什么。

                            压在照片上时补一圈白 —— 深色照片上纯粉点会糊掉。
                          */}
                          {on ? (
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 flex justify-center items-center pointer-events-none"
                            >
                              <span
                                className="bg-accent rounded-full w-1.5 h-1.5"
                                style={{ boxShadow: photo ? "0 0 0 1.5px rgba(255,255,255,0.9)" : undefined }}
                              />
                            </span>
                          ) : null}
                        </button>

                        {/* 日期数字：右下角，和 /ootd 一致 */}
                        <span
                          className="right-1 bottom-0.5 absolute font-bold text-[11px] leading-none tabular-nums pointer-events-none"
                          style={{
                            ...SERIF,
                            color: key === todayKey ? "rgba(255,46,136,0.9)" : "var(--label-1)",
                            opacity: inMonth ? (future ? 0.35 : 1) : 0.28,
                            textShadow: photo ? "0 1px 3px rgba(255,255,255,0.9)" : undefined,
                          }}
                        >
                          {date.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-2 font-ui text-l3 text-[10px] leading-relaxed">
                点任意一天即可关联；那天还没有照片也能记，之后去穿搭日志补传
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
