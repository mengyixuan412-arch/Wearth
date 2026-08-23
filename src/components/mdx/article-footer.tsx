"use client";

import DottedLink from "@/components/dotted-link";
import ScrambleText from "@/components/scramble-text";
import { CONTACT_SECTION_ID } from "@/components/sections/contact";
import { SELECTED_WORK_SECTION_ID } from "@/components/sections/selected-work";
import { PENDING_SCROLL_ANCHOR_SESSION_KEY } from "@/components/header";
import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";
import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";

const LINK_CLASS = `${DOTTED_BORDER_BASE} inline-block -mx-1 px-1 py-0.5 text-l2 lg:hover:text-l1 text-sm transition-colors`;

const SOCIALS = [
  { href: "https://twitter.com/wenhaoqi", label: "Twitter/X" },
  { href: "https://github.com/wenhaoqiasd", label: "GitHub" },
  { href: "https://www.figma.com/@wenhaoqi", label: "Figma" },
];

export function ArticleFooter({
  lastUpdated,
  dimensions = "1×1",
  characters = "—",
}: {
  lastUpdated: string;
  dimensions?: string;
  characters?: string;
}) {
  const { startNavigation } = useRouteTransitionController();

  const goHomeAnchor = (anchor: string) => {
    sessionStorage.setItem(PENDING_SCROLL_ANCHOR_SESSION_KEY, anchor);
    startNavigation("/");
  };

  return (
    <footer data-mdx-footer="true" className="bg-[rgba(var(--label-d),0.03)] mt-16 p-4 lg:p-6 rounded-xl">
      <div className="mb-5 font-sans font-semibold text-l1 text-base">Metadata</div>
      <dl className="gap-x-6 gap-y-6 grid grid-cols-2 lg:grid-cols-3">
        {[
          { term: "Last Updated", value: lastUpdated },
          { term: "Dimensions", value: dimensions },
          { term: "Characters", value: characters },
        ].map(({ term, value }) => (
          <div key={term} className="flex flex-col gap-1.5">
            <dt className="font-sans font-semibold text-l1 text-sm">{term}</dt>
            <dd>
              <ScrambleText className="font-mono tabular-nums text-l2 text-sm" text={value} />
            </dd>
          </div>
        ))}
      </dl>

      <div className="my-6 border-line border-t border-dashed" />

      <div className="gap-x-6 gap-y-4 grid grid-cols-2 lg:grid-cols-3">
        <div className="hidden lg:block font-sans font-semibold text-l1 text-sm">Links</div>
        <div className="flex flex-col items-start gap-1 font-mono">
          <DottedLink href="/" className={LINK_CLASS}>
            <ScrambleText text="Home" />
          </DottedLink>
          <button
            type="button"
            className={`${LINK_CLASS} text-left cursor-pointer`}
            onClick={() => goHomeAnchor(`#${SELECTED_WORK_SECTION_ID}`)}
          >
            <ScrambleText text="Work" />
          </button>
          <button
            type="button"
            className={`${LINK_CLASS} text-left cursor-pointer`}
            onClick={() => goHomeAnchor(`#${CONTACT_SECTION_ID}`)}
          >
            <ScrambleText text="Contact" />
          </button>
        </div>
        <div className="flex flex-col items-start gap-1 font-mono">
          {SOCIALS.map(({ href, label }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
              <ScrambleText text={label} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
