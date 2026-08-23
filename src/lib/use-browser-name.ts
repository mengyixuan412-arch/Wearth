"use client";

import { useEffect, useState } from "react";

type Brand = { brand: string; version: string };

const pick = (brands: Brand[], pattern: RegExp) => brands.find(({ brand }) => pattern.test(brand))?.brand ?? null;

export function useBrowserName() {
  const [name, setName] = useState("Unknown");

  useEffect(() => {
    const brands = (navigator as Navigator & { userAgentData?: { brands?: Brand[] } }).userAgentData?.brands ?? [];
    const resolved =
      pick(brands, /Arc/i) ??
      pick(brands, /Edge/i) ??
      pick(brands, /Opera|OPR/i) ??
      pick(brands, /Firefox/i) ??
      pick(brands, /Chrome/i) ??
      (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? "Safari" : null) ??
      (/firefox/i.test(navigator.userAgent) ? "Firefox" : null) ??
      "Unknown";
    setName(resolved);
  }, []);

  return name;
}
