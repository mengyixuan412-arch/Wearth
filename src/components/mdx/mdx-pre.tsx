"use client";

import { Highlight, type PrismTheme } from "prism-react-renderer";
import { useCallback, useState } from "react";

import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";

/** Prism theme wired to the site's `--code-*` tokens so it follows light/dark. */
const CODE_THEME: PrismTheme = {
  plain: { color: "var(--label-1)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--code-comment)", fontStyle: "italic" } },
    { types: ["string", "char", "attr-value", "regex"], style: { color: "var(--code-string)" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "var(--code-number)" } },
    { types: ["keyword", "atrule", "important"], style: { color: "var(--code-keyword)" } },
    { types: ["function", "class-name", "maybe-class-name"], style: { color: "var(--code-function)" } },
    { types: ["tag", "selector", "deleted"], style: { color: "var(--code-tag)" } },
    { types: ["operator", "punctuation", "entity", "url"], style: { color: "var(--code-operator)" } },
  ],
};

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  js: "JavaScript",
  jsx: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  typescript: "TypeScript",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  glsl: "GLSL",
  python: "Python",
  swift: "Swift",
};

type PreProps = React.HTMLAttributes<HTMLPreElement> & {
  children?: React.ReactElement<{ className?: string; children?: string }>;
};

export function MdxPre({ children }: PreProps) {
  const codeProps = children?.props ?? {};
  const language = (codeProps.className ?? "").replace(/^language-/, "") || "text";
  const code = String(codeProps.children ?? "").replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard is best-effort */
    }
  }, [code]);

  return (
    <div className="group my-6 overflow-hidden rounded-xl bg-[rgba(var(--label-d),0.03)]">
      <div className="flex items-center justify-between px-3 py-2 shadow-[inset_0_-1px_0_0_var(--line)] lg:px-4">
        <span className="px-1 font-mono text-xs tracking-wide text-(--label-3)">
          {LANGUAGE_LABELS[language] ?? language}
        </span>
        <button
          type="button"
          className={`${DOTTED_BORDER_BASE} cursor-pointer px-1 py-0.5 font-mono text-xs uppercase tracking-wide text-(--label-2) transition-colors lg:hover:text-(--label-1) focus-visible:text-(--label-1) focus-visible:outline-none focus-visible:before:border-l1`}
          aria-label="Copy code"
          onClick={copy}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <Highlight theme={CODE_THEME} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`overflow-x-auto px-4 py-2 font-mono text-xs leading-relaxed text-(--label-1) lg:px-5 lg:py-2.5 lg:text-sm ${className ?? ""}`}
          >
            <code className={`language-${language}`}>
              {tokens.map((line, index) => {
                const lineProps = getLineProps({ line });
                return (
                  <div key={index} {...lineProps} className="gap-4 grid grid-cols-[auto_1fr]" style={style}>
                    <span aria-hidden="true" className="select-none text-right tabular-nums text-(--label-4)">
                      {index + 1}
                    </span>
                    <span>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/** Styled download pill used for asset links inside articles. */
export function DownloadButton({
  href,
  fileName,
  children,
}: {
  href: string;
  fileName?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      download={fileName}
      className="flex justify-center items-center bg-line lg:[@media(hover:hover)]:hover:bg-l3 my-6 px-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-b1 w-full min-w-0 h-[52px] font-sans font-medium text-l1 text-sm no-underline transition-[background-color,color] duration-300 ease-66 shrink-0"
    >
      <p>{children}</p>
    </a>
  );
}
