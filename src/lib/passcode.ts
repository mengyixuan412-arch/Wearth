/** Brand label hidden behind the passcode gate — stored as offset char codes, never as plaintext. */
const BRAND_LABEL_CODES = [85, 106, 108, 85, 112, 108];

export const revealBrandLabel = () =>
  BRAND_LABEL_CODES.map((code) => String.fromCharCode(code - 1)).join("");

export const revealBrandLabelLength = () => BRAND_LABEL_CODES.length;

export const passcodeLockedPlaceholderText = () => "■■■■■■";

export const PASSCODE_LOCKED_CHAR_CLASS =
  "inline-block min-w-[0.62em] text-center text-l1 tabular-nums select-text";

export const PASSCODE_LOCKED_SCRAMBLE_CLASS =
  "inline-flex items-baseline gap-[0.12em] mx-[0.06em] select-text [&>span]:inline-block [&>span]:min-w-[0.62em] [&>span]:text-center [&>span]:tabular-nums";

export const PASSCODE = { slotCount: 4 } as const;

export function workHrefToPath(href: string): string | null {
  if (href.startsWith("http://") || href.startsWith("https://")) return null;
  const trimmed = href.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const normalizePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

export const scopeToPath = (scope: string) => {
  const decoded = decodeURIComponent(scope);
  return decoded.startsWith("/") ? decoded : `/${decoded}`;
};

export const sanitizePasscodeReturnTo = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
};
