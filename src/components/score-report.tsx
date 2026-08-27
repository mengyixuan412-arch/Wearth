"use client";

import { META, WIDE } from "@/components/panel";
import { formatDate } from "@/lib/date";
import type { Dimension, ScoreResult } from "@/lib/scoring";

const yuan = (value: number) => `¥${Math.round(value).toLocaleString("zh-CN")}`;

/**
 * 单维度一行：编号 · 名称 · 得分/权重 · 进度条 · 理由 · 佐证单品。
 *
 * 进度条按**该维度自己的满分**归一，不是按总分 —— ⑤身材适配度拿 14/20 和
 * ①衣橱重复度拿 14/15 不是一回事，共用一把尺子会把这个差别抹平。
 */
function DimensionRow({ dimension }: { dimension: Dimension }) {
  const { index, zh, en, weight, score, reason, evidence } = dimension;
  const skipped = score === null;
  const ratio = skipped ? 0 : score / weight;

  return (
    <div className="flex flex-col gap-2 px-4 lg:px-5 py-3.5 lg:py-4 border-line border-b last:border-b-0">
      <div className="flex items-baseline gap-2 lg:gap-3">
        <span className={`${META} text-accent tabular-nums shrink-0`}>{index}</span>
        <span className="font-sans font-bold text-l1 text-sm lg:text-base" style={WIDE}>
          {zh}
        </span>
        <span className={`${META} text-l3 truncate`}>{en}</span>
        <span aria-hidden="true" className="flex-1 min-w-2" />
        <span className="font-sans font-bold text-l1 text-sm lg:text-base tabular-nums shrink-0">
          {skipped ? (
            <span className="text-l3">不计分</span>
          ) : (
            <>
              {score}
              <span className="text-l3"> / {weight}</span>
            </>
          )}
        </span>
      </div>

      {/* 不可算的维度画一条空槽，不画 0 分 —— 0 分是「差」，不可算是「没这项数据」。 */}
      <div className="bg-line w-full h-[3px]">
        {skipped ? null : (
          <div
            className="bg-accent h-full transition-[width] duration-500 ease-66 motion-reduce:transition-none"
            style={{ width: `${Math.max(2, ratio * 100)}%` }}
          />
        )}
      </div>

      <p className="text-l2 text-xs lg:text-sm leading-relaxed">{reason}</p>

      {evidence && evidence.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 mt-0.5">
          {evidence.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline gap-1.5 bg-be/50 px-2.5 py-1 rounded-full text-xs"
            >
              <span className="font-sans font-bold text-l1">{entry.name}</span>
              <span className={`${META} text-l3 tabular-nums`}>{entry.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * 评分报告。
 *
 * **不输出购买建议。** 只给分数、分维度得分与理由 —— 决策主体是用户，
 * 「建议购买 / 不建议购买」既超出这套参数能承担的权威，也与产品立场冲突
 * （PRD 8「明确不做」）。所以这里没有任何一句结论性文案，
 * 分数也不配「优秀 / 一般」这类档位标签。
 */
export default function ScoreReport({ result }: { result: ScoreResult }) {
  const { total, dimensions, countedCount, annualCare, coldStart, snapshotAt } = result;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 lg:px-5 py-4 lg:py-5 border-line border-b">
        <div className="flex flex-col gap-1">
          <span className={`${META} text-l3`}>综合评分</span>
          <span
            className="font-sans font-medium text-l1 text-5xl lg:text-6xl leading-none tabular-nums"
            style={WIDE}
          >
            {total}
            <span className="ml-1 text-l3 text-xl lg:text-2xl">/ 100</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5 ml-auto text-right">
          {/* 归一化后的分数必须交代基数，否则 5 个维度的 78 和 3 个维度的 78 看着一样 */}
          <span className={`${META} text-l2`}>
            基于 {countedCount} 个维度（共 {dimensions.length} 个）
          </span>
          <span className={`${META} text-l3`}>基于 {formatDate(snapshotAt)} 的衣橱状态</span>
        </div>
      </div>

      {coldStart !== null ? (
        <p className={`${META} bg-accent-wash px-4 lg:px-5 py-2.5 border-line border-b text-l1`}>
          衣橱还差 {coldStart} 件解锁完整评分 —— 重复度与可搭配性要有足够的衣橱才算得准
        </p>
      ) : null}

      {dimensions.map((dimension) => (
        <DimensionRow key={dimension.key} dimension={dimension} />
      ))}

      {/* 养护成本单独列，不参与算分（附录 D ④）—— 它是一笔要花的钱，不是一个评价。 */}
      <div className="flex items-baseline gap-3 mt-auto px-4 lg:px-5 py-3.5 border-line border-t">
        <span className={`${META} text-l3`}>年度预估养护成本</span>
        <span className="font-sans font-bold text-l1 text-sm lg:text-base tabular-nums">
          {annualCare > 0 ? yuan(annualCare) : "—"}
        </span>
        <span className={`${META} ml-auto text-l3`}>不参与算分</span>
      </div>
    </div>
  );
}
