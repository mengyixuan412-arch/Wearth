"use client";

import { supabase } from "@/lib/supabase/client";

/**
 * 单行 jsonb 文档的云端读写。`profile` 和 `custom_subs` 两张表形状相同 ——
 * 一个用户一行，整份内容塞在 `data` 里，整取整存。
 *
 * **为什么不拆列**：档案有二十来个可选字段，自建品类是一张变长的映射表。
 * 拆成列的话，加一个字段就要改表加迁移；而这两份东西从来没有「只更新其中一项」
 * 的读写模式，永远是整份覆盖。
 */

type DocTable = "profile" | "custom_subs";

/**
 * 读一份。**`null` 同时表示「读不到」和「还没有这一行」** ——
 * 调用方两种情况的处理是一样的：退回本地那份。
 */
export async function loadDoc<T>(table: DocTable, userId: string): Promise<T | null> {
  const client = supabase();
  if (!client) return null;

  const { data, error } = await client
    .from(table)
    .select("data")
    .eq("user_id", userId)
    // 没有行时 `single()` 会当成错误，`maybeSingle()` 给 null
    .maybeSingle();

  if (error || !data) return null;
  return (data as { data: T }).data;
}

export async function saveDoc<T>(table: DocTable, userId: string, doc: T): Promise<boolean> {
  const client = supabase();
  if (!client) return true;

  const { error } = await client
    .from(table)
    .upsert({ user_id: userId, data: doc, updated_at: new Date().toISOString() });
  return !error;
}
