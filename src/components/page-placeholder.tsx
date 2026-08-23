import DottedLink from "@/components/dotted-link";
import SiteHeader from "@/components/site-header";

/** Route shell for modules that are still to be built. */
export default function PagePlaceholder({ zh, en, note }: { zh: string; en: string; note: string }) {
  return (
    <div className="fixed inset-0 flex flex-col justify-between px-4 lg:px-14 py-4 lg:py-7">
      <SiteHeader />

      <div className="flex flex-col gap-3 p-2">
        <p className="font-mono-2 text-l3 text-xs lg:text-sm uppercase tracking-wide">{en}</p>
        <h1
          className="font-sans font-medium text-l1 text-[8svw] lg:text-6xl leading-none"
          style={{ fontVariationSettings: '"wdth" 110' }}
        >
          {zh}
        </h1>
        <p className="text-l2 text-sm lg:text-base">{note}</p>
      </div>

      <div className="p-2">
        <DottedLink href="/" dotted className="inline-block p-2 font-mono-2 text-l2 text-xs lg:text-sm uppercase">
          ← 返回首页
        </DottedLink>
      </div>
    </div>
  );
}
