export type NavItem = { zh: string; en: string; anchor: string };

/**
 * The site is one continuous scroll, like the original — nav entries are
 * anchors within that scroll, not routes.
 */
export const NAV_ITEMS: NavItem[] = [
  { zh: "主页", en: "HOMEPAGE", anchor: "#banner" },
  { zh: "认识自己", en: "PROFILE", anchor: "#profile" },
  { zh: "我的衣橱", en: "WARDROBE", anchor: "#wardrobe" },
  { zh: "穿搭日志", en: "OOTD", anchor: "#ootd" },
  { zh: "衣橱统计", en: "ANALYSIS", anchor: "#analysis" },
  { zh: "购买评分", en: "DECIDE", anchor: "#decide" },
];

export const BRAND = { zh: "衣橱资产&购买决策", en: "Wardrobe Assets & Purchase Decisions" };
export const SUBMARK = "Wear X Worth";
export const TAGLINE = { zh: "衣有所值，心动有知", en: "Wear with delight, Buy with insight" };
