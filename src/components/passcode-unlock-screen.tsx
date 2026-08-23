"use client";

import { motion, useAnimationControls } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { isPasscodeProtectedPath } from "@/data/work-items";
import { PASSCODE, sanitizePasscodeReturnTo, scopeToPath } from "@/lib/passcode";
import {
  notifyPasscodeAccessChanged,
  submitPasscodeUnlock,
  usePasscodeAllowed,
} from "@/providers/passcode-access-provider";
import { useRouteTransitionController } from "@/providers/fullscreen-transition-provider";

export function PasscodeUnlockScreen({ scope, returnTo }: { scope: string; returnTo?: string }) {
  const path = scopeToPath(scope);
  const isProtected = isPasscodeProtectedPath(path);
  const destination = sanitizePasscodeReturnTo(returnTo) ?? path;
  const allowed = usePasscodeAllowed(path);

  const router = useRouter();
  const { startNavigation } = useRouteTransitionController();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const shake = useAnimationControls();

  const slotCount = PASSCODE.slotCount;
  const inputId = `passcode-${scope}`;

  useEffect(() => {
    if (!isProtected) return;
    if (allowed) {
      router.refresh();
      startNavigation(destination, { replace: true });
      return;
    }
    inputRef.current?.focus();
  }, [destination, isProtected, allowed, router, startNavigation]);

  if (!isProtected) return null;

  const onChange = async (next: string) => {
    if (!isProtected || status === "success") return;
    const trimmed = next.slice(0, slotCount);
    setValue(trimmed);
    if (trimmed.length !== slotCount) return;

    const response = await submitPasscodeUnlock(scope, trimmed);
    if (!response.ok) {
      await shake.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.5, ease: "easeInOut" } });
      setValue("");
      inputRef.current?.focus();
      return;
    }

    notifyPasscodeAccessChanged();
    setStatus("success");
    window.setTimeout(() => {
      router.refresh();
      startNavigation(destination, { replace: true });
    }, 600);
  };

  return (
    <main
      className="z-1000 fixed inset-0 flex justify-center items-center bg-b1"
      onClick={() => inputRef.current?.focus()}
    >
      <label className="sr-only" htmlFor={inputId}>
        Passcode for {path}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => void onChange(event.target.value)}
        className="absolute opacity-0 w-px h-px"
      />
      <div className="relative" aria-hidden="true">
        <span
          className={`-top-10 left-1/2 absolute font-mono text-sm whitespace-nowrap -translate-x-1/2 select-none transition-colors ${
            status === "success" ? "text-l1" : "text-l3"
          }`}
        >
          {status === "success" ? "Access granted" : "Please enter passcode"}
        </span>
        <motion.div className="flex gap-3" animate={shake}>
          {Array.from({ length: slotCount }).map((_, index) => {
            const filled = index < value.length;
            const active = index === value.length;
            return (
              <div
                key={index}
                className="flex justify-center items-center rounded-full w-12 h-12 font-mono tabular-nums text-l1 text-lg transition-shadow duration-300 ease-66"
                style={{ boxShadow: `inset 0 0 0 4px ${filled || active ? "var(--label-1)" : "var(--label-3)"}` }}
              >
                {filled ? value[index] : active ? <span className="block bg-l1 w-px h-5 caret-blink" aria-hidden="true" /> : null}
              </div>
            );
          })}
        </motion.div>
      </div>
    </main>
  );
}
