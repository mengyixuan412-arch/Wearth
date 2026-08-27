import { NextResponse } from "next/server";

import { askAboutReport } from "@/lib/ai/chat";
import type { ChatContext, ChatTurn } from "@/lib/chat";

/**
 * **Vercel 默认只给 10 秒,不够。** 本地跑得好好的三条链路上线后会齐刷刷 504:
 * 抠图实测约 10 秒（阿里云 `...Advance` 要先向 openplatform 取一次上传凭证），
 * 视觉识别十几秒。表现是「一直转圈然后失败」,而本地复现不出来。
 *
 * 60 秒和 `lib/ai/client.ts` 的 `TIMEOUT_MS` 对齐 —— 两边不一致的话,
 * 先到期的那一边说了算,另一边的超时处理永远走不到。
 */
export const maxDuration = 60;

/**
 * 报告追问。**永远返回 200** —— 和另外三条路由同一个约定：
 * 「模型没答上来」和「网络断了」对用户是同一件事，都退回规则匹配那套答案。
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      context?: ChatContext;
      history?: ChatTurn[];
    };

    if (!body.question?.trim() || !body.context) {
      return NextResponse.json({ ok: false, reason: "unreadable" });
    }

    return NextResponse.json(
      await askAboutReport(body.question, body.context, body.history ?? []),
    );
  } catch {
    return NextResponse.json({ ok: false, reason: "network" });
  }
}
