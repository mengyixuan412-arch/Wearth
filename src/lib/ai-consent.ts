"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 照片外发前的一次性确认。
 *
 * **为什么是一次性，不是每次勾选**：外发的是平铺的单品照和电商截图，
 * 不含人像。为一张衣服照片设一道复选框，摩擦全在用户身上，拦不住任何风险。
 * 《个人信息保护法》第 23 条要的是**单独同意** —— 单独，不是重复。
 *
 * **为什么不是一行灰字**：一行提示等于没说。用户按下上传的那一刻才会关心
 * 照片去哪，那时候拦一次，比在档案页第二屏写一段有用得多。
 *
 * 撤回入口不做：用户随时可以不点识别，全部手填的路径一直开着。
 */

const KEY = "wearth.aiConsent.v1";

/**
 * 直接读盘，不看 state。
 *
 * 页面上同时存在**几个互相独立的实例**（水洗标一个、上传照片一个、购买评分一个），
 * 各持一份 state。只看自己那份的话，用户在水洗标那儿点过同意，
 * 转头传照片又会被问一遍 —— 而他刚刚才答应过。
 */
function stored(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "granted";
  } catch {
    return false;
  }
}

export function useAiConsent() {
  const [granted, setGranted] = useState(false);
  const [asking, setAsking] = useState(false);
  /** 等用户点头才跑的那件事。 */
  const pending = useRef<(() => void) | null>(null);

  // 服务端没有 localStorage，首帧就读会造成 hydration 不匹配
  useEffect(() => {
    setGranted(stored());
  }, []);

  /**
   * 把要外发照片的动作包一层。同意过就直接跑，没同意过就先问。
   *
   * **同一次上传可能同时触发识别和抠图**（两个并行跑），这时只弹一次：
   * 第二个动作进来时 `asking` 已经是 true，会并进同一个 pending。
   */
  const guard = useCallback(
    (action: () => void) => {
      if (granted || stored()) {
        action();
        return;
      }
      const queued = pending.current;
      pending.current = queued
        ? () => {
            queued();
            action();
          }
        : action;
      setAsking(true);
    },
    [granted],
  );

  const accept = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, "granted");
    } catch {
      /* 存不下只是下次还会问一遍，不影响这一次 */
    }
    setGranted(true);
    setAsking(false);
    const run = pending.current;
    pending.current = null;
    run?.();
  }, []);

  /**
   * 手动填写。**只跳过这一次，不记成永久设置** ——
   * 「这张我自己填」和「以后都别识别」是两个决定，不该由同一次点击代办。
   */
  const decline = useCallback(() => {
    pending.current = null;
    setAsking(false);
  }, []);

  return { asking, guard, accept, decline };
}
