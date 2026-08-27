import "server-only";

import { askVision } from "@/lib/ai/client";
import type { AiResult, LabelRead, ListingRead } from "@/lib/ai/types";
import { normaliseMaterial, type SizeChart } from "@/lib/scoring";
import type { Material } from "@/lib/wardrobe-data";

/**
 * ②③ 截图提取。两支共用一套校验，但**提示词和难度完全不同**：
 *
 * - **水洗标**是布面上的印刷小字：字小、有褶皱、灰字白底、中英混排。
 *   通用视觉模型在这种场景上是硬考题，读不准就退回手填。
 * - **详情页截图**是屏幕渲染的文字：高对比、笔画笔直，好读得多。
 *
 * 两支都只读**文字**。**绝不从面料照片猜成分**（§5 ⑤，PRD §8）——
 * 从照片判断成分不可靠，会给出错误的养护建议，反而害了用户的衣服。
 */

/**
 * 成分表的公共校验。
 *
 * 三条规则：名字必须在闭集内、占比取 0–100 的整数、同名合并。
 * **不强制加起来等于 100** —— 水洗标上本来就有加不满的（PRD 6.2 那条
 * 「只报事实、不拦保存」是同一个判断），凑整会篡改用户衣服的真实成分。
 */
function coerceMaterials(raw: unknown): Material[] {
  if (!Array.isArray(raw)) return [];

  // 归并后的档 → { 占比合计, 第一次见到的原文 }
  const merged = new Map<string, { pct: number; raw: string }>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { name, pct } = entry as { name?: unknown; pct?: unknown };
    if (typeof name !== "string") continue;

    // 归并交给 `normaliseMaterial()`，不让模型自己映射 —— 它会把「莱赛尔」
    // 硬套成相近的档，而错的成分会算出错的养护建议。认不得就丢。
    const hit = normaliseMaterial(name);
    if (!hit) continue;

    const value = Math.round(Number(pct));
    if (!Number.isFinite(value) || value <= 0 || value > 100) continue;

    const seen = merged.get(hit);
    merged.set(hit, {
      pct: Math.min(100, (seen?.pct ?? 0) + value),
      // 原文只记第一次见到的：「苎麻 80 / 麻 5」合并后记「苎麻」，那是主要成分
      raw: seen?.raw ?? name.trim(),
    });
  }

  return [...merged]
    .map(([name, { pct, raw: original }]) => ({
      name,
      pct,
      // 原文和归并档一样时不重复存 —— 存量数据里绝大多数是这种
      ...(original === name ? {} : { raw: original }),
    }))
    // 按占比从多到少排 —— 水洗标上就是这么印的，也是用户预期的读法
    .sort((a, b) => b.pct - a.pct);
}

/** 取一个正数，读不出来就当没有。围度和价格都不接受 0 和负数。 */
function positive(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 10) / 10 : null;
}

// ── ② 水洗标 ────────────────────────────────────────────────

const LABEL_PROMPT = `这是一张衣服水洗标的照片。用 json 读出上面印的**材质成分**。

只读标签上**印着的文字**，认不清就跳过那一行，**不要根据布料外观猜**。

**成分名照抄标签上印的原文**，比如标签写「苎麻」就填「苎麻」，写「桑蚕丝」就填「桑蚕丝」。
不要自己换成同义词，也不要翻译 —— 归并由我们来做。

pct 填数字，不带百分号。加起来不到 100 也照实填，不要凑整。
一个成分都读不出来就返回空数组。

返回：{"materials":[{"name":"","pct":0}]}`;

export async function readCareLabel(image: string): Promise<AiResult<LabelRead>> {
  const result = await askVision([image], LABEL_PROMPT);
  if (!result.ok) return result;
  return { ok: true, value: { materials: coerceMaterials(result.value.materials) } };
}

// ── ③ 详情页截图 ────────────────────────────────────────────

const LISTING_PROMPT = `这是商品详情页的截图，可能有一张也可能有几张。用 json 读出三样东西。

**只读截图上写着的，读不到的填 null 或空数组，不要推测。**

1. price —— 商品**现价**，只要数字不要货币符号。有划线原价和现价时取现价。
2. materials —— 材质成分。**成分名照抄页面上写的原文**，不要换同义词、不要翻译。
   pct 填数字，加起来不到 100 也照实填。
3. sizeChart —— 尺码表里的**围度，单位厘米**。只取这四项，缺的填 null：
   bust（胸围）、shoulder（肩宽）、waist（腰围）、hip（臀围）
   尺码表有多个码时，取截图里**高亮或默认选中**的那一码；没有高亮就取中间那一码。

返回：{"price":null,"materials":[],"sizeChart":{"bust":null,"shoulder":null,"waist":null,"hip":null}}`;

export async function readListing(images: string[]): Promise<AiResult<ListingRead>> {
  const result = await askVision(images, LISTING_PROMPT);
  if (!result.ok) return result;

  const chartRaw = (result.value.sizeChart ?? {}) as Record<string, unknown>;
  const sizeChart: SizeChart = {};
  // 缺的字段就不出现在对象里 —— 评分⑤按「有没有这一项」决定计不计分，
  // 塞一个 null 进去和真的量过是两回事。
  for (const key of ["bust", "shoulder", "waist", "hip"] as const) {
    const value = positive(chartRaw[key]);
    if (value !== null) sizeChart[key] = value;
  }

  return {
    ok: true,
    value: {
      price: positive(result.value.price),
      materials: coerceMaterials(result.value.materials),
      sizeChart,
    },
  };
}
