"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const SOUND_STORAGE_KEY = "sound";

type ShellMediaContextValue = {
  fontsReady: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
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

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function ShellMediaProvider({ children }: { children: React.ReactNode }) {
  const [fontsReady, setFontsReady] = useState(false);
  const [bgmReady, setBgmReady] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored === "off") setSoundEnabledState(false);
    else if (stored === "on") setSoundEnabledState(true);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    loadFonts()
      .then((ok) => setFontsReady(!!ok))
      .catch((error) => {
        console.warn("Failed to load fonts:", error);
        setFontsReady(false);
      });
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    setBgmReady(false);

    const controller = new AbortController();
    let objectUrl: string | null = null;
    let audio: HTMLAudioElement | null = null;

    fetch("/bgm.mp3", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        audio.loop = true;
        audio.volume = 0.35;
        audioRef.current = audio;
        setBgmReady(true);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.warn("Failed to load BGM:", error);
      });

    return () => {
      controller.abort();
      if (audioRef.current === audio) audioRef.current = null;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mounted]);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (event.key.toLowerCase() === "s") setSoundEnabled(!soundEnabledRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, setSoundEnabled]);

  useEffect(() => {
    if (!mounted || !bgmReady) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (!soundEnabled) {
      audio.pause();
      return;
    }

    const play = () => {
      audio.play().catch(() => {});
    };
    play();

    const onPointerDown = () => {
      play();
      document.removeEventListener("pointerdown", onPointerDown);
    };
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mounted, bgmReady, soundEnabled]);

  return (
    <ShellMediaContext.Provider value={{ fontsReady, soundEnabled, setSoundEnabled }}>
      {children}
    </ShellMediaContext.Provider>
  );
}
