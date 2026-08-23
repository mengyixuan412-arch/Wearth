"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ShellMediaContextValue = {
  fontsReady: boolean;
};

const ShellMediaContext = createContext<ShellMediaContextValue | undefined>(undefined);

export function useShellMedia() {
  const ctx = useContext(ShellMediaContext);
  if (!ctx) throw new Error("useShellMedia must be used within ShellMediaProvider");
  return ctx;
}

async function loadFonts() {
  try {
    const origin = window.location.origin.split("#")[0];

    const tiktok = new FontFace("tiktok", `url(${origin}/fonts/TikTokSans.ttf)`, {
      display: "block",
      weight: "100 900",
    });
    await tiktok.load();
    document.fonts.add(tiktok);

    const mono = new FontFace("mono", `url(${origin}/fonts/GeistMono[wght].ttf)`, {
      display: "block",
      weight: "100 900",
    });
    await mono.load();
    document.fonts.add(mono);

    const tronica = new FontFace("tronica-mono", `url(${origin}/fonts/DepartureMono-Regular.otf)`, {
      display: "block",
      weight: "400",
    });
    await tronica.load();
    document.fonts.add(tronica);

    return true;
  } catch (error) {
    console.warn("Failed to load fonts:", error);
    return false;
  }
}

export function ShellMediaProvider({ children }: { children: React.ReactNode }) {
  const [fontsReady, setFontsReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    loadFonts()
      .then((ok) => setFontsReady(!!ok))
      .catch((error) => {
        console.warn("Failed to load fonts:", error);
        setFontsReady(false);
      });
  }, [mounted]);

  return (
    <ShellMediaContext.Provider value={{ fontsReady }}>
      {children}
    </ShellMediaContext.Provider>
  );
}
