import { dateKey } from "@/lib/date";
import { CATEGORIES, SEASONS, cpw, type Item, type Season } from "@/lib/wardrobe";

/** Items that can still be acted on. Disposed pieces stay out of the rankings. */
const active = (items: Item[]) => items.filter((item) => item.status !== "已处置");

/** 只用来拼**月**桶键（`2026-08`）。完整的日键一律走 `lib/date.ts` 的 `dateKey`。 */
const pad = (value: number) => String(value).padStart(2, "0");

export function overview(items: Item[]) {
  const live = active(items);
  // 花费与穿着次数含已处置单品 —— 那笔钱确实花过、那些次数确实穿过，
  // 从历史里抹掉会让「衣橱平均单次成本」失真（PRD 附录 B）。
  const spendBuy = items.reduce((sum, item) => sum + item.price, 0);
  const spendCare = items.reduce((sum, item) => sum + item.care, 0);
  const wears = items.reduce((sum, item) => sum + item.wears, 0);
  return {
    // 件数则只数在用与闲置 —— 已处置的衣服不在衣橱里了。
    count: live.length,
    disposed: items.length - live.length,
    spendBuy,
    spendCare,
    spend: spendBuy + spendCare,
    wears,
    // Total spend over total wears — averaging each item's own CPW instead lets
    // one barely-worn coat blow the number up (PRD appendix B).
    averageCpw: wears > 0 ? (spendBuy + spendCare) / wears : null,
  };
}

/* ---------------------------------------------------------------- 支出趋势 */

export const RANGES = ["全部", "今年", "本季", "本月"] as const;
export type Range = (typeof RANGES)[number];

/** 桶的粒度。区间从宽到窄，粒度跟着从年退到天。 */
type Unit = "day" | "month" | "year";

/** 从 ISO 日期上截出对应粒度的桶键：2026-08-25 → 2026-08-25 / 2026-08 / 2026 */
const CUT: Record<Unit, number> = { day: 10, month: 7, year: 4 };

function labelOf(key: string, unit: Unit, last: number) {
  if (unit === "year") return key;
  if (unit === "month") return String(Number(key.slice(5, 7)));
  // 一个月三十来格，格格标数字会糊成一条灰带 —— 只留首、末与 5 的倍数，
  // 其余日子靠 tooltip 读。末位与前一个标记贴太近时（31 日紧挨 30）舍掉那个倍数。
  const day = Number(key.slice(8));
  return day === 1 || day === last || (day % 5 === 0 && last - day >= 3) ? String(day) : "";
}

function captionOf(key: string, unit: Unit) {
  if (unit === "year") return `${key} 年`;
  const head = `${key.slice(0, 4)} 年 ${Number(key.slice(5, 7))} 月`;
  return unit === "month" ? head : `${head} ${Number(key.slice(8))} 日`;
}

/**
 * 本季的首月（PRD 附录 C：春 3–5 / 夏 6–8 / 秋 9–11 / 冬 12–2）。
 * 冬季跨年 —— 12 月起头的那一季要延到次年 2 月，所以 1–2 月得回到上一年的 12 月。
 */
function seasonStart(now: Date) {
  const month = now.getMonth();
  if (month >= 2 && month <= 10) return new Date(now.getFullYear(), month - ((month - 2) % 3), 1);
  return new Date(month === 11 ? now.getFullYear() : now.getFullYear() - 1, 11, 1);
}

export type SpendPoint = {
  /** YYYY-MM 或 YYYY，取决于粒度。 */
  key: string;
  label: string;
  /** 完整口径，给 tooltip 用。 */
  caption: string;
  buy: number;
  care: number;
  added: number;
};

type SpendEvent = { key: string; buy: number; care: number; added: number };

/**
 * 把一件单品摊成若干笔带日期的支出。养护支出挂在支出发生月（PRD 附录 B）；
 * 没有养护流水的单品（手动录入、还没记过账），把合计挂回购买月 ——
 * 宁可粗一点，也不能让趋势图的合计对不上总额。
 */
function spendEvents(items: Item[], unit: Unit): SpendEvent[] {
  const cut = CUT[unit];
  const out: SpendEvent[] = [];
  for (const item of items) {
    out.push({ key: item.boughtAt.slice(0, cut), buy: item.price, care: 0, added: 1 });
    if (item.careLog?.length) {
      for (const record of item.careLog) {
        out.push({ key: record.date.slice(0, cut), buy: 0, care: record.amount, added: 0 });
      }
    } else if (item.care > 0) {
      out.push({ key: item.boughtAt.slice(0, cut), buy: 0, care: item.care, added: 0 });
    }
  }
  return out;
}

/** 区间内的桶。空桶也要给出来，否则横轴会被压缩成一条不连续的时间线。 */
function buckets(items: Item[], range: Range, now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (range === "全部") {
    const years = spendEvents(items, "year").map((event) => Number(event.key));
    const first = years.length > 0 ? Math.min(...years) : year;
    const keys: string[] = [];
    for (let y = first; y <= year; y += 1) keys.push(String(y));
    return { unit: "year" as const, keys };
  }

  const keys: string[] = [];
  if (range === "今年") {
    // 整年铺满 1–12 月，横轴永远从 1 月起。还没到的月份留空桶 ——
    // 一年花了多少，本来就该看着它一格一格填起来。
    for (let m = 1; m <= 12; m += 1) keys.push(`${year}-${pad(m)}`);
    return { unit: "month" as const, keys };
  }

  if (range === "本季") {
    const start = seasonStart(now);
    for (let index = 0; index < 3; index += 1) {
      const cursor = new Date(start.getFullYear(), start.getMonth() + index, 1);
      keys.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`);
    }
    return { unit: "month" as const, keys };
  }

  // 本月按天。整月铺满，还没到的日子留空桶 —— 和「今年」同一个道理。
  // new Date(y, m, 0) 是上个月的最后一天，month 已经是 1-based，正好取到本月天数。
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d += 1) keys.push(`${year}-${pad(month)}-${pad(d)}`);
  return { unit: "day" as const, keys };
}

export function spendSeries(items: Item[], range: Range, now = new Date()) {
  const { unit, keys } = buckets(items, range, now);
  const totals = new Map<string, SpendEvent>();
  for (const event of spendEvents(items, unit)) {
    const row = totals.get(event.key) ?? { key: event.key, buy: 0, care: 0, added: 0 };
    row.buy += event.buy;
    row.care += event.care;
    row.added += event.added;
    totals.set(event.key, row);
  }

  const points: SpendPoint[] = keys.map((key) => {
    const row = totals.get(key);
    return {
      key,
      label: labelOf(key, unit, keys.length),
      caption: captionOf(key, unit),
      buy: row?.buy ?? 0,
      care: row?.care ?? 0,
      added: row?.added ?? 0,
    };
  });

  return { unit, points };
}

/**
 * 与参照区间比：「今年」比去年同期、「本季」比上一季同期、「本月」比上月同期。
 * 「全部」没有参照区间，返回 null。
 */
const DELTA_LABEL: Partial<Record<Range, string>> = {
  今年: "去年同期",
  本季: "上一季同期",
  本月: "上月同期",
};

export function spendDelta(items: Item[], range: Range, now = new Date()) {
  if (range === "全部") return null;
  const { unit, keys } = buckets(items, range, now);
  if (keys.length === 0) return null;

  // 区间铺的是整段（整年 / 整季 / 整月），但还没到的格子不能参与环比 ——
  // 拿空桶去比上一段，只会得出「这段花得少」这种假结论。补零对齐的键可直接字典序比大小。
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}${unit === "day" ? `-${pad(now.getDate())}` : ""}`;
  const elapsed = keys.filter((key) => key <= today);
  if (elapsed.length === 0) return null;

  const shifted = (key: string): string | null => {
    if (unit === "day") {
      const cursor = new Date(now.getFullYear(), now.getMonth() - 1, Number(key.slice(8)));
      // 上月天数不足时（31 日对 30 天的月份）Date 会滚进本月，这一天在上月没有对应，舍掉。
      if (cursor.getMonth() === now.getMonth()) return null;
      return dateKey(cursor);
    }
    const back = range === "今年" ? 12 : 3;
    const cursor = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 - back, 1);
    return `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
  };

  const events = spendEvents(items, unit);
  const sum = (window: (string | null)[]) => {
    const set = new Set(window.filter((key): key is string => key !== null));
    return events.reduce((total, event) => (set.has(event.key) ? total + event.buy + event.care : total), 0);
  };

  const current = sum(elapsed);
  const before = sum(elapsed.map(shifted));
  if (before === 0) return null;
  return {
    current,
    before,
    ratio: (current - before) / before,
    label: DELTA_LABEL[range] ?? "上一区间",
  };
}

/** 衣橱规模的累计曲线：截至每个桶末尾，手上还留着的单品有多少件。 */
export function closetSize(items: Item[], range: Range, now = new Date()) {
  const { unit, keys } = buckets(items, range, now);
  const cut = CUT[unit];
  const live = active(items);
  return keys.map((key) => ({
    key,
    label: labelOf(key, unit, keys.length),
    caption: `${captionOf(key, unit)}${unit === "day" ? "" : "底"}`,
    value: live.filter((item) => item.boughtAt.slice(0, cut) <= key).length,
    added: live.filter((item) => item.boughtAt.slice(0, cut) === key).length,
  }));
}

/** 最近的一笔购买与一笔养护。给「总投入」卡收尾，也是这张卡唯一的时间线索。 */
export function latestSpend(items: Item[]) {
  let purchase: { date: string; name: string; amount: number } | null = null;
  let care: { date: string; name: string; amount: number; note: string } | null = null;

  for (const item of items) {
    if (!purchase || item.boughtAt > purchase.date) {
      purchase = { date: item.boughtAt, name: item.name, amount: item.price };
    }
    for (const record of item.careLog ?? []) {
      if (!care || record.date > care.date) {
        care = { date: record.date, name: item.name, amount: record.amount, note: record.note };
      }
    }
  }

  return { purchase, care };
}

/* -------------------------------------------------------------- 预算与结构 */

/** 本自然月已花掉多少、月度预算还剩多少。预算来自「个人档案」。 */
export function budgetStatus(items: Item[], monthlyBudget: string, now = new Date()) {
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const spent = spendEvents(items, "month")
    .filter((event) => event.key === key)
    .reduce((total, event) => total + event.buy + event.care, 0);

  const budget = Number(monthlyBudget);
  if (!Number.isFinite(budget) || budget <= 0) return { spent, budget: null as number | null, ratio: null };
  return { spent, budget, ratio: spent / budget };
}

export function byCategory(items: Item[]) {
  return CATEGORIES.map((category) => {
    const group = items.filter((item) => item.category === category);
    return {
      category,
      count: group.length,
      spend: group.reduce((sum, item) => sum + item.price + item.care, 0),
    };
  }).filter((row) => row.count > 0);
}

export function byBrand(items: Item[]) {
  const map = new Map<string, { brand: string; count: number; spend: number }>();
  for (const item of items) {
    const row = map.get(item.brand) ?? { brand: item.brand, count: 0, spend: 0 };
    row.count += 1;
    row.spend += item.price + item.care;
    map.set(item.brand, row);
  }
  return [...map.values()];
}

/** 穿着次数按一级品类分布，用于点阵图。已处置的不算 —— 它们没法再被穿。 */
export function wearsByCategory(items: Item[]) {
  const rows = CATEGORIES.map((category) => ({
    category,
    wears: active(items)
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + item.wears, 0),
  })).filter((row) => row.wears > 0);
  return rows.sort((a, b) => b.wears - a.wears);
}

/** 手上的衣服里有多少件真正穿过。每件一个点。 */
export function utilisation(items: Item[]) {
  const live = active(items);
  const worn = live.filter((item) => item.wears > 0);
  return {
    total: live.length,
    worn: worn.length,
    never: live.length - worn.length,
    ratio: live.length > 0 ? worn.length / live.length : 0,
    // 点阵按穿着次数从多到少铺，空心的自然聚到末尾。
    dots: [...live].sort((a, b) => b.wears - a.wears).map((item) => ({ id: item.id, name: item.name, wears: item.wears })),
  };
}

/**
 * 单次成本的分布。**只分档、不评级** —— 每一档就是一个价格区间，
 * 不带「优秀 / 待审视」这类标签，也不上红黄绿（PRD 6.5）。
 * 均值答不了「贵的那几件贵在哪一档」，这张分布图才答得了。
 */
export function cpwDistribution(items: Item[]) {
  const bands = [
    { label: "<10", test: (value: number) => value < 10 },
    { label: "10–30", test: (value: number) => value >= 10 && value < 30 },
    { label: "30–60", test: (value: number) => value >= 30 && value < 60 },
    { label: "60–120", test: (value: number) => value >= 60 && value < 120 },
    { label: "≥120", test: (value: number) => value >= 120 },
  ];

  const live = active(items);
  const rows = bands.map((band) => ({
    label: band.label,
    count: live.filter((item) => {
      const value = cpw(item);
      return value !== null && band.test(value);
    }).length,
  }));

  // 未穿着的单品没有 CPW，单独挂一档，不要让它们在分布里凭空消失。
  return [...rows, { label: "未穿", count: live.filter((item) => cpw(item) === null).length }];
}

export function mostWorn(items: Item[], limit = 10) {
  return active(items)
    .filter((item) => item.wears > 0)
    .sort((a, b) => b.wears - a.wears)
    .slice(0, limit);
}

/** Never-worn pieces have no CPW at all, so they cannot rank either way. */
export function cpwRanking(items: Item[], direction: "low" | "high", limit = 10) {
  return active(items)
    .filter((item) => cpw(item) !== null)
    .sort((a, b) => (direction === "low" ? cpw(a)! - cpw(b)! : cpw(b)! - cpw(a)!))
    .slice(0, limit);
}

export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

/**
 * In season and never worn. A plain statement of fact — the PRD is explicit
 * that this list carries no nudge and no judgement. It exists because a piece
 * with zero wears has no CPW and so can never surface in the CPW rankings.
 */
export function unwornThisSeason(items: Item[], season: Season) {
  return active(items).filter((item) => item.seasons.includes(season) && item.wears === 0);
}

export function colourSpread(items: Item[]) {
  const map = new Map<string, number>();
  for (const item of active(items)) map.set(item.colorFamily, (map.get(item.colorFamily) ?? 0) + 1);
  return [...map.entries()].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count);
}

/** 一件四季款会在四个季节里各数一次 —— 问的是「每个季节有多少件可穿」。 */
export function seasonSpread(items: Item[]) {
  return SEASONS.map((season) => ({
    season,
    count: active(items).filter((item) => item.seasons.includes(season)).length,
  }));
}
