"use client";

import { useEffect, useState } from "react";

import { useWeather } from "@/lib/use-weather";

/** 季节窗口（PRD 附录 C，全国统一）：春 3–5 / 夏 6–8 / 秋 9–11 / 冬 12–2 */
export type Season = "春" | "夏" | "秋" | "冬";

export function seasonOf(date: Date): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function formatDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${WEEKDAYS[date.getDay()]}`;
}

/**
 * Live status line: date, weekday and current temperature. The clock ticks on
 * its own so the day rolls over without a reload; the temperature comes from
 * the weather hook and is appended once it resolves.
 */
export function useStatusLine(intervalMs = 30_000) {
  const [stamp, setStamp] = useState("");
  const weather = useWeather();

  useEffect(() => {
    const tick = () => setStamp(formatDate(new Date()));
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  if (!stamp) return "";
  const temp = weather?.now?.temp;
  return temp != null ? `${stamp} · ${temp}°C` : stamp;
}
