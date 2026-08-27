"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FRAME, PINK_INK } from "@/components/analysis-charts";
import CategoryIcon from "@/components/category-icons";
import DialogShell, { DIALOG_ACTION } from "@/components/dialog-shell";
import DropdownMenu from "@/components/dropdown-menu";
import PhotoDrop from "@/components/photo-drop";
import { META } from "@/components/panel";
import { orderPickerItems, type OotdMap, type OotdRecord } from "@/lib/ootd-store";
import { CATEGORIES, cpw, type Category, type Item } from "@/lib/wardrobe";

/* ------------------------------------------------------------------ 视觉常量 */

/** 和日历同一套发丝线（DESIGN.md §2「两档发丝线」）—— 弹窗是从那张纸上翻起来的。 */
const RULE = FRAME;
/** 日志页的衬线声音。日期在这里要和日历刊头读成一套。 */
const SERIF = { fontFamily: 'Georgia, "Times New Roman", "Songti SC", serif' } as const;
/** 格内小节标题的宽度轴。比弹窗大标题（panel 的 WIDE，120）收一档。 */
const WIDE = { fontVariationSettings: '"wdth" 110' } as const;

/** 格子：白底、方角，靠 gap-px 漏出来的 RULE 当分隔线（DESIGN.md §5.4）。 */
const CELL = "flex flex-col gap-2.5 bg-white px-4 lg:px-5 py-3.5 lg:py-4 min-w-0";

/** 「全部」那一档的图标：四格，代表不做筛选。CategoryIcon 里没有这一项。 */
const AllIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.6" y="3.6" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13.4" y="3.6" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
    <rect x="3.6" y="13.4" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13.4" y="13.4" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

type PickCategory = Category | "全部";
const PICK_CATEGORIES = ["全部", ...CATEGORIES] as const satisfies readonly PickCategory[];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 语音上限。再长就不是「备注」而是录音笔了，且 dataURL 会把 localStorage 撑爆。 */
const MAX_VOICE_SEC = 60;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** 小节表头：编号（粉）· 中文 · 英文。和面板表头同一种读法。 */
function CellHead({ index, zh, en, action }: { index: string; zh: string; en: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className={`${META} tabular-nums`} style={{ color: PINK_INK }}>
        {index}
      </span>
      <span className="font-sans font-bold text-l1 text-xs lg:text-sm shrink-0" style={WIDE}>
        {zh}
      </span>
      {/* 英文名是可以被牺牲的那一项：表头挤的时候先截它，
          编号、中文名和右端的操作都得完整。 */}
      <span className={`${META} text-l3 min-w-0 truncate`}>{en}</span>
      {action ? <span className="flex items-baseline gap-2.5 ml-auto pl-1 shrink-0">{action}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------- 语音格 */

type RecState = "idle" | "recording" | "denied" | "unsupported";

function VoiceCell({
  voice,
  voiceSec,
  onChange,
}: {
  voice: string | null;
  voiceSec: number;
  onChange: (patch: { voice: string | null; voiceSec: number }) => void;
}) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 录制中的资源都挂在这里，卸载时一次性收干净 —— 弹窗关掉而麦克风还亮着
  // 是最糟的一种泄漏，浏览器会一直显示录音指示灯。
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  // 到点自停。放在 effect 里而不是 setTimeout，是因为计时和停止读的是同一个 elapsed。
  useEffect(() => {
    if (state === "recording" && elapsed >= MAX_VOICE_SEC) recorderRef.current?.stop();
  }, [state, elapsed]);

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("denied");
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const reader = new FileReader();
      // 秒数取 recorder 自己的计时，不去解码音频 —— 解码要等 loadedmetadata，
      // 而 webm/opus 在 Chrome 里常报 Infinity。
      reader.onload = () => onChange({ voice: String(reader.result), voiceSec: elapsed || 1 });
      reader.readAsDataURL(blob);
      recorderRef.current = null;
      setState("idle");
    };

    recorderRef.current = recorder;
    setElapsed(0);
    recorder.start();
    setState("recording");
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  return (
    <div className={`${CELL} shrink-0`}>
      <CellHead index="04" zh="语音记录" en="VOICE NOTE" />

      <div className="flex flex-col justify-center items-center gap-2.5 py-2 lg:py-3">
        {voice ? (
          <>
            <audio
              ref={audioRef}
              src={voice}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "暂停" : "播放语音"}
              className="flex justify-center items-center border rounded-full w-11 lg:w-12 h-11 lg:h-12 transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
              style={{ borderColor: playing ? PINK_INK : RULE, color: playing ? PINK_INK : "var(--label-1)" }}
            >
              {playing ? (
                <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
                  <rect x="1" y="1" width="3.5" height="12" fill="currentColor" />
                  <rect x="7.5" y="1" width="3.5" height="12" fill="currentColor" />
                </svg>
              ) : (
                <svg width="13" height="14" viewBox="0 0 13 14" aria-hidden="true">
                  <path d="M2 1l10 6-10 6V1z" fill="currentColor" />
                </svg>
              )}
            </button>
            <p className="font-ui text-l1 text-xs lg:text-sm tabular-nums">{mmss(voiceSec)}</p>
            <button
              type="button"
              onClick={() => onChange({ voice: null, voiceSec: 0 })}
              className={`${META} border border-line px-2 py-1 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer`}
            >
              重录
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => (state === "recording" ? recorderRef.current?.stop() : void start())}
              disabled={state === "unsupported"}
              aria-label={state === "recording" ? "停止录音" : "开始录音"}
              className="flex justify-center items-center border rounded-full w-11 lg:w-12 h-11 lg:h-12 transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed cursor-pointer lg:hover:border-accent"
              style={{
                borderColor: state === "recording" ? PINK_INK : RULE,
                color: state === "recording" ? PINK_INK : "var(--label-1)",
              }}
            >
              {state === "recording" ? (
                <span className="bg-current rounded-[2px] w-3 h-3" aria-hidden="true" />
              ) : (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
                  <rect x="4.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1.8 8.2a5.2 5.2 0 0 0 10.4 0M7 13.4V17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
            </button>

            {state === "recording" ? (
              <p className="font-ui text-xs lg:text-sm tabular-nums" style={{ color: PINK_INK }}>
                <span className="lt-blink">●</span> {mmss(elapsed)} / {mmss(MAX_VOICE_SEC)}
              </p>
            ) : (
              <p className={`${META} text-l3 text-center`}>
                {state === "denied"
                  ? "麦克风没授权"
                  : state === "unsupported"
                    ? "这个浏览器不支持录音"
                    : "添加语音"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- 主弹窗 */

export default function OotdDialog({
  date,
  record,
  wardrobe,
  records,
  onPatch,
  onDelete,
  onBumpWears,
  onClose,
}: {
  date: Date;
  record: OotdRecord;
  wardrobe: Item[];
  records: OotdMap;
  onPatch: (patch: Partial<OotdRecord>) => void;
  onDelete: () => void;
  onBumpWears: (ids: string[], delta: number) => void;
  onClose: () => void;
}) {
  const selected = useMemo(() => record.items ?? [], [record.items]);

  /**
   * 勾选即落账：进出一件就给它的 wears ±1，不设「保存」按钮。
   *
   * 少一个提交按钮，就少一条「填了没保存」的失败路径；
   * 整站其余表单本来也都是即时落盘的。
   */
  const toggleItem = useCallback(
    (id: string) => {
      const on = selected.includes(id);
      onPatch({ items: on ? selected.filter((value) => value !== id) : [...selected, id] });
      onBumpWears([id], on ? -1 : 1);
    },
    [selected, onPatch, onBumpWears],
  );

  /**
   * 分类筛选。默认「全部」走附录 E 的排序，但衣橱一大，光靠排序仍然是在
   * 「系统推给我什么」——想找那条特定的裙子还是得自己去翻。选定分类后
   * 排序规则照旧在组内生效。
   */
  const [pickCategory, setPickCategory] = useState<PickCategory>("全部");

  const ordered = useMemo(
    () => orderPickerItems(wardrobe, records, { date, selected }),
    [wardrobe, records, date, selected],
  );
  const shown = useMemo(
    () => (pickCategory === "全部" ? ordered : ordered.filter((item) => item.category === pickCategory)),
    [ordered, pickCategory],
  );

  const byId = useMemo(() => new Map(wardrobe.map((item) => [item.id, item])), [wardrobe]);

  const hasRecord = Boolean(record.photo) || selected.length > 0 || Boolean(record.note) || Boolean(record.voice);

  return (
    <DialogShell
      zh="穿搭记录"
      en="OOTD Entry"
      label={`${date.getMonth() + 1} 月 ${date.getDate()} 日的穿搭记录`}
      onClose={onClose}
      /* 桌面上给死高度，不让内容自己撑。三个区里有两个会长（单品网格随衣橱、
         备注随字数），交给内容决定的话弹窗会随衣橱规模变高，中间那张照片也
         跟着被拉长。定高之后 `1fr` 才有东西可分，超出的部分在各自格子里滚。 */
      panelClassName="max-w-[1120px] lg:h-[min(82svh,880px)]"
      action={
        <>
          {/* 记录是随手落盘的，这个按钮不触发写入 —— 它给的是「我记完了」这个交代。
              没有它，用户填完只能点 ×，那在其它页里是「放弃」的意思。 */}
          <button type="button" onClick={onClose} className={DIALOG_ACTION}>
            保存
          </button>
          {hasRecord ? (
            <button
              type="button"
              onClick={() => {
                onBumpWears(selected, -1);
                onDelete();
                onClose();
              }}
              className={DIALOG_ACTION}
            >
              清空
            </button>
          ) : null}
        </>
      }
    >
        {/*
          三列版式（参考图）：左列日期 + 关联单品，中间照片跨两行，右列文字 + 语音。
          窄屏塌成一列，顺序按 PRD 6.4 的记录动线：先日期、再传照片、然后关联单品。

          桌面行高 `auto / 1fr`：第一行由日期撑开，剩下的高度全给左下的单品挑选区
          —— 那里是唯一会随衣橱变长的内容。

          `auto-rows-min` 是给窄屏的，**不能省**：容器自己有确定高度（flex-1）
          又开了滚动，隐式行会被压到容器高度里平分，而格子都带 min-h-0，
          于是照片那格被压成一半、图片直接盖到下面的单品区上。改成 min-content
          让行按内容撑开、容器滚动，才是这里要的。桌面有显式 grid-rows，
          这一项用不上，互不影响。
        */}
        <div
          data-lenis-prevent
          className="flex-1 gap-px grid auto-rows-min lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-y-auto lg:overflow-hidden [grid-template-areas:'date''photo''items''side'] lg:[grid-template-areas:'date_photo_side''items_photo_side']"
          style={{ background: RULE }}
        >
                    {/* 这一格不挂 CellHead：`August 1 / 2026` 本身就是标题，
              上面再顶一行「今日日期 DATE」是同一句话说两遍。编号也因此从下一格起算。 */}
          <div className={`${CELL} [grid-area:date] justify-center`}>
            <div className="flex flex-col gap-0.5">
              <p className="text-l1 text-2xl lg:text-3xl italic leading-tight" style={SERIF}>
                {MONTHS[date.getMonth()]} {date.getDate()}
              </p>
              <p className="text-base lg:text-lg italic leading-none" style={{ ...SERIF, color: PINK_INK }}>
                {date.getFullYear()}
              </p>
            </div>
          </div>

          {/* ── 02 今日穿搭（中间，跨两行）───────────────────────── */}
          <div className={`${CELL} [grid-area:photo] min-h-0`}>
            <CellHead
              index="02"
              zh="今日穿搭"
              en="THE LOOK"
              action={
                record.photo ? (
                  <button
                    type="button"
                    onClick={() => onPatch({ photo: null })}
                    className={`${META} border border-frame px-2 py-1 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer`}
                  >
                    移除
                  </button>
                ) : null
              }
            />

            <PhotoDrop
              value={record.photo}
              onChange={(next) => onPatch({ photo: next })}
              title="记录今日穿搭"
              alt="当日穿搭全身照"
              // 空态的无障碍名跟着框里那行字走，两者不一致会让读屏和肉眼读到两个说法。
              ariaLabel={record.photo ? "更换今日穿搭照" : "记录今日穿搭"}
              className="flex-1 w-full min-h-[46svh] lg:min-h-0"
            />
          </div>

          {/* ── 01 关联单品 ─────────────────────────────────────── */}
          <div className={`${CELL} [grid-area:items] min-h-0`}>
            <CellHead
              index="01"
              zh="关联单品"
              /* 这一格的表头最挤：中文名 4 字 + 计数 + 添加按钮。
                 英文名取短的那个词，长的会被截成「WORN ...」，看着像 bug。 */
              en="ITEMS"
              action={
                <span className={`${META} text-l3 tabular-nums`}>
                  {selected.length} / {ordered.length}
                </span>
              }
            />

            {/* 已选的先摆出来。下面的网格会随勾选重排（同现搭档实时上浮，
                见 orderPickerItems），这一行是重排时不动的那个回执。 */}
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const item = byId.get(id);
                  if (!item) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleItem(id)}
                      aria-label={`取消关联 ${item.name}`}
                      className="inline-flex items-center gap-1.5 bg-accent-wash px-2 py-1 border border-line rounded-full lg:hover:border-accent max-w-full font-ui text-l1 text-[10px] lg:text-xs transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="text-l3" aria-hidden="true">×</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/*
              分类筛选。**整条收成一个下拉**，不平铺药丸：这一列只有 260px，
              11 个选项铺开要占三行，把挑选区顶掉三分之一，且三行里只有一颗是
              选中的，其余十颗全是噪音（DESIGN.md §5.4「选项多到平铺会占满一行」）。

              面板必须限高：弹窗自己是 `overflow-hidden` 的，11 行 ~600px 会被
              齐腰切断（实测）。限高之后面板内部滚动，切不着了。
            */}
            <div className="flex items-baseline gap-2">
              <DropdownMenu
                label={pickCategory}
                ariaLabel="按分类筛选衣橱单品"
                triggerIcon={
                  pickCategory === "全部" ? (
                    <AllIcon />
                  ) : (
                    <CategoryIcon category={pickCategory} className="w-[15px] h-[15px]" />
                  )
                }
                width={180}
                maxHeight={280}
                groups={[
                  PICK_CATEGORIES.map((category) => ({
                    key: category,
                    label: category,
                    icon:
                      category === "全部" ? (
                        <AllIcon />
                      ) : (
                        <CategoryIcon category={category} className="w-[15px] h-[15px]" />
                      ),
                    selected: pickCategory === category,
                    onSelect: () => setPickCategory(category),
                  })),
                ]}
              />
              {pickCategory !== "全部" ? (
                <span className={`${META} text-l3 tabular-nums`}>{shown.length} 件</span>
              ) : null}
            </div>

            <div data-lenis-prevent className="flex-1 -mr-1 pr-1 min-h-32 lg:min-h-0 overflow-y-auto">
              <div className="gap-1.5 grid grid-cols-4 lg:grid-cols-5">
                {shown.map((item) => {
                  const on = selected.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      aria-pressed={on}
                      title={`${item.name} · ${cpw(item) === null ? "尚未穿着" : `¥${cpw(item)!.toFixed(1)}/次`}`}
                      className="group relative bg-white aspect-3/4 transition-colors duration-200 motion-reduce:transition-none cursor-pointer"
                      style={{ border: `1px solid ${on ? PINK_INK : RULE}` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className={`p-0.5 w-full h-full object-contain transition-opacity duration-200 motion-reduce:transition-none ${
                          on ? "" : "opacity-80 lg:group-hover:opacity-100"
                        }`}
                      />
                      {on ? (
                        <span
                          aria-hidden="true"
                          className="-top-px -right-px absolute flex justify-center items-center w-4 h-4 font-ui text-[10px] text-white leading-none"
                          style={{ background: PINK_INK }}
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ── 右列：03 文字记录 + 04 语音记录 ────────────────────
               合成一个跨两行的区，内部自己分高 —— 挂在外层行轨上的话，
               「要长的那个」（记录）和「够用就行的那个」（语音）会被同一组
               行高绑在一起，只能一个大一个小，刚好和需要的相反。 */}
          <div className="flex flex-col gap-px [grid-area:side] min-h-0" style={{ background: RULE }}>
            <div className={`${CELL} flex-1 min-h-0`}>
              <CellHead index="03" zh="文字记录" en="NOTE" />
              <textarea
                aria-label="文字记录"
                value={record.note}
                onChange={(event) => onPatch({ note: event.target.value })}
                placeholder="记下此刻的天气、去处，与穿上它时的心情。"
                rows={4}
                className="flex-1 bg-transparent w-full min-h-24 lg:min-h-28 font-ui text-l1 placeholder:text-l3 text-sm lg:text-base leading-relaxed outline-none resize-none"
              />
            </div>

            <VoiceCell
              voice={record.voice ?? null}
              voiceSec={record.voiceSec ?? 0}
              onChange={(patch) => onPatch(patch)}
            />
          </div>
      </div>

    </DialogShell>
  );
}
