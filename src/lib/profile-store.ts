"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadDoc, saveDoc } from "@/lib/supabase/docs";
import { useSession } from "@/lib/supabase/session";

/** 云端写入的防抖窗口。档案是逐字段敲进去的，不防抖等于每个字符一次请求。 */
const CLOUD_DEBOUNCE_MS = 700;

const STORAGE_KEY = "wearth:profile";

/**
 * 个人档案。数值一律存字符串 —— 输入框要允许「空」和「正在输入的半截数字」，
 * 存 number 会在每次按键时把 "" 变成 NaN。取用时再 Number()。
 */
export type Profile = {
  photo: string | null;
  age: string;
  city: string;
  monthlyBudget: string;
  styles: string[];
  skinTone: string;
  height: string;
  weight: string;
  shoulder: string;
  bust: string;
  waist: string;
  hip: string;
  thigh: string;
  calf: string;
  shoe: string;
};

export const EMPTY_PROFILE: Profile = {
  photo: null,
  age: "",
  city: "",
  monthlyBudget: "",
  styles: [],
  skinTone: "",
  height: "",
  weight: "",
  shoulder: "",
  bust: "",
  waist: "",
  hip: "",
  thigh: "",
  calf: "",
  shoe: "",
};

/**
 * 逐字段合并而不是整体替换：以后加字段时，旧档案不会因为缺键而崩。
 * 本地与云端两份都要过这里 —— 两边都可能是旧版本写下的。
 */
const normalise = (parsed: Partial<Profile>): Profile => ({
  ...EMPTY_PROFILE,
  ...parsed,
  styles: Array.isArray(parsed.styles) ? parsed.styles : [],
});

function read(): Profile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE;
    return normalise(JSON.parse(raw) as Partial<Profile>);
  } catch {
    return EMPTY_PROFILE;
  }
}

export type SaveState = "idle" | "saved" | "error";

/**
 * 读写 localStorage 的档案。首帧一律返回空档案，挂载后再灌入真实值 ——
 * 服务端没有 localStorage，首帧就读会造成 hydration 不匹配。
 */
export function useProfile() {
  const { ready, userId } = useSession();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 当前该往哪儿写。同 `useWardrobe`：闭包捕获的 `userId` 会停在挂载那一刻。 */
  const target = useRef<string | null>(null);
  target.current = userId;

  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 防抖窗口里还没推上去的那一份。用户在窗口内离开页面时靠它补交。 */
  const unsent = useRef<Profile | null>(null);

  /** 读。**登录读云端，未登录读本地。** */
  useEffect(() => {
    // 会话没恢复完就读，登录用户会先闪一次本机档案
    if (!ready) return;

    let alive = true;
    const run = async () => {
      if (userId) {
        const cloud = await loadDoc<Partial<Profile>>("profile", userId);
        if (!alive) return;
        // 云上还没有这一行（第一次登录）就先用本机那份，
        // 用户下一次编辑会把它整份推上去 —— 档案因此不用手动迁移
        setProfile(cloud ? normalise(cloud) : read());
      } else {
        setProfile(read());
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
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 1600);
    };

    if (uid) {
      unsent.current = profile;
      if (cloudTimer.current) clearTimeout(cloudTimer.current);
      cloudTimer.current = setTimeout(() => {
        const doc = unsent.current;
        unsent.current = null;
        if (doc) void saveDoc("profile", uid, doc).then(done);
      }, CLOUD_DEBOUNCE_MS);
      return () => {
        if (cloudTimer.current) clearTimeout(cloudTimer.current);
      };
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      done(true);
    } catch {
      // 配额超了基本只可能是照片太大 —— 上传时已经压过，这里只如实报错。
      setSaveState("error");
    }
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [profile, hydrated]);

  /**
   * 卸载时补交。**没有这一段，防抖窗口内切走页面就会丢掉最后一次输入** ——
   * 而档案页最后一个字段填完随手就走，恰恰是最容易撞上的路径。
   */
  useEffect(
    () => () => {
      const uid = target.current;
      if (uid && unsent.current) void saveDoc("profile", uid, unsent.current);
    },
    [],
  );

  const setField = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }, []);

  const toggleStyle = useCallback((value: string) => {
    setProfile((current) => ({
      ...current,
      styles: current.styles.includes(value)
        ? current.styles.filter((item) => item !== value)
        : [...current.styles, value],
    }));
  }, []);

  return { profile, hydrated, saveState, setField, toggleStyle };
}

/** 已填字段数 / 总字段数，用于「档案完成度」读数。 */
export function completeness(profile: Profile) {
  const keys: (keyof Profile)[] = [
    "photo", "age", "city", "monthlyBudget", "skinTone",
    "height", "weight", "shoulder", "bust", "waist", "hip", "thigh", "calf", "shoe",
  ];
  const filled = keys.filter((key) => {
    const value = profile[key];
    return typeof value === "string" ? value.trim() !== "" : value != null;
  }).length;
  const total = keys.length + 1; // 风格偏好算一项
  return { filled: filled + (profile.styles.length > 0 ? 1 : 0), total };
}
