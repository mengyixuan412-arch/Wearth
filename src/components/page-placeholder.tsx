import DottedLink from "@/components/dotted-link";
import SiteHeader from "@/components/site-header";

/**
 * 「这一页没有正常内容」时的整页外壳：找不到、出错、还没建。
 *
 * **是整页不是弹窗。** 弹窗的意思是「背后那一页还在，关掉能接着用」，
 * 而这三种情况背后什么都没有 —— 页面要么没渲染出来，要么根本不存在。
 *
 * 底色走 `--background-1`（米白），不铺内页那块白底板：这里没有表格也没有图表，
 * 用不着为发丝线换冷灰两档。所以描边取 `--line` 而不是 `--frame` —— 那一档本来
 * 就是为米白底调的（§2）。
 */
export default function PagePlaceholder({
  zh,
  en,
  note,
  actions,
}: {
  zh: string;
  en: string;
  note: string;
  /** 「返回首页」左边的额外出口，如「重试」。返回首页永远在，是最后那条退路。 */
  actions?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex flex-col justify-between px-4 lg:px-14 py-4 lg:py-7">
      <SiteHeader title={null} />

      <div className="flex flex-col gap-3 p-2">
        <p className="font-ui text-l3 text-xs lg:text-sm uppercase tracking-wide">{en}</p>
        <h1
          className="font-sans font-medium text-l1 text-[8svw] lg:text-6xl leading-none"
          style={{ fontVariationSettings: '"wdth" 110' }}
        >
          {zh}
        </h1>
        <p className="max-w-prose text-l2 text-sm lg:text-base leading-relaxed">{note}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-2">
        {actions}
        <DottedLink href="/" dotted className="inline-block p-2 font-ui text-l2 text-xs lg:text-sm uppercase">
          ← 返回首页
        </DottedLink>
      </div>
    </div>
  );
}

/**
 * 这两页上的按钮档。**和站内链接分开** —— 链接套点线描边（§5.6），
 * 动作走描边药丸壳那一族，内距取表单里的常规档 `px-2.5 py-1.5`。
 */
export const PLACEHOLDER_ACTION =
  "font-ui text-[10px] lg:text-xs uppercase border border-line px-2.5 py-1.5 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer";
