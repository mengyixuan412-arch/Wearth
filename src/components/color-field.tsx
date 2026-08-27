"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ColorPicker from "@/components/color-picker";

/**
 * 颜色格：一排预设圆点 + 末尾一颗自定义色触发器，点开弹出取色器（`color-picker.tsx`）。
 *
 * 全站只此一份 —— 色系（录入 / 评分）与肤色（档案）此前各写各的，后两处直接挂了原生
 * `<input type="color">`，弹的是操作系统面板，长相由系统决定，在这套白底灰线框里会突兀
 * 地跳出来（同 `color-picker.tsx` 开头那条）。
 *
 * **只负责圆点这一行本身。** 字段标签、选中档的名字、说明句由调用方摆 —— 三处的外围
 * 版式本来就不同（录入是表单格、评分是表单格带读数、档案要显示肤色档名），塞进组件只会
 * 让参数表长成配置文件。要读「当前命中哪一档」用 `presetOf()`。
 */
export type ColorPreset = { value: string; label: string };

/** 精确等于某档预设的代表色才算选中那一档；否则就是自定义色。 */
export function presetOf(presets: readonly ColorPreset[], value: string) {
  return presets.find((preset) => preset.value.toLowerCase() === value.toLowerCase());
}

/** 取色器面板的宽（`w-64`）与它到触发器的间距，排布时要算进去。 */
const PANEL_WIDTH = 256;
const PANEL_GAP = 12;
/**
 * 面板高度的**初值**，只在第一帧量到真实高度之前顶一下。
 *
 * 真实高度必须实测：传了图的时候面板里多一条商品取色（画布 132px 加标题和间距），
 * 比不传时高出一大截 —— 拿一个写死的数去算居中，两种形态里必有一种是偏的。
 */
const PANEL_HEIGHT = 352;
/** 面板离视口边缘至少留这么多。 */
const EDGE = 8;

type Box = { left: number; top: number };

/**
 * 算面板落点：横向贴触发器右侧（右边站不下就翻到左侧），
 * **竖向与触发器居中对齐**，再整体夹回视口内。
 */
function place(rect: DOMRect, height: number): Box {
  let left = rect.right + PANEL_GAP;
  if (left + PANEL_WIDTH > window.innerWidth - EDGE) left = rect.left - PANEL_GAP - PANEL_WIDTH;
  if (left < EDGE) {
    left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - EDGE));
  }

  const center = rect.top + rect.height / 2;
  // 夹的下限优先于上限：视口比面板还矮时，宁可顶着上沿也不要跑出屏幕。
  const top = Math.max(EDGE, Math.min(center - height / 2, window.innerHeight - height - EDGE));
  return { left, top };
}

const DOT =
  "rounded-full w-8 h-8 transition-transform duration-150 motion-reduce:transition-none lg:hover:scale-110 cursor-pointer";
/** 选中态是一圈黑环而不是填粉 —— 圆点本身就是颜色，填粉会把它盖掉。 */
const SELECTED = "ring-2 ring-l1 ring-offset-2";

export default function ColorField({
  value,
  onChange,
  presets,
  customLabel = "自定义颜色",
  unset = false,
  sampleImage,
  sampleLabel,
}: {
  value: string;
  onChange: (hex: string) => void;
  presets: readonly ColorPreset[];
  customLabel?: string;
  /**
   * 「一档都还没选」。**`value` 仍要传一个合法色**（面板打开时得有个起点），
   * 这个开关只管**画**：所有圆点都不带黑环，末尾那颗也保持虚线加号。
   *
   * 为什么需要它：调用方常给未选状态一个兜底色（档案页的肤色兜底成「自然」），
   * 界面照着兜底色画就会显出一个选中环 —— 用户以为自己选过了，而下游
   * （附录 D-⑤ 的 5b）读的是真实值，按未设处理。显示与计分对不上。
   */
  unset?: boolean;
  /** 透传给取色器：传了就能直接在这张图上点着取色。 */
  sampleImage?: string | null;
  /** 取样条的标题，随取的是什么照片而定。缺省是「商品取色」。 */
  sampleLabel?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  /** 面板实测高度。内容会变（取样条的图加载完才撑开），所以用 ResizeObserver 盯着。 */
  const [panelHeight, setPanelHeight] = useState(PANEL_HEIGHT);

  /**
   * 面板 **portal 到 body 用 fixed 定位，自己量触发器的矩形**（同 §5.4 的下拉菜单）。
   * 绝对定位会被祖先的 `overflow` 裁掉 —— 单品抽屉与录入弹窗的正文都是
   * `overflow-y-auto`，抽屉又只有四百来像素宽，向左弹的面板会被齐腰切断。
   *
   * 跟着滚动与改窗重新量：抽屉正文滚一下，触发器就走位了。
   */
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setBox(place(rect, panelHeight));
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, panelHeight]);

  /**
   * 盯着面板自己的高度。**`useLayoutEffect` 而不是 `useEffect`** —— 量完要在这一帧
   * 就把位置改过来，放到绘制之后会先闪一下在按估值算出的位置上。
   */
  useLayoutEffect(() => {
    const node = panelRef.current;
    if (!open || !node) return;
    const sync = () => setPanelHeight(node.offsetHeight || PANEL_HEIGHT);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, box !== null]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (triggerRef.current?.contains(target)) return;
      if (!panelRef.current?.contains(target)) setOpen(false);
    };
    // 捕获阶段监听：面板里的拖拽会 setPointerCapture，冒泡阶段收不到外部按下
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  /**
   * Esc 先关取色器。**捕获阶段拦下并掐断传播** —— 三处调用方里有两处是弹窗，
   * 它们自己在 document 上听 Esc 关闭整个弹窗；不掐断的话按一下 Esc 会连取色器带弹窗
   * 一起关掉。掐在捕获阶段，事件就到不了冒泡那一轮。取色器没开时这个监听不挂，
   * Esc 照常传给弹窗。
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  const hit = presetOf(presets, value);

  /**
   * 触发器画成空心虚线加号，还是填成当前色 + 选中环。
   *
   * 填色态的意思是「你选的不是任何一档预设」—— 它靠的是和旁边那排预设圆点的对比。
   * **一档预设都没有时这句话没有内容**：孤零零一颗填色的圆读起来像个色块读数，
   * 不像个能点的按钮。所以没有预设时恒画空心框（购买评分的颜色格就是这种情况）。
   */
  const outlined = unset || presets.length === 0 || Boolean(hit);

  /** 画上去的选中项。`unset` 时一个都不选。 */
  const marked = unset ? undefined : hit;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {presets.map((preset) => {
        const on = marked?.value === preset.value;
        return (
          <button
            key={preset.value}
            type="button"
            aria-label={preset.label}
            aria-pressed={on}
            title={preset.label}
            onClick={() => {
              onChange(preset.value);
              setOpen(false);
            }}
            className={`${DOT} ${on ? SELECTED : "border border-line"}`}
            style={{ backgroundColor: preset.value }}
          />
        );
      })}

      {/* 末尾那颗：没选自定义色时是一圈虚线加号，选了就填成那个颜色。 */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={customLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        // 虚线圈走 `--frame` 不是 `--line`（同 §5.11 的照片投放区）：颜色格三处都坐在
        // `bg-card` 这种近白的卡上，而 `--line` 那档暖灰 10% 是为米白底调的，
        // 白底会把它冲得几乎看不见。两者语义本来也是同一种 ——「这里是空的，等你挑一个」。
        className={`flex justify-center items-center ${DOT} ${
          outlined
            ? "border-2 border-frame border-dashed text-l3 lg:hover:border-accent lg:hover:text-accent"
            : `${SELECTED} text-card`
        }`}
        style={{ backgroundColor: outlined ? undefined : value }}
      >
        <span aria-hidden="true" className="text-base leading-none">
          +
        </span>
      </button>

      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              /**
               * 掐断 pointerdown 的 React 冒泡。面板 portal 到了 body，但在 **React 树里**
               * 它仍是抽屉 / 弹窗的后代，事件照样冒上去；而那两层的「点外面就关」判的是
               * DOM `contains`，面板不在它们的 DOM 子树里 —— 不掐断的话，
               * 在取色器上拖一下就把整个抽屉关掉了。
               */
              onPointerDown={(event) => event.stopPropagation()}
              // z 要压过弹窗（z-50）—— 录入弹窗里的色系就开在弹窗之上。
              className="z-[60] fixed"
              style={{ left: box.left, top: box.top }}
            >
              <ColorPicker
                value={value}
                onChange={onChange}
                sampleImage={sampleImage}
                sampleLabel={sampleLabel}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
