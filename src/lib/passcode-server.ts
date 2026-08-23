import { cookies } from "next/headers";

import { emptyPasscodeAccessState, isPasscodeProtectedPath } from "@/data/work-items";
import type { PasscodeAccessState } from "@/providers/passcode-access-provider";

export const PASSCODE_COOKIE = "hq_passcode";

/**
 * The passcode itself never ships to the client. Set `PASSCODE_CODE` (and optionally
 * `PASSCODE_SCOPES`, comma separated) in the environment.
 */
const expectedCode = () => process.env.PASSCODE_CODE ?? "";

const grantedScopes = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

export async function readPasscodeAccess(): Promise<PasscodeAccessState> {
  const state = emptyPasscodeAccessState();
  const store = await cookies();
  const granted = grantedScopes(store.get(PASSCODE_COOKIE)?.value);
  for (const scope of granted) {
    if (isPasscodeProtectedPath(scope)) state[scope] = true;
  }
  return state;
}

export function verifyPasscode(code: string) {
  const expected = expectedCode();
  if (!expected) return false;
  if (code.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= code.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}
