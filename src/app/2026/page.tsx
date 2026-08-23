import { redirect } from "next/navigation";

import { ArticleFooter } from "@/components/mdx/article-footer";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { MdxArticle } from "@/components/mdx/mdx-article";
import { buildPasscodeUnlockHref } from "@/data/work-items";
import { readArticle } from "@/lib/articles";
import { readPasscodeAccess } from "@/lib/passcode-server";
import { MDXRemote } from "next-mdx-remote/rsc";

export const dynamic = "force-dynamic";

const SCOPE = "/2026";

export default async function GatedPage() {
  const access = await readPasscodeAccess();
  if (!access[SCOPE]) redirect(buildPasscodeUnlockHref(SCOPE, SCOPE));

  const article = await readArticle("2026");
  if (!article) {
    return (
      <MdxArticle title="2026" date="" subtitle="">
        <p>This entry has no content file yet — add `src/content/2026.mdx`.</p>
      </MdxArticle>
    );
  }

  return (
    <MdxArticle
      title={article.frontmatter.title}
      date={article.frontmatter.date}
      subtitle={article.frontmatter.subtitle}
    >
      <MDXRemote source={article.content} components={mdxComponents} />
      <ArticleFooter lastUpdated={article.frontmatter.date} />
    </MdxArticle>
  );
}
