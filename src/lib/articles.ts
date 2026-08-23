import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

export type ArticleFrontmatter = {
  title: string;
  date: string;
  subtitle?: string;
};

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

export async function listArticleSlugs() {
  const entries = await fs.readdir(CONTENT_DIR);
  return entries.filter((name) => name.endsWith(".mdx")).map((name) => name.replace(/\.mdx$/, ""));
}

export async function readArticle(slug: string) {
  if (!/^[a-z0-9_-]+$/i.test(slug)) return null;
  const file = path.join(CONTENT_DIR, `${slug}.mdx`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const { content, data } = matter(raw);
    return { content, frontmatter: data as ArticleFrontmatter };
  } catch {
    return null;
  }
}
