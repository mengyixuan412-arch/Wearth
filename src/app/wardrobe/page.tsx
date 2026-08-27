"use client";

import { useEffect, useMemo, useState } from "react";

import FilterSelect from "@/components/filter-select";
import { BrandIcon, ColorIcon, SearchIcon, SeasonIcon, StatusIcon } from "@/components/filter-icons";
import ItemDrawer from "@/components/item-drawer";
import { META as PANEL_META } from "@/components/panel";
import NewItemDialog from "@/components/new-item-dialog";
import SaveAlert from "@/components/save-alert";
import SiteHeader from "@/components/site-header";
import AddCategoryDialog from "@/components/add-category-dialog";
import AddMenu from "@/components/add-menu";
import SortMenu from "@/components/sort-menu";
import {
  CATEGORIES,
  COLOR_FAMILIES,
  SEASONS,
  STATUSES,
  cpw,
  formatCpw,
  useWardrobe,
  type Category,
  type Item,
} from "@/lib/wardrobe";
import { FRAME, HERO_GAP, RULE_STRONG } from "@/lib/layout";

/**
 * 发丝线体系的框线。和「衣橱统计」「穿搭日志」取同一个值 ——
 * 全站令牌 `--line` 是暖灰 10%，为米白底调的，白底会把它冲得几乎看不见。
 */

/** 拉丁小字与编号的粉。#D53F7D 是粉色阶梯里唯一够当正文读的一档（对比度 4:1）。 */
const PINK_INK = "#D53F7D";

/** 衣橱的小字要对齐数字（单次成本、穿着次数），在共用档上追加 tabular-nums。 */
const META = `${PANEL_META} tabular-nums`;

/**
 * 一件单品一格。**格子之间共用边线，不留缝** —— 参考稿的陈列就是一张连续的表，
 * 分隔全靠 1px，卡与卡之间没有间距也没有圆角。这样单品图彼此对齐成行列，
 * 视觉重量落在衣服本身，而不是一堆漂浮的白卡片上。
 *
 * 三段式：编号 / 二级品类 在上，图居中，名称与单次成本在下。
 * 编号走粉，是这一格里唯一的彩色 —— 图片本身才是有颜色的东西。
 */
function ItemCard({ item, index, onOpen }: { item: Item; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`查看 ${item.name} 的详情`}
      className="group flex flex-col hover:bg-[rgba(20,20,28,0.015)] border-r border-b text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
      style={{ borderColor: FRAME }}
    >
      <div className="flex justify-between items-baseline gap-2 px-2.5 lg:px-3 pt-2 lg:pt-2.5">
        <span className={META} style={{ color: PINK_INK }}>
          {String(index).padStart(2, "0")}
        </span>
        {/* 二级品类做成药丸：它是个**标签**（这件属于哪一类），不是一句读数。
            裸着排在编号对面时，和左边的编号读起来是同一层东西；
            套一圈发丝线之后它归位成「贴在卡上的标签」，编号仍是编号。 */}
        <span
          className={`${META} shrink-0 border border-line rounded-full px-2 py-0.5 text-l2 max-w-[60%] truncate`}
        >
          {item.sub}
        </span>
      </div>

      <div className="flex justify-center items-center px-2 lg:px-3 py-1 w-full aspect-square">
        {/* Cut out from the source photo, so it sits on the card with no box. */}
        <img src={item.image} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
      </div>

      <div className="flex flex-col gap-0.5 px-2.5 lg:px-3 pt-1 pb-2.5 lg:pb-3">
        <p
          className="font-sans font-bold text-l1 text-xs lg:text-sm leading-tight truncate"
          style={{ fontVariationSettings: '"wdth" 110' }}
        >
          {item.name}
        </p>
        <p className={`${META} text-l2 truncate`}>{formatCpw(item)}</p>
      </div>
    </button>
  );
}

/** 季节筛选里的「四季」档。词面与录入弹窗那颗保持一致。 */
const ALL_SEASONS = "四季";

const PER_PAGE = 14; // two rows of seven

/**
 * 季节筛选。「四季」不是第五个季节，而是**季节标签取全集**的那一档
 * （PRD 附录 C：「四季」款 = 全集），所以它要单独判，不能走 includes。
 *
 * 四季款同时也会被「春」「夏」「秋」「冬」筛出来 —— 一件四季都能穿的衣服，
 * 春天当然也在可穿之列，这是对的。
 */
function matchesSeason(item: Item, season: string) {
  if (season === "全部") return true;
  if (season === ALL_SEASONS) return SEASONS.every((entry) => item.seasons.includes(entry));
  return item.seasons.includes(season as (typeof SEASONS)[number]);
}

export default function WardrobePage() {
  const { items, hydrated, saveState, addItem, updateItem, removeItem, addCare, updateCare, removeCare, bumpWears } = useWardrobe();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [active, setActive] = useState<Category | "全部">("全部");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [season, setSeason] = useState("全部");
  const [colorFamily, setColorFamily] = useState("全部");
  const [brand, setBrand] = useState("全部");
  const [status, setStatus] = useState("全部");
  const [sort, setSort] = useState<string>("最新购入");
  const [page, setPage] = useState(1);
  /**
   * 跳转框里正在敲的那个数。**和 `page` 分开存** —— 输入框要允许「空」和
   * 「正在输入的半截数字」，直接绑 `page` 的话每敲一位就跳一次页，
   * 想去第 12 页会先在第 1 页停一下。
   */
  const [jump, setJump] = useState("");

  const brands = useMemo(
    () => Array.from(new Set(items.map((item) => item.brand))).sort(),
    [items],
  );

  const shown = useMemo(() => {
    // Name, brand and sub-category all read as "the thing I am looking for" —
    // 「衬衫」finds every shirt even when no item is named that.
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (item) =>
        (q === "" ||
          `${item.name} ${item.brand} ${item.sub} ${item.category}`.toLowerCase().includes(q)) &&
        (active === "全部" || item.category === active) &&
        matchesSeason(item, season) &&
        (colorFamily === "全部" || item.colorFamily === colorFamily) &&
        (brand === "全部" || item.brand === brand) &&
        (status === "全部" || item.status === status),
    );

    return [...list].sort((a, b) => {
      // Viewing everything at once, group by category first — a flat list of
      // every category interleaved reads as noise. Inside a group the chosen
      // sort still applies. Filtered to one category, there is nothing to group.
      if (active === "全部") {
        const byCategory = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
        if (byCategory !== 0) return byCategory;
      }

      switch (sort) {
        case "最早购入":
          return a.boughtAt.localeCompare(b.boughtAt);
        case "单次成本（高到低）":
        case "单次成本（低到高）": {
          // A never-worn item has no cost per wear at all; park those at the end
          // in both directions rather than letting a missing value read as zero.
          const av = cpw(a);
          const bv = cpw(b);
          if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
          return sort === "单次成本（低到高）" ? av - bv : bv - av;
        }
        case "穿着次数（少到多）":
          return a.wears - b.wears;
        case "穿着次数（多到少）":
          return b.wears - a.wears;
        case "价格（低到高）":
          return a.price - b.price;
        case "价格（高到低）":
          return b.price - a.price;
        default:
          return b.boughtAt.localeCompare(a.boughtAt);
      }
    });
  }, [active, brand, colorFamily, items, query, season, sort, status]);

  // Every category from the taxonomy is offered, not only the ones already
  // filled — an empty one tells you what the wardrobe is missing.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [items]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const paged = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /**
   * 有没有动过筛选。**空态要分两种**：筛出来是 0 件（换个条件就有）和衣橱本身是空的
   * （得先去录入），下一步完全不同，摆同一句话等于什么都没说。
   */
  const filtered =
    active !== "全部" ||
    query.trim() !== "" ||
    season !== "全部" ||
    colorFamily !== "全部" ||
    brand !== "全部" ||
    status !== "全部";

  const clearFilters = () => {
    setActive("全部");
    setQuery("");
    setSeason("全部");
    setColorFamily("全部");
    setBrand("全部");
    setStatus("全部");
  };

  // Any change to what is being shown invalidates the current page number.
  useEffect(() => {
    setPage(1);
    setJump("");
  }, [active, query, season, colorFamily, brand, status, sort]);

  // 首页的录入按钮与 /wardrobe/new 都落到 `?new=1`，到站即开弹窗。
  // 用 location 直接读而不是 useSearchParams —— 后者要求包一层 Suspense，
  // 而这一页本来就是客户端组件，没必要为一个开关引入边界。
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("new")) return;
    setAdding(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <>
      <div className="relative z-10 px-4 lg:px-14 py-4 lg:py-7">
        <SiteHeader title={null} />

        {/* ── 主视觉：标题、编号、副标都画在图里，DOM 不再重复一遍。
             4:1 横幅，按原始画幅铺满 —— 标题在最左、衣架拼贴在最右，
             中间是留白，任何方向的裁切都会丢掉一头。
             图由 tools/build-hero.mjs 从设计稿生成。 ───── */}
        <div className="pt-4 lg:pt-6">
          <img
            src="/img/hero/wardrobe.webp"
            alt="我的衣橱 My Wardrobe —— 每一件，都值得被看见"
            width={2000}
            height={500}
            fetchPriority="high"
            className="block border border-l4 w-full h-auto"
          />
        </div>

        <div
          className={`flex flex-wrap items-center gap-2 lg:gap-3 ${HERO_GAP} pb-2.5 lg:pb-3 border-b`}
          style={{ borderColor: RULE_STRONG }}
        >
          {(["全部", ...CATEGORIES] as const).map((category) => {
            const on = active === category;
            const empty = category !== "全部" && (counts.get(category) ?? 0) === 0;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category)}
                className={`px-3 lg:px-4 py-1.5 rounded-full font-sans font-bold text-xs lg:text-sm transition-colors duration-200 cursor-pointer ${
                  on ? "bg-[rgba(0,0,0,0.07)] text-l1" : empty ? "text-l3" : "text-l2 lg:hover:text-l1"
                }`}
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {category}
              </button>
            );
          })}
          {/* 添加 / 筛选 / 排序 / 搜索，整组贴在分类栏最右。

              **ml-auto 挂在这一组的第一个元素上**（现在是「添加」）—— 它负责把整组
              推到行末。换顺序时必须跟着交到新的第一个手里，否则整组会掉回左边贴着分类 tab。

              「添加」是这四个里唯一实心强调色的：它是这一行中唯一会改变衣橱内容的操作，
              其余三个只改变「怎么看」。 */}
          <div className="ml-auto">
            <AddMenu onAddCategory={() => setAddingCategory(true)} onAddItem={() => setAdding(true)} />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-l1 transition-colors duration-200 cursor-pointer ${
              filtersOpen ? "bg-[rgba(0,0,0,0.07)] border-l1" : "border-line lg:hover:border-l1"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span
              className="font-sans font-bold text-xs lg:text-sm"
              style={{ fontVariationSettings: '"wdth" 110' }}
            >
              筛选
            </span>
          </button>

          <SortMenu value={sort} onChange={setSort} />

          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-line focus-within:border-l1 lg:hover:border-l1 rounded-full text-l1 transition-colors duration-200 cursor-text">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索衣服"
              aria-label="搜索衣服"
              className="bg-transparent w-24 lg:w-36 font-sans font-bold text-l1 placeholder:text-l3 text-xs lg:text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
              style={{ fontVariationSettings: '"wdth" 110' }}
            />
          </label>
        </div>

        {/* One panel holds the whole grid — the items themselves carry no frame. */}
        {filtersOpen ? (
          <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-3">
            <FilterSelect icon={<SeasonIcon />} label="季节" value={season} onChange={setSeason} options={["全部", ...SEASONS, ALL_SEASONS]} />
            <FilterSelect icon={<ColorIcon />} label="色系" value={colorFamily} onChange={setColorFamily} options={["全部", ...COLOR_FAMILIES]} />
            <FilterSelect icon={<BrandIcon />} label="品牌" value={brand} onChange={setBrand} options={["全部", ...brands]} />
            <FilterSelect icon={<StatusIcon />} label="状态" value={status} onChange={setStatus} options={["全部", ...STATUSES]} />
          </div>
        ) : null}

        {/* 平时不占位置，写失败才出现在网格正上方 —— 那是用户刚操作完看的地方。 */}
        <div className="mt-3 empty:mt-0">
          <SaveAlert state={saveState} />
        </div>

        <div className="mt-4 lg:mt-5 mb-16 lg:mb-20">
          {!hydrated ? (
            /* 还没读完盘/云端。**「还没读到」和「确实是空的」不是一回事** ——
               这时候把空态文案铺出去，用户会先被告知衣橱空了，紧接着衣服又冒出来。
               撑住高度，什么都不写，等读完再决定显示哪一支。 */
            <div aria-hidden className="min-h-[22rem]" />
          ) : shown.length === 0 ? (
            /*
              空态。**筛不出东西不是出错**（用户自己选了「冬 + 红 + 已处置」这种组合），
              所以不弹窗、不用红、不加图标 —— 就在网格该出现的位置上写一句话，
              再给一条出路（DESIGN.md §6）。

              两种空分开说：动过筛选的给「清除筛选」，衣橱本身是空的给「去录入」，
              下一步完全不同，摆同一句话等于什么都没说。

              撑到 `min-h-[22rem]`：不撑的话筛掉之后整页会往上塌一大截，
              页脚和分页条一起弹到半屏高度。
            */
            <div
              className="flex flex-col justify-center items-center gap-3 bg-white px-6 border min-h-[22rem] text-center"
              style={{ borderColor: FRAME }}
            >
              <p className="font-sans font-bold text-l1 text-base lg:text-lg" style={{ fontVariationSettings: '"wdth" 110' }}>
                {filtered ? "没有符合条件的单品" : "录入一件衣服，建立你的衣橱"}
              </p>
              {filtered ? (
                <p className="max-w-xs text-l2 text-xs lg:text-sm text-balance leading-relaxed">
                  换个筛选条件，或者清除全部筛选再看看。
                </p>
              ) : null}
              {/* 走药丸壳，不是粉色实心 —— 那是主操作的分量，这里只是退回默认视图。 */}
              <button
                type="button"
                onClick={filtered ? clearFilters : () => setAdding(true)}
                className="mt-1 px-4 py-1.5 border border-line lg:hover:border-l1 rounded-full font-sans font-bold text-l2 lg:hover:text-l1 text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
                style={{ fontVariationSettings: '"wdth" 110' }}
              >
                {filtered ? "清除筛选" : "从第一件开始"}
              </button>
            </div>
          ) : (
            /* 容器只补上和左边，右和下由每一格自己画 —— 相邻两格因此共用一条线，
               不会在中缝叠成 2px。 */
            <div
              className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 bg-white border-t border-l"
              style={{ borderColor: FRAME }}
            >
              {paged.map((item, i) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={(page - 1) * PER_PAGE + i + 1}
                  onOpen={() => setOpenId(item.id)}
                />
              ))}
            </div>
          )}

          {pageCount > 1 ? (
            <div className="flex flex-wrap justify-center items-center gap-1 mt-4 lg:mt-5">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-full font-ui text-xs lg:text-sm tabular-nums transition-colors duration-200 cursor-pointer ${
                    n === page ? "bg-[rgba(0,0,0,0.07)] text-l1" : "text-l3 lg:hover:text-l1"
                  }`}
                >
                  {n}
                </button>
              ))}

              {/*
                跳转框。**页数多到一排铺不下时才有意义**，所以卡在 5 页以上才出现 ——
                只有两三页的时候页码本身就是最快的路径，再摆一个输入框是多余的一步。

                回车或失焦才提交：输入框绑的是本地草稿，不是 `page`，
                否则敲「12」会先跳到第 1 页。越界的数字夹回区间，不弹错误 ——
                用户要的是「去最后一页」，不是一条报错。
              */}
              {pageCount > 4 ? (
                <span className="flex items-center gap-1.5 ml-2 font-ui text-l3 text-xs lg:text-sm">
                  跳至
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={jump}
                    placeholder={String(page)}
                    onChange={(event) => setJump(event.target.value.replace(/\D/g, ""))}
                    onBlur={() => {
                      if (jump === "") return;
                      setPage(Math.min(pageCount, Math.max(1, Number(jump))));
                      setJump("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                    aria-label={`跳至第几页，共 ${pageCount} 页`}
                    className="bg-transparent px-2 py-1.5 border border-line focus:border-accent rounded-full w-12 text-l1 placeholder:text-l3 text-xs lg:text-sm text-center tabular-nums transition-colors duration-200 outline-none"
                  />
                  页
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <AddCategoryDialog open={addingCategory} onClose={() => setAddingCategory(false)} />

      {/* 抽屉读的是 items 里的实时对象，不是打开那一刻的快照 ——
          记一笔养护、改一次状态，读数要立刻跟着变。 */}
      <ItemDrawer
        item={items.find((entry) => entry.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onUpdate={(patch) => openId && updateItem(openId, patch)}
        onAddCare={(record) => openId && addCare(openId, record)}
        onUpdateCare={(index, record) => openId && updateCare(openId, index, record)}
        onRemoveCare={(index) => openId && removeCare(openId, index)}
        onBumpWears={(delta) => openId && bumpWears([openId], delta)}
        onDelete={() => {
          if (openId) removeItem(openId);
          setOpenId(null);
        }}
      />

      <NewItemDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(draft) => {
          addItem(draft);
          setAdding(false);
          // 新单品排在最前，回到第一页才看得见它
          setPage(1);
        }}
      />

      {/* 纯白场。和「衣橱统计」「穿搭日志」统一 —— 分层交给发丝线，底不需要颜色。
          衣橱这一页尤其需要：单品图是抠好的透明底，任何底色都会渗进衣服的边缘。 */}
      <div aria-hidden="true" className="-z-1 fixed inset-0 bg-white pointer-events-none" />
    </>
  );
}
