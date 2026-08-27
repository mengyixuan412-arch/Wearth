"use client";

import { saveDecisions } from "@/lib/supabase/decisions";
import { saveItems } from "@/lib/supabase/items";
import { saveDays } from "@/lib/supabase/ootd";
import { backfillDemo } from "@/lib/wardrobe";
import type { Decision } from "@/lib/decision-store";
import type { OotdMap, OotdRecord } from "@/lib/ootd-store";
import type { Item } from "@/lib/wardrobe-data";

/**
 * 把这台设备上攒的数据传到云端。**一次性、显式触发**，不在登录时自动跑 ——
 * 自动上传等于替用户做了一个不可逆的决定，而他可能只是想在另一台电脑上登录看看。
 *
 * 搬衣橱、穿搭、决策三样。**顺序不能换** —— 穿搭记录引用单品 id，
 * 得等单品先在云上落地。
 *
 * 档案和自建品类不在这里：它们在云端没有行时会退回本机那份，
 * 用户下一次编辑就整份推上去了，等于自己会搬。
 */

const WARDROBE_KEY = "wearth.wardrobe.v3";

export type LocalSnapshot = {
  /** 用户自己录的。默认只传这些。 */
  own: Item[];
  /** 内置的演示数据。**默认不传** —— 它们会污染统计和评分。 */
  demo: Item[];
};

/**
 * 读这台设备上有什么，按「自己录的 / 演示数据」分开。
 *
 * 分开的必要性：种子数据是初始值，用户一操作就和他自己的衣服混进同一个数组、
 * 一起存进 localStorage。不分开就会把 21 件不属于他的衣服传上云 ——
 * 而衣橱重复度、可搭配率、总花费、品牌排名全都要扫这张表。
 */
export function readLocalWardrobe(): LocalSnapshot {
  try {
    const raw = window.localStorage.getItem(WARDROBE_KEY);
    if (!raw) return { own: [], demo: [] };
    // **先回填再分拣**。加 `demo` 字段之前存下的种子没有这个标记，
    // 不补就会被当成用户自己的衣服传上云。
    const items = backfillDemo(JSON.parse(raw) as Item[]);
    return {
      own: items.filter((item) => !item.demo),
      demo: items.filter((item) => item.demo),
    };
  } catch {
    return { own: [], demo: [] };
  }
}

/**
 * 传上去。返回传成了几件。
 *
 * **不删本地那份。** 万一云端写了一半断了，本地还是完整的；
 * 而多一份副本的代价只是 localStorage 里几 MB，比丢数据便宜得多。
 */
export async function pushWardrobe(userId: string, items: Item[]): Promise<number> {
  if (items.length === 0) return 0;
  // 分批推：一件连图约 30KB，几十件一次性 upsert 会撞请求体上限
  const BATCH = 20;
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    if (await saveItems(userId, slice)) done += slice.length;
  }
  return done;
}


const OOTD_KEY = "wearth:ootd";
const DECISIONS_KEY = "wearth.decisions.v1";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 分批推。一条带图约 30KB，几十条一次性 upsert 会撞请求体上限。 */
const BATCH = 20;
async function inBatches<T>(rows: T[], write: (slice: T[]) => Promise<boolean>): Promise<number> {
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    if (await write(slice)) done += slice.length;
  }
  return done;
}

export type PushSummary = { items: number; days: number; decisions: number };

/**
 * 把这台设备上攒的全部数据搬上云。**一次性、显式触发。**
 *
 * 三样按依赖顺序走：单品 → 穿搭（引用单品 id）→ 决策。
 * 中途某一样失败不影响其余 —— 返回的是各自成功的条数，调用方如实报给用户。
 */
export async function pushLocal(userId: string): Promise<PushSummary> {
  const { own } = readLocalWardrobe();
  const items = await inBatches(own, (slice) => saveItems(userId, slice));

  const ootd = Object.entries(readLocal<OotdMap>(OOTD_KEY, {})) as [string, OotdRecord][];
  const days = await inBatches(ootd, (slice) => saveDays(userId, slice));

  const history = readLocal<Decision[]>(DECISIONS_KEY, []);
  const decisions = await inBatches(history, (slice) => saveDecisions(userId, slice));

  return { items, days, decisions };
}
