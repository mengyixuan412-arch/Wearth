import "server-only";

import type { AiResult } from "@/lib/ai/types";

/**
 * DeepSeek 视觉调用的薄适配层。**只在服务端跑**（顶上的 `server-only` 保证
 * 误引进客户端组件时构建直接失败）—— key 不得进前端（ARCHITECTURE.md §5 ③）。
 *
 * **不装 SDK，直接 fetch。** 三个能力用的是同一个端点、同一种请求形状，
 * 二十行就写完了；换供应商时要改的也只有这一个文件，依赖越少越好换。
 */

const MODEL = "deepseek-v4-flash-vision-exp";

/**
 * **只有这一个模型接受图片**，别的传图直接 400（官方文档原话）。
 * 型号带 `-exp`，是实验版，可能变、可能下线 —— 换的时候记得回来改这里和下面的注释。
 */

/**
 * 给足余量。这个模型带思维链，`reasoning_tokens` 实测在 49–261 之间波动五倍，
 * 而它和正文共用 `max_tokens` —— 给小了会把 JSON 从中间截断，
 * 拿到半句合法不了的字符串（实测踩过）。
 */
const MAX_TOKENS = 3000;

/** 单次调用的超时。实测一次约 7 秒，留三倍余量给大图和排队。 */
const TIMEOUT_MS = 60_000;

type Message = {
  role: "user";
  content: ({ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string })[];
};

/**
 * 发一次「看图 → 回 JSON」的请求，返回解析后的对象。
 *
 * JSON mode（`response_format: json_object`）**只保证是合法 JSON，不保证结构**——
 * DeepSeek 没有 JSON Schema。所以字段校验和枚举归并全部由调用方负责，
 * 这里只管拿到一个能 parse 的对象。
 *
 * @param images 已经是 dataURL（`data:image/jpeg;base64,...`）。站内的图都经过
 *               `lib/image.ts` 的 `downscaleImage()` 压到长边 900px 的 JPEG，
 *               远在单张 32MiB 的上限之内。
 */
export async function askVision(
  images: string[],
  prompt: string,
): Promise<AiResult<Record<string, unknown>>> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };

  const base = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  const message: Message = {
    role: "user",
    content: [
      ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
      { type: "text" as const, text: prompt },
    ],
  };

  let raw: string;
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [message],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return { ok: false, reason: "network" };

    const body = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = body.choices?.[0];

    // 顶到 max_tokens 说明 JSON 被截断了，剩下的半句 parse 不出来也不该 parse。
    if (choice?.finish_reason === "length") return { ok: false, reason: "unreadable" };

    // JSON mode 的已知毛病：偶尔返回空内容（官方文档写明「优化中」）。
    raw = choice?.message?.content?.trim() ?? "";
    if (!raw) return { ok: false, reason: "unreadable" };
  } catch {
    // 超时、断网、DNS —— 对调用方是同一件事：这次没读到，走手填。
    return { ok: false, reason: "network" };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason: "unreadable" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}

/** 追问的回答上限。**比识别那三条小得多** —— 那边要吐完整 JSON，这边是两三句话。
 *  给大了模型会写小作文，而追问接在报告正文下方，长回答会把报告顶出屏幕。 */
const CHAT_MAX_TOKENS = 500;

/**
 * 多轮纯文本。**和 `askVision` 分开，不是同一件事**：
 * 那边要 JSON mode（结构化字段），这边要散文，套上 JSON mode 只会得到
 * `{"answer":"..."}` 这种多一层壳的东西。
 *
 * @param system 角色与边界。**边界不能只写在这里** —— 提示词是软约束，
 *               「不给购买结论」这类硬规则要在代码里再挡一道（见 `lib/chat.ts`）。
 */
export async function askText(
  system: string,
  turns: { role: "user" | "assistant"; text: string }[],
): Promise<AiResult<string>> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { ok: false, reason: "unconfigured" };

  const base = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) return { ok: false, reason: "network" };

    const body = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    // 截断的半句话比没有更糟 —— 用户会当成完整回答读
    if (!text || body.choices?.[0]?.finish_reason === "length") {
      return { ok: false, reason: "unreadable" };
    }
    return { ok: true, value: text };
  } catch {
    return { ok: false, reason: "network" };
  }
}
