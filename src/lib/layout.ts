/**
 * 首图和它下面第一条横线之间的距离。四个内容页都用这一个 ——
 * 翻页时首图的位置是固定的，这条距离一变，横线就会在页与页之间跳。
 *
 * 各页横线的来源不同（衣橱、统计是筛选栏的 border-b，穿搭是日历框的上边框），
 * 但它们在视觉上是同一条线，所以对齐的是「首图底边 → 线」这段整体距离：
 * 这个间距 + 中间那条栏自己的高度和下内边距。
 */
export const HERO_GAP = "mt-5 lg:mt-7";

/**
 * 两档发丝线（DESIGN.md §2）。**唯一来源是 globals.css 的 `--frame` / `--rule-strong`**，
 * 这里只是把它们包成 JS 侧能用的 `var()`，inline style 与 Tailwind 的 `border-frame`
 * 因此指向同一个值，不会各自漂移。
 *
 * 之前这两个值在五处各写各的（图表模块导出一份、衣橱页一份、日志页一份、
 * 还有两处直接写死 0.88），改一档要翻五个文件才改得全。
 */
export const FRAME = "var(--frame)";
export const RULE_STRONG = "var(--rule-strong)";
