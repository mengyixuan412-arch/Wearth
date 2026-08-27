"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadDoc, saveDoc } from "@/lib/supabase/docs";
import { useSession } from "@/lib/supabase/session";
import { CATEGORIES, SUBCATEGORIES, type Category } from "@/lib/wardrobe";

const STORAGE_KEY = "wearth.customSubs.v1";

function readLocal(): CustomSubs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomSubs) : {};
  } catch {
    /* 读不出来就当没有自建项 */
    return {};
  }
}

/** 一级品类 → 用户自建的二级品类。内置项不在这里，只存增量。 */
export type CustomSubs = Partial<Record<Category, string[]>>;

/**
 * 只让用户自建**二级**品类，一级 10 类固定。
 *
 * 一级不开放是有原因的：它挂着图标表、互补矩阵、身材适配度的围度对应、统计页的分组，
 * 每加一类都要同时回答「它和谁能搭」「量哪几个围度」——那是产品决策，不是用户填个名字
 * 就能定的。二级只影响「衣橱重复度」的相似判定，粒度问题，用户自己最清楚。
 */
export type SaveState = "idle" | "saved" | "error";

export function useCustomSubs() {
  const { ready, userId } = useSession();
  const [custom, setCustom] = useState<CustomSubs>({});
  const [hydrated, setHydrated] = useState(false);
  /** 只报失败。 */
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /** 当前该往哪儿写。同 `useWardrobe`：`write` 是 useCallback，闭包会停在挂载那一刻。 */
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
        const cloud = await loadDoc<CustomSubs>("custom_subs", userId);
        if (!alive) return;
        // 云上还没有这一行就沿用本机的，下一次增删会整份推上去
        if (cloud) setCustom(cloud);
        else setCustom(readLocal());
      } else {
        setCustom(readLocal());
      }
      if (alive) setHydrated(true);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  /**
   * 写。**不防抖** —— 自建品类只在用户显式增删时变，一次操作一次请求，
   * 不像档案那样逐字触发。
   */
  const write = useCallback((next: CustomSubs) => {
    setCustom(next);
    const uid = target.current;
    if (uid) {
      void saveDoc("custom_subs", uid, next).then((ok) => setSaveState(ok ? "idle" : "error"));
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveState("idle");
    } catch {
      // **不能静默** —— 用户新建了一个二级品类，下次打开就不见了
      setSaveState("error");
    }
  }, []);

  /**
   * 加一个二级品类。返回失败原因，成功返回 null ——
   * 调用方要把原因显示出来，静默失败会让用户以为加上了。
   */
  const addSub = useCallback(
    (category: Category, raw: string): string | null => {
      const name = raw.trim();
      if (!name) return "请输入名称";
      if (name.length > 12) return "名称不得超过 12 个字";

      // 重名要跨**所有**一级查，不只是当前这一类。二级品类名撞车会让
      // 「衣橱重复度」把两类东西判成同一种，也会让筛选结果读起来自相矛盾。
      // 例外是内置的「开衫」—— 它本来就刻意挂在内搭与外套两处。
      for (const entry of CATEGORIES) {
        if (SUBCATEGORIES[entry].includes(name)) {
          return entry === category ? `「${name}」已存在于${entry}` : `「${name}」已被${entry}占用`;
        }
        if ((custom[entry] ?? []).includes(name)) {
          return entry === category ? `「${name}」已存在于${entry}` : `「${name}」已被${entry}占用`;
        }
      }

      write({ ...custom, [category]: [...(custom[category] ?? []), name] });
      return null;
    },
    [custom, write],
  );

  /** 只能删自建项。内置品类删不得 —— 已录入的单品会挂空。 */
  const removeSub = useCallback(
    (category: Category, name: string) => {
      const rest = (custom[category] ?? []).filter((entry) => entry !== name);
      const next = { ...custom };
      if (rest.length > 0) next[category] = rest;
      else delete next[category];
      write(next);
    },
    [custom, write],
  );

  /** 内置 + 自建，给录入弹窗的二级列表用。 */
  const subsOf = useCallback(
    (category: Category): string[] => [...SUBCATEGORIES[category], ...(custom[category] ?? [])],
    [custom],
  );

  return { custom, hydrated, saveState, addSub, removeSub, subsOf };
}
