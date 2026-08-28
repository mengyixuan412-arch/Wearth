import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },

  /**
   * 容器化部署时才打包成 standalone。
   *
   * **用环境变量开关，不无条件打开** —— Vercel 有自己的构建流程，
   * 无条件设了虽然也能跑，但会多出一份没人用的 `.next/standalone`，
   * 而且一旦哪天 Vercel 的行为变了，问题会出在一个「本来就不需要」的开关上。
   *
   * Docker 构建时设 `DOCKER_BUILD=1` 即可。
   */
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
};

export default nextConfig;
