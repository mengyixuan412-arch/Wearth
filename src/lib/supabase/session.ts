"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

/**
 * 登录状态。**这是全站「访客还是本人」的唯一判据**（乙方案）：
 *
 * - 未登录 → 五个 store 走种子数据，可操作、不落库。面试官点开链接
 *   立刻看到一个装满衣服的完整产品，不用注册
 * - 已登录 → 走 Supabase，跨设备同步
 *
 * `ready` 和 `userId` 要分开：SDK 恢复会话是异步的，首帧一定是「还不知道」。
 * 拿 `userId === null` 当「未登录」会让已登录用户在刷新后闪一下访客态的种子数据 ——
 * 而那些种子数据看起来就像他的真实衣橱被替换了。
 */
export type Session = {
  /** 会话恢复完了没有。没完之前不要根据 `userId` 做任何判断。 */
  ready: boolean;
  userId: string | null;
  email: string | null;
};

export function useSession(): Session {
  const [session, setSession] = useState<Session>({ ready: false, userId: null, email: null });

  useEffect(() => {
    const client = supabase();
    if (!client) {
      // 没配 Supabase：纯本地模式，直接判定为「已就绪且未登录」
      setSession({ ready: true, userId: null, email: null });
      return;
    }

    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession({
        ready: true,
        userId: data.session?.user.id ?? null,
        email: data.session?.user.email ?? null,
      });
    });

    // 登录 / 登出 / token 刷新都会走这里
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession({
        ready: true,
        userId: next?.user.id ?? null,
        email: next?.user.email ?? null,
      });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}

/** 发一封魔法链接。不用密码 —— 少一个要用户记的东西，也少一处能泄露的东西。 */
export async function sendMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
  const client = supabase();
  if (!client) return { ok: false, message: "这台机器没配云端存储" };

  const { error } = await client.auth.signInWithOtp({
    email,
    // 回跳到当前站点。魔法链接里带着 token，`detectSessionInUrl` 会接住。
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) {
    // 限流是免费项目最常见的失败（自带发信服务每小时只有几封），
    // 单独说清楚 —— 否则用户会以为是邮箱填错了，反复重试只会更快撞限流。
    return {
      ok: false,
      message: error.status === 429 ? "发送过于频繁，请稍后再试" : "发送失败，请检查邮箱地址",
    };
  }
  return { ok: true, message: "链接已发送，点击邮箱即可查收登录" };
}

export async function signOut() {
  await supabase()?.auth.signOut();
}
