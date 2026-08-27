"use client";

import { useState } from "react";

import Panel, { META } from "@/components/panel";
import { CELL } from "@/components/form-controls";
import { supabaseEnabled } from "@/lib/supabase/client";
import { pushLocal, readLocalWardrobe } from "@/lib/supabase/migrate";
import { sendMagicLink, signOut, useSession } from "@/lib/supabase/session";

/**
 * 账号与同步。**放在个人档案页，不做登录页**（乙方案）——
 * 登录墙会让第一次来的人在什么都没看到之前就要付出成本，而这个产品的第一目标
 * 是让人在五分钟内看懂 CPW 是怎么回事，不是收集用户。
 *
 * 访客逛衣橱、统计、评分全程碰不到这一节；只有点进档案才看得见，
 * 而那正是主人会去的地方。
 */

const ACTION =
  "font-ui text-[10px] lg:text-xs uppercase border border-line px-2.5 py-1.5 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer disabled:cursor-not-allowed disabled:text-l4 disabled:lg:hover:border-line disabled:lg:hover:text-l4";

export default function AccountPanel({ saveFailed = false }: { saveFailed?: boolean }) {
  const { ready, userId, email } = useSession();
  const [address, setAddress] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // 没配 Supabase 就是纯本地模式，界面上不该出现任何登录入口 ——
  // 给一个点了没反应的按钮，比没有这个按钮更糟。
  if (!supabaseEnabled()) return null;

  const send = async () => {
    setBusy(true);
    const result = await sendMagicLink(address.trim());
    setNotice(result.message);
    setBusy(false);
  };

  const migrate = async () => {
    if (!userId) return;
    setBusy(true);
    // 只传用户自己录的。演示数据留在本机当样例，不上云。
    const { items, days, decisions } = await pushLocal(userId);
    // 分项报数而不是报一个总数：三样东西在不同页面，用户要能对上自己刚才录的
    const parts = [
      items > 0 ? `衣物 ${items} 件` : "",
      days > 0 ? `穿搭 ${days} 天` : "",
      decisions > 0 ? `决策 ${decisions} 条` : "",
    ].filter(Boolean);
    setNotice(
      parts.length === 0
        ? "这台设备暂无可同步的数据"
        : `已同步 ${parts.join("、")}，本地数据仍保留`,
    );
    setBusy(false);
  };

  const local = ready && !userId ? readLocalWardrobe() : null;

  return (
    <Panel
      id="account"
      index="06"
      zh="账号同步"
      en="Account"
      /* 未登录时表头右端不出声 —— 正文第一句就是「你的数据目前仅保存在这台设备」，
         再在标题旁挂一个「本地保存」是同一句话说两遍。
         已登录才报「已同步」：那是状态变了，值得说一次。 */
      meta={userId ? "已同步" : undefined}
      delay={540}
    >
      <div className={CELL}>
        {/* 档案页原来的页脚删掉了，写失败没了报的地方 —— 挪到这里。
            **写失败不能静默**（ARCHITECTURE.md §4 ④）：用户填完一屏围度，
            以为存上了，刷新就没了。 */}
        {saveFailed ? (
          <p className={`${META} mb-2 text-accent normal-case`}>
            保存失败 · 这台设备的浏览器存储空间不足
          </p>
        ) : null}

        {!ready ? (
          <p className={`${META} text-l3`}>正在确认登录状态</p>
        ) : userId ? (
          <>
            {/* 和未登录那支同一个排版：一段话说完当前状态。
                拆成「邮箱 + 小字说明」时下半段像脚注，而这里两句都是状态本身。 */}
            <p className="text-l1 text-xs lg:text-sm leading-relaxed">
              已登录：{email}；衣橱、穿搭与档案已同步至云端，使用同一邮箱登录，即可在任意设备继续使用。
            </p>

            {/* 两个按钮并排，同一档分量。原先「退出登录」是无框弱化文字、
                甩到最右 —— 一行里只剩两个控件时，那种拉开反而显得空。 */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3">
              <button type="button" onClick={() => void migrate()} disabled={busy} className={ACTION}>
                同步本机数据
              </button>
              <button type="button" onClick={() => void signOut()} disabled={busy} className={ACTION}>
                退出登录
              </button>
            </div>
          </>
        ) : (
          <>
            {/* **说清楚现在的数据在哪**，而不是「登录以保存」—— 不登录也是保存的，
                只是存在这台设备上。前者是事实，后者会让人以为不登录就会丢。 */}
            {/* 合成一段。拆成两段时下半段是 META 小字，读起来像脚注 ——
                但「登录能换来什么」恰恰是用户做决定的依据，不该降一档。 */}
            <p className="text-l1 text-xs lg:text-sm leading-relaxed">
              你的数据目前仅保存在这台设备
              {local && local.own.length > 0 ? `，已录入 ${local.own.length} 件衣物` : ""}
              。如果需要将数据保存至云端，请输入邮箱登录您的账号。
              登录后可在手机与电脑间同步，也不再受浏览器本地存储空间限制。
              无需密码。我们会向你的邮箱发送一封登录链接。
            </p>

            <div className="flex flex-wrap items-center gap-2.5 mt-2">
              <input
                type="email"
                aria-label="登录邮箱"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && address.trim()) void send();
                }}
                placeholder="请输入邮箱"
                className="flex-1 bg-transparent px-2.5 py-1.5 border border-line focus:border-accent min-w-40 text-l1 text-xs lg:text-sm transition-colors duration-200 outline-none placeholder:text-l3"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || address.trim() === ""}
                className={ACTION}
              >
                发送登录链接
              </button>
            </div>
          </>
        )}

        {notice ? <p className={`${META} mt-2 text-accent normal-case`}>{notice}</p> : null}
      </div>
    </Panel>
  );
}
