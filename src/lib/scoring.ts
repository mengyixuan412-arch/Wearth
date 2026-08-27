/**
 * 购买评分引擎 —— PRD 附录 D 的完整实现。
 *
 * **分数由规则算，大模型只负责截图理解和理由生成。** 这样同一件商品两次评分
 * 一定给出同一个结果，决策工具的公信力就建立在这个一致性上（PRD 6.6）。
 * 这个文件里没有任何随机、没有任何时间依赖 —— 输入相同则输出相同。
 *
 * 所有输入（衣橱快照、预算余额、品类均价、CPW 中位数）在评分时刻取值，
 * 随决策记录一并存档，历史评分可复现。
 */

import { SUBCATEGORIES, cpw, type Category, type Item, type Material, type Season } from "@/lib/wardrobe";

// ─────────────────────────────────────────────────────────────
// D-1 品牌档次系数
// ─────────────────────────────────────────────────────────────

export const BRAND_TIERS = [
  { tier: "快时尚", factor: 1.0, examples: ["优衣库", "Zara", "ZARA", "H&M", "UR", "GU"] },
  { tier: "大众品牌", factor: 1.8, examples: ["太平鸟", "Only", "江南布衣", "Levi's", "Adidas", "Nike"] },
  { tier: "设计师 / 轻奢", factor: 3.5, examples: ["COS", "Maje", "Sandro", "Theory", "Coach", "Longchamp"] },
  { tier: "奢侈品", factor: 8.0, examples: ["Max Mara", "MaxMara", "Burberry", "Hermès", "Chanel", "Dior"] },
] as const;

/** 未收录品牌按「大众品牌」处理（附录 D-1）。 */
export const DEFAULT_BRAND_TIER = BRAND_TIERS[1];

export function brandTier(brand: string) {
  const key = brand.trim().toLowerCase();
  if (key === "") return DEFAULT_BRAND_TIER;
  return (
    BRAND_TIERS.find((row) => row.examples.some((name) => name.toLowerCase() === key)) ??
    DEFAULT_BRAND_TIER
  );
}

// ─────────────────────────────────────────────────────────────
// D-2 材质参数与养护频次
// ─────────────────────────────────────────────────────────────

export type MaterialSpec = {
  /** 价格系数，用于冷启动路径的参考价。 */
  price: number;
  comfort: number;
  durability: number;
  /** 「养护」分越高越好打理。 */
  care: number;
};

export const MATERIALS: Record<string, MaterialSpec> = {
  棉: { price: 1.0, comfort: 9, durability: 6, care: 9 },
  麻: { price: 1.2, comfort: 8, durability: 7, care: 7 },
  聚酯纤维: { price: 0.7, comfort: 4, durability: 8, care: 9 },
  锦纶: { price: 0.8, comfort: 5, durability: 9, care: 8 },
  氨纶: { price: 0.8, comfort: 6, durability: 5, care: 8 },
  粘纤: { price: 0.9, comfort: 7, durability: 4, care: 6 },
  腈纶: { price: 0.7, comfort: 5, durability: 4, care: 5 },
  羊毛: { price: 1.8, comfort: 8, durability: 6, care: 4 },
  羊绒: { price: 3.5, comfort: 10, durability: 4, care: 3 },
  真丝: { price: 2.5, comfort: 9, durability: 3, care: 2 },
  醋酸: { price: 1.1, comfort: 7, durability: 4, care: 4 },
  皮革: { price: 2.0, comfort: 6, durability: 8, care: 4 },
  麂皮: { price: 2.2, comfort: 6, durability: 5, care: 2 },
  羽绒: { price: 1.6, comfort: 8, durability: 7, care: 5 },
};

export const MATERIAL_NAMES = Object.keys(MATERIALS);

/**
 * 成分别名 → 闭集里的档。
 *
 * **这是常设设施，不是临时替代扩充闭集的。** 闭集扩得再大，水洗标上照样会写
 * `亚麻` / `Linen` / `涤纶` / `莱卡` —— 输入归一化这件事永远要有人做。
 *
 * 归并是**有损**的：苎麻比亚麻硬挺、贴身可能扎人，两者的舒适度确实差一档。
 * 但那点差异折算到 100 分制的总分上只有约 1 分，**小于附录 D 那张系数表本身的
 * 不确定度**（PRD 原文：参数表为初始值，需在种子数据上试跑后校准）。
 * 在没校准的表上拆档是在噪声上做精度，而且每加一档就多 4 个待校准参数，
 * 样本却没变多 —— 拆档让校准更难，不是更准。
 *
 * 归并前的原文存在 `Material.raw` 里：养护建议按它给，将来真要拆档也按它回填。
 *
 * **只收行业通用的同义叫法。** 拿不准的（莱赛尔、天丝这类新再生纤维素纤维）
 * 宁可不收，让它落到「读不出来」走手填 —— 硬套一个相近的档会算错养护建议，
 * 而错的养护建议是真会把衣服洗坏的（PRD §8 不做材质图片识别是同一个理由）。
 */
export const MATERIAL_ALIASES: Record<string, string> = {
  // 麻：苎麻、亚麻都归「麻」，差异见上面那段
  苎麻: "麻", 亚麻: "麻", 亚麻纤维: "麻", 麻纤维: "麻", linen: "麻", flax: "麻", ramie: "麻",
  // 真丝：桑蚕丝与柞蚕丝是蚕种之别，「丝绒」是织法不是成分
  桑蚕丝: "真丝", 柞蚕丝: "真丝", 蚕丝: "真丝", 丝: "真丝", 丝绒: "真丝", 真丝丝绒: "真丝", silk: "真丝",
  // 化纤：商品名与学名的对应是确定的
  涤纶: "聚酯纤维", 聚酯: "聚酯纤维", polyester: "聚酯纤维",
  尼龙: "锦纶", 锦纶纤维: "锦纶", nylon: "锦纶",
  莱卡: "氨纶", 弹性纤维: "氨纶", 弹力纤维: "氨纶", spandex: "氨纶", elastane: "氨纶",
  粘胶: "粘纤", 粘胶纤维: "粘纤", 人造棉: "粘纤", viscose: "粘纤", rayon: "粘纤",
  腈纶纤维: "腈纶", acrylic: "腈纶",
  // 天然
  棉纤维: "棉", 全棉: "棉", 纯棉: "棉", cotton: "棉",
  羊毛纤维: "羊毛", 美利奴: "羊毛", wool: "羊毛", merino: "羊毛",
  山羊绒: "羊绒", 开司米: "羊绒", cashmere: "羊绒",
  醋酸纤维: "醋酸", 醋纤: "醋酸", acetate: "醋酸",
  牛皮: "皮革", 羊皮: "皮革", 真皮: "皮革", leather: "皮革",
  反绒皮: "麂皮", 磨砂皮: "麂皮", suede: "麂皮",
  鸭绒: "羽绒", 鹅绒: "羽绒", down: "羽绒",
};

/**
 * 把水洗标上的一个成分名归到闭集里。命中不了返回 `null`，由调用方丢弃。
 * 大小写与首尾空白不敏感 —— 标签上 `Cotton` 和 `cotton` 都见得到。
 */
export function normaliseMaterial(raw: string): string | null {
  const clean = raw.trim();
  if (MATERIALS[clean]) return clean;
  return MATERIAL_ALIASES[clean.toLowerCase()] ?? MATERIAL_ALIASES[clean] ?? null;
}

/**
 * 需要干洗的成分。附录 D 只写了「需干洗再 −4」，没有定义怎么判定 ——
 * 这里按成分给一张明表，占比最高的成分属于此表就算需干洗。
 * 写死成表而不是让用户勾，是为了保证同一件商品的评分可复现。
 */
const DRY_CLEAN = new Set(["羊毛", "羊绒", "真丝", "皮革", "麂皮", "醋酸"]);

/** 年度养护频次与单次成本（附录 D-2 末尾）。 */
export function careFrequency(sub: string, materials: Material[]) {
  const names = materials.map((entry) => entry.name);
  if (["大衣", "西装", "皮衣", "皮草"].includes(sub)) return { times: 2, unit: 60 };
  if (["毛衣", "针织衫", "开衫"].includes(sub) && names.some((n) => n === "羊毛" || n === "羊绒")) {
    return { times: 2, unit: 40 };
  }
  if (names.includes("真丝")) return { times: 3, unit: 40 };
  return { times: 0, unit: 0 };
}

// ─────────────────────────────────────────────────────────────
// D-3 品类基价与互补矩阵
// ─────────────────────────────────────────────────────────────

/**
 * 基准价（元，以快时尚档 + 棉/涤纶为基准）。
 *
 * 附录 D-3 只给了旧品类树里服装五类的价，品类改写后**多数二级品类在 D-3 里没有对应**。
 * 这里把 D-3 有的值原样挪过来（T恤 80 / 大衣 500 / 高跟鞋 300 …），其余按同档位估。
 * 包 / 帽子 / 首饰 / 配饰四类 D-3 完全没给过，整组都是估值。
 *
 * **这些估值需要在种子数据上试跑后校准** —— PRD 附录 D 本来就写明 D-1~D-4 是初始值。
 * 缺项会让冷启动的参考价算成 0，进而把价格合理性打成 0 分，所以宁可先给一个数。
 */
export const BASE_PRICES: Record<string, number> = {
  // 内搭
  T恤: 80, POLO衫: 130, 衬衫: 150, 卫衣: 180,
  毛衣: 200, 针织衫: 180, 马甲: 180,
  吊带: 60, 背心: 60, 抹胸: 80, 其他内搭: 150,
  // 外套（开衫两类共用一个价 —— 基准价按二级品类建键，与它挂在哪一类无关）
  开衫: 200, 西装: 350, 夹克: 300, 牛仔衣: 300, 棒球服: 280,
  风衣: 400, 大衣: 500, 斗篷: 400,
  棉衣: 380, 羊羔绒: 450, 羽绒服: 500,
  皮衣: 450, 皮草: 1200, 其他外套: 400,
  // 裤子
  牛仔裤: 200, 休闲裤: 180, 运动裤: 160, 西装裤: 180, 打底裤: 80, 皮裤: 400, 其他裤子: 180,
  // 半身裙
  包臀裙: 160, 背带裙: 200, 蓬蓬裙: 180, A字裙: 150, 百褶裙: 160, 其他半身裙: 150,
  // 连体装
  连衣裙: 250, 连衣裤: 250,
  // 鞋
  高跟鞋: 300, 乐福鞋: 320, 长靴: 450, "踝/短靴": 400, 平底时装鞋: 250,
  凉鞋: 180, 板鞋: 300, 帆布鞋: 200, 运动鞋: 350, 豆豆鞋: 300,
  洞洞鞋: 150, 松糕鞋: 300, 懒人鞋: 250, 雪地鞋: 350, 休闲鞋: 280, 拖鞋: 120, 其他鞋类: 250,
  // 包
  "休闲/运动包": 250, 时装包: 500, 帆布包: 120, "腰/胸包": 250,
  箱包: 600, 手拿包: 350, 双肩包: 350, 其他包类: 300,
  // 帽子
  鸭舌帽: 90, 贝雷帽: 90, 毛线帽: 80, 遮阳帽: 100, 头巾帽: 70,
  渔夫帽: 90, 平顶帽: 100, 报童帽: 100, 雷锋帽: 130, 礼帽: 150, 其他帽子: 100,
  // 首饰
  "手链/镯": 200, 戒指: 200, 胸针: 150, 项链: 250, 耳饰: 150, 其他首饰: 180,
  // 配饰
  手表: 800, 发饰: 50, 内衣: 150, 袜子: 30, 领带: 150, "腰带/腰链": 200,
  "围巾/披肩": 200, 丝巾: 250, 手套: 120, 眼镜: 300, 其他配饰: 120,
};

/**
 * 互补矩阵。**只在服装类之间计算** —— 包 / 帽子 / 首饰 / 配饰
 * 纳入录入、CPW 与花费统计，但不参与可搭配性。
 *
 * 上半身拆成「内搭 / 外套」之后，「外套 ↔ 内搭」（西装配衬衫）这条关系又能表达了 ——
 * 上一版把外套并进上衣时它是丢失的，可搭配率会系统性偏低。
 *
 * 内搭不与鞋互补（沿用附录 A：上装 ↔ 鞋履 ✗），外套则可以 —— 外套决定整体廓形，
 * 和鞋的呼应是成立的搭配判断。
 */
const COMPLEMENT: Partial<Record<Category, Category[]>> = {
  内搭: ["裤子", "半身裙", "外套"],
  外套: ["内搭", "裤子", "半身裙", "连体装", "鞋"],
  裤子: ["内搭", "外套", "鞋"],
  半身裙: ["内搭", "外套", "鞋"],
  连体装: ["外套", "鞋"],
  鞋: ["裤子", "半身裙", "连体装", "外套"],
};

export function complementsOf(category: Category): Category[] {
  return COMPLEMENT[category] ?? [];
}

/** 该品类是否参与可搭配性判定。 */
export function isApparel(category: Category) {
  return category in COMPLEMENT;
}

// ─────────────────────────────────────────────────────────────
// D-4 色系归并与搭配规则
// ─────────────────────────────────────────────────────────────

export type ColorFamilyD4 =
  | "中性色" | "红色系" | "橙色系" | "黄色系" | "绿色系" | "蓝色系" | "紫色系" | "棕色系";

/**
 * 由 hex 归并到附录 D-4 的八色系。
 *
 * 用 hex 推而不是直接用 `item.colorFamily`：后者是衣橱列表筛选用的六档
 * （白/黑灰/米棕/蓝/粉紫/彩色），粒度和 D-4 对不上，硬映射会把「藏青」和
 * 「宝蓝」判成同一件事 —— 而 D-4 里前者是中性色、后者是蓝色系，可搭性完全不同。
 *
 * 阈值取自 D-4 的色名归属：低饱和、极亮、极暗一律归中性（黑白灰米驼藏青牛仔蓝），
 * 其余按色相分段；橙色区里偏暗的那半是棕色系。
 */
export function colorFamilyD4(hex: string): ColorFamilyD4 {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "中性色";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  // 黑 / 白 / 灰 / 米 / 驼 / 藏青 / 牛仔蓝 —— D-4 把它们全部归入中性色
  if (s < 0.22 || l > 0.86 || l < 0.18) return "中性色";

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;

  if (h < 15 || h >= 330) return "红色系";
  if (h < 45) return l < 0.45 ? "棕色系" : "橙色系";
  if (h < 70) return "黄色系";
  if (h < 170) return "绿色系";
  if (h < 260) return l < 0.32 && s < 0.5 ? "中性色" : "蓝色系"; // 藏青
  if (h < 300) return "紫色系";
  return "红色系"; // 玫红 / 粉
}

/** 任一方为中性 → 可搭；双方同色系 → 可搭；双方彩色且不同色系 → 不可搭。 */
export function colorsMatch(a: ColorFamilyD4, b: ColorFamilyD4) {
  return a === "中性色" || b === "中性色" || a === b;
}

// ─────────────────────────────────────────────────────────────
// 候选商品
// ─────────────────────────────────────────────────────────────

/** 尺码表围度，单位 cm。缺项按「无数据」处理，对应维度不计分。 */
export type SizeChart = {
  bust?: number;
  shoulder?: number;
  waist?: number;
  hip?: number;
};

/**
 * ⑤ 身材适配度按品类取哪几个围度。**没列进来的品类不计分**
 * （鞋 / 包 / 帽子 / 首饰 / 配饰与围度无关）。
 *
 * 导出是因为界面也要按它决定展示哪几个尺码输入框 —— 让用户填一个
 * 根本不参与计算的围度，比不问更糟。
 */
export const FIT_MEASURES: Partial<Record<Category, (keyof SizeChart)[]>> = {
  内搭: ["bust", "shoulder"],
  外套: ["bust", "shoulder"],
  裤子: ["waist", "hip"],
  半身裙: ["waist", "hip"],
  连体装: ["bust", "waist", "hip"],
};

/** 围度字段的中文名，界面与理由文案共用。 */
export const MEASURE_LABEL: Record<keyof SizeChart, string> = {
  bust: "胸围",
  shoulder: "肩宽",
  waist: "腰围",
  hip: "臀围",
};

/* ---------------------------------------------- ⑤-5b 肤色适配 */

type Warmth = "暖" | "冷" | "中";

/**
 * 四档预设肤色各自的冷暖倾向（PRD 附录 D-⑤ 5b）。
 * 键是 `profile-options.ts` 里那四个色值，**大小写不敏感地比**。
 */
const SKIN_WARMTH: Record<string, Warmth> = {
  "#E5C0B0": "冷", // 白皙
  "#D9AC8D": "暖", // 自然（中性偏暖）
  "#BA8062": "中", // 小麦
  "#855743": "暖", // 深
};

/** 八个色系（D-4）的冷暖。绿色军绿偏暖、薄荷偏冷，合并归中。 */
const FAMILY_WARMTH: Record<ColorFamilyD4, Warmth> = {
  中性色: "中",
  红色系: "暖",
  橙色系: "暖",
  黄色系: "暖",
  棕色系: "暖",
  蓝色系: "冷",
  紫色系: "冷",
  绿色系: "中",
};

/** 自定义肤色不在四档预设里时的兜底：按 R 与 B 的差判冷暖。 */
function warmthOfSkin(hex: string): Warmth | null {
  const hit = SKIN_WARMTH[hex.toUpperCase()];
  if (hit) return hit;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // 12 是个经验阈值：肤色的 R 恒大于 B，差得不够多才算中性。
  if (r - b > 60) return "暖";
  if (r - b < 35) return "冷";
  return "中";
}

export type Candidate = {
  sub: string;
  category: Category;
  price: number;
  brand: string;
  color: string;
  seasons: Season[];
  materials: Material[];
  sizeChart: SizeChart;
  /**
   * 尺码档（S / M / …）。**不参与任何维度的计分** —— ⑤ 比的是 `sizeChart`
   * 里的围度数字。存它只为回看时知道那几个围度是照哪个码抄的。
   */
  sizeLabel?: string;
};

export type Dimension = {
  key: string;
  index: string;
  zh: string;
  en: string;
  /** 满分权重。不可算时这一份权重会被摊给其余维度。 */
  weight: number;
  /** 得分；`null` 表示本次不可算。 */
  score: number | null;
  reason: string;
  /** 支撑这个分数的具体单品，界面上直接列出来。 */
  evidence?: { id: string; name: string; detail: string }[];
};

export type ScoreResult = {
  /** 归一化后的 0–100 总分。 */
  total: number;
  dimensions: Dimension[];
  countedWeight: number;
  countedCount: number;
  /** 年度预估养护成本，单独输出，不参与算分（附录 D ④）。 */
  annualCare: number;
  /** 冷启动路径下为 true，界面要提示「再录入 X 件解锁完整评分」。 */
  coldStart: number | null;
  /** 评分基于哪一天的衣橱快照。 */
  snapshotAt: string;
};

const bucket = (value: number, cuts: number[], scores: number[]) => {
  for (let i = 0; i < cuts.length; i += 1) if (value <= cuts[i]) return scores[i];
  return scores[scores.length - 1];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

// ─────────────────────────────────────────────────────────────
// 评分主函数
// ─────────────────────────────────────────────────────────────

/**
 * @param budgetLeft 本月剩余预算；`null` 表示用户没设预算，3b 不计。
 * @param body       用户围度，来自个人档案；缺项则⑤不计。
 */
export function scoreCandidate(
  candidate: Candidate,
  wardrobe: Item[],
  budgetLeft: number | null,
  body: { bust?: number; shoulder?: number; waist?: number; hip?: number },
  snapshotAt: string,
  /** 用户肤色（hex）。喂给 ⑤ 的 5b 子项；没设就只按围度算。 */
  skinTone?: string,
): ScoreResult {
  // 已处置的单品不进任何判定 —— 送人卖掉的衣服既不会造成重复，也搭不了。
  const live = wardrobe.filter((item) => item.status !== "已处置");
  const dimensions: Dimension[] = [];

  // ── ① 衣橱重复度（15 分）────────────────────────
  const candFamily = colorFamilyD4(candidate.color);
  const similar = live.filter(
    (item) => item.sub === candidate.sub && colorFamilyD4(item.color) === candFamily,
  );
  let dupScore = bucket(similar.length, [0, 1, 2, 3], [15, 11, 7, 3, 0]);
  const avgWears =
    similar.length > 0 ? similar.reduce((sum, item) => sum + item.wears, 0) / similar.length : 0;
  const penalised = similar.length > 0 && avgWears < 3;
  if (penalised) dupScore = Math.max(0, dupScore - 2);

  dimensions.push({
    key: "duplicate",
    index: "①",
    zh: "衣橱重复度",
    en: "Duplication",
    weight: 15,
    score: dupScore,
    reason:
      similar.length === 0
        ? `衣橱里没有同为「${candidate.sub}」且同属${candFamily}的单品，不构成重复。`
        : `衣橱里已有 ${similar.length} 件同为「${candidate.sub}」的${candFamily}单品${
            penalised ? `，且它们平均只穿过 ${round1(avgWears)} 次 —— 再扣 2 分` : ""
          }。`,
    evidence: similar.map((item) => {
      const value = cpw(item);
      return {
        id: item.id,
        name: item.name,
        detail: `已穿 ${item.wears} 次 · ${value === null ? "尚未穿着" : `¥${value.toFixed(1)}/次`}`,
      };
    }),
  });

  // ── ② 可搭配能力（20 分）────────────────────────
  const complements = complementsOf(candidate.category);
  const pool = live.filter((item) => complements.includes(item.category));
  const matched = pool.filter(
    (item) =>
      colorsMatch(candFamily, colorFamilyD4(item.color)) &&
      item.seasons.some((season) => candidate.seasons.includes(season)),
  );

  let matchDim: Dimension;
  if (!isApparel(candidate.category)) {
    matchDim = {
      key: "match", index: "②", zh: "可搭配能力", en: "Versatility", weight: 20, score: null,
      reason: `${candidate.category}不参与搭配互补矩阵（附录 A），本维度不计分，权重摊给其余维度。`,
    };
  } else if (pool.length === 0) {
    matchDim = {
      key: "match", index: "②", zh: "可搭配能力", en: "Versatility", weight: 20, score: null,
      reason: `衣橱里还没有可与${candidate.category}互补的单品，算不出可搭配率。`,
    };
  } else {
    const rate = matched.length / pool.length;
    matchDim = {
      key: "match",
      index: "②",
      zh: "可搭配能力",
      en: "Versatility",
      weight: 20,
      // 用比率而非件数，不受衣橱规模影响
      score: bucket(rate, [0.099, 0.249, 0.399, 0.599], [2, 5, 10, 15, 20]),
      reason: `衣橱里有 ${pool.length} 件互补品类单品，其中 ${matched.length} 件可搭（同色系或有一方为中性色，且季节有交集），可搭配率 ${Math.round(rate * 100)}%。`,
      evidence: matched.slice(0, 6).map((item) => ({
        id: item.id,
        name: item.name,
        detail: `${item.category} · ${colorFamilyD4(item.color)}`,
      })),
    };
  }
  dimensions.push(matchDim);

  // ── ③ 价格合理性（25 分）────────────────────────
  const coldStart = live.length < 15 ? 15 - live.length : null;

  if (coldStart !== null) {
    // 冷启动：参考价 = 品类基准价 × 品牌档次系数 × 材质价格系数
    const base = BASE_PRICES[candidate.sub] ?? 0;
    const tier = brandTier(candidate.brand);
    const matFactor =
      candidate.materials.length > 0
        ? candidate.materials.reduce(
            (sum, entry) => sum + (entry.pct / 100) * (MATERIALS[entry.name]?.price ?? 1),
            0,
          )
        : 1;

    if (base === 0) {
      dimensions.push({
        key: "price", index: "③", zh: "价格合理性", en: "Price", weight: 25, score: null,
        reason: `附录 D-3 没有为「${candidate.sub}」定义基准价，冷启动下算不出参考价。`,
      });
    } else {
      const ref = base * tier.factor * matFactor;
      const ratio = candidate.price / ref;
      dimensions.push({
        key: "price",
        index: "③",
        zh: "价格合理性",
        en: "Price",
        weight: 25,
        score: bucket(ratio, [0.8, 1.2, 1.8, 2.5], [25, 19, 12, 6, 0]),
        reason: `衣橱只有 ${live.length} 件，走冷启动参考价：${base} × ${tier.factor}（${tier.tier}）× ${round1(matFactor)}（材质）= ¥${Math.round(ref)}，实际价格是它的 ${round1(ratio)} 倍。`,
      });
    }
  } else {
    // 主路径：3a 品类均价 9 + 3b 预算占用 8 + 3c 预估 CPW 8
    const sameSub = live.filter((item) => item.sub === candidate.sub);
    const parts: { label: string; weight: number; score: number | null; note: string }[] = [];

    if (sameSub.length >= 3) {
      const avg = sameSub.reduce((sum, item) => sum + item.price, 0) / sameSub.length;
      const ratio = candidate.price / avg;
      parts.push({
        label: "品类均价",
        weight: 9,
        score: bucket(ratio, [0.8, 1.2, 1.8, 2.5], [9, 7, 4, 2, 0]),
        note: `同类 ${sameSub.length} 件历史均价 ¥${Math.round(avg)}，是它的 ${round1(ratio)} 倍`,
      });
    } else {
      // 该品类历史不足 3 件时 3a 不计，9 分按比例摊给 3b、3c
      parts.push({ label: "品类均价", weight: 9, score: null, note: `同类只有 ${sameSub.length} 件，不足 3 件不计` });
    }

    if (budgetLeft === null) {
      parts.push({ label: "预算占用", weight: 8, score: null, note: "个人档案里没有设月度预算" });
    } else if (budgetLeft <= 0) {
      parts.push({ label: "预算占用", weight: 8, score: 0, note: "本月预算已经超支" });
    } else {
      const share = candidate.price / budgetLeft;
      parts.push({
        label: "预算占用",
        weight: 8,
        score: bucket(share, [0.2, 0.4, 0.7, 1.0], [8, 6, 4, 2, 0]),
        note: `占本月剩余预算 ¥${Math.round(budgetLeft)} 的 ${Math.round(share * 100)}%`,
      });
    }

    // 3c：价格 ÷ 该二级品类在用单品的年均穿着次数，再比衣橱 CPW 中位数
    const inUse = live.filter((item) => item.sub === candidate.sub && item.status === "在用" && item.wears > 0);
    const cpwValues = live.map(cpw).filter((value): value is number => value !== null).sort((a, b) => a - b);
    const median =
      cpwValues.length === 0
        ? null
        : cpwValues.length % 2 === 1
          ? cpwValues[(cpwValues.length - 1) / 2]
          : (cpwValues[cpwValues.length / 2 - 1] + cpwValues[cpwValues.length / 2]) / 2;

    if (inUse.length === 0 || median === null) {
      parts.push({ label: "预估 CPW", weight: 8, score: null, note: "同类在用单品不足，推算不出年均穿着次数" });
    } else {
      const yearly = inUse.reduce((sum, item) => sum + annualWears(item), 0) / inUse.length;
      const estimate = candidate.price / Math.max(1, yearly);
      const ratio = estimate / median;
      parts.push({
        label: "预估 CPW",
        weight: 8,
        score: bucket(ratio, [0.7, 1.0, 1.5, 2.5], [8, 6, 4, 2, 0]),
        note: `按同类年均 ${round1(yearly)} 次推算，预估 ¥${estimate.toFixed(1)}/次，是衣橱 CPW 中位数 ¥${median.toFixed(1)} 的 ${round1(ratio)} 倍`,
      });
    }

    const counted = parts.filter((part) => part.score !== null);
    if (counted.length === 0) {
      dimensions.push({
        key: "price", index: "③", zh: "价格合理性", en: "Price", weight: 25, score: null,
        reason: "三个子项都缺输入，本维度不计分。",
      });
    } else {
      const gained = counted.reduce((sum, part) => sum + (part.score ?? 0), 0);
      const available = counted.reduce((sum, part) => sum + part.weight, 0);
      dimensions.push({
        key: "price",
        index: "③",
        zh: "价格合理性",
        en: "Price",
        weight: 25,
        // 不可算的子项按比例把权重摊给可算的
        score: round1((gained / available) * 25),
        reason: parts.map((part) => `${part.label}：${part.note}`).join("；") + "。",
      });
    }
  }

  // ── ④ 材质与养护（20 分）────────────────────────
  const covered = candidate.materials.filter((entry) => MATERIALS[entry.name]);
  const pctSum = covered.reduce((sum, entry) => sum + entry.pct, 0);
  const annualCareSpec = careFrequency(candidate.sub, candidate.materials);
  const annualCare = annualCareSpec.times * annualCareSpec.unit;

  if (covered.length === 0 || pctSum === 0) {
    dimensions.push({
      key: "material", index: "④", zh: "材质与养护", en: "Material", weight: 20, score: null,
      reason: "没有填写材质成分，本维度不计分，权重摊给其余维度。",
    });
  } else {
    // 材质从三条路径影响 CPW：舒适度低会被闲置、耐久度低会提前退休、养护成本高抬高分子
    const weighted = (pick: (spec: MaterialSpec) => number) =>
      covered.reduce((sum, entry) => sum + (entry.pct / pctSum) * pick(MATERIALS[entry.name]), 0);

    const raw =
      weighted((spec) => spec.comfort) * 0.4 +
      weighted((spec) => spec.durability) * 0.3 +
      weighted((spec) => spec.care) * 0.3;

    const main = [...covered].sort((a, b) => b.pct - a.pct)[0];
    const dry = DRY_CLEAN.has(main.name);
    dimensions.push({
      key: "material",
      index: "④",
      zh: "材质与养护",
      en: "Material",
      weight: 20,
      score: Math.max(0, round1(raw * 2 - (dry ? 4 : 0))),
      reason: `${covered.map((entry) => `${entry.name} ${entry.pct}%`).join(" / ")}，加权材质分 ${round1(raw)}/10${
        dry ? `；主成分${main.name}需干洗，再扣 4 分` : ""
      }。`,
    });
  }

  // ── ⑤ 身材与肤色适配度（20 分 = 5a 围度 14 + 5b 肤色 6）──
  dimensions.push(fitDimension(candidate, body, skinTone));

  // ── 归一化 ────────────────────────────────────
  const counted = dimensions.filter((dim) => dim.score !== null);
  const countedWeight = counted.reduce((sum, dim) => sum + dim.weight, 0);
  const gained = counted.reduce((sum, dim) => sum + (dim.score ?? 0), 0);
  const total = countedWeight === 0 ? 0 : Math.round((gained / countedWeight) * 100);

  return {
    total,
    dimensions,
    countedWeight,
    countedCount: counted.length,
    annualCare,
    coldStart,
    snapshotAt,
  };
}

/** 年均穿着次数。购入不足一年的按已过天数折年，否则新买的衣服会被低估。 */
function annualWears(item: Item) {
  const bought = new Date(item.boughtAt).getTime();
  if (Number.isNaN(bought)) return item.wears;
  const days = Math.max(30, (Date.now() - bought) / 86_400_000);
  return (item.wears / days) * 365;
}

/**
 * ⑤ 身材与肤色适配度（20 分）= **5a 围度贴合 14 + 5b 肤色适配 6**（PRD 附录 D-⑤）。
 *
 * 两个子项各自可算可不算，**谁不可算谁的权重就摊给另一个** —— 都不可算时整个维度不计分，
 * 由 `scoreCandidate` 按可算权重归一。
 *
 * 合成一个维度而不是新开第⑥个：5a 对鞋 / 包 / 帽子 / 首饰 / 配饰完全不适用
 * （它们没有可比的围度），这五类原先在⑤上一分都算不了；而颜色与肤色的关系对它们反而更直接。
 */
function fitDimension(
  candidate: Candidate,
  body: { bust?: number; shoulder?: number; waist?: number; hip?: number },
  skinTone: string | undefined,
): Dimension {
  const base = { key: "fit", index: "⑤", zh: "身材与肤色适配度", en: "Fit", weight: 20 } as const;

  const size = sizeFit(candidate, body); // 5a，满分 14
  const skin = skinFit(candidate, skinTone); // 5b，满分 6

  if (size === null && skin === null) {
    return { ...base, score: null, reason: `缺少尺码表与肤色数据，本维度不计分。` };
  }
  if (size === null) {
    // 5a 不可算：14 分摊给 5b，即 5b 独占这一维度的 20 分。
    return { ...base, score: round1((skin!.score / 6) * 20), reason: `${skin!.reason}（本次无围度可比，仅按肤色计分）` };
  }
  if (skin === null) {
    return { ...base, score: round1((size.score / 14) * 20), reason: `${size.reason}（未设肤色，本次仅按围度计分）` };
  }
  return { ...base, score: round1(size.score + skin.score), reason: `${size.reason} ${skin.reason}` };
}

/** 5a 围度贴合，满分 14。不可算返回 null。 */
function sizeFit(
  candidate: Candidate,
  body: { bust?: number; shoulder?: number; waist?: number; hip?: number },
): { score: number; reason: string } | null {
  const keys = FIT_MEASURES[candidate.category];
  if (!keys) return null;

  const LABEL = MEASURE_LABEL;
  const gaps: { label: string; gap: number }[] = [];
  for (const key of keys) {
    const chart = candidate.sizeChart[key];
    const mine = body[key];
    if (chart === undefined || mine === undefined) return null;
    gaps.push({ label: LABEL[key], gap: chart - mine });
  }

  // 合理松量 +2~+8cm
  const outside = gaps.filter((entry) => entry.gap < 2 || entry.gap > 8);
  const extreme = gaps.filter((entry) => entry.gap < 0 || entry.gap > 15);
  const detail = gaps.map((entry) => `${entry.label} ${entry.gap >= 0 ? "+" : ""}${round1(entry.gap)}cm`).join(" / ");

  if (outside.length === 0) return { score: 14, reason: `${detail}，全部落在 +2~+8cm 的合理松量区间。` };
  if (outside.length >= 2) return { score: 2, reason: `${detail}，有 ${outside.length} 项超出合理松量区间。` };
  if (extreme.length >= 1) {
    return { score: 6, reason: `${detail}，有 1 项${extreme[0].gap < 0 ? "偏紧" : "过松"}。` };
  }
  const off = outside[0];
  const deviation = off.gap < 2 ? 2 - off.gap : off.gap - 8;
  return deviation <= 3
    ? { score: 10, reason: `${detail}，${off.label}超出区间 ${round1(deviation)}cm，仍在可接受范围。` }
    : { score: 6, reason: `${detail}，${off.label}超出区间 ${round1(deviation)}cm。` };
}

/**
 * 5b 肤色适配，满分 6。未设肤色返回 null。
 *
 * **冷暖相反只扣到 3 分，不归零。** 这是全套规则里最软的一条判断 —— 肤色配色没有公认口径，
 * 结果还随光线与妆容变。它的位置是「提醒你注意一下」，不是「你不适合穿这个颜色」；
 * 重罚等于产品替用户否掉一整个色系，与「不替用户做决定」的立场冲突。
 * 同理，**理由文本写成参考语气，不写成结论**。
 */
function skinFit(candidate: Candidate, skinTone: string | undefined): { score: number; reason: string } | null {
  if (!skinTone) return null;
  const skin = warmthOfSkin(skinTone);
  if (skin === null) return null;

  const family = colorFamilyD4(candidate.color);
  const colour = FAMILY_WARMTH[family];

  if (family === "中性色") return { score: 6, reason: `${family}属通用色，不挑肤色。` };
  if (skin === colour) return { score: 6, reason: `${family}与你的${skin}调肤色同属一个方向。` };
  if (skin === "中" || colour === "中") {
    return { score: 5, reason: `${family}与你的${skin}调肤色其中一方偏中性，搭配空间较大。` };
  }
  return { score: 3, reason: `${family}偏${colour}，与你的${skin}调肤色对比较强，可留意上身效果。` };
}

/** 二级品类的可选值，决策页的下拉直接用它。 */
export const ALL_SUBS = Object.values(SUBCATEGORIES).flat();
