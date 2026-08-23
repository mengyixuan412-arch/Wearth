import { Children, isValidElement, type ReactNode } from "react";

const PROSE_CLASS =
  "space-y-4 [&_p]:text-sm [&_p]:text-l1 [&_p]:leading-relaxed lg:[&_p]:text-base [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-0 [&_ul]:space-y-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-0 [&_ol]:space-y-0 [&_li]:text-l1 [&_li]:leading-relaxed [&_li::marker]:text-[var(--selection-bg)] [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--selection-bg)] [&_blockquote]:pl-4 [&_blockquote]:text-l2 [&_blockquote_p]:text-l2 [&_blockquote_li]:text-l2 [&_blockquote_strong]:text-l2 [&_blockquote_em]:text-l2 [&_blockquote_a]:!text-l2 [&_blockquote_a]:underline [&_blockquote_a]:underline-offset-4 [&_blockquote_a]:decoration-[color:var(--label-3)] [&_blockquote_a]:transition-colors [&_blockquote_a]:lg:hover:!text-l1 [&_blockquote_a]:lg:hover:decoration-[color:var(--label-2)] [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-[rgba(var(--label-d),0.08)] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:text-l1 [&_hr]:my-8 [&_hr]:h-px [&_hr]:w-full [&_hr]:border-0 [&_hr]:bg-line [&_u]:no-underline [&_u]:pb-[6px] [&_u]:[box-decoration-break:clone] [&_u]:[-webkit-box-decoration-break:clone] [&_u]:[background-image:radial-gradient(circle_at_center,var(--color-l2)_0.65px,transparent_0.7px)] [&_u]:[background-size:5px_3px] [&_u]:[background-repeat:repeat-x] [&_u]:[background-position:left_bottom]";

const PARAGRAPH_GROUP_CLASS =
  "[&_p+p]:mt-3 [&_p]:mb-0 text-l2 [&_p]:text-l2! text-sm lg:text-base leading-relaxed";

/** Runs of consecutive paragraphs share a tighter, muted block. */
function groupParagraphs(children: ReactNode) {
  const output: ReactNode[] = [];
  let run: ReactNode[] = [];
  let key = 0;

  const flush = () => {
    if (run.length === 0) return;
    output.push(
      <div key={`pgroup-${key++}`} className={PARAGRAPH_GROUP_CLASS}>
        {run}
      </div>,
    );
    run = [];
  };

  Children.forEach(children, (child) => {
    const isParagraph =
      isValidElement(child) &&
      (child.type === "p" || (typeof child.type === "function" && (child.type as { name?: string }).name === "p"));
    if (isParagraph) run.push(child);
    else {
      flush();
      output.push(child);
    }
  });

  flush();
  return output;
}

export function MdxArticle({
  title,
  date,
  subtitle,
  children,
}: {
  title: string;
  date: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <article data-mdx-article="true" className="mx-auto px-6 py-18 lg:py-24 w-full max-w-[880px] text-l1">
      <div className={PROSE_CLASS}>
        <header className="pt-[10vh]">
          <h1
            className="font-bold text-3xl! text-l1 lg:text-5xl! leading-tight tracking-tight"
            style={{ fontVariationSettings: '"wdth" 120' }}
          >
            {title}
          </h1>
          <p className="mt-1 tabular-nums text-l2! text-sm! lg:text-base! leading-relaxed">{date}</p>
          <div className="mt-2 border-line border-b" />
          {subtitle ? (
            <p className="pt-3 text-l2! text-sm! lg:text-base! leading-relaxed">{subtitle}</p>
          ) : null}
        </header>
        {groupParagraphs(children)}
      </div>
    </article>
  );
}
