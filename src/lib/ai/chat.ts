import "server-only";

import { askText } from "@/lib/ai/client";
import type { AiResult } from "@/lib/ai/types";
import type { ChatContext, ChatTurn } from "@/lib/chat";

/**
 * ④ 报告追问（PRD 6.6）。
 *
 * **模型在这里只负责读懂问题和组织语言，不负责下判断。**
 * 三条硬边界（不给购买结论、不改分、假设重算回规则引擎）都在 `lib/chat.ts`
 * 里用代码挡着 —— 提示词是软约束，模型偶尔会绕过去，而这三条绕过去一次就废了。
 * 这里的提示词是第二道，不是唯一一道。
 */

const yuan = (value: number) => `¥${Math.round(value).toLocaleString("zh-CN")}`;

/**
 * 把报告压成模型能读的一段。
 *
 * **整柜衣服不进上下文。** `result` 里每个维度的理由和佐证单品已经把相关的
 * 那几件带出来了；把一百件衣服塞进去既贵又会让模型开始编搭配建议。
 */
function brief(context: ChatContext): string {
  const { candidate, result, wardrobeSize, budgetLeft } = context;

  const lines = [
    `【这件商品】`,
    `品类：${candidate.category} / ${candidate.sub}`,
    `价格：${yuan(candidate.price)}`,
    candidate.brand ? `品牌：${candidate.brand}` : null,
    candidate.materials.length > 0
      ? `材质：${candidate.materials.map((m) => `${m.name} ${m.pct}%`).join("、")}`
      : null,
    candidate.seasons.length > 0 ? `季节：${candidate.seasons.join("、")}` : null,
    ``,
    `【评分报告】总分 ${result.total}/100（基于 ${result.countedCount} 个可算维度）`,
    ...result.dimensions.map((d) =>
      d.score === null
        ? `${d.index}${d.zh}：本次不可算。${d.reason}`
        : `${d.index}${d.zh}：${d.score}/${d.weight}。${d.reason}${
            d.evidence?.length
              ? ` 佐证：${d.evidence.map((e) => `${e.name}（${e.detail}）`).join("、")}`
              : ""
          }`,
    ),
    ``,
    `【其他】衣橱在橱 ${wardrobeSize} 件；本月剩余预算${
      budgetLeft === null ? "用户没设" : yuan(budgetLeft)
    }`,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

const SYSTEM = (context: ChatContext) => `你是一个衣橱决策工具里的答疑助手。用户刚看完一份对某件待购商品的评分报告，现在就报告内容提问。

${brief(context)}

回答规则：

1. **只依据上面这份报告作答。** 报告里没有的信息就说没有，不要推测、不要编造用户衣橱里的具体单品。
2. **不要给出「买」或「不买」的结论**，也不要用「建议入手」「可以拿下」「不值得」这类倾向性说法。用户自己做决定，你的作用是把权衡摆清楚。
3. **不要自己算分或改分。** 分数由规则引擎出，你重算一个数会和报告对不上。用户问「如果便宜点会怎样」时，如实说这需要重跑一次，不要口头估一个分。
4. 用中文，口语一点，**两到四句话**，不要用 markdown 标题、列表符号或加粗。
5. 用户问的是穿衣和消费，别扯到别处去。`;

export async function askAboutReport(
  question: string,
  context: ChatContext,
  history: ChatTurn[],
): Promise<AiResult<string>> {
  // 只带最近几轮。「那如果再便宜点呢」只需要连着上一轮就读得懂，
  // 全量历史会把上下文顶到很贵，而更早的轮次对当前这句几乎没有信息量。
  const recent = history.slice(-6);
  return askText(SYSTEM(context), [...recent, { role: "user", text: question }]);
}
