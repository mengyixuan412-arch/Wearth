import { prefillFromPhoto } from "@/lib/ai/prefill";

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
 * 单品照片 → 录入表单的预填值。
 *
 * **这一层只做转发，规则都在 `lib/ai/prefill.ts`**（ARCHITECTURE.md §2：
 * 业务逻辑只写在 `lib/`）。它存在的唯一理由是 key 不能进前端（§5 ③）。
 *
 * 一律返回 200 —— 失败对调用方不是异常，是「这次没读到，走手填」（§5 ②）。
 * 用 HTTP 状态码报失败的话，前端还得去分辨「网络断了」和「模型没读出来」，
 * 而这两件事的处理是同一种：把表单留空给用户自己填。
 */
export async function POST(request: Request) {
  let image: unknown;
  try {
    ({ image } = (await request.json()) as { image?: unknown });
  } catch {
    return Response.json({ ok: false, reason: "unreadable" });
  }

  // 只收 dataURL。站内的图都过 `lib/image.ts` 的 downscaleImage()，
  // 长边 900px 的 JPEG，约 29KB —— 远在 DeepSeek 单张 32MiB 的上限之内。
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ ok: false, reason: "unreadable" });
  }

  return Response.json(await prefillFromPhoto(image));
}
