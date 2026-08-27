import { cutoutGarment } from "@/lib/ai/cutout";

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
 * 单品照片 → 透明底 PNG。规则在 `lib/ai/cutout.ts`。
 *
 * 一律返回 200 —— 抠不成不是异常，是「这次用原图」（§5 ②）。
 * 抠图纯粹是视觉效果，不喂任何评分维度，**绝不能因为它失败就挡住录入**。
 */
export async function POST(request: Request) {
  let image: unknown;
  try {
    ({ image } = (await request.json()) as { image?: unknown });
  } catch {
    return Response.json({ ok: false, reason: "unreadable" });
  }

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ ok: false, reason: "unreadable" });
  }

  return Response.json(await cutoutGarment(image));
}
