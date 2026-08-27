export type NavItem = { zh: string; en: string; href: string };

export const NAV_ITEMS: NavItem[] = [
  { zh: "主页", en: "HOMEPAGE", href: "/" },
  { zh: "个人档案", en: "PROFILE", href: "/profile" },
  { zh: "我的衣橱", en: "WARDROBE", href: "/wardrobe" },
  { zh: "穿搭日志", en: "OOTD", href: "/ootd" },
  { zh: "衣橱统计", en: "INSIGHTS", href: "/analysis" },
  { zh: "购买评分", en: "SCORE", href: "/decide" },
];

export const BRAND = {
  zh: "衣橱资产&购买决策",
  en: "Wardrobe Assets & Purchase Decisions",
};

export const SUBMARK = "Wear X Worth";

export const TAGLINE = {
  zh: "衣有所值，心动有知",
  en: "Wear with delight, Buy with insight",
};
