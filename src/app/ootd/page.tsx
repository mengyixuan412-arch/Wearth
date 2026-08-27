"use client";

import { Fleur_De_Leah } from "next/font/google";
import { useMemo, useState } from "react";

import OotdDialog from "@/components/ootd-dialog";
import SiteHeader from "@/components/site-header";
import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";
import { dateKey, monthMatrix, parseKey, sameDay } from "@/lib/date";
import { currentStreak, EMPTY_RECORD, isRecorded, monthCount, useOotd } from "@/lib/ootd-store";
import { FRAME, HERO_GAP } from "@/lib/layout";
import { useWardrobe } from "@/lib/wardrobe";
import { META } from "@/components/panel";

/** 月份名专用花体。只有 400 一个字重，拉丁子集足够。 */
const fleur = Fleur_De_Leah({ weight: "400", subsets: ["latin"], display: "swap" });

/** 周一起头，和矩阵一致 */
const WEEKDAYS = ["Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat.", "Sun."];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SERIF = { fontFamily: 'Georgia, "Times New Roman", "Songti SC", serif' } as const;

/**
 * 和「衣橱统计」同一套发丝线体系：白底、方角、可看清的中灰框线。
 *
 * 全站令牌 `--line` 是暖灰 10%，为米白底调的；白底会把它冲得几乎看不见，
 * 格线一淡，整张表就散了。所以这里和统计页取同一个值 —— 两页的表格看起来
 * 才是同一种纸。
 *
 * 粉的落点是**拉丁文字与非本月的日期**：星期名、刊头、年份走 `PINK_INK`
 * （DESIGN.md §2 指定的「要当文字读」的那一档，对比度够 4:1）；邻月日期用淡粉，
 * 既标出「不属于这个月」，又把粉铺进数字里而不至于喧宾夺主。
 * 本月日期保持近黑 —— 它才是这张表上唯一要被读的数据。
 */
const RULE = FRAME;
/** 本月日期数字：主文字。 */
const INK = "var(--label-1)";
/** 翻月箭头、底栏说明：退一档。 */
const INK_2 = "var(--label-2)";
/** 拉丁小字的粉。#D53F7D，DESIGN.md 粉色阶梯里唯一够当正文读的一档。 */
const PINK_INK = "#D53F7D";
/** 邻月日期。同一支粉，靠 opacity 压到背景层。 */
const PINK_SOFT = "#F27CAD";

export default function OotdPage() {
  const { records, saveState, setRecord, removeRecord } = useOotd();
  // 弹窗要读衣橱、也要改 wears，**必须由这里持有这一份** ——
  // useWardrobe 是本地 state，弹窗自己再调一次会拿到不同步的第二份副本。
  const { items: wardrobe, bumpWears } = useWardrobe();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  /** 打开的是哪一天。null = 弹窗关着。 */
  const [openKey, setOpenKey] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);

  const recordedThisMonth = monthCount(records, year, month);
  const streak = currentStreak(records, today);
  const totalDays = Object.keys(records).filter((key) => isRecorded(records[key])).length;

  const shiftMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));

  /**
   * 从格子上直接删。**先把穿着次数退回去，再删记录** —— 反过来的话
   * items 已经没了，那几件衣服的 wears 就永远多算了这一次。
   */
  const dropDay = (key: string) => {
    bumpWears(records[key]?.items ?? [], -1);
    removeRecord(key);
  };

  const openDate = openKey ? parseKey(openKey) : null;

  return (
    <>
      <div className="z-10 fixed inset-0 flex flex-col px-4 lg:px-14 pt-4 lg:pt-7 pb-3">
        <SiteHeader title={null} />

        <h1 className="sr-only">穿搭日志 — 月视图日历</h1>

        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* ── 主视觉：标题、编号、副标都画在图里，DOM 不再重复一遍。
             4:1 横幅，按原始画幅铺满 —— 标题在最左、拼贴在最右，
             中间是留白，任何方向的裁切都会丢掉一头。
             图由 tools/build-hero.mjs 从设计稿生成。

             宽度跟其余五页一致：铺满 px-4 lg:px-14 的内容宽，**不套日历那层
             max-w-[1280px]** —— 套进去宽屏上就比别的页窄一截。

             alt 只写标语，不写标题 —— 上面那行 sr-only h1 已经念过一遍，
             图再念一次就是重复。 ───── */}
        <div className="pt-4 lg:pt-6">
          <img
            src="/img/hero/ootd.webp"
            alt="把今天穿成故事，也把故事穿在身上"
            width={2000}
            height={500}
            fetchPriority="high"
            className="block border border-l4 w-full h-auto"
          />
        </div>

        <div className={`mx-auto ${HERO_GAP} mb-3 lg:mb-5 w-full max-w-[1280px]`}>
          {/* 顶栏：不带底色，直接坐在页面的弥散光晕上 */}
          <div className="flex justify-between items-center gap-4 px-1 lg:px-2 pb-2 lg:pb-2.5">
            <div className="flex items-baseline gap-2 lg:gap-3">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="上个月"
                className={`${DOTTED_BORDER_BASE} px-1 text-base italic cursor-pointer`}
                style={{ ...SERIF, color: INK_2 }}
              >
                ‹
              </button>
              <h2 className={`${fleur.className} text-l1 text-3xl lg:text-5xl leading-none`}>
                {MONTHS[month]}
              </h2>
              <span className="text-l1 text-base lg:text-xl italic leading-none" style={SERIF}>
                <span style={{ color: PINK_INK }}>* look calendar</span>
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="下个月"
                className={`${DOTTED_BORDER_BASE} px-1 text-base italic cursor-pointer`}
                style={{ ...SERIF, color: INK_2 }}
              >
                ›
              </button>
            </div>

            <p className="text-l1 text-base lg:text-xl italic leading-none" style={SERIF}>
              wearth <span style={{ color: PINK_INK }}>/ {year}</span>
            </p>
          </div>

          {/* 白纸从星期行开始：内部靠细线分格，没有圆角砖和间隙。
              日格竖版 3:4，照片完整不裁 —— 六行超出一屏，整块随页面滚动。 */}
          <div className="bg-white overflow-hidden" style={{ border: `1px solid ${RULE}` }}>
          {/* 星期行 */}
          <div
            className="top-0 z-20 sticky grid grid-cols-7 shrink-0"
            style={{ background: "#ffffff", borderBottom: `1px solid ${RULE}` }}
          >
            {WEEKDAYS.map((day, index) => (
              <p
                key={day}
                className="py-1.5 lg:py-2 text-lg lg:text-2xl text-center italic leading-none"
                style={{
                  ...SERIF,
                  color: PINK_INK,
                  borderLeft: index === 0 ? undefined : `1px solid ${RULE}`,
                }}
              >
                {day}
              </p>
            ))}
          </div>

          {/* 日格：六行均分剩余高度，格间只有细线 */}
          <div className="grid grid-cols-7">
            {cells.map(({ date, inMonth }, index) => {
              const key = dateKey(date);
              const record = records[key];
              const photo = record?.photo ?? null;
              // 只关联了单品 / 只写了字的天也得看得出来，否则点开才知道有没有东西。
              const partial = !photo && Boolean(record?.items?.length || record?.note || record?.voice);
              const isToday = sameDay(date, today);
              const isFuture = date > today && !isToday;

              return (
                <div
                  key={key}
                  className="group relative min-w-0 aspect-3/4"
                  style={{
                    borderLeft: index % 7 === 0 ? undefined : `1px solid ${RULE}`,
                    borderTop: index < 7 ? undefined : `1px solid ${RULE}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenKey(key)}
                    disabled={isFuture}
                    aria-label={`${date.getMonth() + 1} 月 ${date.getDate()} 日${
                      photo || partial ? "，已有记录，点击查看" : "，点击记录这天的穿搭"
                    }`}
                    // 照片从格线上收进来一点：两张相邻的 OOTD 之间只隔 1px 格线时会连成
                    // 一片，看不出是两天。内边距留在按钮上而不是图片上 —— hover 底色画的
                    // 是整格，收进去的只有照片。
                    className={`block relative p-1 lg:p-1.5 w-full h-full overflow-hidden transition-colors duration-200 motion-reduce:transition-none ${
                      isFuture ? "cursor-default" : "cursor-pointer lg:hover:bg-selection/[0.05]"
                    }`}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : partial ? (
                      // 没照片的记录：左上角一个小粉点，不占地方也不像按钮。
                      <span
                        aria-hidden="true"
                        className="top-1.5 left-1.5 absolute rounded-full w-1.5 h-1.5"
                        style={{ background: PINK_SOFT }}
                      />
                    ) : null}
                  </button>

                  {/* 日期数字：右下角。今天加一圈粉环 */}
                  <span
                    className={`right-1.5 bottom-1 absolute font-bold text-base lg:text-xl leading-none tabular-nums pointer-events-none ${
                      isToday ? "flex justify-center items-center rounded-full w-6 lg:w-7 h-6 lg:h-7" : ""
                    }`}
                    style={{
                      ...SERIF,
                      color: isToday ? "rgba(255,46,136,0.9)" : inMonth ? INK : PINK_SOFT,
                      opacity: inMonth ? (isFuture ? 0.4 : 1) : 0.28,
                      boxShadow: isToday ? "inset 0 0 0 1.5px rgba(255,46,136,0.7)" : undefined,
                      textShadow: photo ? "0 1px 3px rgba(255,255,255,0.9)" : undefined,
                    }}
                  >
                    {date.getDate()}
                  </span>

                  {photo || partial ? (
                    <button
                      type="button"
                      onClick={() => dropDay(key)}
                      aria-label="删除这天的记录"
                      className="top-1 right-1 z-10 absolute flex justify-center items-center bg-card/90 opacity-0 lg:group-hover:opacity-100 border border-line rounded-full w-4 h-4 font-ui text-l1 text-[10px] leading-none transition-opacity duration-200 motion-reduce:transition-none cursor-pointer"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          </div>

          {/* 底栏：搬到白卡外面，不带底色，和顶栏一样坐在页面背景上。
              只剩右侧那组读数，整行因此靠右。 */}
          <div className="flex flex-wrap justify-end items-baseline gap-x-6 gap-y-1 px-1 lg:px-2 pt-2 lg:pt-2.5">
            <p className={`${META} flex items-baseline gap-4 lg:gap-6 tabular-nums shrink-0`} style={{ color: INK_2 }}>
              <span>本月 {recordedThisMonth}</span>
              <span>连续 {streak}</span>
              <span>累计 {totalDays}</span>
              {/* 平时不出声。**但写失败必须出声**（ARCHITECTURE.md §4 ④）——
                  用户记完一周穿搭，以为存上了，刷新就没了。 */}
              {saveState === "error" ? <span className="text-accent">保存失败</span> : null}
            </p>
          </div>
        </div>
        </main>

      </div>

      {openKey && openDate ? (
        <OotdDialog
          date={openDate}
          record={{ ...EMPTY_RECORD, ...records[openKey] }}
          wardrobe={wardrobe}
          records={records}
          onPatch={(patch) => setRecord(openKey, patch)}
          onDelete={() => removeRecord(openKey)}
          onBumpWears={bumpWears}
          onClose={() => setOpenKey(null)}
        />
      ) : null}

      {/* 纯白场。和「衣橱统计」统一 —— 分层全部交给发丝线，底不需要任何颜色；
          底一白，那些 1px 的格线才立得住，粉也才读得出是粉。 */}
      <div aria-hidden="true" className="-z-1 fixed inset-0 bg-white pointer-events-none" />
    </>
  );
}
