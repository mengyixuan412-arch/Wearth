"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 浏览器端 Supabase 客户端。**单例** —— 每个 store 各建一个的话，
 * 会各自持有一份会话监听，登录状态在页面间对不上。
 *
 * 用的是 **publishable key（旧称 anon key）**，它本来就会打进前端包，
 * 公开的。真正拦住别人读数据的是 RLS —— 五张表的策略都只认
 * `auth.uid() = user_id`（见 `supabase/schema.sql`）。
 *
 * **没配环境变量时返回 `null` 而不是抛错。** 这个应用要在「没接 Supabase」
 * 的状态下照常跑：访客看种子数据、可操作、不落库（乙方案）。
 * 构造函数一炸，整站白屏 —— 而云端存储只是一个可选的增强。
 */

let cached: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  cached =
    url && key
      ? createClient(url, key, {
          auth: {
            // 会话存在 localStorage，刷新页面不用重新登录
            persistSession: true,
            autoRefreshToken: true,
            // 魔法链接回跳时 URL 上带着 token，SDK 自己接住
            detectSessionInUrl: true,
          },
        })
      : null;
  return cached;
}

/** 配没配 Supabase。没配就是纯本地模式，界面上不该出现任何登录入口。 */
export const supabaseEnabled = () => supabase() !== null;
