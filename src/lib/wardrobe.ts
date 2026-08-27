"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { deleteItem, loadItems, saveItems } from "@/lib/supabase/items";
import { useSession } from "@/lib/supabase/session";

import {
  CATEGORIES,
  SUBCATEGORIES,
  type CareRecord,
  type Item,
} from "@/lib/wardrobe-data";

/**
 * 衣橱的读写。**纯数据与规则在 `wardrobe-data.ts`**，本文件整体 re-export 它 ——
 * 既有的 `from "@/lib/wardrobe"` 一行都不用改。
 *
 * 拆开的理由：带 `"use client"` 的模块被服务端引用时导出会变成代理对象，
 * 服务端拿不到真正的数组。详见 `wardrobe-data.ts` 顶上那段。
 */
export * from "@/lib/wardrobe-data";

// v2 加了 careLog；沿用旧键会让存量本地数据盖掉新种子，趋势图上就没有养护那一列了。
// v3 换了色系六档（白/黑/灰/红/蓝/粉）。沿用旧键的话，存量数据里的
// 「米棕」「粉紫」「彩色」在新表里不存在，按色系筛选会一件都选不出来。
const STORAGE_KEY = "wearth.wardrobe.v3";

const SEED: Item[] = [
  { id: "1", colorFamily: "粉", seasons: ["春", "夏", "秋"], brand: "无印良品", boughtAt: "2024-09-12", name: "假两件粉白T恤", category: "内搭", sub: "T恤", price: 399, care: 40, careLog: [{ date: "2025-03-15", amount: 40, note: "干洗" }], wears: 46, image: "/img/wardrobe/w_01.png", color: "#e2c6c3", status: "在用" , demo: true },
  { id: "2", colorFamily: "红", seasons: ["春", "秋"], brand: "COS", boughtAt: "2025-04-02", name: "米色系带短袖", category: "内搭", sub: "T恤", price: 629, care: 60, careLog: [{ date: "2025-11-02", amount: 60, note: "干洗" }], wears: 31, image: "/img/wardrobe/w_05.png", color: "#d9ccc2", status: "在用" , demo: true },
  { id: "3", colorFamily: "蓝", seasons: ["春", "夏", "秋", "冬"], brand: "Levi's", boughtAt: "2023-11-18", name: "蓝色系带短袖", category: "内搭", sub: "T恤", price: 549, care: 20, careLog: [{ date: "2024-06-10", amount: 20, note: "洗护" }], wears: 88, image: "/img/wardrobe/w_09.png", color: "#c2d0d8", status: "在用" , demo: true },
  { id: "4", colorFamily: "粉", seasons: ["春", "秋", "冬"], brand: "Theory", boughtAt: "2025-10-20", name: "粉色系带衬衫", category: "内搭", sub: "衬衫", price: 1280, care: 180, careLog: [{ date: "2025-12-06", amount: 90, note: "干洗" }, { date: "2026-05-14", amount: 90, note: "干洗" }], wears: 12, image: "/img/wardrobe/w_16.png", color: "#e2bfc3", status: "在用" , demo: true },
  { id: "5", colorFamily: "红", seasons: ["春", "夏"], brand: "Sandro", boughtAt: "2026-04-08", name: "红色镂空针织衫", category: "内搭", sub: "针织衫", price: 899, care: 90, careLog: [{ date: "2026-06-20", amount: 90, note: "羊毛洗护" }], wears: 7, image: "/img/wardrobe/w_30.png", color: "#94202a", status: "在用" , demo: true },
  { id: "6", colorFamily: "蓝", seasons: ["春", "夏", "秋"], brand: "Adidas", boughtAt: "2024-05-30", name: "深蓝色牛仔喇叭裤", category: "裤子", sub: "牛仔裤", price: 699, care: 50, careLog: [{ date: "2025-01-12", amount: 50, note: "修补裤脚" }], wears: 120, image: "/img/wardrobe/w_02.png", color: "#2c4665", status: "在用" , demo: true },
  { id: "7", colorFamily: "黑", seasons: ["冬"], brand: "MaxMara", boughtAt: "2023-12-14", name: "黑色西装裤", category: "裤子", sub: "西装裤", price: 2680, care: 320, careLog: [{ date: "2024-03-08", amount: 80, note: "干洗" }, { date: "2024-12-19", amount: 80, note: "干洗" }, { date: "2025-11-25", amount: 80, note: "干洗" }, { date: "2026-03-30", amount: 80, note: "干洗" }], wears: 18, image: "/img/wardrobe/w_06.png", color: "#242326", status: "在用" , demo: true },
  { id: "8", colorFamily: "蓝", seasons: ["春", "秋"], brand: "优衣库", boughtAt: "2025-09-05", name: "水洗蓝色牛仔裤", category: "裤子", sub: "牛仔裤", price: 199, care: 10, careLog: [{ date: "2026-01-09", amount: 10, note: "洗护" }], wears: 63, image: "/img/wardrobe/w_28.png", color: "#8998b0", status: "在用" , demo: true },
  { id: "9", colorFamily: "红", seasons: ["春", "秋", "冬"], brand: "ZARA", boughtAt: "2024-03-22", name: "红色高跟鞋", category: "鞋", sub: "高跟鞋", price: 459, care: 40, careLog: [{ date: "2025-06-05", amount: 40, note: "鞋跟修补" }], wears: 24, image: "/img/wardrobe/w_24.png", color: "#7a161e", status: "在用" , demo: true },
  { id: "10", colorFamily: "黑", seasons: ["春", "夏", "秋", "冬"], brand: "Coach", boughtAt: "2024-12-01", name: "黑色阔腿喇叭裤", category: "裤子", sub: "休闲裤", price: 1899, care: 120, careLog: [{ date: "2025-02-14", amount: 60, note: "干洗" }, { date: "2026-02-11", amount: 60, note: "干洗" }], wears: 41, image: "/img/wardrobe/w_26.png", color: "#1c1c1c", status: "在用" , demo: true },
  { id: "11", colorFamily: "蓝", seasons: ["春", "夏"], brand: "Hermès", boughtAt: "2026-06-19", name: "黑色包臀长裙", category: "半身裙", sub: "包臀裙", price: 320, care: 30, careLog: [{ date: "2026-07-02", amount: 30, note: "洗护" }], wears: 0, image: "/img/wardrobe/w_31.png", color: "#282735", status: "闲置" , demo: true },
  { id: "12", colorFamily: "粉", seasons: ["冬"], brand: "优衣库", boughtAt: "2023-12-08", name: "粉色蝴蝶结高跟鞋", category: "鞋", sub: "高跟鞋", price: 1580, care: 200, careLog: [{ date: "2024-04-18", amount: 100, note: "鞋面护理" }, { date: "2025-12-22", amount: 100, note: "换鞋跟" }], wears: 34, image: "/img/wardrobe/w_14.png", color: "#d7b7b1", status: "在用" , demo: true },
  { id: "13", colorFamily: "粉", seasons: ["春", "夏", "秋"], brand: "Coach", boughtAt: "2025-05-18", name: "浅粉手提包", category: "包", sub: "时装包", price: 1290, care: 80, careLog: [{ date: "2025-09-26", amount: 80, note: "皮具保养" }], wears: 36, image: "/img/wardrobe/w_03.png", color: "#d2b5b1", status: "在用" , demo: true },
  { id: "14", colorFamily: "黑", seasons: ["春", "夏", "秋", "冬"], brand: "COS", boughtAt: "2024-08-11", name: "黑色手提包", category: "包", sub: "时装包", price: 980, care: 60, careLog: [{ date: "2025-03-19", amount: 60, note: "皮具保养" }], wears: 52, image: "/img/wardrobe/w_04.png", color: "#191919", status: "在用" , demo: true },
  { id: "15", colorFamily: "红", seasons: ["春", "秋"], brand: "Longchamp", boughtAt: "2026-02-26", name: "米色单肩包", category: "包", sub: "时装包", price: 760, care: 40, careLog: [{ date: "2026-05-30", amount: 40, note: "皮具保养" }], wears: 28, image: "/img/wardrobe/w_11.png", color: "#d6ccc4", status: "在用" , demo: true },
  { id: "16", colorFamily: "粉", seasons: ["春", "夏"], brand: "Charles & Keith", boughtAt: "2026-05-09", name: "浅粉小方包", category: "包", sub: "手拿包", price: 430, care: 20, careLog: [{ date: "2026-07-16", amount: 20, note: "清洁" }], wears: 14, image: "/img/wardrobe/w_20.png", color: "#e6bfbe", status: "在用" , demo: true },
  { id: "17", colorFamily: "红", seasons: ["春", "夏", "秋", "冬"], brand: "无印良品", boughtAt: "2023-09-14", name: "花朵紧身T恤", category: "内搭", sub: "T恤", price: 320, care: 30, careLog: [{ date: "2024-08-21", amount: 30, note: "洗护" }], wears: 96, image: "/img/wardrobe/w_21.png", color: "#d2bfb4", status: "在用" , demo: true },
  { id: "18", colorFamily: "黑", seasons: ["秋", "冬"], brand: "Dr.Martens", boughtAt: "2023-11-03", name: "黑色高跟鞋", category: "鞋", sub: "高跟鞋", price: 1680, care: 220, careLog: [{ date: "2024-05-13", amount: 110, note: "鞋底修补" }, { date: "2025-10-28", amount: 110, note: "换底" }], wears: 44, image: "/img/wardrobe/w_07.png", color: "#1c1b1c", status: "在用" , demo: true },
  { id: "19", colorFamily: "黑", seasons: ["冬"], brand: "Stuart Weitzman", boughtAt: "2024-11-21", name: "黑色高跟鞋", category: "鞋", sub: "高跟鞋", price: 2380, care: 260, careLog: [{ date: "2025-05-07", amount: 130, note: "鞋面护理" }, { date: "2026-04-23", amount: 130, note: "换鞋跟" }], wears: 19, image: "/img/wardrobe/w_08.png", color: "#222121", status: "在用" , demo: true },
  { id: "20", colorFamily: "蓝", seasons: ["秋", "冬"], brand: "ZARA", boughtAt: "2025-10-16", name: "浅蓝踝靴", category: "鞋", sub: "踝/短靴", price: 590, care: 60, careLog: [{ date: "2026-03-05", amount: 60, note: "皮革保养" }], wears: 11, image: "/img/wardrobe/w_12.png", color: "#bcc5d0", status: "在用" , demo: true },
  { id: "21", colorFamily: "蓝", seasons: ["春", "夏", "秋"], brand: "Levi's", boughtAt: "2025-04-07", name: "浅蓝踝靴", category: "鞋", sub: "踝/短靴", price: 629, care: 30, careLog: [{ date: "2025-12-11", amount: 30, note: "清洁" }], wears: 38, image: "/img/wardrobe/w_13.png", color: "#bec7d2", status: "在用" , demo: true },
];

/** 新单品的 id。取当前最大数字 id + 1，接着种子数据的 1–21 往下排。 */
function nextId(items: Item[]) {
  const max = items.reduce((top, item) => Math.max(top, Number(item.id) || 0), 0);
  return String(max + 1);
}

/**
 * 衣橱读写。
 *
 * 写入**在每个 mutator 里直接落盘**，不走 `useEffect([items])` ——
 * 那种写法在首帧会拿还没灌入 localStorage 的种子数据去覆盖用户的真实衣橱。
 * profile-store 靠一个 `hydrated` 标志绕开，这里字段多、入口多，直接写更难出错。
 *
 * 各页面各持一份实例，靠路由切换时的重新挂载来同步 —— 分割式路由下每次跳转都会
 * 卸载重建，读到的一定是最新的盘上数据。
 */
/**
 * 内置演示数据的身份证：`id|名称`。
 *
 * **必须两者都比**。只比 id 会误伤：种子是 "1"–"21"，而 `nextId()` 取的是当前
 * 最大 id + 1，用户删掉几件再新增，自己录的衣服完全可能拿到 "21" 这种号。
 * 只比名称也会误伤：用户真有可能给自己的衣服起一样的名字。
 */
const SEED_KEYS = new Set(SEED.map((item) => `${item.id}|${item.name}`));

export const isSeedItem = (item: Pick<Item, "id" | "name">) =>
  SEED_KEYS.has(`${item.id}|${item.name}`);

/**
 * 给早于 `demo` 字段存下来的旧数据补上标记。
 *
 * 加这个字段之前存进 localStorage 的那批种子没有它，`readLocalWardrobe()` 会把它们
 * 当成用户自己录的衣服传上云 —— 21 件假衣服会污染衣橱重复度、总花费、品牌排名和评分。
 *
 * **只补不删**：已经有 `demo` 的原样保留，用户自己录的不动。
 */
export function backfillDemo(items: Item[]): Item[] {
  return items.map((item) =>
    item.demo === undefined && isSeedItem(item) ? { ...item, demo: true as const } : item,
  );
}

/** 和 `profile-store` / `ootd-store` 同一套三态，界面才好共用一个提示条。 */
export type SaveState = "idle" | "saved" | "error";

export function useWardrobe() {
  const { ready, userId } = useSession();
  /**
   * **首帧一律是空的，不是种子。**
   *
   * 从 `SEED` 起步会让已登录的用户先看到 21 件不属于他的衣服，
   * 云端读回来之后再被清空 —— 那一闪看起来像「我的衣橱被换掉又被删光了」。
   * 种子只在确认「未登录且本机没有数据」之后才铺。
   *
   * 代价是访客首屏会空一下。但空一下再出现，比出现再消失轻得多。
   */
  const [items, setItems] = useState<Item[]>([]);
  const [hydrated, setHydrated] = useState(false);
  /** 只用来报失败。成功不出声 —— 常驻一行「已保存」是噪音。 */
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /**
   * 当前该往哪儿写。放 ref 而不是直接读闭包里的 `userId` ——
   * 八个 mutator 都是 `useCallback`，闭包捕获的是创建那一刻的值；
   * 登录状态在它们创建之后才恢复完，不这样会一直往本地写。
   */
  const target = useRef<string | null>(null);
  target.current = userId;

  /**
   * 读。**登录读云端，未登录读本地。**
   *
   * 未登录不是「只读演示」——访客照样能改、也照样存在他自己的浏览器里，
   * 只是不上云。这样面试官点开链接就是一个能操作的完整产品，不用注册（乙方案）。
   */
  useEffect(() => {
    // 会话还没恢复完就读，会先闪一次访客态的种子数据 —— 那看起来像用户的衣橱被换掉了
    if (!ready) return;

    let alive = true;
    const run = async () => {
      if (userId) {
        const cloud = await loadItems(userId);
        if (!alive) return;
        // 读不到（断网、表没建）就空着。**不能退回种子** —— 那是演示数据，
        // 对已登录的人来说是假的衣橱，比空着更糟
        if (cloud) setItems(cloud);
      } else {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          // 本机没存过东西 = 第一次来的访客，这时才铺演示衣橱
          if (!raw) setItems(SEED);
          else {
            const stored = JSON.parse(raw) as Item[];
            const fixed = backfillDemo(stored);
            setItems(fixed);
            // 补过就写回去，这样只算一次；写失败无所谓，下次读还会再补
            if (fixed.some((item, i) => item !== stored[i])) {
              try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fixed));
              } catch {
                /* 补标记失败不影响使用 */
              }
            }
          }
        } catch {
          // 存的东西坏了（手改过、被别的版本写过）也当访客处理，铺种子
          setItems(SEED);
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
   * 写。**八个 mutator 全部经由这里**，本地与云端的分叉只在这一处 ——
   * 原来八处各写一遍 `localStorage.setItem`，加云端就要再抄八遍。
   *
   * `changed` 是这次真正动过的那几件：云端按件 upsert，一次推一两件而不是
   * 把整柜衣服连图重传一遍（一件连图约 30KB，一百件就是 3MB）。
   */
  const persist = useCallback((next: Item[], changed: Item[]) => {
    const uid = target.current;
    if (uid) {
      // 云端失败也要出声：改动只在内存里，刷新就没了
      void saveItems(uid, changed).then((ok) => setSaveState(ok ? "idle" : "error"));
      return next;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveState("idle");
    } catch {
      // 配额超了基本只可能是照片太大 —— 上传时已经压过，**不能静默吞掉**：
      // 用户录完一件衣服以为存上了，刷新就没了（ARCHITECTURE §4 ④）
      setSaveState("error");
    }
    return next;
  }, []);

  const commit = useCallback((next: Item[]) => {
    setItems(next);
    return persist(next, next);
  }, [persist]);

  /** 返回新单品的 id，好让录入页保存完直接跳到它的详情页。 */
  const addItem = useCallback(
    (draft: Omit<Item, "id">) => {
      let id = "";
      setItems((current) => {
        id = nextId(current);
        const next = [{ ...draft, id }, ...current];
        persist(next, [{ ...draft, id }]);
        return next;
      });
      return id;
    },
    [persist],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Item>) => {
      setItems((current) => {
        const next = current.map((item) => (item.id === id ? { ...item, ...patch } : item));
        persist(next, next.filter((item) => item.id === id));
        return next;
      });
    },
    [persist],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((current) => {
        const next = current.filter((item) => item.id !== id);
        // 删除要真的删掉云端那一行 —— 只 upsert 剩下的，被删的那件会一直留在库里
        const uid = target.current;
        if (uid) void deleteItem(uid, id);
        else persist(next, next);
        return next;
      });
    },
    [persist],
  );

  /**
   * 记一笔养护。`care` 是 careLog 的合计 —— 两个都要动，
   * 否则 CPW 分子（读 care）和支出趋势图（读 careLog 的日期）会对不上账。
   */
  const addCare = useCallback(
    (id: string, record: CareRecord) => {
      setItems((current) => {
        const next = current.map((item) => {
          if (item.id !== id) return item;
          const log = [...(item.careLog ?? []), record].sort((a, b) => a.date.localeCompare(b.date));
          return { ...item, careLog: log, care: log.reduce((sum, entry) => sum + entry.amount, 0) };
        });
        persist(next, next.filter((item) => item.id === id));
        return next;
      });
    },
    [persist],
  );

  /**
   * 改一笔已有的养护。
   *
   * **不做成「删了再加」** —— 那样 `care` 合计会在两次 setState 之间短暂算错，
   * 而且改完日期后新记录排到别的位置，用户正在编辑的那一行会跳走。
   * 这里原地替换再整体重排，合计跟着 careLog 一起重算，两个字段始终对得上账。
   */
  const updateCare = useCallback(
    (id: string, index: number, record: CareRecord) => {
      setItems((current) => {
        const next = current.map((item) => {
          if (item.id !== id) return item;
          const log = (item.careLog ?? [])
            .map((entry, i) => (i === index ? record : entry))
            .sort((a, b) => a.date.localeCompare(b.date));
          return { ...item, careLog: log, care: log.reduce((sum, entry) => sum + entry.amount, 0) };
        });
        persist(next, next.filter((item) => item.id === id));
        return next;
      });
    },
    [persist],
  );

  const removeCare = useCallback(
    (id: string, index: number) => {
      setItems((current) => {
        const next = current.map((item) => {
          if (item.id !== id) return item;
          const log = (item.careLog ?? []).filter((_, i) => i !== index);
          return { ...item, careLog: log, care: log.reduce((sum, entry) => sum + entry.amount, 0) };
        });
        persist(next, next.filter((item) => item.id === id));
        return next;
      });
    },
    [persist],
  );

  /**
   * 按 id 批量调整穿着次数。OOTD 保存时 +1、删记录时 −1 都走这里。
   * 下限锁 0 —— 回滚一条不该回滚的记录不能把次数打成负数，那会让 CPW 变成负值。
   */
  const bumpWears = useCallback(
    (ids: string[], delta: number) => {
      if (ids.length === 0) return;
      setItems((current) => {
        const set = new Set(ids);
        const next = current.map((item) =>
          set.has(item.id) ? { ...item, wears: Math.max(0, item.wears + delta) } : item,
        );
        persist(next, next.filter((item) => set.has(item.id)));
        return next;
      });
    },
    [persist],
  );

  return { items, hydrated, saveState, commit, addItem, updateItem, removeItem, addCare, updateCare, removeCare, bumpWears };
}
