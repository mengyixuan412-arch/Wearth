"use client";

import { supabase } from "@/lib/supabase/client";
import type { OotdMap, OotdRecord } from "@/lib/ootd-store";

/**
 * 穿搭记录的云端读写。一天一行，主键 `(user_id, day)`。
 *
 * **按天写，不整份覆盖。** 一条记录带全身照，压缩后仍有几十 KB；
 * 改一天的备注就把三百天连照片重传一遍，是几十 MB 的事。
 */

type Row = {
  day: string;
  photo: string | null;
  note: string;
  items: string[];
  voice: string | null;
  voice_sec: number | null;
};

const toRow = (day: string, record: OotdRecord, userId: string) => ({
  user_id: userId,
  day,
  photo: record.photo,
  note: record.note,
  items: record.items ?? [],
  voice: record.voice ?? null,
  // 没录音时存 null 而不是 0 —— 0 秒是个有效时长，会让「录过但极短」和
  // 「没录过」分不开
  voice_sec: record.voice ? (record.voiceSec ?? 0) : null,
});

/** 拉这个用户的全部穿搭。读不到返回 `null`，由调用方退回本地。 */
export async function loadOotd(userId: string): Promise<OotdMap | null> {
  const client = supabase();
  if (!client) return null;

  const { data, error } = await client.from("ootd").select("*").eq("user_id", userId);
  if (error || !data) return null;

  const map: OotdMap = {};
  for (const row of data as Row[]) {
    map[row.day] = {
      photo: row.photo,
      note: row.note ?? "",
      items: row.items ?? [],
      voice: row.voice,
      voiceSec: row.voice_sec ?? 0,
    };
  }
  return map;
}

/** 写若干天。 */
export async function saveDays(userId: string, days: [string, OotdRecord][]): Promise<boolean> {
  const client = supabase();
  if (!client || days.length === 0) return true;

  const { error } = await client
    .from("ootd")
    .upsert(days.map(([day, record]) => toRow(day, record, userId)));
  return !error;
}

export async function deleteDays(userId: string, days: string[]): Promise<boolean> {
  const client = supabase();
  if (!client || days.length === 0) return true;

  const { error } = await client.from("ootd").delete().eq("user_id", userId).in("day", days);
  return !error;
}
