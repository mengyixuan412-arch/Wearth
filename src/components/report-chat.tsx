"use client";

import { useMemo, useRef, useState } from "react";

import { META } from "@/components/panel";
import { ScrambleLoop } from "@/components/scramble-text";
import {
  askReport,
  diffResults,
  presetQuestions,
  type ChatContext,
  type ChatTurn,
  type ScoreDiff,
} from "@/lib/chat";
import type { Candidate, ScoreResult } from "@/lib/scoring";

/** 药丸与问句的宽度轴（DESIGN.md §3）。标题那一档是 120，这里是 110。 */
const NARROW = { fontVariationSettings: '"wdth" 110' } as const;

type Entry = {
  id: number;
  q: string;
  /** `null` = 还在等回答。 */
  answer: { text: string; label?: string; diff?: ScoreDiff } | null;
  error?: string;
};

const fmtScore = (value: number | null) => (value === null ? "不计分" : String(value));

/**
 * 假设重算的差异条。
 *
 * **只列变了的维度**（DESIGN.md §5.18）—— 五项全铺出来，读者得自己找哪一行动了。
 * 新值 `text-accent`、旧值压到 `l3`：旧值是背景，新值才是答案。
 *
 * 不复用 `ScoreReport` 的进度条：那几根条说的是「这一项拿了多少分」，
 * 这里说的是「变了多少」，同一种画法会让人以为上面那份报告被改写了。
 */
function DiffBar({ label, diff }: { label: string; diff: ScoreDiff }) {
  return (
    <div className="bg-accent-wash mt-1 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <span className={`${META} text-accent shrink-0`}>假设</span>
        <span className="text-l2 text-xs lg:text-sm">{label}</span>
        <span aria-hidden="true" className="flex-1 min-w-2" />
        <span className="shrink-0 font-sans font-bold text-sm lg:text-base tabular-nums">
          <span className={`${META} mr-1.5 text-l3 normal-case`}>综合</span>
          <span className="text-l3">{diff.totalFrom}</span>
          <span className="text-l3"> → </span>
          <span className="text-accent">{diff.totalTo}</span>
        </span>
      </div>

      {/* 一项都没变时不留一张空列表 —— 空着读起来像算挂了，
          而「没变」本身就是这次假设的答案。 */}
      {diff.changed.length === 0 ? (
        <p className={`${META} mt-2 text-l3`}>各维度得分都没有变化</p>
      ) : (
      <ul className="flex flex-col gap-1 mt-2">
        {diff.changed.map((dimension) => (
          <li key={dimension.index} className="flex items-baseline gap-2 text-xs lg:text-sm">
            <span className={`${META} text-l3 shrink-0`}>{dimension.index}</span>
            <span className="text-l2">{dimension.zh}</span>
            <span aria-hidden="true" className="flex-1 min-w-2" />
            <span className="shrink-0 font-sans font-bold tabular-nums">
              <span className="text-l3">{fmtScore(dimension.from)}</span>
              <span className="text-l3"> → </span>
              <span className="text-accent">{fmtScore(dimension.to)}</span>
            </span>
          </li>
        ))}
      </ul>
      )}

      {diff.changed.length > 0 && diff.unchanged > 0 ? (
        <p className={`${META} mt-2 text-l3`}>其余 {diff.unchanged} 项不变</p>
      ) : null}
    </div>
  );
}

/**
 * 报告追问（PRD 6.6 · DESIGN.md §5.18）。
 *
 * **不是一个聊天窗口，是报告的延长线** —— 接在报告正文下方、同一张面板里往下走。
 * 用户问的每一句都指着上面那几行分维度得分，隔到另一个容器里就得来回对照。
 *
 * 三条边界不在这里实现，在 `lib/chat.ts` —— 它们是这个能力的定义，
 * 不是某一版界面的选择。这里只负责画。
 *
 * @param rescore 由页面提供：把参数改动套到 candidate 上重跑 `scoreCandidate()`。
 *                本组件拿不到衣橱与个人档案，**也不该拿到**（ARCHITECTURE §2）。
 */
export default function ReportChat({
  candidate,
  result,
  wardrobeSize,
  budgetLeft,
  rescore,
}: {
  candidate: Candidate;
  result: ScoreResult;
  wardrobeSize: number;
  budgetLeft: number | null;
  rescore: (patch: Partial<Candidate>) => ScoreResult;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(0);

  const context = useMemo<ChatContext>(
    () => ({ candidate, result, wardrobeSize, budgetLeft }),
    [candidate, result, wardrobeSize, budgetLeft],
  );

  const presets = useMemo(() => presetQuestions(context), [context]);
  const busy = entries.some((entry) => entry.answer === null && !entry.error);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;

    const id = nextId.current++;
    setEntries((current) => [...current, { id, q: text, answer: null }]);
    setDraft("");

    // 历史按提问顺序带上。当前实现用不到，接 DeepSeek 后「那再便宜点呢」
    // 这种话只有连着上一轮才读得懂。
    const history: ChatTurn[] = entries.flatMap((entry) =>
      entry.answer
        ? [
            { role: "user" as const, text: entry.q },
            { role: "assistant" as const, text: entry.answer.text },
          ]
        : [],
    );

    const settle = (patch: Partial<Entry>) =>
      setEntries((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      );

    try {
      const reply = await askReport(text, context, history);

      if (reply.kind === "rescore") {
        // **分由规则引擎出，不由模型出**（ARCHITECTURE §5 ⑥）。
        // 模型只把话解析成 patch，这一行才是真正算分的地方。
        const after = rescore(reply.patch);
        settle({
          answer: { text: reply.text, label: reply.label, diff: diffResults(result, after) },
        });
        return;
      }

      settle({ answer: { text: reply.text } });
    } catch {
      // 只有这一段降级，上面的报告照常 —— 分是本地规则引擎算的，
      // 不该被一条外部依赖拖垮（ARCHITECTURE §8）。
      settle({ error: "追问暂时不可用，报告不受影响，请稍后重试。" });
    }
  };

  return (
    <div className="flex flex-col border-line border-t">
      <div className="flex items-baseline gap-2 px-4 lg:px-5 py-2.5">
        <span className={`${META} text-accent`}>追问</span>
        <span className={`${META} text-l3`}>Ask</span>
        <span aria-hidden="true" className="flex-1 min-w-2" />
        <span className={`${META} text-l3`}>分数不会被改写</span>
      </div>

      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-2 px-4 lg:px-5 py-3.5 border-line border-t">
          {/* 问句靠字重与颜色站住，不做左右分置的气泡 —— 大面积填充撞 DESIGN §1 铁律二。 */}
          <p className="flex items-baseline gap-2">
            <span className={`${META} text-l3 shrink-0`}>Q</span>
            <span className="font-sans font-bold text-l1 text-sm lg:text-base" style={NARROW}>
              {entry.q}
            </span>
          </p>

          {entry.error ? (
            <p className="text-accent text-xs lg:text-sm leading-relaxed">{entry.error}</p>
          ) : entry.answer === null ? (
            /* 全站第一个真有等待窗口的地方。复用文字进场那套语言，
               不另加转圈或三点跳动（DESIGN §5.18）。 */
            <ScrambleLoop className={`${META} text-l3`} length={18} />
          ) : (
            <>
              <p className="text-l2 text-sm lg:text-base leading-relaxed whitespace-pre-line">
                {entry.answer.text}
              </p>
              {entry.answer.diff && entry.answer.label ? (
                <DiffBar label={entry.answer.label} diff={entry.answer.diff} />
              ) : null}
            </>
          )}
        </div>
      ))}

      <div className="flex flex-col gap-2.5 px-4 lg:px-5 py-3 border-line border-t">
        {/* 预设只在用户还没开口时摆出来。空输入框是这个功能最高的门槛。 */}
        {entries.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {presets.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void ask(question)}
                style={NARROW}
                className="border-line lg:hover:border-l1 px-3 lg:px-4 py-1.5 border rounded-full font-sans font-bold text-l3 text-xs lg:text-sm lg:hover:text-l1 transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
              >
                {question}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
          className="flex items-center gap-2 border-line focus-within:border-l1 px-4 py-1.5 border rounded-full transition-colors duration-200 motion-reduce:transition-none"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="问问这份报告 —— 为什么扣分、换个价再算一遍"
            aria-label="追问这份报告"
            className="flex-1 bg-transparent p-0 outline-none min-w-0 font-sans text-l1 text-xs lg:text-sm placeholder:text-l3"
          />
          <button
            type="submit"
            disabled={draft.trim() === "" || busy}
            aria-label="发送"
            className="shrink-0 text-l3 enabled:lg:hover:text-accent disabled:text-l4 transition-colors duration-200 motion-reduce:transition-none enabled:cursor-pointer disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
