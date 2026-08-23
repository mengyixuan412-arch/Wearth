"use client";

import { useEffect, useState } from "react";

export type WeatherNow = { now?: { temp?: string } };

const QWEATHER_URL =
  "https://devapi.qweather.com/v7/weather/now?location=101020100&key=c6e1eaf8bbac4c9f91b50e630e9ad750";

const fetchWeather = async (): Promise<WeatherNow | undefined> => {
  try {
    const res = await fetch(QWEATHER_URL);
    if (!res.ok) return undefined;
    return (await res.json()) as WeatherNow;
  } catch {
    return undefined;
  }
};

export function useWeather() {
  const [weather, setWeather] = useState<WeatherNow | undefined>(undefined);
  useEffect(() => {
    fetchWeather().then(setWeather);
  }, []);
  return weather;
}
