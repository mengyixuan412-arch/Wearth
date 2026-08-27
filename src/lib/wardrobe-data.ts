/**
 * 衣橱的**纯数据与规则** —— 品类表、色系、季节、CPW 计算。没有 React，
 * 顶上也**没有 `"use client"`**，所以服务端（Route Handler、`lib/ai/`）也能引。
 *
 * 这个拆分不是洁癖：带 `"use client"` 的模块被服务端引用时，Turbopack 会把导出
 * 换成客户端引用代理 —— `CATEGORIES` 在服务端不是数组，`.map()` 直接抛
 * `is not a function`。AI 那层要拿这些枚举拼提示词，必须从这里引。
 *
 * 带状态的那半边（`useWardrobe` 与种子数据）在 `wardrobe.ts`，它 re-export 本文件，
 * 所以客户端的既有引用不用改。
 */
/**
 * 一级品类。**不再沿用 PRD 附录 A 的八大类**，改按产品给的分类稿重写：
 * 上半身分「外套 / 内搭」两类，「下装」拆成「裤子 / 半身裙」，「配饰」拆出「帽子 / 首饰」。
 * 附录 A 与本表已不一致，以本表为准（见文件末尾的口径说明）。
 */
export const CATEGORIES = [
  "外套",
  "内搭",
  "裤子",
  "半身裙",
  "连体装",
  "鞋",
  "包",
  "帽子",
  "首饰",
  "配饰",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * 二级品类。粒度按「刚好够支撑衣橱重复度判定」定 —— 粗到只有「上衣」会把衬衫和卫衣
 * 判成重复，细到「泡泡袖雪纺衬衫」则永远判不出重复。决策①的相似判定直接吃这一层，
 * 改动会连带改变历史评分，不要随手加减。
 *
 * 每组末尾的「其他 X」是兜底项：录入时找不到对应款式也能入库，不至于逼用户瞎选一个。
 */
export const SUBCATEGORIES: Record<Category, readonly string[]> = {
  外套: [
    "西装", "夹克", "牛仔衣", "棒球服", "开衫",
    "风衣", "大衣", "斗篷",
    "棉衣", "羊羔绒", "羽绒服",
    "皮衣", "皮草", "其他外套",
  ],
  内搭: [
    "T恤", "POLO衫", "衬衫", "卫衣",
    "毛衣", "针织衫", "开衫", "马甲",
    "吊带", "背心", "抹胸", "其他内搭",
  ],
  裤子: ["牛仔裤", "休闲裤", "运动裤", "西装裤", "打底裤", "皮裤", "其他裤子"],
  半身裙: ["包臀裙", "背带裙", "蓬蓬裙", "A字裙", "百褶裙", "其他半身裙"],
  连体装: ["连衣裙", "连衣裤"],
  鞋: [
    "高跟鞋", "乐福鞋", "长靴", "踝/短靴", "平底时装鞋",
    "凉鞋", "板鞋", "帆布鞋", "运动鞋", "豆豆鞋",
    "洞洞鞋", "松糕鞋", "懒人鞋", "雪地鞋", "休闲鞋", "拖鞋", "其他鞋类",
  ],
  包: ["休闲/运动包", "时装包", "帆布包", "腰/胸包", "箱包", "手拿包", "双肩包", "其他包类"],
  帽子: [
    "鸭舌帽", "贝雷帽", "毛线帽", "遮阳帽", "头巾帽",
    "渔夫帽", "平顶帽", "报童帽", "雷锋帽", "礼帽", "其他帽子",
  ],
  首饰: ["手链/镯", "戒指", "胸针", "项链", "耳饰", "其他首饰"],
  配饰: [
    "手表", "发饰", "内衣", "袜子", "领带", "腰带/腰链",
    "围巾/披肩", "丝巾", "手套", "眼镜", "其他配饰",
  ],
};

/**
 * 品类选择用的两级数据。形状对齐档案页的省市联动控件（`CascadeSelect`），
 * 直接复用那一个控件，不为品类再造一个。
 */
export const CATEGORY_REGIONS = CATEGORIES.map((category) => ({
  province: category as string,
  cities: [...SUBCATEGORIES[category]],
}));

/*
 * 这里原先有个 `categoryOfSub()`，靠「二级品类名全局唯一」把一级反查回来。
 * 「开衫」现在同时挂在内搭与外套下（冬天当内搭、春秋当外套），这个前提不再成立 ——
 * 反查会永远返回先命中的那一类，一半的情况是错的。
 *
 * 录入弹窗本来就是一级 → 二级钻取，`category` 与 `sub` 分开存，用不到反查，
 * 所以直接删掉而不是留一个会算错的函数在那里等人接。
 * 将来若真需要「由二级找一级」，它必须返回**一组**结果，由调用方消歧。
 */

export const SEASONS = ["春", "夏", "秋", "冬"] as const;
export type Season = (typeof SEASONS)[number];

export const COLOR_FAMILIES = ["白", "黑", "灰", "红", "蓝", "粉"] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/** 六档色系各自的代表色。录入时选了哪一档，`item.color` 就存这个 hex。 */
export const FAMILY_SWATCH: Record<ColorFamily, string> = {
  白: "#F2F0EC",
  黑: "#1F1F21",
  灰: "#8C8C8C",
  红: "#B23A3A",
  蓝: "#7A93BC",
  粉: "#D9A8BD",
};

/**
 * 六档色系的预设色板，喂给共用的颜色格（`components/color-field.tsx`）。
 * 录入与评分两处选的是同一件事 —— 衣服的色系，色板必须是同一份。
 */
export const COLOR_PRESETS = COLOR_FAMILIES.map((family) => ({
  value: FAMILY_SWATCH[family],
  label: family as string,
}));

/**
 * 把任意 hex 归到六档色系里最近的一档。
 *
 * 自定义颜色必须也能落进某一档 —— `colorFamily` 是衣橱列表筛选的字段，
 * 留空的话那件衣服在「按色系筛选」时会整个消失。存的 `color` 仍是用户挑的
 * 精确值，六档只是它的筛选归属。
 *
 * 注意这套六档和评分引擎里附录 D-4 的八色系是两回事：前者服务筛选（粒度粗、
 * 允许「彩色」这种兜底档），后者服务可搭配性判定（粒度按色相分）。
 */
export function nearestFamily(hex: string): ColorFamily {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "灰";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  // 低饱和的一律走中性三档，只看明暗
  if (s < 0.15) return l > 0.8 ? "白" : l < 0.25 ? "黑" : "灰";
  if (l > 0.9) return "白";
  if (l < 0.12) return "黑";

  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;

  // 六档装不下整个色轮，绿/青并进蓝，橙/黄/棕并进红 —— 这是有损的，
  // 但筛选器只需要「大概是哪一类」，精确色值仍存在 item.color 里。
  if (h >= 90 && h < 270) return "蓝";
  if (h >= 270 && h < 335) return "粉";
  if (h >= 335 || h < 15) return l > 0.65 && s < 0.55 ? "粉" : "红";
  return "红";
}

/**
 * hex → 色系档。**精确等于某档预设的代表色才算那一档**，否则按最近色归并。
 *
 * 直接用 `nearestFamily` 会让预设色偶尔归到隔壁档 —— 六档装不下整个色轮，
 * 归并是有损的。于是「从录入页选的粉」和「从详情页选的同一个粉」会落进
 * 不同的筛选档。录入、详情、评分三个入口都必须走这一个函数。
 */
export function familyOf(hex: string): ColorFamily {
  const preset = COLOR_FAMILIES.find(
    (family) => FAMILY_SWATCH[family].toLowerCase() === hex.toLowerCase(),
  );
  return preset ?? nearestFamily(hex);
}

/**
 * 季节多选点一下之后的新值。三条规则：
 *
 * - 当前是「四季」时点某一季 = 只要这一季（四季态下逐个取消要点三次，没人会那么做）
 * - 点掉最后一季则落回四季 —— **季节标签不能为空**：空集的单品永远进不了
 *   「本季还没穿过」（附录 C）
 * - 结果按春夏秋冬排序，不按点击顺序 —— 详情页要把它 join 成一行显示
 */
export function toggleSeason(current: readonly Season[], season: Season): Season[] {
  const next =
    current.length === SEASONS.length
      ? [season]
      : current.includes(season)
        ? current.filter((entry) => entry !== season)
        : [...current, season];
  return next.length > 0 ? SEASONS.filter((entry) => next.includes(entry)) : [...SEASONS];
}

export const STATUSES = ["在用", "闲置", "已处置"] as const;

export const SORTS = [
  "最新购入",
  "最早购入",
  "单次成本（高到低）",
  "单次成本（低到高）",
  "穿着次数（多到少）",
  "穿着次数（少到多）",
  "价格（低到高）",
  "价格（高到低）",
] as const;
export type Sort = (typeof SORTS)[number];

/**
 * 一笔养护支出。金额进 CPW 分子，日期决定它挂在支出趋势的哪个月 ——
 * PRD 附录 B 要求「养护支出挂在支出发生月」，只存一个合计数是做不到的。
 */
export type CareRecord = {
  date: string;
  amount: number;
  note: string;
};

/**
 * 材质成分。**结构化而非一行自由文本** —— 决策④要按成分逐项加权算舒适/耐久/养护，
 * 「羊毛70%聚酯30%」这样的字符串没法参与计算（PRD 6.2）。
 */
export type Material = {
  /** 归并后的成分档，必须是 `MATERIAL_NAMES` 里的一个。评分④按它取系数。 */
  name: string;
  pct: number;
  /**
   * 水洗标 / 详情页上**原本写的那个名字**，归并前的。`苎麻` 会被归到 `麻`，
   * 这里留着 `苎麻`。
   *
   * 两个用途，都不参与算分：
   *
   * - **养护建议按原文给。**「苎麻：折痕处易发白」比「麻：注意收纳」有用得多（PRD 6.7）
   * - **将来真要拆档时的依据。** 不记的话，手上全是「麻 80%」，
   *   根本不知道哪些是苎麻哪些是亚麻 —— 只能让用户把衣服重录一遍。
   *   记了就能先看真实分布：如果衣橱里的麻九成是亚麻，这档压根不用拆
   *
   * 可选字段，存量数据没有它也无害，所以**不进 storage key 的版本号**（见 ARCHITECTURE.md §3）。
   */
  raw?: string;
};

export type Item = {
  id: string;
  name: string;
  category: Category;
  sub: string;
  /** Purchase price in yuan. */
  price: number;
  /** Accumulated care spend, part of the CPW numerator. Equals the care log's sum. */
  care: number;
  /** Dated breakdown of `care`. Absent on hand-entered items until care is logged. */
  careLog?: CareRecord[];
  wears: number;
  /** Cut-out photo, transparent background. */
  image: string;
  color: string;
  colorFamily: ColorFamily;
  seasons: Season[];
  brand: string;
  /** ISO date, used by the default sort. */
  boughtAt: string;
  status: (typeof STATUSES)[number];
  /** 成分表，决策④的输入。存量种子数据没有这一项，所以是可选的。 */
  materials?: Material[];
  size?: string;
  /** 购入渠道，PRD 6.2 的选填项。 */
  channel?: string;
  /**
   * 演示数据的标记。**只有内置的那 21 件有**，用户自己录的没有。
   *
   * 存在的理由：种子数据是初始值，用户一操作就和他自己的衣服混在同一个数组里，
   * 也一起存进 localStorage。登录后把本地数据传上云时，**这 21 件不该跟着上去** ——
   * 它们会污染统计（总花费、品牌排名）和评分（衣橱重复度、可搭配率都要全表扫）。
   *
   * **不能靠 id 判断**：种子是 "1"–"21"，但用户删掉几件再新增，`nextId()` 取的是
   * 当前最大 id + 1，新件完全可能拿到 "21" 这种号。得有个字段显式记着。
   */
  demo?: true;
  note?: string;
};

/**
 * CPW = (price + care) / wears. Zero wears has no CPW — showing infinity or
 * falling back to the price would poison the wardrobe average (PRD appendix B).
 */
export function cpw(item: Item): number | null {
  if (item.wears <= 0) return null;
  return (item.price + item.care) / item.wears;
}

export function formatCpw(item: Item) {
  const value = cpw(item);
  if (value === null) return `尚未穿着 · 已投入 ¥${item.price + item.care}`;
  return `¥${value.toFixed(value >= 100 ? 0 : 1)}/次 · 已穿 ${item.wears} 次`;
}

