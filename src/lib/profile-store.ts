"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

function read(): Profile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    // 逐字段合并而不是整体替换：以后加字段时，旧档案不会因为缺键而崩。
    return { ...EMPTY_PROFILE, ...parsed, styles: Array.isArray(parsed.styles) ? parsed.styles : [] };
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
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setProfile(read());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      setSaveState("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 1600);
    } catch {
      // 配额超了基本只可能是照片太大 —— 上传时已经压过，这里只如实报错。
      setSaveState("error");
    }
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [profile, hydrated]);

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
