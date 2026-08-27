"use client";

import { META } from "@/components/panel";

/**
 * 写失败的提示条。**平时一个字都不出,只在 `error` 时出现**。
 *
 * 常驻一行「本地保存」是噪音——用户每天看它一百遍,而它一百遍都在说同一句
 * 没有信息量的话。但**写失败不能静默**（ARCHITECTURE §4 ④）：
 * 用户录完一件衣服、填完一屏围度,以为存上了,刷新就没了。
 *
 * 两种失败对用户是两句不同的话：本地是「腾空间」,云端是「等会儿再试」。
 */
export default function SaveAlert({
  state,
  where = "local",
}: {
  state: "idle" | "saved" | "error";
  /** `local` = localStorage 配额；`cloud` = 云端写入。 */
  where?: "local" | "cloud";
}) {
  if (state !== "error") return null;

  return (
    <p className={`${META} text-accent normal-case`} role="status">
      {where === "cloud"
        ? "同步失败 · 改动仅保存在本设备，恢复网络后重新编辑即可上传"
        : "保存失败 · 本设备浏览器存储空间不足"}
    </p>
  );
}
