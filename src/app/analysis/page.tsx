"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BLUSH,
  BreakdownBar,
  DeltaChip,
  DotColumns,
  ItemDots,
  META,
  MeterBar,
  MetricStrip,
  Pager,
  MiniBars,
  Panel,
  PINK,
  PINK_INK,
  RULE_STRONG,
  Segmented,
  SeriesLegend,
  SpendBars,
  StepArea,
  amount,
  yuan,
} from "@/components/analysis-charts";
import DottedLink from "@/components/dotted-link";
import { formatDate } from "@/lib/date";
import SiteHeader from "@/components/site-header";
import {
  RANGES,
  budgetStatus,
  byBrand,
  byCategory,
  closetSize,
  colourSpread,
  cpwDistribution,
  cpwRanking,
  latestSpend,
  mostWorn,
  overview,
  seasonOfMonth,
  seasonSpread,
  spendDelta,
  spendSeries,
  unwornThisSeason,
  utilisation,
  wearsByCategory,
  type Range,
} from "@/lib/analysis";
import { useProfile } from "@/lib/profile-store";
import { cpw, useWardrobe, type Item } from "@/lib/wardrobe";
import TintedScene from "@/webgl/tinted-scene";
import { HERO_GAP } from "@/lib/layout";

const WIDE = { fontVariationSettings: '"wdth" 110' } as const;

/** 卡片里的主读数。字号是这一页的层级线索 —— 大数字 = 这张卡在回答的问题。 */
function Hero({
  value,
  unit,
  caption,
  trailing,
}: {
  value: string;
  unit?: string;
  caption: string;
  /** 挂在数字右侧、与数字**垂直居中**的角标。挂到外层会掉到脚注那一行去。 */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3">
        <p className="font-sans font-bold text-l1 text-3xl lg:text-5xl leading-none tabular-nums" style={WIDE}>
          {value}
          {unit ? <span className="ml-1 font-ui text-l2 text-base lg:text-xl">{unit}</span> : null}
        </p>
        {trailing}
      </div>
      {/* 单位与说明句同为 l2 —— 同一档，不在这一块内部再分层；
          让路是靠字号（大数 vs 12/14），不靠把它们压到几乎看不见。 */}
      <p className="mt-1.5 font-sans text-l2 text-xs lg:text-sm">{caption}</p>
    </div>
  );
}

function ItemRow({ item, right, index }: { item: Item; right: string; index: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-5 font-ui text-l2 text-[10px] lg:text-xs tabular-nums shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="flex justify-center items-center bg-[rgba(0,0,0,0.03)] rounded-lg w-9 lg:w-10 h-9 lg:h-10 shrink-0">
        <img src={item.image} alt="" className="p-1 w-full h-full object-contain" loading="lazy" />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="font-sans text-l1 text-xs lg:text-sm truncate">{item.name}</span>
        <span className={`${META} text-l2 normal-case`}>
          {item.brand} · {item.sub}
        </span>
      </span>
      <span className="ml-auto font-ui text-l1 text-[10px] lg:text-xs tabular-nums shrink-0">{right}</span>
    </li>
  );
}

const RANKS = ["最常穿", "最值", "最不值"] as const;

/**
 * 各表每页多少行。
 *
 * **品类 / 品牌 / 结构三张取同一个数**：它们同处一个栅格行，而每页补足空行之后
 * 各自的高度就由行数定死了 —— 行数不同，三张卡的固定高度就不同，栅格按最高的
 * 那张拉齐，矮的两张底下会空出一块。取同一个数，三张自然等高。
 *
 * 单品排行和本季未穿同处下面那一行，**也都是 5 行高**：前者两列排，10 条正好
 * 铺满 5 行；后者单列，就是 5 条。原先未穿是 6 条，比隔壁高出一行，
 * 栅格按它拉齐，单品排行底下就空出一截。
 */
const PER_PAGE = { category: 5, brand: 5, structure: 5, rank: 10, unworn: 5 } as const;

const pageCount = (total: number, size: number) => Math.max(1, Math.ceil(total / size));
const pageOf = <T,>(rows: T[], page: number, size: number) => rows.slice(page * size, page * size + size);

/**
 * 这一页缺几行。**用来补等高的空行,让每一页都占满 `PER_PAGE` 行** ——
 * 最后一页只剩两条时表格会缩掉一截，翻回上一页又弹回来，整片栅格跟着上下跳。
 *
 * 补的是**真组件套一层 `invisible`**，不是写死一个高度：行高由里面的图片框、
 * 条形轨道和字号共同决定，写死的数一改样式就对不上。
 */
const blanksOf = (total: number, page: number, size: number) =>
  Math.max(0, size - pageOf(Array.from({ length: total }), page, size).length);
const SERIES = [
  { key: "all", label: "总支出", en: "TOTAL SPEND" },
  { key: "buy", label: "购买支出", en: "PURCHASE" },
  { key: "care", label: "养护支出", en: "CARE" },
] as const;

export default function AnalysisPage() {
  const { items, hydrated } = useWardrobe();
  const { profile } = useProfile();

  const [range, setRange] = useState<Range>("今年");
  const [focus, setFocus] = useState<"all" | "buy" | "care">("all");
  const [rank, setRank] = useState<(typeof RANKS)[number]>("最常穿");
  const [brandBy, setBrandBy] = useState<"金额" | "件数">("金额");
  const [structureBy, setStructureBy] = useState<"颜色" | "季节">("颜色");

  const now = useMemo(() => new Date(), []);
  const season = seasonOfMonth(now.getMonth() + 1);

  const stats = useMemo(() => overview(items), [items]);
  const series = useMemo(() => spendSeries(items, range, now), [items, range, now]);
  const delta = useMemo(() => spendDelta(items, range, now), [items, range, now]);
  const size = useMemo(() => closetSize(items, range, now), [items, range, now]);
  const budget = useMemo(() => budgetStatus(items, profile.monthlyBudget, now), [items, profile.monthlyBudget, now]);
  const wearSpread = useMemo(() => wearsByCategory(items), [items]);
  const usage = useMemo(() => utilisation(items), [items]);
  const unworn = useMemo(() => unwornThisSeason(items, season), [items, season]);

  const categories = useMemo(() => byCategory(items).sort((a, b) => b.spend - a.spend), [items]);
  const brands = useMemo(
    () => byBrand(items).sort((a, b) => (brandBy === "金额" ? b.spend - a.spend : b.count - a.count)),
    [brandBy, items],
  );
  const structure = useMemo(
    () =>
      structureBy === "颜色"
        ? colourSpread(items).map((row) => ({ label: row.family, count: row.count }))
        : seasonSpread(items).map((row) => ({ label: row.season, count: row.count })),
    [items, structureBy],
  );

  const ranked = useMemo(() => {
    if (rank === "最常穿") return mostWorn(items);
    return cpwRanking(items, rank === "最值" ? "low" : "high");
  }, [items, rank]);

  // 指标条读的是当前区间，不是全部历史 —— 它是这张图的表头。
  const window = useMemo(() => {
    const buy = series.points.reduce((sum, point) => sum + point.buy, 0);
    const care = series.points.reduce((sum, point) => sum + point.care, 0);
    const added = series.points.reduce((sum, point) => sum + point.added, 0);
    return { buy, care, added, total: buy + care };
  }, [series]);

  const metrics = SERIES.map((item) => ({
    key: item.key,
    label: item.label,
    en: item.en,
    value: amount(item.key === "buy" ? window.buy : item.key === "care" ? window.care : window.total),
    unit: "元",
  }));

  // 标题固定为「支出趋势」，覆盖的范围交给区间控件；粒度换了横轴单位与英文副标要跟上，
  // 否则四个区间的图长得一样，切过去分不清眼前这一格是一年、一月还是一天。
  // 横轴标注和纵轴同一个格式：「维度 / 单位」。纵轴是「支出 / 元」，
  // 横轴就该是「月份 / 月」—— 只写「月」少了维度名，只写「月份」少了单位。
  const grain =
    series.unit === "year"
      ? { en: "SPEND BY YEAR", x: "年份 / 年", unit: "年" }
      : series.unit === "day"
        ? { en: "SPEND BY DAY", x: "日期 / 日", unit: "日" }
        : { en: "SPEND BY MONTH", x: "月份 / 月", unit: "月" };

  /**
   * 各表的页码。**一表一个** —— 它们的行数、排序、筛选都各自独立，共用一个页码
   * 会出现「在品牌那张翻到第 2 页，单品排行也跟着跳走」。
   *
   * 排序 / 筛选一换就回第一页：换了口径还停在第 3 页，看到的是一批没有上下文的行。
   */
  const [catPage, setCatPage] = useState(0);
  const [brandPage, setBrandPage] = useState(0);
  const [structPage, setStructPage] = useState(0);
  const [rankPage, setRankPage] = useState(0);
  const [unwornPage, setUnwornPage] = useState(0);

  useEffect(() => setBrandPage(0), [brandBy]);
  useEffect(() => setStructPage(0), [structureBy]);
  useEffect(() => setRankPage(0), [rank]);
  useEffect(() => setUnwornPage(0), [season]);

  const addedInWindow = size.reduce((sum, point) => sum + point.added, 0);
  const unwornSpend = unworn.reduce((sum, item) => sum + item.price + item.care, 0);
  const latest = useMemo(() => latestSpend(items), [items]);
  // CPW 的两端。榜单在下面，这里只取极值，让核心指标卡自己带上量程。
  const cheapest = useMemo(() => cpwRanking(items, "low", 1)[0] ?? null, [items]);
  const dearest = useMemo(() => cpwRanking(items, "high", 1)[0] ?? null, [items]);
  const spread = useMemo(() => cpwDistribution(items), [items]);

  return (
    <>
      <div className="relative z-10 px-4 lg:px-14 py-4 lg:py-7">
        <SiteHeader title={null} />

        {/* ── 主视觉：标题、编号、副标都画在图里，DOM 不再重复一遍。
             4:1 横幅，按原始画幅铺满 —— 标题在最左、拼贴在最右，
             中间是留白，任何方向的裁切都会丢掉一头。
             图由 tools/build-hero.mjs 从设计稿生成。 ───── */}
        <div className="mt-4 lg:mt-6">
          <img
            src="/img/hero/insights.webp"
            alt="衣橱统计 Wardrobe Insights —— 让每一次穿着都看得见价值"
            width={2000}
            height={500}
            fetchPriority="high"
            className="block border border-l4 w-full h-auto"
          />
        </div>

        {/* 区间控件。整页所有时间序列都听它的。
            底下压一道贯穿全宽的横线 —— 发丝线体系里，头部和内容之间需要一个锚点，
            否则那一排面板会像浮在空白上。 */}
        <div
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${HERO_GAP} pb-2.5 lg:pb-3 border-b`}
          style={{ borderColor: RULE_STRONG }}
        >
          <Segmented options={RANGES} value={range} onChange={setRange} size="lg" />
          {/* 读数推到行末。它是当下衣橱的静态事实，不是可操作项 ——
              放在行首会被当成标题读，靠右才归位成「角标」。 */}
          <span className={`${META} ml-auto text-l2 normal-case tabular-nums`}>
            在橱 {stats.count} 件 · 累计穿着 {stats.wears} 次 · 当季 {season}
          </span>
        </div>

        {/* 读完之前整片不出。**统计比列表更不能先给数** —— 「总支出 ¥0」
            紧接着跳成「¥12,345」，用户会以为自己看错了，或者数据出过问题。
            撑住高度，避免读完瞬间整页往下顶。 */}
        <div
          className={`gap-4 lg:gap-5 grid grid-cols-12 mt-4 lg:mt-6 mb-16 lg:mb-20 min-h-[60svh] transition-opacity duration-300 motion-reduce:transition-none ${
            hydrated ? "opacity-100" : "opacity-0"
          }`}
          aria-busy={!hydrated}
        >
          {/* ── 第一行：支出趋势 + 总投入 ─────────────────────────── */}
          <Panel
            index="01"
            title="支出趋势"
            en={grain.en}
            action={<SeriesLegend />}
            className="col-span-12 lg:col-span-8"
          >
            <MetricStrip metrics={metrics} value={focus} onChange={(key) => setFocus(key as typeof focus)} />
            <div className="mt-5 lg:mt-6">
              <SpendBars rows={series.points} focus={focus} yUnit="支出 / 元" xUnit={grain.x} />
            </div>
          </Panel>

          {/* `bodyClassName` 要撑满：这一栏和左边那张趋势图同处一个栅格行，高度被它拉高。
              正文不 `flex-1` 的话，底下那块「最近两笔」的 `mt-auto` 顶不到底，
              余高会整块吊在面板末尾 —— 就是那一片空。 */}
          <Panel
            index="02"
            title="衣橱投入"
            en="TOTAL INVESTED"
            className="col-span-12 lg:col-span-4"
            bodyClassName="flex flex-col flex-1"
          >
            <Hero
              value={amount(stats.spend)}
              unit="元"
              caption={`${stats.count} 件在橱${stats.disposed > 0 ? ` · 已处置 ${stats.disposed} 件` : ""}`}
              trailing={delta ? <DeltaChip ratio={delta.ratio} label={`vs ${delta.label}`} /> : null}
            />

            <div className="flex flex-col flex-1 mt-4 pt-4 border-line border-t">
              {/* 三根条**平分这块高度**（`flex-1 justify-between`），不是挤在顶上、
                  把余高全推给底下那两行流水。原先条与条之间是固定的 gap，
                  卡片被隔壁的趋势图拉高之后，多出来的高度全落在预算条和流水之间，
                  上密下疏。 */}
              <div className="flex flex-col flex-1 justify-between gap-3.5">
              <BreakdownBar
                label="购买支出"
                amount={yuan(stats.spendBuy)}
                value={stats.spendBuy}
                max={stats.spend}
              />
              <BreakdownBar
                label="养护支出"
                amount={yuan(stats.spendCare)}
                value={stats.spendCare}
                max={stats.spend}
                tint={PINK_INK}
              />

              {/*
                上面两根条的**合起来一条**：浅粉购买、深粉养护，长度按各自占总投入的比例。
                两根条各自答「这一项花了多少」，这一条答「两项之间是什么比例」。

                版式和 `BreakdownBar` **逐层对齐**：外层 `gap-1.5`、上面一行标签配右端读数、
                下面同一套白底轨道（描边 + `h-2.5` + 斜纹填充）。原先它没有标签行、
                轨道也更细，比邻居少一行高度 —— 三根条摆在 `justify-between` 里，
                少的那一行就变成了对不齐的间距。图例挪进右端读数位，不再单占一行。
              */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-sans text-l1 text-xs lg:text-sm">支出构成</span>
                  {/*
                    右端读数和另外三行**同一规格**（`font-sans font-bold text-l1 text-sm lg:text-base`）——
                    原先是 10/12px 的灰字，同一列里两种字号两种重量，整列就散了。

                    「购买 / 养护」两个词去掉，只留色点：这两支粉就是紧挨着上面那两根条的颜色，
                    顺序也一样，写全反而把这一行撑到换行。
                  */}
                  <span
                    className="flex items-center gap-3 ml-auto font-sans font-bold text-l1 text-sm lg:text-base tabular-nums"
                    style={WIDE}
                  >
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="rounded-full w-1.5 h-1.5" style={{ backgroundColor: PINK }} />
                      {((stats.spendBuy / Math.max(1, stats.spend)) * 100).toFixed(1)}%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="rounded-full w-1.5 h-1.5" style={{ backgroundColor: PINK_INK }} />
                      {((stats.spendCare / Math.max(1, stats.spend)) * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <span className="relative flex bg-white border border-[rgba(20,20,28,0.09)] rounded-full h-2.5 overflow-hidden">
                  {[
                    { tint: PINK, value: stats.spendBuy },
                    { tint: PINK_INK, value: stats.spendCare },
                  ].map((seg) => (
                    <span
                      key={seg.tint}
                      className="h-full"
                      style={{
                        width: `${(seg.value / Math.max(1, stats.spend)) * 100}%`,
                        backgroundColor: seg.tint,
                        // 斜纹和另外两根条同一套，不然三根条读起来是两种材质。
                        backgroundImage:
                          "repeating-linear-gradient(45deg, rgba(255,255,255,0.42) 0 2px, transparent 2px 5px)",
                      }}
                    />
                  ))}
                </span>
              </div>

              <BreakdownBar
                label="本月预算"
                amount={budget.budget === null ? "未设置" : `${yuan(budget.spent)} / ${yuan(budget.budget)}`}
                value={budget.spent}
                max={budget.budget ?? 0}
                note={
                  budget.budget === null ? (
                    <DottedLink href="/profile" className="underline underline-offset-2">
                      去「个人档案」设置月度预算
                    </DottedLink>
                  ) : budget.spent > budget.budget ? (
                    `已超出 ${yuan(budget.spent - budget.budget)}`
                  ) : (
                    `本月还剩 ${yuan(budget.budget - budget.spent)}`
                  )
                }
              />
              </div>

              {/* 最近两笔流水。卡片下半原本是空的，而「最近一次花钱是什么时候」
                  正是总额答不上来的那个问题。

                  一行只分两级：左端标签与右端读数同为 l2，中间的单品名 l1。
                  两端同色，视线不会被行末的数字先拽走 —— 这两行要答的是
                  「最近买的是哪一件」，名字才是主体。 */}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-line border-t">
                {latest.purchase ? (
                  <div className="flex items-baseline gap-2">
                    <span className={`${META} text-l2 shrink-0`}>最近购入</span>
                    <span className="font-sans text-l1 text-xs lg:text-sm truncate">{latest.purchase.name}</span>
                    <span className={`${META} ml-auto text-l2 tabular-nums shrink-0`}>
                      {formatDate(latest.purchase.date)} · {yuan(latest.purchase.amount)}
                    </span>
                  </div>
                ) : null}
                {latest.care ? (
                  <div className="flex items-baseline gap-2">
                    <span className={`${META} text-l2 shrink-0`}>最近养护</span>
                    <span className="font-sans text-l1 text-xs lg:text-sm truncate">
                      {latest.care.name}
                      <span className="text-l2">（{latest.care.note}）</span>
                    </span>
                    <span className={`${META} ml-auto text-l2 tabular-nums shrink-0`}>
                      {formatDate(latest.care.date)} · {yuan(latest.care.amount)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* ── 第二行：衣橱规模 + 两张读数卡 + CPW ────────────────── */}
          <Panel
            index="03"
            title="衣橱规模"
            en="CLOSET SIZE"
            className="col-span-12 lg:col-span-3"
            bodyClassName="flex flex-col flex-1"
          >
            <Hero value={String(stats.count)} unit="件" caption={`区间内新增 ${addedInWindow} 件`} />
            {/* 不再压上限：填充早先是平涂的粉色块，拉高会糊成一片，所以当时封了顶；
                现在换成竖向细线的梳子填充，长高只是台阶更舒展，正好把卡片下半的空白吃掉。 */}
            <div className="flex flex-1 mt-4 min-h-[104px]">
              <StepArea points={size} caption={`区间内 +${addedInWindow}`} xUnit={grain.unit} />
            </div>
          </Panel>

          <div className="flex flex-col gap-4 lg:gap-5 col-span-12 lg:col-span-5">
            <Panel index="04" title="穿着分布" en="WEARS BY CATEGORY" className="flex-1" bodyClassName="flex flex-col flex-1 justify-center">
              <div className="flex items-center gap-5">
                <div className="shrink-0">
                  <Hero value={stats.wears.toLocaleString("zh-CN")} unit="次" caption="累计穿着次数" />
                </div>
                <div className="flex-1 min-w-0">
                  <DotColumns
                    groups={wearSpread.map((row) => ({ label: row.category, value: row.wears }))}
                    unit={Math.max(10, Math.ceil(Math.max(1, ...wearSpread.map((row) => row.wears)) / 10))}
                  />
                </div>
              </div>
            </Panel>

            <Panel index="05" title="在穿比例" en="IN ROTATION" className="flex-1" bodyClassName="flex flex-col flex-1 justify-center">
              {/* 左读数、中点阵、右补数 —— 点阵原先限了宽，右边空掉一大片。 */}
              <div className="flex items-center gap-5">
                <div className="shrink-0">
                  <Hero
                    value={`${Math.round(usage.ratio * 100)}%`}
                    caption={`${usage.worn} / ${usage.total} 件已穿着`}
                  />
                </div>

                <div className="flex flex-col flex-1 gap-2 min-w-0">
                  <ItemDots dots={usage.dots} />
                  <span className={`${META} text-l2 normal-case`}>每点代表一件单品，空心表示为尚未穿着</span>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className={`${META} text-l2`}>尚未穿着</span>
                  <span
                    className="mt-1 font-sans font-bold text-l1 text-xl lg:text-2xl leading-none tabular-nums"
                    style={WIDE}
                  >
                    {usage.never}
                    <span className="ml-0.5 font-ui text-l2 text-xs lg:text-sm">件</span>
                  </span>
                </div>
              </div>
            </Panel>
          </div>

          {/* CPW 是这个产品的那根线。卡片本身保持白底 —— 粉色是数据的颜色，
              不是装饰的颜色，所以只落在数字、量条和分子的构成上。 */}
          <Panel
            index="06"
            title="穿着成本"
            en="COST PER WEAR"
            surface={BLUSH}
            className="col-span-12 lg:col-span-4"
            bodyClassName="flex flex-col flex-1"
          >
            {/*
              **两栏对读**：左栏是结论（大数 + 它是什么），右栏是来历（算式）。

              先前是把算式直接甩在大数右边、纵向居中，它既不和数字对齐、
              也不和下面那句说明成行，孤零零浮在一片留白里。现在左右各成一栏、
              上下各自成行，中间一条发丝线把两栏分开 —— 那条线同时说明了
              「右边这串是在解释左边这个数」。
            */}
            <div className="flex items-stretch gap-4 lg:gap-5">
              <div className="flex flex-col justify-center gap-2 shrink-0">
                <p
                  className="font-sans font-bold text-5xl lg:text-6xl leading-none tabular-nums"
                  style={{ ...WIDE, color: PINK_INK }}
                >
                  {stats.averageCpw === null ? "—" : amount(stats.averageCpw)}
                  {/* 单位整块挂在数字后面（`元/次`），和「20 件」「22,631 元」同一种写法。
                      原来是 `¥27` 再跟一个 `/次`，货币符号在前、量纲在后，读成了两截。 */}
                  <span className="ml-1 font-ui text-lg lg:text-2xl">元/次</span>
                </p>
                <p className="font-sans text-l2 text-sm lg:text-base">衣橱平均单次成本</p>
              </div>

              <div
                className="flex flex-col justify-center gap-1.5 pl-4 lg:pl-5 border-l min-w-0"
                style={{ borderColor: "rgba(20,20,28,0.14)" }}
              >
                {/* 中文 + 英文副标，和面板表头同一种读法（`衣橱投入 TOTAL INVESTED`）。
                    字间距只加在英文上 —— 汉字撑开字距会散。 */}
                <span className="flex items-baseline gap-1.5">
                  <span className="font-sans text-l1 text-xs lg:text-sm">计算公式</span>
                  <span className={`${META} text-l2 tracking-[0.16em]`}>How it adds up</span>
                </span>
                <p className="font-ui text-l2 text-[10px] lg:text-xs leading-relaxed tabular-nums">
                  （购买 {yuan(stats.spendBuy)} + 养护 {yuan(stats.spendCare)}）÷{" "}
                  {stats.wears.toLocaleString("zh-CN")} 次穿着
                </p>
              </div>
            </div>

            {/* 均值之外还要给出量程 —— 只看平均值，会以为衣橱里每件都差不多。 */}
            <div className="flex flex-col gap-2.5 mt-6">
              {[
                { tag: "最值", item: cheapest },
                { tag: "最不值", item: dearest },
              ].map(({ tag, item }) =>
                item ? (
                  <div key={tag} className="flex items-baseline gap-2">
                    <span className={`${META} text-l2 shrink-0`}>{tag}</span>
                    <span className="font-sans text-l1 text-xs lg:text-sm truncate">{item.name}</span>
                    {/* 和上面那个大数同一种写法：数字不带 ¥，单位整块跟在后面。
                        原来是 `¥3/次` —— 货币符号在前、量纲在后，一个读数拆成两截。 */}
                    <span className="ml-auto font-ui text-l1 text-xs lg:text-sm shrink-0">
                      <span className="tabular-nums">{amount(cpw(item)!)}</span> 元/次
                    </span>
                  </div>
                ) : null,
              )}
            </div>

            {/* 均值背后的形状。全衣橱压成一个数字，看不出它是怎么分布的。 */}
            <div className="mt-6">
              <MiniBars rows={spread} yUnit="件数 / 件" xUnit="单次成本 / 元" />
            </div>

          </Panel>

          {/* ── 第三行：结构 ───────────────────────────────────── */}
          <Panel
            index="07"
            title="品类花费"
            en="BY CATEGORY"
            className="col-span-12 lg:col-span-4"
            bodyClassName="flex flex-col flex-1"
          >
            {/* `max` 取的是**全表**的最大值，不是当前页的 —— 按页取最大，
                翻到第二页时那一页最长的一根又会铺满整格，几页之间的长度不可比。 */}
            <div className="flex flex-col flex-1 justify-between gap-2.5 py-1">
              {pageOf(categories, catPage, PER_PAGE.category).map((row) => (
                <MeterBar
                  key={row.category}
                  label={row.category}
                  value={row.spend}
                  max={Math.max(...categories.map((c) => c.spend))}
                  right={`${yuan(row.spend)} · ${row.count}件`}
                />
              ))}
              {Array.from({ length: blanksOf(categories.length, catPage, PER_PAGE.category) }).map((_, i) => (
                <div key={`blank-${i}`} aria-hidden className="invisible">
                  <MeterBar label="—" value={0} max={1} right="—" />
                </div>
              ))}
            </div>
            {/* 翻页摆在正文右下角，跟在被翻的那张表后面 —— 表头那一排是筛选与排序，
                它们决定「看的是什么」；翻页决定「看到第几行」，属于这张表本身。 */}
            <div className="flex justify-end mt-3">
              <Pager
                page={catPage}
                pages={pageCount(categories.length, PER_PAGE.category)}
                onChange={setCatPage}
                ariaLabel="品类花费分页"
              />
            </div>
          </Panel>

          <Panel
            index="08"
            title="品牌排名"
            en="BY BRAND"
            action={<Segmented options={["金额", "件数"] as const} value={brandBy} onChange={setBrandBy} />}
            className="col-span-12 lg:col-span-4"
            bodyClassName="flex flex-col flex-1"
          >
            <div className="flex flex-col flex-1 justify-between gap-2.5 py-1">
              {pageOf(brands, brandPage, PER_PAGE.brand).map((row) => (
                <MeterBar
                  key={row.brand}
                  label={row.brand}
                  value={brandBy === "金额" ? row.spend : row.count}
                  max={Math.max(...brands.map((b) => (brandBy === "金额" ? b.spend : b.count)))}
                  right={brandBy === "金额" ? yuan(row.spend) : `${row.count} 件`}
                />
              ))}
              {Array.from({ length: blanksOf(brands.length, brandPage, PER_PAGE.brand) }).map((_, i) => (
                <div key={`blank-${i}`} aria-hidden className="invisible">
                  <MeterBar label="—" value={0} max={1} right="—" />
                </div>
              ))}
            </div>
            {/* 翻页摆在正文右下角，跟在被翻的那张表后面 —— 表头那一排是筛选与排序，
                它们决定「看的是什么」；翻页决定「看到第几行」，属于这张表本身。 */}
            <div className="flex justify-end mt-3">
              <Pager
                page={brandPage}
                pages={pageCount(brands.length, PER_PAGE.brand)}
                onChange={setBrandPage}
                ariaLabel="品牌排名分页"
              />
            </div>
          </Panel>

          <Panel
            index="09"
            title="衣橱结构"
            en="SPREAD"
            action={<Segmented options={["颜色", "季节"] as const} value={structureBy} onChange={setStructureBy} />}
            className="col-span-12 lg:col-span-4"
            bodyClassName="flex flex-col flex-1"
          >
            <div className="flex flex-col flex-1 justify-between gap-2.5 py-1">
              {pageOf(structure, structPage, PER_PAGE.structure).map((row) => (
                <MeterBar
                  key={row.label}
                  label={row.label}
                  value={row.count}
                  max={Math.max(...structure.map((entry) => entry.count))}
                  right={`${row.count} 件`}
                  tint={PINK_INK}
                />
              ))}
              {Array.from({ length: blanksOf(structure.length, structPage, PER_PAGE.structure) }).map((_, i) => (
                <div key={`blank-${i}`} aria-hidden className="invisible">
                  <MeterBar label="—" value={0} max={1} right="—" />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <Pager
                page={structPage}
                pages={pageCount(structure.length, PER_PAGE.structure)}
                onChange={setStructPage}
                ariaLabel="衣橱结构分页"
              />
            </div>
          </Panel>

          {/* ── 第四行：单品 ───────────────────────────────────── */}
          <Panel
            index="10"
            title="单品排行"
            en="ITEM RANKING"
            action={<Segmented options={RANKS} value={rank} onChange={setRank} />}
            className="col-span-12 lg:col-span-8"
          >
            <ul className="gap-x-8 gap-y-2.5 grid sm:grid-cols-2">
              {/* 序号按**全表**连续编，不是每页从 01 重来 —— 这是一张排行榜，
                  第 2 页的第一件是第 11 名，重新编号会把名次读错。 */}
              {pageOf(ranked, rankPage, PER_PAGE.rank).map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={rankPage * PER_PAGE.rank + index}
                  right={rank === "最常穿" ? `${item.wears} 次` : `${yuan(cpw(item)!)}/次`}
                />
              ))}
              {Array.from({ length: blanksOf(ranked.length, rankPage, PER_PAGE.rank) }).map((_, i) => (
                // 行高由 ItemRow 里那个 36 / 40px 的图片框定死，空行照抄这个高度。
                <li key={`blank-${i}`} aria-hidden className="h-9 lg:h-10" />
              ))}
            </ul>
            <div className="flex justify-end mt-3">
              <Pager
                page={rankPage}
                pages={pageCount(ranked.length, PER_PAGE.rank)}
                onChange={setRankPage}
                ariaLabel="单品排行分页"
              />
            </div>
          </Panel>

          <Panel
            index="11"
            title="本季未穿"
            en="UNWORN"
            className="self-start col-span-12 lg:col-span-4"
          >
              <ul className="flex flex-col gap-2.5">
                {pageOf(unworn, unwornPage, PER_PAGE.unworn).map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    index={unwornPage * PER_PAGE.unworn + index}
                    right={yuan(item.price + item.care)}
                  />
                ))}
                {Array.from({ length: blanksOf(unworn.length, unwornPage, PER_PAGE.unworn) }).map((_, i) => (
                  <li key={`blank-${i}`} aria-hidden className="h-9 lg:h-10" />
                ))}
              </ul>
              {/* 只陈述事实，不加提醒也不加判断（PRD 6.5）。
                  合计句和翻页共用这一行，一左一右 —— 两者都是「这张表的脚注」，
                  各占一行会让这张本来就矮的卡片多出一截。 */}
              <div className="flex justify-between items-baseline gap-3 mt-3">
                {unworn.length > 0 ? (
                  <p className={`${META} text-l2 normal-case`}>
                    共 {unworn.length} 件，已投入 {yuan(unwornSpend)}，尚无单次成本
                  </p>
                ) : (
                  <span />
                )}
                <Pager
                  page={unwornPage}
                  pages={pageCount(unworn.length, PER_PAGE.unworn)}
                  onChange={setUnwornPage}
                  ariaLabel="本季未穿分页"
                />
              </div>
          </Panel>
        </div>
      </div>

      {/* 纯白场。原先是「浅灰场 + 白色圆角卡 + 投影」，靠明度差和阴影分层；
          现在分层全部交给发丝线，底就不需要任何颜色了 —— 底一白，
          那些 1px 的线才立得住，图形本身也才是页面上唯一有颜色的东西。 */}
      <div aria-hidden="true" className="-z-1 fixed inset-0 bg-white pointer-events-none" />

      {/* 画布只剩点阵转场那一层，背景交给上面的 CSS。 */}
      <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen pointer-events-none">
        <TintedScene background={false} />
      </div>
    </>
  );
}
