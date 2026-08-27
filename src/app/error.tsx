"use client";

import { useEffect, useState } from "react";

import PagePlaceholder, { PLACEHOLDER_ACTION } from "@/components/page-placeholder";

/** 本地数据的键前缀。两种写法都用过（`wearth:` 与 `wearth.`），按前缀扫更保险。 */
const PREFIX = "wearth";

/**
 * 页面渲染时抛异常的兜底（React error boundary，Next 按约定接在这条路由上）。
 * 不接管的话整页是白的 —— 用户连「回主页」都点不到。
 *
 * **两个出口是分开的，因为病因有两种：**
 *
 * - 代码的偶发问题 → 「重试」（`reset()` 重挂这条路由）就够了。
 * - **本地数据坏了** → 重试多少次都是同一个异常。这个应用所有数据都在 localStorage，
 *   手动改过、或者存量数据结构变了，都会让页面每次渲染都炸在同一处。
 *   这时唯一的出路是清掉本地数据，所以那颗按钮必须在这一页上，不能只写在文档里。
 *
 * 清数据是不可逆的，走两步确认 —— 和单品详情的「删除这件」同一套做法。
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // 开发时要能在控制台看见真正的堆栈，界面上那句话是给用户的，不是给排查用的。
  useEffect(() => {
    console.error("页面渲染失败：", error);
  }, [error]);

  const wipe = () => {
    try {
      const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(PREFIX));
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      /* 读不到 localStorage 就没什么可清的，照样重载 */
    }
    // 不走 reset()：清完要的是一次彻底的重新开始，各个 store 都得重新读一遍盘。
    window.location.href = "/";
  };

  return (
    <PagePlaceholder
      zh="此页面无法正常显示"
      en="Error"
      note={
        confirming
          ? "清空后，衣橱、穿搭日志、个人档案与决策记录将全部恢复初始状态，且无法撤销。仅在反复重试均停留在此页面时才需执行。"
          : "请先尝试重新加载。若反复停留在此页面，通常是本地数据已损坏 —— 本应用的全部数据均存储于你的浏览器中，清空后即可重新开始。"
      }
      actions={
        confirming ? (
          <>
            <button type="button" onClick={wipe} className={PLACEHOLDER_ACTION}>
              确认清空
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={PLACEHOLDER_ACTION}>
              取消
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={reset} className={PLACEHOLDER_ACTION}>
              重试
            </button>
            <button type="button" onClick={() => setConfirming(true)} className={PLACEHOLDER_ACTION}>
              清空本地数据
            </button>
          </>
        )
      }
    />
  );
}
