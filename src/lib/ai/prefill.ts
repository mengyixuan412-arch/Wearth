import "server-only";

import { askVision } from "@/lib/ai/client";
import type { AiResult, Prefill } from "@/lib/ai/types";
import {
  CATEGORIES,
  COLOR_FAMILIES,
  SEASONS,
  SUBCATEGORIES,
  type Category,
  type ColorFamily,
  type Season,
} from "@/lib/wardrobe-data";

/**
 * ① 单品照片 → 录入表单的预填值。
 *
 * **枚举约束靠两层，缺一不可**（DeepSeek 没有 JSON Schema，只有 JSON mode，
 * 保证是合法 JSON 但不保证结构与取值）：
 *
 * 1. 提示词里给闭集 —— 实测有效：不给闭集时模型会自创「上衣」「长袖吊带衫」
 *    「粉色」「春季」，四个字段全部落在表外
 * 2. 拿到结果逐字段校验 —— 提示词的遵守不是保证，表外的值一律丢弃
 *
 * 只做第 1 层等于没做。
 */

/**
 * 闭集从 `lib/wardrobe.ts` 现读现拼，**不手抄一份到提示词里**。
 * 抄一份的话，品类表改了这里不会跟着改，模型就会照着过期的表选。
 */
function buildPrompt(): string {
  const table = CATEGORIES.map((category) => `${category}：${SUBCATEGORIES[category].join("、")}`).join(
    "\n",
  );

  // 提示词里必须出现「json」这个词，否则 DeepSeek 的 JSON mode 不生效（官方文档要求）。
  return `看这张衣服照片，用 json 回答它是什么。

**每个字段只能从下面给的选项里原样挑一个，不许改写、不许自创。**
看不出来的字段填 null（seasons 填空数组），不要猜。

category 与 sub 从这张表里选，sub 必须属于你选的 category：
${table}

color 只能是：${COLOR_FAMILIES.join("、")}
seasons 从 ${SEASONS.join("、")} 里选，可多选；四季都适合就四个都填

返回这个格式：{"category":"","sub":"","color":"","seasons":[]}`;
}

/** 取一个字符串字段，非字符串一律当没有。 */
const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * 逐字段校验并归并。**表外的值丢弃，不往上传** ——
 * 错的默认值比空的更糟：用户会以为那是识别出来的，直接存进衣橱就是脏数据，
 * 而品类和色系是决策①的相似判定输入，脏了会连带算错评分。
 */
function coerce(raw: Record<string, unknown>): Prefill {
  const rawCategory = str(raw.category);
  const category = CATEGORIES.find((entry) => entry === rawCategory) ?? null;

  // sub 必须属于命中的那个 category —— 一级没命中时二级一并作废，
  // 「开衫」同时挂在内搭与外套下，脱离一级的二级是没有意义的（附录 A）。
  const rawSub = str(raw.sub);
  const sub = category && SUBCATEGORIES[category].find((entry) => entry === rawSub) ? rawSub : null;

  const rawColor = str(raw.color);
  const colorFamily = COLOR_FAMILIES.find((entry) => entry === rawColor) ?? null;

  const rawSeasons = Array.isArray(raw.seasons) ? raw.seasons : [];
  // 按春夏秋冬排序，不按模型返回的顺序 —— 详情页要把它 join 成一行显示。
  const seasons = SEASONS.filter((season) => rawSeasons.includes(season));

  return {
    category: category as Category | null,
    sub,
    colorFamily: colorFamily as ColorFamily | null,
    seasons: seasons as Season[],
  };
}

export async function prefillFromPhoto(image: string): Promise<AiResult<Prefill>> {
  const result = await askVision([image], buildPrompt());
  if (!result.ok) return result;
  return { ok: true, value: coerce(result.value) };
}
