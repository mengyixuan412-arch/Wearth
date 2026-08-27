"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { META as PANEL_META } from "@/components/panel";

/**
 * 统计页的图形件。配色只有两档：**购买支出用中性黑、养护支出用荧光粉**，
 * 没有第三种颜色 —— DESIGN.md 的第二条铁律是界面元素一律低饱和，
 * 而 PRD 6.5 又明确禁止红黄绿的语气化配色。要区分的只有两个序列，够用了。
 */
/**
 * 粉色阶梯。五档全部取自 DESIGN.md §2「粉色色号」表：
 * `#f6e9eb` 首屏天空底 · `#FFC4DD` 录入按钮高光 · `#F27CAD → #D53F7D → #C4306E` 录入按钮渐变。
 *
 * 两个序列用**深浅不同的同一支粉**而不是两个色相 —— 购买与养护是同一笔钱的两段，
 * 换色相会读成两件不相干的事。深浅差已经足够把它们分开。
 */
const PINK_50 = "#f6e9eb";
const PINK_200 = "#FFC4DD";
export const PINK = "#F27CAD";
export const PINK_LIGHT = "#ff9ec4";
/** 要当文字读的地方用它，对比度够 4:1；填充色够淡的粉，当文字就糊了。 */
export const PINK_INK = "#D53F7D";
const PINK_DEEP = "#C4306E";

/**
 * 柱状图的色阶锚在 `PINK`（#F27CAD）—— 点阵图用的那支粉。
 *
 * **只往下走一档就停。** 阶梯里更深的 #C4306E / #B42862 不进柱状图：
 * 点阵是 6px 小圆点、彼此隔着空白、非峰值列还带 0.5 透明度，实际覆盖率约四分之一；
 * 柱子是接近实心的色块。同一个色号，覆盖率差三四倍，观感就差一个量级。
 * 拿阶梯最深的两档去铺满柱面和侧面，整根柱子会读成红的。
 *
 * 两个序列的区分主要交给**材质**（购买斜纹、养护实心），颜色只补半档，
 * 侧面同理 —— 它贯穿全高，深一点点就够读出厚度，再深就是给轮廓描了一圈黑边。
 */
const BAR_LIGHT = PINK_200;
const BAR_MID = PINK;
const BAR_MID_SIDE = "#E4759F";
/**
 * 养护段**不再靠更深的颜色**来和购买段区分，直接用同一支 `PINK`。
 *
 * 之前每压深一档，整根柱子就重一分 —— 养护是柱顶那一小截，颜色一深，
 * 全图最抢眼的位置就成了最深的地方。改由两样东西分开它们：
 * 实心 vs 斜纹的**材质差**，以及两段交界处的一道白色发丝线。
 * 材质差本来就够读，那道线只是把边界钉死，颜色因此可以完全不动。
 */
const BAR_DEEP = PINK;
const BAR_DEEP_SIDE = "#E4759F";
/** 两段交界的白线。养护与购买同色，边界全靠它。 */
const SEGMENT_EDGE = "inset 0 -1.5px 0 rgba(255,255,255,0.92)";
const BAR_MID_0 = "rgba(242,124,173,0)";

/** 斜切深度。再厚就从「有厚度」变成「躺倒的盒子」了。 */
const DEPTH = 7;

/** 图表轴标在共用档上追加字距 —— 密排的数字挤在一起会连成一片。 */
export const META = `${PANEL_META} tracking-wide`;

/**
 * 发丝线体系的两档线。
 *
 * 全站令牌 `--line` 是暖灰 10%，为米白底调的；换成纯白底之后它被冲得几乎看不见，
 * 框线立不住，面板就散成一片白。参考稿用的是**两档**：面板框是能看清的中灰，
 * 页面级的结构横线接近纯黑。两档拉开，「这是一个框」和「这里分区了」才读得出层级 ——
 * 只有一档的话，要么框太重像表格，要么线太淡等于没有。
 *
 * 用中性冷灰 20,20,28 而不是令牌的暖灰 54,54,48：白底上暖灰会泛黄。
 */
// 两档发丝线的唯一来源在 globals.css。这里既要本地用，也要替既有引用方转出 ——
// `export ... from` 只转出、不引入本地作用域，所以两句都要。
import { FRAME, RULE_STRONG } from "@/lib/layout";
export { FRAME, RULE_STRONG };
const WIDE = { fontVariationSettings: '"wdth" 110' } as const;

export const yuan = (value: number) => `¥${Math.round(value).toLocaleString("zh-CN")}`;
/**
 * 不带货币符号的金额。给**后面另挂单位**的那几个大数用（`22,631` + 小字 `元`），
 * 和「20 + 件」是同一种写法。`yuan()` 那版自带 ¥，再挂一个「元」就重复了 ——
 * 行内读数（最近购入、条形图的金额）仍旧走 `yuan()`，那里没有单位后缀。
 */
export const amount = (value: number) => Math.round(value).toLocaleString("zh-CN");

/**
 * 柱面材质。粉条纹宽 6px、白条纹只有 2px —— 参考稿的比例就是「彩色粗、留白细」，
 * 等宽会让柱子看上去发灰。上面再压一层顺着斜纹方向的白色渐变，顶端饱和、底端褪到近白：
 * 柱子从下往上长，顶端才是这个月新添的那一截，浓度该落在那里。
 */
/**
 * 条纹本身是渐变的，不是平涂色再盖一层白纱。
 *
 * 做法是**反过来的**：底下铺一张真的渐变（左上饱和 → 右下褪到近白），
 * 再用条纹当遮罩把它切成一道道。平涂条纹上压白色渐变虽然远看相似，
 * 但白纱会同时冲淡条纹之间的留白，整根柱子发灰；用遮罩，
 * 留白始终是干净的白，只有粉条纹自己在褪色。
 *
 * 粉条纹 6px、白留白 2px —— 参考稿的比例就是「彩色粗、留白细」。
 */
const STRIPE_MASK = "repeating-linear-gradient(45deg, #000 0 6px, transparent 6px 8px)";

/**
 * `to` 传的是**同色的零透明度**，不是一个更浅的粉。
 * 不褪的那一段留到 22%：一上来就褪，柱子会整根发灰。
 *
 * 褪到浅粉，柱子底部仍然是一块实色；褪到透明，底部才真的化进卡片里 ——
 * 参考稿的柱子就是这样从顶端的饱和一路消失的。因此柱面本身不能再垫底色，
 * 垫了白色，渐变的透明端会被那层白顶住，等于没褪。
 */
const stripes = (from: string, to: string): React.CSSProperties => ({
  backgroundImage: `linear-gradient(155deg, ${from} 0%, ${from} 22%, ${to} 100%)`,
  WebkitMaskImage: STRIPE_MASK,
  maskImage: STRIPE_MASK,
});

/** 选中态是实心的，斜纹让位。上浅下深，柱体因此有体积。 */
const filled = (top: string, bottom: string) => `linear-gradient(170deg, ${top} 0%, ${bottom} 100%)`;

/** 未选中的序列退成一层极淡的斜纹，只留形状不留分量。 */
const ghost = (color: string) =>
  `repeating-linear-gradient(45deg, ${color} 0 4px, transparent 4px 7px)`;

type Tone = {
  base: string;
  hatch: string;
  hatchTo: string;
  /** 侧面外缘。靠柱面的那一侧用 `sideNear`，两者之间拉一道渐变。 */
  side: string;
  sideNear: string;
  solidTop: string;
  solidBottom: string;
};

/**
 * 侧面的光。它是背着光转过去的那个面 —— 贴柱面的一侧亮、外缘暗，
 * 一道横向渐变就够把厚度读出来，平涂一块只是给轮廓描了道边。
 * 再压一层顶端的白veil，和柱面「顶端饱和、往下褪」的走向对齐。
 *
 * 明暗差只在 `PINK` 与 `*_SIDE` 之间走，**不往更深处去** —— 理由同上文色阶注释：
 * 侧面贯穿全高，压深一档就足够，再深整根柱子会读成红的。
 */
const sideFill = (tone: Tone): React.CSSProperties => ({
  backgroundImage: [
    "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 42%)",
    `linear-gradient(90deg, ${tone.sideNear} 0%, ${tone.side} 100%)`,
  ].join(", "),
});

/**
 * 两个序列同时靠**材质**和**深浅**分开：购买是浅色斜纹，养护是深色实心。
 *
 * 养护段就叠在购买段正上方，而斜纹渐变最浓的一端恰好在柱子顶部。
 * 两者若取同一个 `BAR_MID`，交界处同色同明度，只剩材质一点差别，
 * 柱子一矮就读成一根纯色柱 —— 所以养护压到深一档的 `BAR_DEEP`。
 */
const SERIES: Record<"buy" | "care", Tone> = {
  buy: { base: "transparent", hatch: BAR_MID, hatchTo: BAR_MID_0, side: BAR_MID_SIDE, sideNear: BAR_MID, solidTop: BAR_MID, solidBottom: BAR_MID_SIDE },
  care: { base: BAR_DEEP, hatch: BAR_DEEP, hatchTo: BAR_DEEP, side: BAR_DEEP_SIDE, sideNear: BAR_DEEP, solidTop: BAR_DEEP, solidBottom: BAR_DEEP },
};

const GHOST: Tone = {
  base: "transparent",
  hatch: "rgba(242,124,173,0.45)",
  hatchTo: "rgba(242,124,173,0.06)",
  side: "rgba(242,124,173,0.22)",
  sideNear: "rgba(242,124,173,0.10)",
  solidTop: "rgba(242,124,173,0.5)",
  solidBottom: "rgba(242,124,173,0.6)",
};

/* ------------------------------------------------------------------ 容器 */

/**
 * 磨砂金属的淡粉卡面。四层叠出来，从上到下：
 *
 * 1. **颗粒** —— 一张 feTurbulence 噪声（内联 data URI，不外链），`overlay` 混合，
 *    只改明暗不改色相，这是「磨砂」的来源；
 * 2. **拉丝纹** —— 1px 亮线 / 3px 间隔的极细斜纹，`soft-light` 混合。金属的各向异性
 *    就在这里：纹路必须**同向**，一旦交叉就成了编织布，不是拉丝面；
 * 3. **高光带** —— 沿同一角度扫过的明暗交替，金属和塑料的区别全在这条：
 *    塑料是单向渐变，金属会在一个面上明→暗→明地翻好几次；
 * 4. **底色** —— 原来的淡粉渐变。
 *
 * 三个角度全部锁在 115°，颗粒除外。方向一乱，拉丝面立刻塌成磨砂玻璃。
 */
const GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E")`;

const BRUSH_LINES =
  "repeating-linear-gradient(115deg, rgba(255,255,255,0.55) 0 1px, rgba(255,255,255,0) 1px 3px)";

const SHEEN =
  "linear-gradient(115deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.06) 14%, " +
  "rgba(120,90,110,0.05) 28%, rgba(255,255,255,0.5) 44%, rgba(255,255,255,0.04) 58%, " +
  "rgba(120,90,110,0.06) 74%, rgba(255,255,255,0.44) 88%, rgba(255,255,255,0.1) 100%)";

const BASE_BLUSH =
  "linear-gradient(152deg, rgba(255,196,221,0.30) 0%, #f6e9eb 52%, rgba(255,196,221,0.42) 100%)";

export const BLUSH: React.CSSProperties = {
  backgroundImage: [GRAIN, BRUSH_LINES, SHEEN, BASE_BLUSH].join(", "),
  backgroundBlendMode: "overlay, soft-light, normal, normal",
  backgroundSize: "160px 160px, auto, auto, auto",
  // 上缘一道亮边、下缘一道暗边 —— 金属片的转折光，没有它整张卡还是平的。
  // 外投影去掉了：发丝线体系里所有面板都齐平地坐在白底上，只有这一张浮起来会脱队。
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(120,90,110,0.10)",
};

/**
 * 面板。**靠发丝线框做区隔，不靠圆角、投影和留白。**
 *
 * 原先是「浅灰场 + 白色圆角卡 + 柔和投影」，分层靠的是明度差和阴影。
 * 现在整页白底，卡与卡之间只有一道 1px 的 `--line`，表头再由一道同样的线
 * 和正文分开 —— 秩序全部交给线和网格，页面因此安静得多，图形本身才是唯一的重点。
 *
 * 表头三段式，和编号索引的读法一致：`编号 · 中文名 · 英文名 ……………… 单位/操作`。
 * 右端那个 `unit` 是在回答用户还没问出口的问题(这一格量的是元、件还是次)，
 * 成本只有一个字段，信息密度却很高。
 */
export function Panel({
  index,
  title,
  en,
  unit,
  action,
  className = "",
  bodyClassName = "",
  surface,
  children,
}: {
  /** 表头最左的编号，如 "01"。省略则不占位。 */
  index?: string;
  title: string;
  en: string;
  /** 表头右端的量纲提示，如 "元" / "件" / "元 / 次"。与 action 二选一。 */
  unit?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 卡面。留空是白卡；传 BLUSH 这类样式对象可以整张换底（含混合模式与投影）。 */
  surface?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col border ${surface ? "" : "bg-white"} ${className}`}
      style={{ borderColor: FRAME, ...surface }}
    >
      <div
        className="flex items-baseline gap-2.5 lg:gap-3 px-4 lg:px-6 py-2.5 lg:py-3 border-b"
        style={{ borderColor: FRAME }}
      >
        {/* 序号走 accent —— 和表单族面板（`components/panel.tsx`）同一套：
            那一族的编号本来就是粉的，统计页却是灰的，两处面板并排看会觉得不是一家。 */}
        {index ? <span className={`${META} text-accent tabular-nums`}>{index}</span> : null}
        <h2 className="font-sans font-bold text-l1 text-sm lg:text-base" style={WIDE}>
          {title}
        </h2>
        <span className={`${META} text-l3`}>{en}</span>
        {action ? <div className="ml-auto">{action}</div> : null}
        {!action && unit ? <span className={`${META} ml-auto text-l3`}>{unit}</span> : null}
      </div>
      <div className={`px-4 lg:px-6 py-4 lg:py-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * 药丸式分段控件。全站的 tab 都走这一个，不要各写各的。
 *
 * 两档尺寸，别再加第三档：
 * - `sm`（默认）面板头里的次级控件，字号要压在面板标题之下。
 * - `lg` 首图下面那条页面级筛选栏。这一档必须和衣橱那条筛选栏的药丸同字号 ——
 *   两个页面的同一个位置摆两种大小，翻页时会看出来。
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div className={`flex ${lg ? "gap-2 lg:gap-3" : "gap-1"}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full font-sans font-bold whitespace-nowrap transition-colors duration-200 cursor-pointer ${
            lg ? "px-3 lg:px-4 py-1.5 text-xs lg:text-sm" : "px-2.5 lg:px-3 py-1 text-xs"
          } ${value === option ? "bg-[rgba(0,0,0,0.07)] text-l1" : "text-l3 lg:hover:text-l1"}`}
          style={WIDE}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/**
 * 环比读数。三角是粉的，但**方向不带颜色** —— 涨和跌用的是同一支粉，
 * 只有箭头朝向不同。支出涨了不等于坏事，染成红绿就是在替用户下判断，
 * PRD 8 明确不做这件事。
 *
 * 对比基准（去年同期 / 前 12 个月）不占版面，收进 title 与 aria-label：
 * 角标只有一行的宽度，把基准写进去会让「3%」这个真正的读数失去重心。
 */
/**
 * 环比读数。**把话说全**：只写「▲ 4%」，读者得自己猜是跟谁比、涨还是跌 ——
 * 一个孤零零的百分比在这张卡上没有参照。`label` 传的是被比的那一段（「去年同期」）。
 */
export function DeltaChip({ ratio, label }: { ratio: number; label: string }) {
  const up = ratio >= 0;
  const against = label.replace(/^vs\s*/i, "");
  const text = `较${against}${up ? "上涨" : "下降"} ${Math.abs(ratio * 100).toFixed(0)}%`;

  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex items-center gap-1 bg-[rgba(0,0,0,0.05)] px-2 py-1 rounded-full whitespace-nowrap"
    >
      <span className="text-[10px] leading-none" style={{ color: PINK }} aria-hidden>
        {up ? "▲" : "▼"}
      </span>
      <span className="font-ui text-l1 text-[10px] lg:text-xs">
        较{against}
        {up ? "上涨" : "下降"} <span className="tabular-nums">{Math.abs(ratio * 100).toFixed(0)}%</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------ 分段指标条（图表页眉） */

export type Metric = { key: string; label: string; en: string; value: string; unit?: string };

/**
 * 图表上方的一排指标。点选切换下方柱状图高亮哪个序列，
 * 未选中的一列整体弱化 —— 参考稿的漏斗头就是这个交互。
 */
export function MetricStrip({
  metrics,
  value,
  onChange,
}: {
  metrics: Metric[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="gap-px grid grid-cols-3 bg-[rgba(20,20,28,0.07)]">
      {metrics.map((metric) => {
        const on = metric.key === value;
        return (
          <button
            key={metric.key}
            type="button"
            onClick={() => onChange(metric.key)}
            aria-pressed={on}
            className="flex flex-col items-start bg-white px-3 lg:px-4 py-2.5 lg:py-3 text-left transition-colors duration-200 cursor-pointer"
          >
            {/* 中英文同一行压在数字上方，英文小一号 —— 名字先读完，再读数。 */}
            <span className="flex items-baseline gap-1.5">
              <span
                className={`font-sans font-bold text-xs lg:text-sm transition-colors duration-200 ${on ? "text-l1" : "text-l3"}`}
                style={WIDE}
              >
                {metric.label}
              </span>
              <span className={`${META} ${on ? "text-l2" : "text-l3"}`}>{metric.en}</span>
            </span>
            <span
              className={`mt-1 font-sans font-bold text-xl lg:text-3xl tabular-nums transition-colors duration-200 ${
                on ? "text-l1" : "text-l3"
              }`}
              style={WIDE}
            >
              {metric.value}
              {/* 单位提一档（`base/xl`）：数值是 `xl/3xl`，原来的 `sm/base` 差得太远，
                  「元」被压成了下标。和 `Hero` 的单位配比一致。 */}
              {metric.unit ? <span className="ml-1 font-ui text-base lg:text-xl">{metric.unit}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- 堆叠柱状图 */

export type SpendBar = { key: string; label: string; caption: string; buy: number; care: number; added: number };

export function SpendBars({
  rows,
  focus,
  xUnit,
  yUnit,
}: {
  rows: SpendBar[];
  /** "all" 两段都实心；否则另一段改斜线填充。 */
  focus: "all" | "buy" | "care";
  xUnit: string;
  yUnit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // 点选会**留住**这一列，鼠标移开也不散 —— 参考稿里被点中的那列是持续高亮的。
  const [picked, setPicked] = useState<number | null>(null);
  const lit = hover ?? picked;

  const max = Math.max(1, ...rows.map((row) => row.buy + row.care));
  const active = lit === null ? null : rows[lit];

  // Tooltip 跟着柱子横向走。宽度是内容撑出来的，所以偏移量只能实测 ——
  // 贴边那两列若照直居中会探出面板，量到了再往里收，中间的列不受影响。
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipLeft, setTipLeft] = useState(0);

  useLayoutEffect(() => {
    if (lit === null || !plotRef.current || !tipRef.current) return;
    const width = plotRef.current.clientWidth;
    const tip = tipRef.current.offsetWidth;
    const centre = ((lit + 0.5) / rows.length) * width - tip / 2;
    setTipLeft(Math.min(Math.max(centre, 0), Math.max(0, width - tip)));
  }, [lit, rows.length]);
  const solid = (series: "buy" | "care") => focus === "all" || focus === series;

  /** 刻度取到一个圆整的上界，顶上给柱顶小横标留出余地。 */
  const ceiling = (() => {
    const magnitude = 10 ** Math.floor(Math.log10(max));
    return Math.ceil(max / magnitude) * magnitude;
  })();

  return (
    <div className="flex flex-col gap-1">
      {/* 纵轴的维度与单位单独占一行，压在刻度上方 —— 挤进刻度列会和「¥2,000」重叠。 */}
      <span className={`${META} text-l2 normal-case`}>{yUnit}</span>

      <div className="relative flex gap-2 lg:gap-3">
        <div className="relative mt-3 w-9 lg:w-12 h-[168px] lg:h-[216px] shrink-0">
          {[1, 0.5, 0].map((step) => (
            <span
              key={step}
              className={`${META} right-0 absolute text-l2 tabular-nums -translate-y-1/2`}
              style={{ top: `${(1 - step) * 100}%` }}
            >
              {step === 0 ? "0" : yuan(ceiling * step)}
            </span>
          ))}
        </div>

        <div ref={plotRef} className="relative flex-1 pt-3 min-w-0">
          {/* 只留基线。参考稿没有横向网格 —— 分栏靠的是竖线，横线会和斜纹打架。 */}
          <div className="relative flex items-stretch h-[168px] lg:h-[216px]">
            <span
              aria-hidden
              className="right-0 bottom-0 left-0 absolute h-px"
              style={{ backgroundColor: "rgba(20,20,28,0.16)" }}
            />

            {rows.map((row, index) => {
              const total = row.buy + row.care;
              const on = lit === index;
              const buy = solid("buy") ? SERIES.buy : GHOST;
              const care = solid("care") ? SERIES.care : GHOST;
              const carePct = total > 0 ? (row.care / total) * 100 : 0;

              // 选中时整根柱子转成实心，斜纹让位。
              const faceOf = (series: "buy" | "care", tone: Tone) => {
                if (!solid(series)) return { backgroundColor: GHOST.base, backgroundImage: ghost(GHOST.hatch) };
                if (on) return { backgroundImage: filled(tone.solidTop, tone.solidBottom) };
                if (series === "care") return { backgroundColor: tone.base };
                return { backgroundColor: tone.base, ...stripes(tone.hatch, tone.hatchTo) };
              };

              return (
                <button
                  key={row.key}
                  type="button"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover((current) => (current === index ? null : current))}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover((current) => (current === index ? null : current))}
                  onClick={() => setPicked((current) => (current === index ? null : index))}
                  aria-pressed={picked === index}
                  aria-label={`${row.caption} 支出 ${yuan(total)}`}
                  className="group relative flex flex-col justify-end px-[2px] lg:px-[3px] h-full transition-colors duration-200 cursor-pointer"
                  style={{
                    flex: "1 1 0%",
                    // 柱与柱之间的灰色分隔线，贯穿整个图形区。
                    boxShadow: index < rows.length - 1 ? "inset -1px 0 0 var(--line)" : undefined,
                  }}
                >
                  {/* 选中时**整列**都罩上一层自上而下的渐变，不只是柱子本身 —— 
                      参考稿被点中的那一列，柱子外的区域也是渐变的。 */}
                  <span
                    aria-hidden
                    className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
                    style={{
                      opacity: on ? 1 : 0,
                      backgroundImage: `linear-gradient(180deg, ${BAR_MID}38 0%, ${BAR_LIGHT}1f 46%, rgba(255,255,255,0) 100%)`,
                    }}
                  />

                  {total === 0 ? (
                    <span className="bg-line w-full h-px" />
                  ) : (
                    <span
                      className="relative block w-full transition-[height] duration-500 ease-66"
                      style={{ height: `${(total / ceiling) * 100}%` }}
                    >
                      {/* 侧面必须**分段各画各的**。合成一块、用一道水平渐变去分色是不对的：
                          侧面的顶边是斜的，两段的分界线也得跟着斜同样的角度，
                          水平分界会和正面的分界错开一个 DEPTH，那块深色就看着是歪的。

                          养护段在上，是等厚的平行四边形；购买段在下，底边要压在基线上，
                          所以是梯形。两者的分界线共用同一条斜边，正面侧面因此严丝合缝。 */}
                      {row.care > 0 ? (
                        <span
                          aria-hidden
                          className="absolute top-0 h-full"
                          style={{
                            right: -DEPTH,
                            width: DEPTH,
                            clipPath: `polygon(0 0, 100% ${DEPTH}px, 100% min(calc(${carePct}% + ${DEPTH}px), 100%), 0 ${carePct}%)`,
                            ...sideFill(care),
                          }}
                        />
                      ) : null}
                      {row.buy > 0 ? (
                        <span
                          aria-hidden
                          className="absolute top-0 h-full"
                          style={{
                            right: -DEPTH,
                            width: DEPTH,
                            clipPath: `polygon(0 ${carePct}%, 100% min(calc(${carePct}% + ${DEPTH}px), 100%), 100% 100%, 0 100%)`,
                            ...sideFill(buy),
                          }}
                        />
                      ) : null}

                      {/* 柱顶小横标。上亮下暗的渐变加一道高光，才有厚度；纯色会读成一根线。 */}
                      <span
                        aria-hidden
                        className="bottom-full left-1/2 absolute mb-1 rounded-full w-3 lg:w-4 h-[4px] -translate-x-1/2"
                        style={{
                          backgroundImage: `linear-gradient(180deg, ${BAR_LIGHT} 0%, ${row.care > 0 ? BAR_DEEP : BAR_MID} 100%)`,
                          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.9), 0 1px 1.5px rgba(196,45,108,0.2)",
                        }}
                      />

                      {/* 正面：养护在上、购买在下 */}
                      <span className="relative flex flex-col w-full h-full overflow-hidden">
                        <span
                          className="block w-full"
                          style={{
                            height: `${carePct}%`,
                            ...faceOf("care", care),
                            // 购买段占满整根时不画线，否则柱顶会平白多一道白边。
                            boxShadow: row.buy > 0 && row.care > 0 ? SEGMENT_EDGE : undefined,
                          }}
                        />
                        <span className="block flex-1 w-full" style={faceOf("buy", buy)} />
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex mt-2">
            {rows.map((row, index) => (
              <span
                key={row.key}
                className={`font-ui text-[10px] lg:text-xs text-center tabular-nums transition-colors duration-200 ${
                  lit === index ? "text-l1" : "text-l2"
                }`}
                style={{ flex: "1 1 0%" }}
              >
                {row.label}
              </span>
            ))}
          </div>

          {/* 纵向仍然钉在图的上沿，不跟着柱顶跳 —— 柱子矮的时候浮在半空更难读；
              横向则对齐被点中的那一列，读数和柱子因此是同一件事。 */}
          <div
            ref={tipRef}
            className="top-0 absolute w-fit transition-opacity duration-200 pointer-events-none"
            style={{ opacity: active ? 1 : 0, left: tipLeft }}
          >
            {active ? (
              <span className="flex items-center gap-2 bg-white shadow-[0_6px_24px_rgba(20,20,28,0.10)] px-3 py-1.5 border border-line rounded-full whitespace-nowrap">
                {/* 日期和右半边的分项同为 l3 —— 气泡里真正要读的是中间那个总额，
                    两端同色才不会把视线拆成三处。 */}
                <span className="font-ui text-l3 text-[10px] lg:text-xs">{active.caption}</span>
                <span className="font-sans font-bold text-l1 text-xs lg:text-sm tabular-nums">
                  {yuan(active.buy + active.care)}
                </span>
                <span className="bg-line w-px h-3" aria-hidden />
                <span className="font-ui text-l3 text-[10px] lg:text-xs tabular-nums">
                  购买 <span className="text-l1">{yuan(active.buy)}</span> · 养护{" "}
                  <span className="text-l1">{yuan(active.care)}</span> · 新增{" "}
                  <span className="text-l1">{active.added}</span> 件
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 横轴单位。和纵轴的「元」对称，两条轴都说清楚自己量的是什么。 */}
      <span className={`${META} text-l2 text-right normal-case`}>{xUnit}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ 分页 */

/**
 * 列表分页。**摆在面板正文的右下角**，跟在被翻的那张表后面。
 *
 * 统计页的几张表原先是硬 `slice()` 掉尾巴的：品牌只显示前 6 家、单品排行只显示
 * 前 10 件，多出来的既看不到也没有任何提示。衣橱一大，这些表读到的就不是全貌，
 * 而是一个没说明白的截断。
 *
 * **一页和多页共用同一个壳**：都是那颗带箭头的药丸，只是一页时两颗箭头都到头、
 * 读数写作「1」而不是「1/1」。几张卡并排时右下角摆着形状不一的两种东西最扎眼 ——
 * 有没有下一页，靠箭头的明暗说，不靠换一套长相。
 *
 * 形态跟 DESIGN.md §5.3 的药丸壳走：一圈发丝线、圆角、静息 `l3`、hover 转 `l1`；
 * 到头的那一侧压到 `l4` 并 `cursor-not-allowed`，不用 `disabled` 之外的别的信号。
 */
export function Pager({
  page,
  pages,
  onChange,
  ariaLabel,
}: {
  /** 从 0 起。 */
  page: number;
  pages: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  const step = (delta: number) => onChange(Math.min(pages - 1, Math.max(0, page + delta)));
  const arrow = (off: boolean) =>
    `flex justify-center items-center rounded-full w-6 h-6 transition-colors duration-200 motion-reduce:transition-none ${
      off ? "text-l4 cursor-not-allowed" : "text-l3 lg:hover:bg-[rgba(0,0,0,0.07)] lg:hover:text-l1 cursor-pointer"
    }`;

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      className="flex items-center gap-0.5 px-1 border border-line rounded-full shrink-0"
    >
      <button type="button" onClick={() => step(-1)} disabled={page === 0} aria-label="上一页" className={arrow(page === 0)}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className={`${META} px-0.5 text-l2 tabular-nums`} aria-live="polite">
        {pages > 1 ? `${page + 1}/${pages}` : "1"}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={page >= pages - 1}
        aria-label="下一页"
        className={arrow(page >= pages - 1)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </span>
  );
}

/** 图例。两个序列各一枚色块。 */
export function SeriesLegend() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1.5">
        <span className="rounded-[2px] w-2.5 h-2.5" style={{ ...stripes(BAR_MID, BAR_MID) }} />
        <span className={`${META} text-l2`}>购买</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded-[2px] w-2.5 h-2.5" style={{ backgroundColor: BAR_DEEP }} />
        <span className={`${META} text-l2`}>养护</span>
      </span>
    </div>
  );
}

/* ---------------------------------------------------------- 分解进度条 */

export function BreakdownBar({
  label,
  amount,
  value,
  max,
  tint = PINK,
  note,
}: {
  label: string;
  amount: string;
  value: number;
  max: number;
  tint?: string;
  /** 注解。**另起一行、贴右端** —— 摆进条那一行会把条挤没。 */
  note?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="font-sans text-l1 text-xs lg:text-sm">{label}</span>
        <span className="ml-auto font-sans font-bold text-l1 text-sm lg:text-base tabular-nums" style={WIDE}>
          {amount}
        </span>
      </div>
      <div className="relative flex items-center">
        <span className="relative flex flex-1 bg-white border border-[rgba(20,20,28,0.09)] rounded-full h-2.5 overflow-hidden">
          <span
            className="rounded-full h-full transition-[width] duration-500 ease-66"
            style={{
              width: `${pct}%`,
              backgroundColor: tint,
              backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.42) 0 2px, transparent 2px 5px)`,
            }}
          />
        </span>
      </div>
      {note ? <span className={`${META} self-end text-l2 normal-case`}>{note}</span> : null}
    </div>
  );
}

/** 横条读数，用于品类 / 品牌 / 颜色这类排名。 */
export function MeterBar({
  label,
  value,
  max,
  right,
  tint = PINK,
}: {
  label: string;
  value: number;
  max: number;
  right: string;
  tint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 lg:w-20 font-sans text-l1 text-xs lg:text-sm truncate shrink-0">{label}</span>
      <span className="relative flex flex-1 bg-white border border-[rgba(20,20,28,0.09)] rounded-full h-2.5 overflow-hidden">
        <span
          className="rounded-full h-full transition-[width] duration-500 ease-66"
          style={{
            width: `${max > 0 ? (value / max) * 100 : 0}%`,
            backgroundColor: tint,
            backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.42) 0 2px, transparent 2px 5px)`,
          }}
        />
      </span>
      {/* 比单品排行的右端读数（l1）轻一档，不再轻两档：
          这一行有粉条画出数量级，数字是补一个精确值；单品排行没有条，
          那个次数是整行唯一承载排序依据的东西，只能由它来读。 */}
      <span className="w-20 lg:w-24 font-ui text-l2 text-[10px] lg:text-xs text-right tabular-nums shrink-0">
        {right}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------- 阶梯面积图 */

/** 累计曲线。阶梯而非平滑 —— 衣橱是一件一件加进来的，不是连续变化的量。 */
export function StepArea({
  points,
  caption,
  xUnit,
}: {
  points: { key: string; label: string; value: number }[];
  caption?: string;
  /**
   * 横轴刻度的单位（`月` / `年` / `日`）。**两端都挂上**，不是只挂右端 ——
   * 这张图两头只有两个光秃秃的数字（`1` … `12`），不说单位读不出是月还是周还是第几件。
   */
  xUnit?: string;
}) {
  const W = 100;
  const H = 40;
  const max = Math.max(1, ...points.map((point) => point.value));
  const step = points.length > 1 ? W / points.length : W;

  let line = "";
  points.forEach((point, index) => {
    const x = index * step;
    const y = H - (point.value / max) * (H - 3);
    line += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    line += ` L ${x + step} ${y}`;
  });

  const last = points[points.length - 1];
  const lastY = last ? H - (last.value / max) * (H - 3) : H;

  return (
    <div className="flex flex-col flex-1 gap-1.5 h-full">
      <div className="relative flex-1 w-full min-h-[92px]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden>
          <defs>
            {/* 竖向细线填充，不是平涂的渐变 —— 参考稿的面积图是一把梳子，
                密排的竖线既能透出底色，又比实心块轻。 */}
            <pattern id="step-comb" width="2.2" height={H} patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="0.9" height={H} fill={PINK} opacity="0.30" />
            </pattern>
            <linearGradient id="step-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.72" />
            </linearGradient>
          </defs>
          <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#step-comb)" />
          <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#step-fade)" />
          <path d={line} fill="none" stroke={PINK_INK} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* 末点。参考稿在峰值上点一个圆点并吊一枚气泡，这里标的是当前值。

            定位的原点**就是折线上那个点**，圆点绕它居中、气泡吊在它正上方。
            原先是把「气泡 + 圆点」当一摞整体 −50%，摞有多高圆点就往下掉多少，
            所以圆点落在了折线下面。 */}
        {last ? (
          <span
            className="absolute pointer-events-none"
            style={{ left: `${W - step / 2}%`, top: `${(lastY / H) * 100}%` }}
          >
            <span
              className="absolute bg-white border-2 rounded-full w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2"
              style={{ borderColor: PINK_INK }}
            />
            {/*
              气泡**正对末点**（`-translate-x-1/2`），不再按横向比例回收。

              原来那套是拿末点的横向百分比去平移气泡自身宽度：末点贴右边缘时
              等于右对齐，气泡的右沿压在点上、数字整个偏到点的左边 —— 而它标的
              就是这个点，对不上就没有意义。居中之后气泡最多探出半个身位（约 14px），
              卡片左右还有 16–24px 的内边距接得住。
            */}
            <span
              className="bottom-2 absolute bg-white shadow-[0_2px_8px_rgba(20,20,28,0.12)] px-1.5 py-0.5 border border-line rounded-full -translate-x-1/2"
            >
              <span className="font-ui text-l1 text-[10px] tabular-nums">{last.value}</span>
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex justify-between">
        <span className={`${META} text-l2`}>
          {points[0]?.label}
          {xUnit ? ` ${xUnit}` : ""}
        </span>
        {caption ? <span className={`${META} text-l2 normal-case`}>{caption}</span> : null}
        <span className={`${META} text-l2`}>
          {last?.label}
          {xUnit ? ` ${xUnit}` : ""}
        </span>
      </div>
    </div>
  );
}

/** 紧凑直方图。柱顶标数，横轴标区间，不画纵轴 —— 卡片里塞不下第三层刻度。 */
export function MiniBars({
  rows,
  yUnit,
  xUnit,
}: {
  rows: { label: string; count: number }[];
  /** 纵轴（柱高 / 柱顶那个数）量的是什么。写成「维度 / 单位」，同 `SpendBars`。 */
  yUnit: string;
  /** 横轴（那几个分档）量的是什么。 */
  xUnit: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-1.5">
      {/* 两根轴各自标各自的 —— 原来是底下一句「件数 × 单次成本区间（元）」把两根轴
          合在一起说，读者得自己拆开、还得猜哪半句配哪根轴。
          位置照 `SpendBars`：纵轴在左上、横轴在右下。 */}
      <span className={`${META} text-l2 normal-case`}>{yUnit}</span>
      <div className="flex items-end gap-1.5 h-[64px] lg:h-[78px]">
        {rows.map((row) => (
          <span key={row.label} className="flex flex-col justify-end items-center gap-1 h-full" style={{ flex: "1 1 0%" }}>
            <span className="font-ui text-l2 text-[10px] tabular-nums">{row.count}</span>
            <span
              className="rounded-t-[3px] w-full transition-[height] duration-500 ease-66"
              style={{
                height: `${(row.count / max) * 100}%`,
                minHeight: row.count > 0 ? 3 : 1,
                backgroundColor: row.count > 0 ? "transparent" : "var(--line)",
                ...(row.count > 0 ? stripes(PINK_DEEP, "rgba(196,48,110,0)") : {}),
              }}
            />
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {rows.map((row) => (
          <span key={row.label} className={`${META} text-l2 text-center`} style={{ flex: "1 1 0%" }}>
            {row.label}
          </span>
        ))}
      </div>
      <span className={`${META} text-l2 text-right normal-case`}>{xUnit}</span>
    </div>
  );
}

/* -------------------------------------------------------------- 点阵图 */

/** 一列一个分组，圆点数量正比于数值。峰值那列在上方标出来。 */
export function DotColumns({ groups, unit }: { groups: { label: string; value: number }[]; unit: number }) {
  const peak = groups.reduce((best, row) => (row.value > best.value ? row : best), groups[0] ?? { label: "", value: 0 });
  const rowsOf = (value: number) => Math.max(1, Math.ceil(value / unit));
  const tallest = Math.max(1, ...groups.map((group) => rowsOf(group.value)));

  // 三行都按等宽格子排（每格 flex-1），标签、点阵、名称才会逐列对齐 ——
  // 用 justify-around 的话每格宽度取决于内容，气泡就落不到峰值那一列头上。
  const cell = { flex: "1 1 0%" } as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex">
        {groups.map((group) => (
          <span key={group.label} className="flex justify-center" style={cell}>
            {group.label === peak.label ? (
              <span className="bg-[rgba(0,0,0,0.05)] px-2 py-0.5 rounded-full whitespace-nowrap">
                <span className={`${META} text-l2 normal-case`}>穿着最多：{peak.label}</span>
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <div className="flex items-center" style={{ height: `${tallest * 10}px` }}>
        {groups.map((group) => {
          const rows = rowsOf(group.value);
          const on = group.label === peak.label;
          return (
            <span key={group.label} className="flex justify-center" style={cell}>
              <span
                className="flex flex-col-reverse justify-center items-center gap-1"
                title={`${group.label} ${group.value} 次`}
              >
                {Array.from({ length: rows }, (_, index) => (
                  <span key={index} className="flex gap-1">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="rounded-full w-1.5 h-1.5"
                        style={{ backgroundColor: PINK, opacity: on ? 1 : 0.5 }}
                      />
                    ))}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </div>

      <div className="flex">
        {groups.map((group) => (
          <span key={group.label} className={`${META} text-l2 text-center normal-case`} style={cell}>
            {group.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 一件单品一个点。穿过的实心，没穿过的留空心 —— 一眼看得出闲置了几件。 */
export function ItemDots({ dots }: { dots: { id: string; name: string; wears: number }[] }) {
  return (
    <div className="flex flex-wrap gap-[5px]">
      {dots.map((dot) => (
        <span
          key={dot.id}
          title={`${dot.name} · ${dot.wears} 次`}
          className="rounded-full w-2 h-2"
          style={
            dot.wears > 0
              ? { backgroundColor: PINK, opacity: dot.wears >= 40 ? 1 : dot.wears >= 12 ? 0.74 : 0.5 }
              : { boxShadow: "inset 0 0 0 1px var(--label-3)" }
          }
        />
      ))}
    </div>
  );
}
