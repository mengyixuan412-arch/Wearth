import PagePlaceholder from "@/components/page-placeholder";

/**
 * 地址不存在。**不是报错** —— 没有任何东西坏掉，只是这个地址下没有内容，
 * 所以文案里不出现「失败」「错误」，也不给「重试」（重试同一个地址还是找不到）。
 *
 * 不接管这一页的话，Next 会渲染它自带的英文系统页（`This page could not be found`）：
 * 没有页头、没有导航、字体和配色也全不是这一套 —— 用户输错一个字就掉出产品之外。
 */
export default function NotFound() {
  return (
    <PagePlaceholder
      zh="未找到该页面"
      en="404 · Not Found"
      note="该地址下没有内容，可能是链接已失效或地址有误。可通过上方导航前往任一模块。"
    />
  );
}
