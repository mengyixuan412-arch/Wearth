import "server-only";

import { Readable } from "node:stream";

import Imageseg, { SegmentCommodityAdvanceRequest } from "@alicloud/imageseg20191230";
import { Config } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";

import type { AiResult } from "@/lib/ai/types";

/**
 * ④ 抠图：单品照片 → 透明底 PNG 的 dataURL。
 *
 * 走**阿里云视觉智能开放平台的「商品分割」**，不是通用显著性分割。这个区别是决定性的：
 * 通用分割找的是「画面里显眼的东西」，实测会把衣架、手、页面上的按钮一起抠出来；
 * 商品分割的训练目标就是「商品主体」，那些本来就该被当背景丢掉。
 *
 * 浏览器端方案（`@imgly/background-removal`，WASM）实测放弃了：单张推理 6.8 秒
 * （桌面，手机更久）+ 首次 53.6MB 下载，和 PRD「单件录入 30 秒内」直接冲突。
 *
 * **代价是图片要上传到阿里云。** 这一条改变了产品的隐私口径，档案页那句
 * 「只存在这台设备的浏览器里，不上传」对衣物照片不再成立，文案要跟着改。
 */

/** 商品分割只在上海地域提供。 */
const ENDPOINT = "imageseg.cn-shanghai.aliyuncs.com";

/**
 * SDK 的超时。**默认只有 3 秒,从国内直连会稳定超时** ——
 * `...Advance` 会先向 `openplatform.aliyuncs.com` 取一次临时上传凭证,
 * 这一跳三秒经常不够,实测报的正是 `ReadTimeout(3000)`。
 * 整条链路（取凭证 → 传图 → 分割）实测约 9 秒,给到 60 秒余量足够。
 */
const SDK_TIMEOUT = { readTimeout: 60_000, connectTimeout: 30_000, autoretry: true, maxAttempts: 2 };

/**
 * 结果链接的下载超时。阿里云返回的是一个 30 分钟有效的临时 URL，
 * 我们当场把它取回来转成 dataURL —— **不把这个链接交给前端**：
 * 它会过期，而衣橱里的图要长期存在 localStorage 里。
 */
const FETCH_TIMEOUT_MS = 30_000;

/** dataURL → Buffer。SDK 要的是可读流，前端给的是 dataURL。 */
function decodeDataUrl(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.startsWith("data:image/")) return null;
  try {
    return Buffer.from(dataUrl.slice(comma + 1), "base64");
  } catch {
    return null;
  }
}

export async function cutoutGarment(image: string): Promise<AiResult<string>> {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) return { ok: false, reason: "unconfigured" };

  const buffer = decodeDataUrl(image);
  if (!buffer) return { ok: false, reason: "unreadable" };

  let resultUrl: string;
  try {
    const client = new Imageseg(new Config({ accessKeyId, accessKeySecret, endpoint: ENDPOINT }));

    /**
     * 用 `...Advance` 而不是普通的 `segmentCommodity`：后者只收公网可访问的
     * `ImageURL`，那意味着我们得先自建一个 OSS 桶、把用户的衣服照片传成公开链接。
     * Advance 版由 SDK 代传到阿里云的临时存储，省掉整个 OSS 环节，
     * 也不会留下一个任何人都能访问的衣服照片 URL。
     */
    const response = await client.segmentCommodityAdvance(
      new SegmentCommodityAdvanceRequest({ imageURLObject: Readable.from(buffer) }),
      new RuntimeOptions(SDK_TIMEOUT),
    );

    const url = response.body?.data?.imageURL;
    if (!url) return { ok: false, reason: "unreadable" };
    resultUrl = url;
  } catch (error) {
    console.error("[cutout] SDK 调用失败:", error);
    // 配额用尽、签名错误、网络不通 —— 对调用方是同一件事：这次没抠成，用原图。
    return { ok: false, reason: "network" };
  }

  try {
    const png = await fetch(resultUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!png.ok) return { ok: false, reason: "network" };
    const bytes = Buffer.from(await png.arrayBuffer());
    return { ok: true, value: `data:image/png;base64,${bytes.toString("base64")}` };
  } catch {
    return { ok: false, reason: "network" };
  }
}
