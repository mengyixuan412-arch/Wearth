import { normalizePath, revealBrandLabel, workHrefToPath } from "@/lib/passcode";

export { workHrefToPath };

export type WorkItem = {
  name: string;
  imageUrl: string;
  hoverImageUrl?: string;
  href: string;
  year: string;
  type: "post" | "tools" | "event";
  gridClass?: string;
  codingProject?: boolean;
  passcodeProtected?: boolean;
};

export const WORK_ITEMS: WorkItem[] = [
  {
    name: revealBrandLabel(),
    imageUrl: "/work/tt01.png",
    hoverImageUrl: "/work/tt02.png",
    href: "/2026",
    year: "2022-2026",
    type: "post",
    gridClass: "col-span-12 lg:col-span-8 lg:col-start-3",
    passcodeProtected: true,
  },
  {
    name: "Reunimos™",
    imageUrl: "/work/reunimos01.png",
    hoverImageUrl: "/work/reunimos02.png",
    href: "/reunimos",
    year: "2024-2026",
    type: "post",
    gridClass: "col-span-12 lg:col-span-8 lg:col-start-5",
    codingProject: true,
  },
  {
    name: "Inspire Mono",
    imageUrl: "/work/inspire_mono_01.png",
    hoverImageUrl: "/work/inspire_mono_02.png",
    href: "/inspire_mono",
    year: "2025",
    gridClass: "col-span-12 lg:col-start-1 lg:col-span-6 xl:col-span-5",
    type: "post",
    codingProject: true,
  },
  {
    name: "Wasm design utils",
    imageUrl: "/work/wasm01.png",
    hoverImageUrl: "/work/wasm02.png",
    href: "/wasm_design_utils",
    year: "2025",
    gridClass: "col-span-12 lg:col-span-6 xl:col-span-5 lg:col-start-7 xl:col-start-7",
    type: "post",
    codingProject: true,
  },
  {
    name: "VectorSymbols",
    imageUrl: "/work/vs01.png",
    hoverImageUrl: "/work/vs02.png",
    href: "https://www.figma.com/community/plugin/1255914175202017737/vectorsymbols",
    year: "2023",
    gridClass: "col-span-6 lg:col-start-5 lg:col-span-4 xl:col-start-6 xl:col-span-3",
    type: "tools",
    codingProject: true,
  },
  {
    name: "DarkSide",
    imageUrl: "/work/ds01.png",
    hoverImageUrl: "/work/ds02.png",
    href: "https://www.figma.com/community/plugin/986289377230504703/darkside",
    year: "2021",
    gridClass: "col-span-6 lg:col-start-9 lg:col-span-4 xl:col-start-10 xl:col-span-3",
    type: "tools",
    codingProject: true,
  },
  {
    name: "aDrive 阿里云盘",
    imageUrl: "/work/ali01.png",
    hoverImageUrl: "/work/ali02.png",
    href: "/adrive",
    year: "2020-2022",
    gridClass: "col-span-12 lg:col-start-1 lg:col-span-4 xl:col-start-1 xl:col-span-3",
    type: "post",
  },
  {
    name: "Shore Icon",
    imageUrl: "/work/si.png",
    hoverImageUrl: "/work/si02.png",
    href: "/shore_icon",
    year: "2022",
    gridClass: "col-span-6 lg:col-start-5 lg:col-span-4 xl:col-start-5 xl:col-span-3",
    type: "post",
  },
  {
    name: "Teambition",
    imageUrl: "/work/c4.png",
    href: "/teambition",
    year: "2018-2020",
    gridClass: "col-span-6 lg:col-start-9 lg:col-span-4 xl:col-start-9 xl:col-span-3",
    type: "post",
  },
  {
    name: "FoF: See Hear Touch",
    imageUrl: "/work/s01.png",
    hoverImageUrl: "/work/s02.png",
    href: "https://friends.figma.com/events/details/figma-shanghai-presents-see-hear-touch/",
    year: "2022",
    gridClass: "col-span-6 lg:col-start-5 lg:col-span-4 xl:col-start-6 xl:col-span-3",
    type: "event",
  },
  {
    name: "FoF: Design System",
    imageUrl: "/work/sd01.png",
    hoverImageUrl: "/work/sd02.png",
    href: "https://friends.figma.com/events/details/figma-shanghai-presents-design-system/",
    year: "2021",
    gridClass: "col-span-6 lg:col-start-9 lg:col-span-4 xl:col-start-10 xl:col-span-3",
    type: "event",
  },
];

const PASSCODE_PATHS = WORK_ITEMS.flatMap((item) => {
  if (!item.passcodeProtected) return [];
  const path = workHrefToPath(item.href);
  return path ? [path] : [];
});

export const primaryPasscodePath = () => PASSCODE_PATHS[0] ?? "/2026";

export const isPasscodeProtectedPath = (value: string) => PASSCODE_PATHS.includes(normalizePath(value));

export const emptyPasscodeAccessState = (): Record<string, boolean> =>
  Object.fromEntries(PASSCODE_PATHS.map((path) => [path, false]));

export const buildPasscodeUnlockHref = (scope: string, returnTo?: string | null) => {
  const target = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/unlock/${encodeURIComponent(normalizePath(scope).slice(1) || "_")}?return=${encodeURIComponent(target)}`;
};
