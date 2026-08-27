/** Option tables for 个人档案. Kept apart from the page so 录入 and 评分 can reuse them. */

export type Option = { value: string; zh: string; en: string };

/** 常居城市，按省份分级。城市决定当地气候与季节窗口（PRD 附录 C）。 */
export type Region = { province: string; cities: string[] };

export const REGIONS: Region[] = [
  { province: "北京", cities: ["北京"] },
  { province: "上海", cities: ["上海"] },
  { province: "天津", cities: ["天津"] },
  { province: "重庆", cities: ["重庆"] },
  { province: "广东", cities: ["广州", "深圳", "东莞", "佛山", "珠海", "中山", "惠州", "汕头"] },
  { province: "浙江", cities: ["杭州", "宁波", "温州", "嘉兴", "绍兴", "金华", "台州"] },
  { province: "江苏", cities: ["南京", "苏州", "无锡", "常州", "南通", "徐州", "扬州"] },
  { province: "山东", cities: ["济南", "青岛", "烟台", "潍坊", "临沂", "淄博"] },
  { province: "四川", cities: ["成都", "绵阳", "德阳", "南充"] },
  { province: "湖北", cities: ["武汉", "宜昌", "襄阳"] },
  { province: "湖南", cities: ["长沙", "株洲", "衡阳", "岳阳"] },
  { province: "河南", cities: ["郑州", "洛阳", "南阳", "新乡"] },
  { province: "河北", cities: ["石家庄", "唐山", "保定", "廊坊"] },
  { province: "福建", cities: ["福州", "厦门", "泉州", "漳州"] },
  { province: "陕西", cities: ["西安", "咸阳", "宝鸡"] },
  { province: "安徽", cities: ["合肥", "芜湖", "蚌埠"] },
  { province: "辽宁", cities: ["沈阳", "大连", "鞍山"] },
  { province: "江西", cities: ["南昌", "赣州", "九江"] },
  { province: "山西", cities: ["太原", "大同", "临汾"] },
  { province: "黑龙江", cities: ["哈尔滨", "大庆", "齐齐哈尔"] },
  { province: "吉林", cities: ["长春", "吉林", "延边"] },
  { province: "云南", cities: ["昆明", "大理", "丽江"] },
  { province: "贵州", cities: ["贵阳", "遵义"] },
  { province: "广西", cities: ["南宁", "桂林", "柳州"] },
  { province: "甘肃", cities: ["兰州", "天水"] },
  { province: "海南", cities: ["海口", "三亚"] },
  { province: "内蒙古", cities: ["呼和浩特", "包头"] },
  { province: "新疆", cities: ["乌鲁木齐", "喀什"] },
  { province: "宁夏", cities: ["银川"] },
  { province: "青海", cities: ["西宁"] },
  { province: "西藏", cities: ["拉萨"] },
  { province: "香港", cities: ["香港"] },
  { province: "澳门", cities: ["澳门"] },
  { province: "台湾", cities: ["台北", "高雄", "台中"] },
  { province: "海外", cities: ["海外"] },
];

/** 反查城市所属省份，用于把已存的城市值定位回省份栏。 */
export function provinceOf(city: string) {
  return REGIONS.find((region) => region.cities.includes(city))?.province ?? "";
}

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

/**
 * 四档肤色，**从浅到深排**。摆在一起的色板要沿明度单调走，
 * 深浅跳着放的话，用户得逐个比对才能找到自己那一档。
 */
export const SKIN_TONES: SkinTone[] = [
  { value: "#E5C0B0", zh: "偏冷 · 白皙肤色", en: "Cool Fair" },
  { value: "#D9AC8D", zh: "中性偏暖 · 自然肤色", en: "Neutral Warm" },
  { value: "#BA8062", zh: "中性 · 小麦肤色", en: "Neutral Tan" },
  { value: "#855743", zh: "偏暖 · 深肤色", en: "Warm Deep" },
];

/**
 * 没选过时的落点：自然肤色。
 *
 * **写死色值而不是取 `SKIN_TONES[0]`** —— 上面那一排的顺序是给眼睛排的，
 * 哪天再调一次深浅次序，默认值不该跟着变成另一档。
 */
export const DEFAULT_SKIN_TONE = "#D9AC8D";

/** 肤色预设色板，喂给共用的颜色格（`components/color-field.tsx`）。 */
export const SKIN_PRESETS = SKIN_TONES.map((tone) => ({ value: tone.value, label: tone.zh }));

export type BodyField = {
  key: "height" | "weight" | "shoulder" | "bust" | "waist" | "hip" | "thigh" | "calf" | "shoe";
  zh: string;
  en: string;
  unit: string;
  /** 参与附录 D ⑤ 身材适配度的围度。 */
  scored?: boolean;
  /** 必填项只有身高体重 —— 没有这两个，虚拟模特的比例就无从校准。 */
  required?: boolean;
  /** 步进器每次加减的量。鞋码走 0.5 档，围度走 1cm。 */
  step?: number;
  /** 空值时显示的灰字示例，让空表也有可读的版面（参考图即如此）。 */
  placeholder: string;
};

export const BODY_FIELDS: BodyField[] = [
  { key: "height", zh: "身高", en: "Height", unit: "cm", required: true, placeholder: "170" },
  { key: "weight", zh: "体重", en: "Weight", unit: "kg", required: true, placeholder: "60" },
  { key: "shoulder", zh: "肩宽", en: "Shoulder", unit: "cm", scored: true, placeholder: "39" },
  { key: "bust", zh: "胸围", en: "Bust", unit: "cm", scored: true, placeholder: "88" },
  { key: "waist", zh: "腰围", en: "Waist", unit: "cm", scored: true, placeholder: "68" },
  { key: "hip", zh: "臀围", en: "Hip", unit: "cm", scored: true, placeholder: "92" },
  { key: "thigh", zh: "大腿", en: "Thigh", unit: "cm", placeholder: "52" },
  { key: "calf", zh: "小腿", en: "Calf", unit: "cm", placeholder: "34" },
  { key: "shoe", zh: "鞋码", en: "Shoe", unit: "", step: 0.5, placeholder: "37" },
];

/** 「如何正确测量身体数据」展开后的内容，避免挂一个死链接。 */
export const MEASURE_TIPS: { zh: string; en: string; tip: string }[] = [
  { zh: "肩宽", en: "Shoulder", tip: "从左肩骨最外侧量到右肩骨最外侧，沿背部走，手臂自然下垂。" },
  { zh: "胸围", en: "Bust", tip: "软尺水平绕过胸部最丰满处一周，穿无衬垫内衣，正常呼吸不收胸。" },
  { zh: "腰围", en: "Waist", tip: "绕腰部最细处一周，通常在肚脐上方两指，量时不要收腹。" },
  { zh: "臀围", en: "Hip", tip: "双脚并拢站直，软尺水平绕过臀部最丰满处一周。" },
];
