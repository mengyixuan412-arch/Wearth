"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { dateKey, parseKey } from "@/lib/date";
import { deleteDays, loadOotd, saveDays } from "@/lib/supabase/ootd";
import { useSession } from "@/lib/supabase/session";
import { seasonOf } from "@/lib/season";
import type { Item } from "@/lib/wardrobe";

const STORAGE_KEY = "wearth:ootd";

/** 一天一条。 */
export type OotdRecord = {
  photo: string | null;
  note: string;
  /** 关联的衣橱单品 id。每进出一个，对应单品的 wears 同步 ±1。 */
  items: string[];
  /**
   * 语音备注，webm/opus 的 dataURL。可选 —— 这两个字段是后加的，
   * 存量 localStorage 里的记录没有它们，加了 `?` 才不用写迁移。
   */
  voice?: string | null;
  /** 语音时长（秒）。存下来是为了不用先解码音频就能显示时长。 */
  voiceSec?: number;
};

export type OotdMap = Record<string, OotdRecord>;

export const EMPTY_RECORD: OotdRecord = { photo: null, note: "", items: [], voice: null, voiceSec: 0 };

function read(): OotdMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OotdMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** 云端写入的防抖窗口。备注是逐字敲的，不防抖等于每个字符一次请求。 */
const CLOUD_DEBOUNCE_MS = 700;

/**
 * 和上次已同步的那份比，哪几天变了、哪几天没了。
 *
 * **按天推，不整份覆盖。** 一条记录带全身照，压缩后仍有几十 KB；
 * 改一天的备注就把三百天连照片重传一遍，是几十 MB 的事。
 *
 * 靠引用相等判断「变了」—— `setRecord` 只给动过的那个键换新对象，
 * 没动的那些引用不变。
 */
function diffDays(prev: OotdMap, next: OotdMap) {
  const changed: [string, OotdRecord][] = [];
  for (const [day, record] of Object.entries(next)) {
    if (prev[day] !== record) changed.push([day, record]);
  }
  const removed = Object.keys(prev).filter((day) => !(day in next));
  return { changed, removed };
}

export type SaveState = "idle" | "saved" | "error";

export function useOotd() {
  const { ready, userId } = useSession();
  const [records, setRecords] = useState<OotdMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 当前该往哪儿写。同 `useWardrobe`：两个 mutator 都是 useCallback。 */
  const target = useRef<string | null>(null);
  target.current = userId;

  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 上一次已经推上去的那份，用来算增量。 */
  const synced = useRef<OotdMap>({});
  /** 最新一份，卸载时补交用。 */
  const latest = useRef<OotdMap>({});
  latest.current = records;

  /** 读。**登录读云端，未登录读本地。** */
  useEffect(() => {
    // 会话没恢复完就读，登录用户会先闪一次本机记录
    if (!ready) return;

    let alive = true;
    const run = async () => {
      if (userId) {
        const cloud = await loadOotd(userId);
        if (!alive) return;
        // 读不到就维持空表，不要拿本地那份顶上 —— 那会把别人的穿搭
        // 当成这个账号的，下一次编辑还会真的推上去
        if (cloud) {
          setRecords(cloud);
          synced.current = cloud;
        }
      } else {
        setRecords(read());
      }
      if (alive) setHydrated(true);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [ready, userId]);

  /** 写。 */
  useEffect(() => {
    if (!hydrated) return;
    const uid = target.current;

    const done = (ok: boolean) => {
      setSaveState(ok ? "saved" : "error");
      if (!ok) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaveState("idle"), 1600);
    };

    if (uid) {
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
      cloudTimer.current = setTimeout(() => {
        const { changed, removed } = diffDays(synced.current, records);
        synced.current = records;
        if (changed.length === 0 && removed.length === 0) return;
        void Promise.all([saveDays(uid, changed), deleteDays(uid, removed)]).then(
          ([wrote, deleted]) => done(wrote && deleted),
        );
      }, CLOUD_DEBOUNCE_MS);
      return () => {
        if (cloudTimer.current) clearTimeout(cloudTimer.current);
      };
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      done(true);
    } catch {
      setSaveState("error");
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [records, hydrated]);

  /**
   * 卸载时补交。**没有这一段，防抖窗口内切走页面就会丢掉最后一次编辑** ——
   * 而日志页恰恰是「记完一天随手就走」。
   */
  useEffect(
    () => () => {
      const uid = target.current;
      if (!uid) return;
      const { changed, removed } = diffDays(synced.current, latest.current);
      if (changed.length > 0) void saveDays(uid, changed);
      if (removed.length > 0) void deleteDays(uid, removed);
    },
    [],
  );

  const setRecord = useCallback((key: string, patch: Partial<OotdRecord>) => {
    setRecords((current) => ({ ...current, [key]: { ...EMPTY_RECORD, ...current[key], ...patch } }));
  }, []);

  const removeRecord = useCallback((key: string) => {
    setRecords((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  return { records, hydrated, saveState, setRecord, removeRecord };
}

/** 有照片才算记录过 —— 只写了备注不算，PRD 里 OOTD 的主对象是全身照。 */
export const isRecorded = (record?: OotdRecord) => Boolean(record?.photo);

/** 截至今天的连续记录天数。 */
export function currentStreak(records: OotdMap, today = new Date()) {
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (isRecorded(records[dateKey(cursor)])) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 某月已记录的天数。 */
export function monthCount(records: OotdMap, year: number, month: number) {
  return Object.keys(records).filter((key) => {
    const [y, m] = key.split("-").map(Number);
    return y === year && m === month + 1 && isRecorded(records[key]);
  }).length;
}

/* ------------------------------------------------------------ 勾选界面排序 */

const DAY_MS = 86_400_000;
/** 「近期穿过」的窗口。PRD 附录 E 定的就是 30 天。 */
const RECENT_DAYS = 30;

/**
 * 勾选界面里衣橱单品的排列顺序（PRD 附录 E）。**这条规则只管顺序，不管勾选**
 * —— 单品由用户自己选，这里决定的是她要翻几屏才能找到。
 *
 * 衣橱到 50 件以上时，按录入时间排列会让用户每天翻三屏才能凑齐 4–6 件，
 * 而这一步直接决定 PRD 第 9 节「OOTD 关联率 > 80%」能不能达成。
 *
 * 优先级从高到低：
 *
 * 1. **已勾选** —— PRD 没写这一条，是实现时补的。后面三档都会随勾选实时重排，
 *    刚点中的那件如果跟着队列漂走，用户会以为自己点丢了。钉在最前面，
 *    它既是「已选」的回执，也是重排时唯一不动的锚点。
 * 2. **同现搭档** —— 与任一已勾选单品在历史 OOTD 中同时出现过。
 * 3. **当季** —— 季节标签含目标日期所属季节（冬装在夏天不该排在前面）。
 * 4. **近期穿过** —— 目标日期前 30 天内有穿着记录的，按最近穿着日期倒序。
 *
 * 全部同档时按购入时间倒序，保证顺序稳定、不会每次渲染抖动。
 *
 * 已处置的单品直接不出现 —— 送人卖掉的衣服没法穿在身上。
 */
export function orderPickerItems(
  items: Item[],
  records: OotdMap,
  { date, selected }: { date: Date; selected: string[] },
): Item[] {
  const season = seasonOf(date);
  const chosen = new Set(selected);
  const cutoff = date.getTime() - RECENT_DAYS * DAY_MS;

  // 一趟扫完历史：既算每件的最近穿着日期，也算与已选单品的同现关系。
  const lastWorn = new Map<string, number>();
  const partners = new Set<string>();
  for (const [key, record] of Object.entries(records)) {
    const worn = parseKey(key).getTime();
    if (Number.isNaN(worn) || worn > date.getTime()) continue;
    const ids = record.items ?? [];
    const hit = ids.some((id) => chosen.has(id));
    for (const id of ids) {
      if (worn > (lastWorn.get(id) ?? -Infinity)) lastWorn.set(id, worn);
      if (hit && !chosen.has(id)) partners.add(id);
    }
  }

  const rank = (item: Item) => [
    chosen.has(item.id) ? 1 : 0,
    partners.has(item.id) ? 1 : 0,
    item.seasons.includes(season) ? 1 : 0,
    (lastWorn.get(item.id) ?? -Infinity) >= cutoff ? 1 : 0,
    lastWorn.get(item.id) ?? -Infinity,
  ];

  return items
    .filter((item) => item.status !== "已处置")
    .map((item) => ({ item, key: rank(item) }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i += 1) {
        if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i];
      }
      return b.item.boughtAt.localeCompare(a.item.boughtAt);
    })
    .map(({ item }) => item);
}
