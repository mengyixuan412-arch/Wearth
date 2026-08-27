"use client";

import { supabase } from "@/lib/supabase/client";
import type { Decision } from "@/lib/decision-store";
import type { Candidate, ScoreResult } from "@/lib/scoring";

/**
 * 决策记录的云端读写。
 *
 * `candidate` 与 `result` 是**当时那一次评分的值拷贝**（ARCHITECTURE.md §7），
 * 整份存进 jsonb —— 拆列会诱使人事后「补算」某个维度，而历史评分一旦能被
 * 重算就失去了存档的意义。
 */

type Row = {
  id: string;
  at: string;
  name: string;
  photo: string | null;
  candidate: Candidate;
  result: ScoreResult;
};

const toRow = (entry: Decision, userId: string) => ({
  user_id: userId,
  id: entry.id,
  at: entry.at,
  name: entry.name ?? "",
  photo: entry.photo,
  candidate: entry.candidate,
  result: entry.result,
});

/** 拉全部记录，最近一条在前 —— 和本地那份的顺序一致。 */
export async function loadDecisions(userId: string): Promise<Decision[] | null> {
  const client = supabase();
  if (!client) return null;

  const { data, error } = await client
    .from("decisions")
    .select("*")
    .eq("user_id", userId)
    // id 是 `Date.now()`，同一天内也能分出先后
    .order("at", { ascending: false })
    .order("id", { ascending: false });

  if (error || !data) return null;
  return (data as Row[]).map((row) => ({
    id: row.id,
    at: row.at,
    name: row.name ?? "",
    photo: row.photo,
    candidate: row.candidate,
    result: row.result,
  }));
}

export async function saveDecisions(userId: string, entries: Decision[]): Promise<boolean> {
  const client = supabase();
  if (!client || entries.length === 0) return true;

  const { error } = await client.from("decisions").upsert(entries.map((e) => toRow(e, userId)));
  return !error;
}

export async function deleteDecision(userId: string, id: string): Promise<boolean> {
  const client = supabase();
  if (!client) return true;

  const { error } = await client.from("decisions").delete().eq("user_id", userId).eq("id", id);
  return !error;
}
