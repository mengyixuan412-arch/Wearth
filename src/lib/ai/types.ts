/**
 * 视觉能力与页面之间的合同。
 *
 * **页面只认这里的签名**（ARCHITECTURE.md §5 ④）—— 换模型供应商时只改
 * `client.ts` 的实现，调用方一行不动。当前实现是 DeepSeek，见 `client.ts`。
 *
 * 三个能力做的是同一类事：**看图、读出字段**。它们不判断、不打分、不给建议 ——
 * 那是规则引擎的活（§5 ①）。
 */

import type { Category, ColorFamily, Material, Season } from "@/lib/wardrobe-data";
import type { SizeChart } from "@/lib/scoring";

/**
 * 失败原因。**调用方一律降级为手填，不能卡住流程**（§5 ②），
 * 但要能说清是哪一种 —— 「没配 key」和「这张图读不出来」对用户是两句话。
 */
export type AiFailReason =
  /** 没配 `DEEPSEEK_API_KEY`。部署环境的问题，不是用户的问题。 */
  | "unconfigured"
  /** 调不通：超时、断网、供应商挂了。 */
  | "network"
  /** 调通了但读不出内容：模型返回空、或者吐的不是合法 JSON。 */
  | "unreadable";

export type AiResult<T> = { ok: true; value: T } | { ok: false; reason: AiFailReason };

/**
 * ① 单品照片 → 录入表单的预填值。
 *
 * **每一项都可空**：认不出来就留空让用户自己填，不要瞎猜一个填进去 ——
 * 错的默认值比空的更糟，用户会以为那是识别出来的。
 *
 * 取值一律是既有枚举里的成员。模型吐出表外的值由 `client.ts` 丢弃，
 * 不往上传（实测模型确实会自创「上衣」「长袖吊带衫」这类表外值）。
 */
export type Prefill = {
  category: Category | null;
  /** 二级品类，保证属于上面那个 `category`。 */
  sub: string | null;
  colorFamily: ColorFamily | null;
  /** 空数组表示没认出来，不表示「四季」。 */
  seasons: Season[];
};

/**
 * ② 水洗标照片 → 材质成分。
 *
 * **只从水洗标的文字读，绝不从面料照片猜**（§5 ⑤，PRD §8）——
 * 从照片判断成分不可靠，会给出错误的养护建议，反而害了用户的衣服。
 */
export type LabelRead = {
  /** 成分名保证在 `MATERIAL_NAMES` 内，百分比是 0–100 的整数。 */
  materials: Material[];
};

/**
 * ③ 商品详情页截图 → 评分要的三样输入。
 * 每一项都可缺 —— 一张截图未必三样都有。
 */
export type ListingRead = {
  price: number | null;
  materials: Material[];
  /** 围度单位 cm，缺的字段就不出现。 */
  sizeChart: SizeChart;
};
