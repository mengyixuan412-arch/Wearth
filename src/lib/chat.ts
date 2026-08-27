import type { Candidate, ScoreResult } from "@/lib/scoring";

/**
 * 购买评分的「报告追问」（PRD 6.6）。
 *
 * **这个文件定的是出入参，不是模型。** 页面只认 `askReport()` 这一个签名；
 * 接 DeepSeek 时只改本文件下半段的实现，`report-chat.tsx` 一行都不用动
 * （ARCHITECTURE §5 ④）。
 *
 * 三条边界写在这里，因为它们是这个能力的定义，不是某一版实现的选择：
 *
 * 1. **不给购买结论**（PRD §8）。被直接问到时把决定权还回去、摆出权衡。
 * 2. **不改分数**。追问与假设重算都不写回 `Decision.result`。
 * 3. **假设重算回规则引擎**（ARCHITECTURE §5 ⑥）。模型只把话解析成
 *    `Partial<Candidate>`，分仍旧由 `lib/scoring.ts` 的 `scoreCandidate()` 出 ——
 *    让模型自己算会得到一个和报告对不上的数，同一件商品报告里 78 分、
 *    对话里 82 分，这个功能就废了。
 */

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** 喂给模型的上下文。**只有这些** —— 整柜衣服不进上下文，`result` 里的
 *  分维度理由与佐证单品已经把相关的那几件带出来了。 */
export type ChatContext = {
  candidate: Candidate;
  result: ScoreResult;
  /** 在橱件数（已处置不计）。冷启动提示与「衣橱里那几件」都要它。 */
  wardrobeSize: number;
  /** 本月剩余预算；`null` = 用户没设。 */
  budgetLeft: number | null;
};

/**
 * 一次回答。`rescore` 分支带回一组参数改动，**由调用方去重跑规则引擎** ——
 * 本模块拿不到衣橱与个人档案，也不该拿到。
 */
export type AskResult =
  | { kind: "text"; text: string }
  | { kind: "rescore"; text: string; patch: Partial<Candidate>; label: string };

/** 报告与假设重算之间的差异。只列变了的维度（DESIGN.md §5.18）。 */
export type ScoreDiff = {
  totalFrom: number;
  totalTo: number;
  changed: { index: string; zh: string; from: number | null; to: number | null }[];
  /** 没变的维度个数，界面写成「其余 N 项不变」。 */
  unchanged: number;
};

const yuan = (value: number) => `¥${Math.round(value).toLocaleString("zh-CN")}`;

/**
 * 比对两份评分。**按 `key` 对位，不按下标** —— 维度不可算时不入列，
 * 两次评分的数组长度可以不一样（附录 D 的归一化）。
 */
export function diffResults(before: ScoreResult, after: ScoreResult): ScoreDiff {
  const map = new Map(before.dimensions.map((dimension) => [dimension.key, dimension]));
  const changed: ScoreDiff["changed"] = [];
  let unchanged = 0;

  for (const dimension of after.dimensions) {
    const was = map.get(dimension.key);
    if (was && was.score === dimension.score) {
      unchanged += 1;
      continue;
    }
    changed.push({
      index: dimension.index,
      zh: dimension.zh,
      from: was ? was.score : null,
      to: dimension.score,
    });
  }

  return { totalFrom: before.total, totalTo: after.total, changed, unchanged };
}

// ─────────────────────────────────────────────────────────────
// 以下是**接 DeepSeek 之前的临时实现**。
//
// 它不调任何模型，只做两件真事：把问题对到报告里已有的那一行理由上，
// 以及从话里认出一个价格改动交回规则引擎。意图识别很粗（正则），
// 但**重算那条路是真的** —— 换成 DeepSeek 时替换的是 `askReport` 的函数体，
// 返回类型与三条边界都不动。
// ─────────────────────────────────────────────────────────────

/** 直接问「该不该买」时的回法：不给结论，把权衡摆出来。 */
function weighIn(context: ChatContext): string {
  const counted = context.result.dimensions.filter((dimension) => dimension.score !== null);
  if (counted.length === 0) return "这次没有可算的维度，还不足以支撑判断。";

  const ranked = [...counted].sort(
    (a, b) => (a.score as number) / a.weight - (b.score as number) / b.weight,
  );
  const worst = ranked[0];
  const best = ranked[ranked.length - 1];

  return (
    `这个得你自己定 —— 我只摆数据。\n` +
    `最拖后腿的是${worst.index}${worst.zh}（${worst.score}/${worst.weight}）：${worst.reason}\n` +
    `最站得住的是${best.index}${best.zh}（${best.score}/${best.weight}）：${best.reason}\n` +
    `所以问题落在你更在意哪一头。`
  );
}

/** 把问题对到某一个维度上，答案就是报告里那一行的理由。 */
function matchDimension(question: string, result: ScoreResult) {
  const KEYS: [RegExp, string][] = [
    [/重复|撞衫|类似|同款/, "dup"],
    [/搭配|能搭|配得/, "match"],
    [/价格|贵|便宜|预算|值不值这个价/, "price"],
    [/材质|成分|养护|打理|干洗|起球/, "material"],
    [/身材|尺码|围度|合不合身|肤色|显白|冷暖/, "fit"],
  ];

  const numbered = question.match(/[①②③④⑤]/);
  if (numbered) {
    const found = result.dimensions.find((dimension) => dimension.index === numbered[0]);
    if (found) return found;
  }

  for (const [pattern, key] of KEYS) {
    if (!pattern.test(question)) continue;
    const found = result.dimensions.find((dimension) => dimension.key === key);
    if (found) return found;
  }
  return null;
}

/** 扣分最多的那一维（按得分率）。「为什么扣得最多」要它。 */
function weakest(result: ScoreResult) {
  const counted = result.dimensions.filter((dimension) => dimension.score !== null);
  if (counted.length === 0) return null;
  return counted.reduce((low, dimension) =>
    (dimension.score as number) / dimension.weight < (low.score as number) / low.weight ? dimension : low,
  );
}

/** 「八折」的八。用户说折扣多半用汉字，只认阿拉伯数字会整条落空。 */
const CN_DIGITS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 从话里认出一个新价格。认不出来返回 `null`，绝不猜。 */
function parsePrice(question: string, current: number): number | null {
  const num = (raw: string) => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const discount = question.match(/打\s*([\d.]+|[一二三四五六七八九])\s*折/);
  if (discount) {
    const rate = CN_DIGITS[discount[1]] ?? num(discount[1]);
    if (rate !== null && rate < 10) return Math.round((current * rate) / 10);
  }

  const cheaper = question.match(/(?:便宜|少|减|降)\s*(?:了)?\s*(\d+)\s*(?:块|元|块钱)?/);
  if (cheaper) {
    const delta = num(cheaper[1]);
    if (delta !== null && delta < current) return current - delta;
  }

  const target = question.match(/(?:降到|减到|变成|改成|如果|要是|卖)\s*(\d+)\s*(?:块|元|块钱)?/);
  if (target) return num(target[1]);

  const bare = question.match(/(\d+)\s*(?:块|元|块钱)/);
  if (bare) return num(bare[1]);

  return null;
}

/** 问模型。答不上来（没配 key、断网、被截断）返回 `null`，由调用方退回规则匹配。 */
async function askModel(
  question: string,
  context: ChatContext,
  history: ChatTurn[],
): Promise<string | null> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context, history }),
    });
    const result = (await response.json()) as { ok: boolean; value?: string };
    return result.ok && result.value ? result.value : null;
  } catch {
    return null;
  }
}

/**
 * 问一句，回一句。
 *
 * **顺序是有讲究的，不能重排：**
 *
 * 1. **结论性提问先挡住**（PRD §8）。这一条排在最前，模型根本没有机会看到它 ——
 *    提示词里也写了不给结论，但那是软约束，绕过去一次这个产品的立场就没了。
 * 2. **假设重算走规则引擎**（ARCHITECTURE §5 ⑥）。认出价格改动就交回
 *    `scoreCandidate()`，模型不参与算分 —— 让它算会得到一个和报告对不上的数，
 *    同一件商品报告里 78 分、对话里 82 分，这个功能就废了。
 * 3. **能对到某个维度的，直接用报告里那一行。** 精确、即时、免费，
 *    而且用词和报告完全一致 —— 让模型转述反而会出现两种说法。
 * 4. 剩下的才交给模型。这一层原来是一句「还答不了」。
 * 5. 模型也没答上来，如实说边界，不装作答过了。
 */
export async function askReport(
  question: string,
  context: ChatContext,
  history: ChatTurn[],
): Promise<AskResult> {
  const { candidate, result } = context;
  const text = question.trim();

  // ① 先挡结论。这一条排在最前，任何别的匹配都不能绕过它。
  if (/该不该买|要不要买|买不买|值不值得买|你觉得.*买|建议我买|能买吗|可以买吗/.test(text)) {
    return { kind: "text", text: weighIn(context) };
  }

  // ② 假设重算。认出价格改动就交回规则引擎。
  const nextPrice = parsePrice(text, candidate.price);
  if (nextPrice !== null && nextPrice !== candidate.price && /如果|要是|假如|万一|便宜|降|打折|减到|变成|改成/.test(text)) {
    return {
      kind: "rescore",
      text: "按这个价重跑了一遍规则引擎：",
      patch: { price: nextPrice },
      label: `价格 ${yuan(candidate.price)} → ${yuan(nextPrice)}`,
    };
  }

  // ③ 对到某一个维度，答案就是报告里那一行。
  const asked = /扣得最多|扣分最多|哪一项最差|最拖后腿/.test(text)
    ? weakest(result)
    : matchDimension(text, result);

  if (asked) {
    if (asked.score === null) {
      return {
        kind: "text",
        text: `${asked.index}${asked.zh}这次不可算，那份权重已经按比例摊给了其余维度 —— 所以总分是基于 ${result.countedCount} 个维度算的。${asked.reason}`,
      };
    }
    const evidence = asked.evidence?.length
      ? `\n具体是：${asked.evidence.map((entry) => `${entry.name}（${entry.detail}）`).join("、")}`
      : "";
    return {
      kind: "text",
      text: `${asked.index}${asked.zh}拿了 ${asked.score}/${asked.weight}。${asked.reason}${evidence}`,
    };
  }

  // ④ 交给模型。上面三条都没接住，说明这是一句开放性的问题。
  const answered = await askModel(question, context, history);
  if (answered) return { kind: "text", text: answered };

  // ⑤ 兜底。**说清楚是能力边界，不装作答过了。**
  return {
    kind: "text",
    text: "这一问暂时答不了 —— 可能是网络不通，或者模型没读懂。可以换个说法，或者问报告里已有的那几项：某个维度为什么是这个分，或者「如果便宜 100 呢」这类换个价再算一遍。",
  };
}

/**
 * 出分后摆在输入框上方的三条预设追问（DESIGN.md §5.18）。
 *
 * **空输入框是这个功能最高的门槛。** 用户看完报告的疑问是具体的，
 * 但把疑问组织成一句问话是另一回事 —— 给三条按得下去的，第一句就有了。
 * 三条按报告的实际情况生成：扣分最多的那一维、价格、有佐证单品的那一维。
 */
export function presetQuestions(context: ChatContext): string[] {
  const { result, candidate } = context;
  const out: string[] = [];

  const low = weakest(result);
  if (low) out.push(`为什么${low.index}${low.zh}扣得最多？`);

  // 便宜 100 对一件 120 块的衣服没有意义，低价单品换成打折问法。
  if (candidate.price > 300) out.push("如果便宜 100 呢？");
  else if (candidate.price > 0) out.push("如果打八折呢？");

  const withEvidence = result.dimensions.find((dimension) => dimension.evidence?.length);
  out.push(withEvidence ? "和我衣橱里那几件差在哪？" : "这个价在同类里算什么水平？");

  return out.slice(0, 3);
}
