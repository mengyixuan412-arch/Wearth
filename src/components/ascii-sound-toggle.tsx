"use client";

import { useEffect, useRef, useState } from "react";

import ScrambleText from "@/components/scramble-text";
import { useShellMedia } from "@/providers/shell-media-provider";

const SPINNER = ["|", "/", "-", "\\"];

type Props = {
  startDelayMs?: number;
  scrambleColors?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

export function ASCIISoundToggle({
  onClick,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  className,
  startDelayMs = 600,
  scrambleColors = true,
  ...rest
}: Props) {
  const { soundEnabled, setSoundEnabled } = useShellMedia();
  const [interacted, setInteracted] = useState(false);
  const [frame, setFrame] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    setRestartKey((value) => value + 1);
  }, [soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => setFrame((value) => (value + 1) % SPINNER.length), 130);
    return () => window.clearInterval(id);
  }, [soundEnabled]);

  const glyph = soundEnabled ? SPINNER[frame] : "·";
  const delay = interacted ? 100 : startDelayMs;

  const toggle = () => {
    setInteracted(true);
    setSoundEnabled(!soundEnabled);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={soundEnabled ? "Sound playing, click to pause" : "Sound paused, click to play"}
      aria-pressed={soundEnabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`inline-flex shrink-0 items-baseline gap-0 ${className ?? ""} normal-case`}
      {...rest}
    >
      <ScrambleText
        key={soundEnabled ? `sound-on-${restartKey}` : `sound-off-${restartKey}`}
        text={`SOUND[${glyph}]`}
        startDelayMs={delay}
        letterDelayMs={80}
        scrambleColors={scrambleColors}
      />
    </span>
  );
}
