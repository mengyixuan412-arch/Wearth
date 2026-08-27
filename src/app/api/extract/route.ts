import { readCareLabel, readListing } from "@/lib/ai/extract";

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
 * 截图提取。**一条路由两种用途**，用 `kind` 区分：
 *
 * - `label` —— 水洗标 → 材质成分（录入弹窗用）
 * - `listing` —— 商品详情页截图 → 价格 / 材质 / 尺码表（购买评分用）
 *
 * 合成一条是因为两者只有提示词不同，出入参形状、失败处理、校验路数完全一样；
 * 拆两条会把同一套错误处理抄两遍。
 *
 * 规则都在 `lib/ai/extract.ts`（§2：业务逻辑只写在 `lib/`）。
 * 一律返回 200 —— 失败对调用方不是异常，是「这次没读到，走手填」（§5 ②）。
 */

/** 详情页最多认几张。再多不是读不动，是一次请求塞太多图会慢到用户以为卡死。 */
const MAX_IMAGES = 4;

const fail = () => Response.json({ ok: false, reason: "unreadable" });

export async function POST(request: Request) {
  let payload: { kind?: unknown; images?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return fail();
  }

  const { kind, images } = payload;
  if (kind !== "label" && kind !== "listing") return fail();

  // 只收 dataURL。站内的图都过 `lib/image.ts` 的 downscaleImage()，
  // 长边 900px 的 JPEG —— 远在 DeepSeek 单张 32MiB 的上限之内。
  if (!Array.isArray(images)) return fail();
  const shots = images.filter(
    (entry): entry is string => typeof entry === "string" && entry.startsWith("data:image/"),
  );
  if (shots.length === 0) return fail();

  // 水洗标只认一张 —— 它读的是一件衣服的成分表，多张只会让模型把两件衣服的混在一起。
  if (kind === "label") return Response.json(await readCareLabel(shots[0]));
  return Response.json(await readListing(shots.slice(0, MAX_IMAGES)));
}
