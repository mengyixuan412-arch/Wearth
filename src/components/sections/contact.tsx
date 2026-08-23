"use client";

import Link from "next/link";
import { forwardRef } from "react";

import ScrambleText from "@/components/scramble-text";

export const CONTACT_SECTION_ID = "contact";

const HEADLINE_CLASS =
  "gap-2 grid grid-cols-12 font-bold text-[7.2svw] lg:text-[6svw] 2xl:text-[5svw] xl:text-[5.6svw] uppercase leading-none";

const FOOTER_LINK_CLASS =
  "block before:absolute relative before:inset-0 p-2 lg:hover:before:border-l1 before:border-2 before:border-transparent active:before:border-l1 before:border-dotted uppercase before:content-[''] before:transition-colors before:duration-200 cursor-pointer pointer-events-auto before:pointer-events-none";

const SOCIALS = [
  { href: "https://twitter.com/wenhaoqi", label: "Twitter/X" },
  { href: "https://www.figma.com/@wenhaoqi", label: "Figma" },
  { href: "https://github.com/wenhaoqiasd", label: "GitHub" },
];

const Contact = forwardRef<HTMLElement>(function Contact(_props, ref) {
  return (
    <footer
      id={CONTACT_SECTION_ID}
      ref={ref}
      className="z-10 relative flex flex-col justify-center p-6 lg:p-16 w-full h-dvh lg:h-screen pointer-events-none"
    >
      <div className={HEADLINE_CLASS} style={{ fontVariationSettings: '"wdth" 120' }}>
        <ScrambleText
          text="Let's"
          className="col-span-6 md:col-span-5 xl:col-span-4 md:col-start-2 xl:col-start-3 text-left pointer-events-auto"
          startDelayMs={300}
        />
        <ScrambleText
          text="Create"
          className="col-span-6 md:col-span-5 xl:col-span-4 text-right pointer-events-auto"
          startDelayMs={300}
          reverse
        />
      </div>
      <div className={HEADLINE_CLASS} style={{ fontVariationSettings: '"wdth" 120' }}>
        <ScrambleText
          text="Something"
          className="col-span-12 md:col-start-2 xl:col-start-3 text-left pointer-events-auto"
          startDelayMs={300}
        />
      </div>
      <div className={HEADLINE_CLASS} style={{ fontVariationSettings: '"wdth" 120' }}>
        <ScrambleText
          text="Extraordinary"
          className="col-span-12 md:col-end-12 xl:col-end-11 text-right pointer-events-auto"
          startDelayMs={300}
          reverse
        />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end px-4 lg:px-14 py-18 lg:py-24 font-mono-2 text-sm lg:text-base">
        <div className="flex lg:flex-row flex-col justify-between w-full">
          <Link className={FOOTER_LINK_CLASS} href="mailto:curiosity.wen@gmail.com">
            <ScrambleText text="curiosity.wen@gmail.com" startDelayMs={300} />
          </Link>
          <div className="flex flex-row items-center gap-2 lg:gap-4">
            {SOCIALS.map(({ href, label }) => (
              <Link key={href} className={FOOTER_LINK_CLASS} href={href} target="_blank" rel="noopener noreferrer">
                <ScrambleText text={label} startDelayMs={300} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
});

export default Contact;
