"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 录入已经改成衣橱页上的弹窗，这条路由只留作入口：
 * 带着 `?new=1` 跳回衣橱，落地即开弹窗。首页那颗粉色按钮和旧书签都走这里。
 */
export default function NewItemRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/wardrobe?new=1");
  }, [router]);

  return null;
}
