import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { ArticleFooter } from "@/components/mdx/article-footer";
import { mdxComponents } from "@/components/mdx/mdx-components";
import { MdxArticle } from "@/components/mdx/mdx-article";
import { listArticleSlugs, readArticle } from "@/lib/articles";

export async function generateStaticParams() {
  const slugs = await listArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await readArticle(slug);
  if (!article) return {};
  return { title: `${article.frontmatter.title} — HAOQI©2026` };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await readArticle(slug);
  if (!article) notFound();

  const { content, frontmatter } = article;

  return (
    <MdxArticle title={frontmatter.title} date={frontmatter.date} subtitle={frontmatter.subtitle}>
      <MDXRemote source={content} components={mdxComponents} />
      <ArticleFooter lastUpdated={frontmatter.date} />
    </MdxArticle>
  );
}
