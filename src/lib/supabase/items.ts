"use client";

import { supabase } from "@/lib/supabase/client";
import type { CareRecord, ColorFamily, Item, Material, Season } from "@/lib/wardrobe-data";

/**
 * 衣橱单品的云端读写。**只在已登录时用**，未登录走 localStorage（乙方案）。
 *
 * 表结构见 `supabase/schema.sql`。列名用 snake_case（Postgres 惯例），
 * `Item` 用 camelCase（TS 惯例），映射集中在本文件两个函数里 ——
 * 散到调用处就会出现某一处漏转、某个字段永远存不上的那种 bug。
 */

type Row = {
  id: string;
  name: string;
  category: string;
  sub: string;
  price: number;
  care: number;
  wears: number;
  image: string;
  color: string;
  color_family: string;
  seasons: string[];
  brand: string;
  bought_at: string;
  status: string;
  care_log: CareRecord[];
  materials: Material[];
  size: string | null;
  channel: string | null;
  note: string | null;
};

const toItem = (row: Row): Item => ({
  id: row.id,
  name: row.name,
  category: row.category as Item["category"],
  sub: row.sub,
  price: row.price,
  care: row.care,
  careLog: row.care_log ?? [],
  wears: row.wears,
  image: row.image,
  color: row.color,
  colorFamily: row.color_family as ColorFamily,
  seasons: (row.seasons ?? []) as Season[],
  brand: row.brand,
  boughtAt: row.bought_at,
  status: row.status as Item["status"],
  materials: row.materials ?? [],
  // 空串和 null 在库里都表示「没填」，转回来统一成 undefined ——
  // 表单用 `?? ""` 兜底，留着 null 会让「未填写」判断多一种情况
  size: row.size ?? undefined,
  channel: row.channel ?? undefined,
  note: row.note ?? undefined,
});

const toRow = (item: Item, userId: string) => ({
  user_id: userId,
  id: item.id,
  name: item.name,
  category: item.category,
  sub: item.sub,
  price: item.price,
  care: item.care,
  wears: item.wears,
  image: item.image,
  color: item.color,
  color_family: item.colorFamily,
  seasons: item.seasons,
  brand: item.brand,
  bought_at: item.boughtAt,
  status: item.status,
  care_log: item.careLog ?? [],
  materials: item.materials ?? [],
  size: item.size ?? null,
  channel: item.channel ?? null,
  note: item.note ?? null,
  updated_at: new Date().toISOString(),
});

/** 拉这个用户的全部单品。读不到（断网、RLS 拦下）返回 `null`，由调用方决定退路。 */
export async function loadItems(userId: string): Promise<Item[] | null> {
  const client = supabase();
  if (!client) return null;

  const { data, error } = await client
    .from("items")
    .select("*")
    .eq("user_id", userId)
    // 和本地那份的默认顺序一致：最新购入在前
    .order("bought_at", { ascending: false });

  if (error || !data) return null;
  return (data as Row[]).map(toItem);
}

/**
 * 写若干件。**按整件 upsert，不做字段级 diff** —— 单品字段多且相互关联
 * （`care` 必须等于 `careLog` 的合计，ARCHITECTURE.md §7），
 * 只推变动字段迟早会出现两者对不上的中间状态。
 *
 * 一件衣服连图约 30KB，一次写一两件，代价可以接受。
 */
export async function saveItems(userId: string, items: Item[]): Promise<boolean> {
  const client = supabase();
  if (!client || items.length === 0) return true;

  const { error } = await client.from("items").upsert(items.map((item) => toRow(item, userId)));
  return !error;
}

export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const client = supabase();
  if (!client) return true;

  const { error } = await client.from("items").delete().eq("user_id", userId).eq("id", id);
  return !error;
}

