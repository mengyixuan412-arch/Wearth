/**
 * 全站日期的唯一出处：**存什么格式、读成什么样子，都在这里定**。
 *
 * 存储一律是 `YYYY-MM-DD` 的本地日期键（`dateKey`）—— 它可直接字符串比大小、
 * 可按前缀切出年月（统计的趋势图就是这么分组的），是所有 store 的字段格式。
 * 界面上一律读成 `2026/08/12`（`formatDate`）—— 斜杠是 DESIGN.md §3 定的写法。
 *
 * 两件事分开，是因为它们的读者不同：连字符那版给代码看，斜杠那版给人看。
 * 之前两种混着往界面上放，同一张抽屉里「购入日期」是 `2026-04-08`、
 * 日期选择器却是 `2026/08/26`，看起来像两个系统的数据。
 */

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * 本地日期键 `YYYY-MM-DD`。
 *
 * **不用 `toISOString()`** —— 那个走 UTC，东八区晚上 8 点之后会记成前一天。
 */
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 今天的日期键。 */
export const today = () => dateKey(new Date());

/**
 * 日期键 → 本地零点的 Date。
 *
 * 补 `T00:00:00` 是必须的：`new Date("2026-08-12")` 按 UTC 零点解析，
 * 东八区拿到的是 8 点，跨时区加减天数时会漂。
 */
export function parseKey(key: string) {
  const date = new Date(`${key}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export const sameDay = (a: Date, b: Date) => dateKey(a) === dateKey(b);

/** 界面上的日期：`2026/08/12`。空值返回空串，好让调用方直接落进 JSX。 */
export const formatDate = (key: string) => (key ? key.replace(/-/g, "/") : "");

/**
 * 省掉年份的短版：`08/12`。
 *
 * 只用在**年份已经由上下文交代过**的地方（单品详情里那一排穿着日期，都在
 * 这件衣服的生命周期内）。列表和读数一律用完整的 `formatDate` —— 少了年份，
 * 「去年的 08/12」和「今年的」就分不出来了。
 */
export const formatDateShort = (key: string) => (key ? key.slice(5).replace("-", "/") : "");

/**
 * 月视图矩阵：**周一起头**（参考图与国内习惯一致），补齐前后邻月，
 * 始终 6 行 42 格，换月时高度不跳。
 *
 * 穿搭日志的整页日历和日期选择器的浮层共用这一个 —— 两处的排布必须一致，
 * 否则同一个月在两个地方的格子位置对不上。
 */
export function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  // getDay() 周日为 0，+6 再取模把周一挪到 0
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date, inMonth: date.getMonth() === month };
  });
}
