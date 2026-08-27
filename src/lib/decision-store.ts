"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { today } from "@/lib/date";
import { deleteDecision, loadDecisions, saveDecisions } from "@/lib/supabase/decisions";
import { useSession } from "@/lib/supabase/session";
import type { Candidate, ScoreResult } from "@/lib/scoring";

const STORAGE_KEY = "wearth.decisions.v1";

/**
 * 一条决策记录。
 *
 * **整份 `result` 原样存下来，不只存总分。** PRD 附录 D 要求「所有输入在评分时刻
 * 取值，随决策记录一并存档，历史评分可复现」—— 衣橱明天就会变，重算只会得到
 * 另一个数；能回看的必须是当时那一次的分维度得分与理由。
 */
export type Decision = {
  id: string;
  /** 记录创建时间，ISO 日期。 */
  at: string;
  /** 商品主图（已压缩的 dataURL），没传就为 null。 */
  photo: string | null;
  /** 用户给的名字，留空则回落到二级品类。 */
  name: string;
  candidate: Candidate;
  result: ScoreResult;
};

export type SaveState = "idle" | "saved" | "error";

export function useDecisions() {
  const { ready, userId } = useSession();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [hydrated, setHydrated] = useState(false);
  /** 只报失败。决策记录带商品主图，配额撑满多半就是它们。 */
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /** 当前该往哪儿写。同 `useWardrobe`：三个 mutator 都是 useCallback。 */
  const target = useRef<string | null>(null);
  target.current = userId;

  /**
   * 读。**登录读云端，未登录读本地。**
   * 服务端没有 localStorage，首帧就读会造成 hydration 不匹配，所以一律放在挂载后。
   */
  useEffect(() => {
    if (!ready) return;

    let alive = true;
    const run = async () => {
      if (userId) {
        const cloud = await loadDecisions(userId);
        // 读不到就维持空表，不要拿本地那份顶上 —— 决策记录会显示成
        // 「你的历史决策」，混进另一个身份的记录比空着更糟
        if (alive && cloud) setDecisions(cloud);
      } else {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw && alive) setDecisions(JSON.parse(raw) as Decision[]);
        } catch {
          /* 读不出来就当没有历史记录 */
        }
      }
      if (alive) setHydrated(true);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  /**
   * 写。**三个 mutator 的分叉只在这一处。**
   * `changed` 是这次真正动过的那几条：云端按条 upsert，一条带商品主图，
   * 整份重传会把历史记录里的图连着发一遍。
   */
  const persist = useCallback((next: Decision[], changed: Decision[]) => {
    const uid = target.current;
    if (uid) {
      void saveDecisions(uid, changed).then((ok) => setSaveState(ok ? "idle" : "error"));
      return next;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveState("idle");
    } catch {
      // 配额多半是被图片撑满的。**不能静默** —— 用户生成完报告点了保存，
      // 以为存进历史了，回头找不到（ARCHITECTURE §4 ④）
      setSaveState("error");
    }
    return next;
  }, []);

  const write = useCallback(
    (next: Decision[]) => {
      setDecisions(persist(next, next));
    },
    [persist],
  );

  /** 新记录排在最前 —— 决策是当下的事，最近一条才是用户要回看的。 */
  const save = useCallback(
    (entry: Omit<Decision, "id" | "at">) => {
      // 不用 toISOString().slice(0,10) —— 那个走 UTC，东八区晚上保存会记成前一天。
      const at = today();
      const id = `${Date.now()}`;
      const created = { ...entry, id, at };
      setDecisions((current) => persist([created, ...current], [created]));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      const uid = target.current;
      if (uid) void deleteDecision(uid, id);
      setDecisions((current) => {
        const next = current.filter((entry) => entry.id !== id);
        // 云端已经单独删过了，这里只负责本地那份
        return uid ? next : persist(next, []);
      });
    },
    [persist],
  );

  return { decisions, hydrated, saveState, save, remove, write };
}
