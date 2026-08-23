"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { emptyPasscodeAccessState, isPasscodeProtectedPath, workHrefToPath } from "@/data/work-items";

export type PasscodeAccessState = Record<string, boolean>;

const PASSCODE_ACCESS_EVENT = "passcode-access-changed";

async function readAccess(): Promise<PasscodeAccessState> {
  const res = await fetch("/api/passcode", { cache: "no-store" });
  return res.ok ? ((await res.json()) as PasscodeAccessState) : emptyPasscodeAccessState();
}

function postAccess(body: unknown) {
  return fetch("/api/passcode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type Store = {
  snapshot: PasscodeAccessState;
  listeners: Set<() => void>;
  refresh: () => Promise<void>;
};

const PasscodeAccessContext = createContext<Store | null>(null);

export function PasscodeAccessProvider({
  initialAccess,
  children,
}: {
  initialAccess: PasscodeAccessState;
  children: React.ReactNode;
}) {
  const storeRef = useRef<Store | null>(null);

  if (!storeRef.current) {
    const store: Store = {
      snapshot: initialAccess,
      listeners: new Set(),
      async refresh() {
        const next = await readAccess();
        const same =
          Object.keys(next).length === Object.keys(store.snapshot).length &&
          Object.keys(next).every((key) => next[key] === store.snapshot[key]);
        if (same) return;
        store.snapshot = next;
        store.listeners.forEach((listener) => listener());
      },
    };
    storeRef.current = store;
  }

  useEffect(() => {
    const store = storeRef.current!;
    const onChange = () => void store.refresh();
    window.addEventListener(PASSCODE_ACCESS_EVENT, onChange);
    return () => window.removeEventListener(PASSCODE_ACCESS_EVENT, onChange);
  }, []);

  return <PasscodeAccessContext.Provider value={storeRef.current}>{children}</PasscodeAccessContext.Provider>;
}

export const notifyPasscodeAccessChanged = () => {
  window.dispatchEvent(new CustomEvent(PASSCODE_ACCESS_EVENT));
};

export const submitPasscodeUnlock = (scope: string, code: string) => postAccess({ scope, code });

export async function logoutPasscodeAccess(options?: { reload?: boolean }) {
  const res = await postAccess({ action: "logout" });
  if (!res.ok) return false;
  if (options?.reload) window.location.reload();
  else notifyPasscodeAccessChanged();
  return true;
}

export function usePasscodeAccessLookup() {
  const store = useContext(PasscodeAccessContext);
  const fallback = useMemo(() => emptyPasscodeAccessState(), []);

  const snapshot = useSyncExternalStore(
    (listener) => {
      if (!store) return () => {};
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    () => store?.snapshot ?? fallback,
    () => store?.snapshot ?? fallback,
  );

  return useCallback(
    (href: string) => {
      const path = workHrefToPath(href) ?? href;
      if (!isPasscodeProtectedPath(path)) return true;
      return snapshot[path] ?? false;
    },
    [snapshot],
  );
}

export const usePasscodeAllowed = (href: string) => usePasscodeAccessLookup()(href);
