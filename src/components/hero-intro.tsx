"use client";

import { useCallback, useMemo, useRef } from "react";

import ScrambleText, { type ScramblePart } from "@/components/scramble-text";
import { buildPasscodeUnlockHref, primaryPasscodePath } from "@/data/work-items";
import {
  PASSCODE_LOCKED_CHAR_CLASS,
  PASSCODE_LOCKED_SCRAMBLE_CLASS,
  passcodeLockedPlaceholderText,
  revealBrandLabel,
  revealBrandLabelLength,
} from "@/lib/passcode";
import { logoutPasscodeAccess, usePasscodeAllowed } from "@/providers/passcode-access-provider";
import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";

const PASSCODE_PATH = primaryPasscodePath();
const BRAND_LABEL = revealBrandLabel();
const BRAND_LABEL_LENGTH = revealBrandLabelLength();

/** Inline chip that hides the employer name until the passcode has been entered. */
function BrandReveal() {
  const allowed = usePasscodeAllowed(PASSCODE_PATH);
  const { startNavigation } = useRouteTransitionController();
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const relock = useCallback(async () => {
    if (window.confirm("Lock protected content again? You will need the passcode to view it.")) {
      await logoutPasscodeAccess({ reload: true });
    }
  }, []);

  if (!allowed) {
    const unlock = () => startNavigation(buildPasscodeUnlockHref(PASSCODE_PATH, "/"));
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label="Protected — enter passcode to reveal"
        className="inline-flex items-baseline gap-[0.12em] mx-[0.06em] align-baseline cursor-pointer select-text"
        onClick={unlock}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            unlock();
          }
        }}
      >
        {passcodeLockedPlaceholderText()
          .split("")
          .map((char, index) => (
            <span key={index} aria-hidden className={PASSCODE_LOCKED_CHAR_CLASS}>
              {char}
            </span>
          ))}
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${BRAND_LABEL} — long press to lock again`}
      className="inline mx-[0.06em] align-baseline cursor-default select-none"
      onPointerDown={() => {
        cancelLongPress();
        longPressRef.current = setTimeout(() => void relock(), 500);
      }}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(event) => {
        event.preventDefault();
        void relock();
      }}
    >
      {BRAND_LABEL}
    </span>
  );
}

export default function HeroIntro({
  className,
  startDelayMs = 300,
  letterDelayMs = 10,
}: {
  className?: string;
  startDelayMs?: number;
  letterDelayMs?: number;
}) {
  const allowed = usePasscodeAllowed(PASSCODE_PATH);

  const parts = useMemo<ScramblePart[]>(
    () => [
      "I'm Haoqi Wen, leading Design Engineering and AI exploration at ",
      {
        length: BRAND_LABEL_LENGTH,
        scramble: allowed ? BRAND_LABEL : passcodeLockedPlaceholderText(),
        className: allowed ? undefined : PASSCODE_LOCKED_SCRAMBLE_CLASS,
        settled: <BrandReveal />,
      },
      ", engineering, and AI at scale. Outside work, I build design tools for team efficiency.",
    ],
    [allowed],
  );

  return <ScrambleText className={className} parts={parts} startDelayMs={startDelayMs} letterDelayMs={letterDelayMs} />;
}
