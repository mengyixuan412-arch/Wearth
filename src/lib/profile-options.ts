/** Option tables for 认识自己. Kept apart from the page so 录入 and 评分 can reuse them. */

export type Option = { value: string; zh: string; en: string };

/** 常居城市 —— 决定当地气候与季节窗口（PRD 附录 C）。 */
export const CITIES: string[] = [
  "北京", "上海", "广州", "深圳",
  "杭州", "南京", "苏州", "成都", "重庆", "武汉",
  "西安", "天津", "长沙", "郑州", "青岛", "济南",
  "合肥", "福州", "厦门", "宁波", "无锡", "东莞",
  "佛山", "沈阳", "大连", "哈尔滨", "长春", "石家庄",
  "太原", "南昌", "昆明", "贵阳", "南宁", "海口",
  "兰州", "乌鲁木齐", "呼和浩特", "银川", "西宁", "拉萨",
  "香港", "澳门", "台北", "海外",
];

/** 风格偏好 —— 多选。附录 D 注明风格标签只作展示，不参与相似度判定。 */
export const STYLE_TAGS: Option[] = [
  { value: "workwear", zh: "通勤", en: "Workwear" },
  { value: "minimalist", zh: "简约", en: "Minimalist" },
  { value: "vintage", zh: "复古", en: "Vintage" },
  { value: "sporty", zh: "运动", en: "Sporty" },
  { value: "sweet", zh: "甜美", en: "Sweet" },
  { value: "androgynous", zh: "中性", en: "Androgynous" },
  { value: "french", zh: "法式", en: "French Chic" },
  { value: "preppy", zh: "学院", en: "Preppy" },
];

export type SkinTone = { value: string; zh: string; en: string };

export const SKIN_TONES: SkinTone[] = [
  { value: "#D9AC8D", zh: "中性偏暖 · 自然肤色", en: "Neutral Warm" },
  { value: "#E5C0B0", zh: "偏冷 · 白皙肤色", en: "Cool Fair" },
  { value: "#BA8062", zh: "中性 · 小麦肤色", en: "Neutral Tan" },
  { value: "#855743", zh: "偏暖 · 深肤色", en: "Warm Deep" },
];

export type BodyField = {
  key: "height" | "weight" | "shoulder" | "bust" | "waist" | "hip" | "thigh" | "calf" | "shoe";
  zh: string;
  en: string;
  unit: string;
  /** 参与附录 D ⑤ 身材适配度的围度。 */
  scored?: boolean;
};

export const BODY_FIELDS: BodyField[] = [
  { key: "height", zh: "身高", en: "Height", unit: "cm" },
  { key: "weight", zh: "体重", en: "Weight", unit: "kg" },
  { key: "shoulder", zh: "肩宽", en: "Shoulder", unit: "cm", scored: true },
  { key: "bust", zh: "胸围", en: "Bust", unit: "cm", scored: true },
  { key: "waist", zh: "腰围", en: "Waist", unit: "cm", scored: true },
  { key: "hip", zh: "臀围", en: "Hip", unit: "cm", scored: true },
  { key: "thigh", zh: "大腿围", en: "Thigh", unit: "cm" },
  { key: "calf", zh: "小腿围", en: "Calf", unit: "cm" },
  { key: "shoe", zh: "鞋码", en: "Shoe", unit: "" },
];

/** 「如何正确测量身体数据」展开后的内容，避免挂一个死链接。 */
export const MEASURE_TIPS: { zh: string; en: string; tip: string }[] = [
  { zh: "肩宽", en: "Shoulder", tip: "从左肩骨最外侧量到右肩骨最外侧，沿背部走，手臂自然下垂。" },
  { zh: "胸围", en: "Bust", tip: "软尺水平绕过胸部最丰满处一周，穿无衬垫内衣，正常呼吸不收胸。" },
  { zh: "腰围", en: "Waist", tip: "绕腰部最细处一周，通常在肚脐上方两指，量时不要收腹。" },
  { zh: "臀围", en: "Hip", tip: "双脚并拢站直，软尺水平绕过臀部最丰满处一周。" },
];
