"use client";

import { useMemo, useState } from "react";

import AiConsentDialog from "@/components/ai-consent-dialog";
import SaveAlert from "@/components/save-alert";
import CategoryIcon from "@/components/category-icons";
import ColorField from "@/components/color-field";
import type { AiResult, ListingRead, Prefill } from "@/lib/ai/types";
import DropdownMenu from "@/components/dropdown-menu";
import {
  CELL,
  CELL_ROW,
  CELL_ROW_VALUE,
  CellLabel,
  NumberCell,
  VALUE_ROW,
  valueText,
} from "@/components/form-controls";
import Panel, { META, WIDE } from "@/components/panel";
import { useAiConsent } from "@/lib/ai-consent";
import { dominantColor } from "@/lib/dominant-color";
import ShotMulti from "@/components/shot-multi";
import ShotSlot from "@/components/shot-slot";
import ReportChat from "@/components/report-chat";
import ScoreReport from "@/components/score-report";
import SectionNav from "@/components/section-nav";
import SiteHeader from "@/components/site-header";
import { budgetStatus } from "@/lib/analysis";
import { formatDate, today } from "@/lib/date";
import { useDecisions } from "@/lib/decision-store";
import { HERO_GAP, RULE_STRONG } from "@/lib/layout";
import { useProfile } from "@/lib/profile-store";
import {
  FIT_MEASURES,
  MATERIAL_NAMES,
  MEASURE_LABEL,
  scoreCandidate,
  type Candidate,
  type ScoreResult,
  type SizeChart,
} from "@/lib/scoring";
import {
  CATEGORIES,
  FAMILY_SWATCH,
  SEASONS,
  SUBCATEGORIES,
  familyOf,
  useWardrobe,
  type Category,
  type Material,
  type Season,
} from "@/lib/wardrobe";

const yuan = (value: number) => `¥${Math.round(value).toLocaleString("zh-CN")}`;

/**
 * 尺码档。**只做展示上下文，不参与评分** —— ⑤ 比的是尺码表上的围度数字
 * （附录 D-⑤），字母档只是告诉用户「下面这几个围度是哪个码的」。
 * 一并存进决策记录：回看时没有它，那几个围度就不知道是照哪个码抄的。
 */
const SIZES = ["均码", "XS", "S", "M", "L", "XL", "XXL"] as const;
const sizeText = (size: string) => (size === "均码" ? size : `${size} 码`);

/** 表头右上角的「清空」。一把小刷子，比垃圾桶轻 —— 这里清的是表单不是数据。 */
const EraserIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="block w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M6.4 13.5 2.9 10a1.2 1.2 0 0 1 0-1.7l5.4-5.4a1.2 1.2 0 0 1 1.7 0l3.1 3.1a1.2 1.2 0 0 1 0 1.7l-6 6z" strokeLinejoin="round" />
    <path d="M6.4 13.5H13" strokeLinecap="round" />
    <path d="M5.4 5.4 10.6 10.6" />
  </svg>
);

/** 分段多选，和录入弹窗的季节格同一档字号。 */
function SeasonPicker({ value, onToggle }: { value: Season[]; onToggle: (season: Season) => void }) {
  return (
    <div className={VALUE_ROW}>
      <div className="flex flex-1 gap-px bg-line border border-line min-w-0">
        {SEASONS.map((season) => {
          const on = value.includes(season);
          return (
            <button
              key={season}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(season)}
              className={`flex flex-1 justify-center items-center py-2 lg:py-2.5 min-w-0 text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
                on ? "bg-accent text-card" : "bg-card text-l2 lg:hover:bg-accent-wash"
              }`}
            >
              {season}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DecidePage() {
  // 商品截图外发前问一次。同意过就不再打扰（和录入弹窗共用同一份磁盘状态）
  const consent = useAiConsent();
  const { items } = useWardrobe();
  const { profile } = useProfile();
  const { decisions, saveState, save, remove } = useDecisions();

  /**
   * 三格截图，构成「先上传」那一步。价格与品牌不单开一格 —— 商品详情页
   * 那一屏本来就带着它们，让用户为同一张图截两次是多余的。
   *
   * 「成分表」不能写成「材质图」：从面料照片判断成分不可靠（PRD 8 明确不做），
   * 只能读文字。存进决策记录的只有主图，三张全存会很快撑爆 localStorage。
   */
  const [photo, setPhoto] = useState<string | null>(null);
  const [shotMaterial, setShotMaterial] = useState<string | null>(null);
  const [shotSize, setShotSize] = useState<string | null>(null);
  /** 补充截图。不喂任何评分维度，也不进决策记录 —— 只在本次评分期间留着看。 */
  const [shotsOther, setShotsOther] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [sub, setSub] = useState("");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("#C8B6AE");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [materials, setMaterials] = useState<Material[]>([{ name: "棉", pct: 100 }]);
  const [chart, setChart] = useState<Record<keyof SizeChart, string>>({
    bust: "",
    shoulder: "",
    waist: "",
    hip: "",
  });
  const [saved, setSaved] = useState<string | null>(null);

  const [sizeLabel, setSizeLabel] = useState("");

  /**
   * 截图提取的状态。三张截图任意一张变动就重跑一次，**把当时已有的几张一起送去** ——
   * 价格在主图上、尺码表在另一张、成分在第三张，分开读等于每次只看到三分之一。
   */
  const [extract, setExtract] = useState<"idle" | "running" | "failed">("idle");
  /**
   * 成分表被用户动过没有。它的初值是「棉 100%」—— 一个真实的值，
   * 分不清「没动过」和「用户就是填的棉」，所以单独记一个标志。
   * 价格与尺码表不用：空串就是没填过。
   */
  const [materialsTouched, setMaterialsTouched] = useState(false);
  /** 用户自己动过颜色就别再覆盖他。 */
  const [colorTouched, setColorTouched] = useState(false);

  /**
   * 评分**由按钮触发，不跟着输入实时重算**。
   *
   * 边填边跳分会把「评分」读成一个仪表盘 —— 用户盯着数字调价格、试品类，
   * 变成刷分而不是判断。它也不是免费的：①②③ 每次都要全表扫一遍衣橱。
   * 更要紧的是决策记录：存下来的必须是「按下那一刻」的那一份，
   * 而不是恰好停留在屏幕上的某个中间状态。
   *
   * 连同当时的 `candidate` 一起存 —— 存决策记录时要用它，
   * 也用来判断报告出来之后信息又被改过没有。
   */
  const [report, setReport] = useState<{ candidate: Candidate; result: ScoreResult } | null>(null);
  const result = report?.result ?? null;

  /**
   * 每生成一次报告就换一把钥匙，让追问那一段整块重挂 —— 对话是**针对这一份报告**的，
   * 换了报告还留着上一轮的问答，读起来就是在问一份已经不存在的分。
   * 用 key 重挂而不是拿 `report` 当 effect 依赖：每次生成都是一个新对象，
   * 依赖整个对象的 effect 会被无关的重渲染带着跑（ARCHITECTURE §4 ③）。
   */
  const [reportKey, setReportKey] = useState(0);


  /** 在橱件数。页头读数与追问的上下文都要它，不在两处各算一遍。 */
  const liveCount = useMemo(
    () => items.filter((item) => item.status !== "已处置").length,
    [items],
  );

  const snapshotAt = useMemo(() => today(), []);

  /** 本月还剩多少预算，喂给③的 3b。没设预算则为 null，那一子项不计。 */
  const budgetLeft = useMemo(() => {
    const { budget, spent } = budgetStatus(items, profile.monthlyBudget);
    return budget === null ? null : Math.max(0, budget - spent);
  }, [items, profile.monthlyBudget]);

  const body = useMemo(() => {
    const num = (raw: string) => {
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    return {
      bust: num(profile.bust),
      shoulder: num(profile.shoulder),
      waist: num(profile.waist),
      hip: num(profile.hip),
    };
  }, [profile]);

  /** 这个品类要比对哪几个围度。没列进来的（鞋 / 包 / 配饰）⑤ 不计分。 */
  const measures = category ? (FIT_MEASURES[category] ?? []) : [];

  const priceNum = Number(price);
  const ready = category !== null && sub !== "" && Number.isFinite(priceNum) && priceNum > 0;

  /**
   * 左栏目录。**条目名是动作，不照抄面板标题** —— 这一栏读起来是一条流程
   * （传图 → 填信息 → 出分 → 存档），面板标题读的是那一块里装着什么。
   * 两者不必一致，`id` 才是它们之间的绑定。
   *
   * 读数的分母取的是**这一节要往下走必须有的东西**，不是字段总数 ——
   * 02 有八个字段，但只有必填三项决定出不出分，把选填也算进分母会让进度条
   * 永远填不满，读起来像没做完。
   */
  const navSections = useMemo(
    () => [
      {
        id: "shots",
        index: "01",
        zh: "上传图片",
        done: [photo, shotSize, shotMaterial].filter(Boolean).length,
        need: 3,
      },
      {
        id: "details",
        index: "02",
        zh: "填写信息",
        done: [category !== null, sub !== "", Number.isFinite(priceNum) && priceNum > 0].filter(
          Boolean,
        ).length,
        need: 3,
      },
      { id: "score", index: "03", zh: "生成评分", done: report ? 1 : 0, need: 1 },
      { id: "history", index: "04", zh: "决策记录", done: decisions.length > 0 ? 1 : 0, need: 1 },
    ],
    [photo, shotSize, shotMaterial, category, sub, priceNum, report, decisions.length],
  );

  const candidate = useMemo<Candidate | null>(() => {
    if (!ready || category === null) return null;
    const sizeChart: SizeChart = {};
    for (const key of measures) {
      const value = Number(chart[key]);
      if (Number.isFinite(value) && value > 0) sizeChart[key] = value;
    }
    return {
      sub,
      category,
      price: priceNum,
      brand: brand.trim() || "未填写",
      color,
      // 留空按四季处理，和录入一致（附录 C：「四季」款 = 全集）
      seasons: seasons.length > 0 ? seasons : [...SEASONS],
      materials: materials.filter((entry) => entry.pct > 0),
      sizeChart,
      sizeLabel: sizeLabel || undefined,
    };
  }, [ready, category, sub, priceNum, brand, color, seasons, materials, chart, measures, sizeLabel]);

  /** 报告出来之后又动过商品信息。此时屏幕上的分对不上表单，得说一声。 */
  const stale =
    report !== null && candidate !== null && JSON.stringify(candidate) !== JSON.stringify(report.candidate);

  /**
   * 清空商品信息。**只清这一张表**，不动上面已传的截图 —— 按钮就长在这张表的
   * 表头上，越权去删旁边那一栏的东西是用户没预期的。
   * 报告一并清掉：它是照着这份表算出来的，表没了，那个分就没有依据。
   */
  const clearDetails = () => {
    setName("");
    setCategory(null);
    setSub("");
    setPrice("");
    setBrand("");
    setColor("#C8B6AE");
    setSeasons([]);
    setMaterials([{ name: "棉", pct: 100 }]);
    setSizeLabel("");
    setChart({ bust: "", shoulder: "", waist: "", hip: "" });
    setMaterialsTouched(false);
    setColorTouched(false);
    setExtract("idle");
    setReport(null);
  };

  /**
   * 读一遍已上传的截图，把认出来的字段回填进表单。
   *
   * **只填用户还没动过的字段**（§5 ②）—— 他先手填了价格再传截图，
   * 说明他已经确认过，模型没资格覆盖。
   *
   * 补充截图（`shotsOther`）不送 —— 那几张按设计就不喂任何评分维度。
   */
  const runExtract = async (shots: (string | null)[]) => {
    const images = shots.filter((entry): entry is string => Boolean(entry));
    if (images.length === 0) return;

    setExtract("running");
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "listing", images }),
      });
      const result = (await response.json()) as AiResult<ListingRead>;
      if (!result.ok) {
        setExtract("failed");
        return;
      }

      const read = result.value;
      // 函数式更新读当前值：这个回调跑在几秒之后，闭包里的值是发起那一刻的旧值。
      if (read.price !== null) setPrice((current) => (current === "" ? String(read.price) : current));
      if (!materialsTouched && read.materials.length > 0) setMaterials(read.materials);
      setChart((current) => {
        const next = { ...current };
        for (const key of ["bust", "shoulder", "waist", "hip"] as const) {
          const value = read.sizeChart[key];
          if (value !== undefined && next[key] === "") next[key] = String(value);
        }
        return next;
      });

      setExtract("idle");
    } catch {
      setExtract("failed");
    }
  };

  /**
   * 商品主图 → 品类 / 款式 / 颜色。**和 `runExtract` 是两条独立的管线**：
   * 那条从截图里读文字（价格、成分、尺码表），这条从主图认东西。
   *
   * 品类不是可有可无的一格 —— 评分①③⑤三个维度都要它，不选就出不了分。
   * 原来这一页只调了 `extract`，所以传完图价格材质都好了，品类还得手选。
   *
   * 失败什么都不做，就是一张空表单，用户照常手选（§5 ②）。
   */
  const runPrefill = async (dataUrl: string) => {
    try {
      const response = await fetch("/api/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const result = (await response.json()) as AiResult<Prefill>;
      if (!result.ok) return;
      const guess = result.value;

      // 函数式更新读当前值：回调跑在几秒之后，闭包里是发起那一刻的旧值
      setCategory((current) => {
        if (current !== null || !guess.category) return current;
        if (guess.sub) setSub(guess.sub);
        return guess.category;
      });

      /* 颜色优先用从图里取到的真实主色调，模型的色系只是兜底 ——
         `FAMILY_SWATCH["粉"]` 是固定示意色，藕粉和桃粉会填成同一个值。
         这页没有抠图，所以取中心区域并拿模型色系校验一次：
         万一取到的是背景，两者会落在不同色系，那就以模型的为准。 */
      if (!colorTouched) {
        const picked = await dominantColor(dataUrl, true);
        const agreed = picked && (!guess.colorFamily || familyOf(picked) === guess.colorFamily);
        if (agreed && picked) setColor(picked);
        else if (guess.colorFamily) setColor(FAMILY_SWATCH[guess.colorFamily]);
      }
    } catch {
      /* 认不出来就手选 */
    }
  };

  const generate = () => {
    if (!candidate) return;
    setReport({
      candidate,
      result: scoreCandidate(candidate, items, budgetLeft, body, snapshotAt, profile.skinTone || undefined),
    });
    setReportKey((value) => value + 1);
  };

  /** 这张表动过没有。全是初值时清空按钮没有意义，置灰。 */
  const dirty =
    name !== "" ||
    category !== null ||
    sub !== "" ||
    price !== "" ||
    brand !== "" ||
    color !== "#C8B6AE" ||
    seasons.length > 0 ||
    sizeLabel !== "" ||
    materials.length !== 1 ||
    materials[0]?.name !== "棉" ||
    materials[0]?.pct !== 100 ||
    Object.values(chart).some((value) => value !== "");

  const patchMaterial = (index: number, next: Partial<Material>) => {
    setMaterialsTouched(true);
    setMaterials((current) => current.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));
  };

  return (
    <div className="relative z-10 px-4 lg:px-14 py-4 lg:py-7">
      <SiteHeader title={null} />

      {/* ── 主视觉：标题、编号、副标都画在图里，DOM 不再重复一遍。
           4:1 横幅，按原始画幅铺满 —— 标题在最左、放大镜与吊牌拼贴在最右，
           中间是留白，任何方向的裁切都会丢掉一头。
           图由 tools/build-hero.mjs 从设计稿生成。 ───── */}
      <div className="pt-4 lg:pt-6">
        <img
          src="/img/hero/score.webp"
          alt="购买评分 Purchase Score —— 在心动之前，先听见你的衣橱"
          width={2000}
          height={500}
          fetchPriority="high"
          className="block border border-l4 w-full h-auto"
        />
      </div>

      <div
        className={`${HERO_GAP} flex flex-wrap items-center gap-x-4 gap-y-2 pb-2.5 lg:pb-3 border-b`}
        style={{ borderColor: RULE_STRONG }}
      >
        <span className={`${META} ml-auto text-l2 normal-case tabular-nums`}>
          在橱 {liveCount} 件 ·{" "}
          {budgetLeft === null ? "未设预算" : `本月余额 ${yuan(budgetLeft)}`}
        </span>
      </div>

      <div className="gap-4 lg:gap-6 grid grid-cols-12 mt-4 lg:mt-6 mb-16 lg:mb-20">
        {/* 左栏目录。和档案页共用 `SectionNav` —— 两页的这一栏是同一个东西。
            评分页是「页面自滚」那一类版式（DESIGN.md §4 的 A），没有内层滚动区，
            所以不传 rootRef，观察器按视口判定。 */}
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2">
          <SectionNav ariaLabel="评分步骤" sections={navSections} />
        </aside>

        <div className="gap-4 lg:gap-5 grid grid-cols-12 col-span-12 lg:col-span-9 xl:col-span-10 auto-rows-min">
        {/* ── 01 上传 ──────────────────────────────────
             三格并排，构成流程的第一步。上传与表格分成两块而不是交替排列 ——
             交替排会读不出「先传图、再确认」这条线，每一格都像一个独立的表单项。 */}
        <Panel
          id="shots"
          index="01"
          zh="上传图片"
          en="Shots"
          /* 只在跑和失败时出声，认完就安静下去 —— 成功的证据是下面表单里
             多出来的那几个值，不用再写一句「识别成功」。 */
          meta={
            extract === "running"
              ? "正在识别截图…"
              : extract === "failed"
                ? "未能识别，请在下方手动填写"
                : undefined
          }
          className="col-span-12"
        >
          <div className="px-4 lg:px-5 py-4 lg:py-5">
            <div className="gap-4 lg:gap-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <ShotSlot
                zh="商品主图"
                value={photo}
                onChange={(next) => {
                  setPhoto(next);
                  consent.guard(() => {
                    void runExtract([next, shotSize, shotMaterial]);
                    // 主图还要走一条独立管线认品类/款式/颜色
                    if (next) void runPrefill(next);
                  });
                }}
              />
              <ShotSlot
                zh="尺码表截图"
                value={shotSize}
                onChange={(next) => {
                  setShotSize(next);
                  consent.guard(() => void runExtract([photo, next, shotMaterial]));
                }}
              />
              <ShotSlot
                zh="成分表截图 / 水洗标"
                value={shotMaterial}
                onChange={(next) => {
                  setShotMaterial(next);
                  consent.guard(() => void runExtract([photo, shotSize, next]));
                }}
              />
              <ShotMulti values={shotsOther} onChange={setShotsOther} />
            </div>
          </div>
        </Panel>

        {/* ── 02 商品信息 ─────────────────────────────
             面板和它下面那颗生成按钮**合成一栏**，一起占住左边这 5 列。
             两者各自当栅格项的话，按钮会被自动排到右边第 6–10 列，
             7 列宽的评分报告就放不下，只能掉到下一行去。 */}
        <div className="flex flex-col gap-4 lg:gap-5 col-span-12 lg:col-span-5">
        <Panel
          id="details"
          index="02"
          zh="商品信息"
          en="Details"
          action={
            <button
              type="button"
              onClick={clearDetails}
              disabled={!dirty}
              aria-label="清空商品信息"
              title="清空商品信息"
              className={`flex justify-center items-center border w-7 h-7 transition-colors duration-200 motion-reduce:transition-none ${
                dirty
                  ? "border-line text-l3 lg:hover:border-accent lg:hover:text-accent cursor-pointer"
                  : "border-line text-l4 cursor-not-allowed"
              }`}
            >
              <EraserIcon />
            </button>
          }
        >
          {/* 单值字段一律**横排**（标签在左、值在右），和单品详情抽屉的「基本信息」
              同一种版式 —— 这一栏只占 12 栏里的 5 栏，竖排一格吃两行高度，
              八九个字段排下来整栏就只剩标签和留白。
              季节 / 材质成分 / 尺码数据的值本身不止一行，仍旧竖排。 */}
          <div className="gap-px grid grid-cols-1 bg-line">
            <div className={CELL_ROW}>
              <CellLabel zh="名称" />
              <div className={CELL_ROW_VALUE}>
                <input
                  aria-label="商品名称"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  // 选了款式就把款式名摆在占位上 —— 留空时存下来用的就是它，
                  // 让用户先看见那个默认值；还没选款式时回落到和品牌一致的「未填写」。
                  placeholder={sub || "未填写"}
                  className={`${valueText("sm")} bg-transparent w-full text-l1 placeholder:text-l3 text-right outline-none`}
                  style={WIDE}
                />
              </div>
            </div>

            {/* 三对两两配成一行：品类|款式 是「这是什么」，价格|品牌 是「这笔买卖」，
                颜色|尺码 是「什么样的」。每格自己仍是横排，只是两格并排占一行 ——
                名称那种可能很长的值单独占整行，配对了会被挤成两三个字。 */}
            <div className="gap-px grid grid-cols-2 bg-line">
            <div className={CELL_ROW}>
              <CellLabel zh="品类" required />
              <div className={CELL_ROW_VALUE}>
                <DropdownMenu
                  label={category ?? "未选"}
                  ariaLabel="一级品类"
                  triggerIcon={category ? <CategoryIcon category={category} className="w-4 h-4" /> : null}
                  align="right"
                  width={168}
                  maxHeight={320}
                  groups={[
                    CATEGORIES.map((entry) => ({
                      key: entry,
                      label: entry,
                      icon: <CategoryIcon category={entry} className="w-4 h-4" />,
                      selected: entry === category,
                      onSelect: () => {
                        setCategory(entry);
                        setSub("");
                      },
                    })),
                  ]}
                />
              </div>
            </div>

            <div className={CELL_ROW}>
              <CellLabel zh="款式" required />
              {/*
                空提示一律和输入框的占位同族同号（`valueText("sm")` + `WIDE` + l3）。
                横排之后这几句都落在同一条右对齐线上，字号不齐一眼就看得出来。

                它比选完之后出现的药丸大一档，这是**有意的**：那是从「一句提示」
                切到「一个控件」，本来就该长得不一样；而同一列里几句提示自己长得
                不一样，才是真的乱。
              */}
              <div className={CELL_ROW_VALUE}>
                {category === null ? (
                  <p className={`${valueText("sm")} text-l3`} style={WIDE}>
                    请先填写品类
                  </p>
                ) : (
                  <DropdownMenu
                    label={sub || "未选"}
                    ariaLabel="二级品类"
                    triggerIcon={null}
                    align="right"
                    width={176}
                    maxHeight={320}
                    groups={[
                      SUBCATEGORIES[category].map((entry) => ({
                        key: entry,
                        label: entry,
                        selected: entry === sub,
                        onSelect: () => setSub(entry),
                      })),
                    ]}
                  />
                )}
              </div>
            </div>
            </div>

            <div className="gap-px grid grid-cols-2 bg-line">
            <NumberCell
              zh="价格"
              unit="元"
              required
              value={price}
              placeholder="0"
              onChange={setPrice}
              max={99999}
              step={10}
              size="sm"
              row
            />

            <div className={CELL_ROW}>
              <CellLabel zh="品牌" />
              <div className={CELL_ROW_VALUE}>
                <input
                  aria-label="品牌"
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  placeholder="未填写"
                  className={`${valueText("sm")} bg-transparent w-full text-l1 placeholder:text-l3 text-right outline-none`}
                  style={WIDE}
                />
              </div>
            </div>
            </div>

            {/* 色系判定（附录 D-4）吃的就是这个 hex，和录入页选的是同一件事。

                **不铺那一排预设圆点**：这一栏的单值字段一律横排，右半边站不下
                六档预设加一颗触发器（七颗圆点要 284px）。预设并没有丢 ——
                取色器面板里的「最近用色」就是那一排，点开一次全在。

                预设表传空，这一格只剩那颗空心虚线加号（见 `ColorField` 的 `outlined`）。 */}
            <div className="gap-px grid grid-cols-2 bg-line">
            <div className={CELL_ROW}>
              <CellLabel zh="颜色" />
              <div className={CELL_ROW_VALUE}>
                <ColorField
                  value={color}
                  onChange={(next) => {
                    // 用户自己选过就别再被识别覆盖
                    setColorTouched(true);
                    setColor(next);
                  }}
                  presets={[]}
                  sampleImage={photo}
                />
              </div>
            </div>

            <div className={CELL_ROW}>
              <CellLabel zh="尺码" />
              <div className={CELL_ROW_VALUE}>
                <DropdownMenu
                  label={sizeLabel || "未选"}
                  ariaLabel="商品尺码"
                  triggerIcon={null}
                  align="right"
                  width={160}
                  groups={[
                    SIZES.map((entry) => ({
                      key: entry,
                      label: entry,
                      selected: entry === sizeLabel,
                      // 再点一次同一档就取消 —— 选错了总得有条退路，
                      // 而这一档本来就是选填的。
                      onSelect: () => setSizeLabel((current) => (current === entry ? "" : entry)),
                    })),
                  ]}
                />
              </div>
            </div>
            </div>

            <div className={CELL}>
              <CellLabel zh="季节" />
              <SeasonPicker
                value={seasons}
                onToggle={(season) =>
                  setSeasons((current) =>
                    current.includes(season)
                      ? current.filter((entry) => entry !== season)
                      : [...current, season],
                  )
                }
              />
            </div>

            <div className={CELL}>
              <CellLabel zh="材质成分" />

              <div className="flex flex-col gap-2.5">
                {materials.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <DropdownMenu
                        label={entry.name}
                        ariaLabel="成分名称"
                        triggerIcon={null}
                        triggerClassName="w-full"
                        width={168}
                        maxHeight={280}
                        groups={[
                          MATERIAL_NAMES.map((material) => ({
                            key: material,
                            label: material,
                            selected: material === entry.name,
                            onSelect: () => patchMaterial(index, { name: material }),
                          })),
                        ]}
                      />
                    </div>
                    <input
                      inputMode="numeric"
                      maxLength={3}
                      value={String(entry.pct)}
                      onChange={(event) =>
                        patchMaterial(index, {
                          pct: Number(event.target.value.replace(/\D/g, "")) || 0,
                        })
                      }
                      aria-label={`${entry.name} 占比`}
                      className="bg-transparent px-2 py-1.5 border border-line focus:border-accent w-14 text-l1 text-xs lg:text-sm text-right tabular-nums transition-colors duration-200 outline-none"
                    />
                    <span className={`${META} w-3 text-l3 shrink-0`}>%</span>
                    <button
                      type="button"
                      aria-label={`删除 ${entry.name}`}
                      onClick={() => {
                        setMaterialsTouched(true);
                        setMaterials((current) => current.filter((_, i) => i !== index));
                      }}
                      className="text-l3 lg:hover:text-accent text-xs transition-colors duration-200 cursor-pointer shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMaterialsTouched(true);
                    setMaterials((current) => [...current, { name: "聚酯纤维", pct: 0 }]);
                  }}
                  className={`${META} self-start border border-line lg:hover:border-accent px-2.5 py-1.5 text-l2 lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
                >
                  + 添加材质成分
                </button>
              </div>
            </div>

            {/* 围度留在下面单开一格：它有两到三个输入框，塞进上面那半格会把
                颜色那一格连带撑高一倍，而颜色格里是空的。
                标题带上选中的码 —— 这几个数字是照哪个码抄的，得说清楚。 */}
            {/*
              **空态走横排、有内容才竖排。**

              没有围度可填时这一格只有一句提示，竖排会让它单独占掉两行高度，
              而且提示靠左、上面每一行的值靠右 —— 一栏里两种对齐方式最扎眼。
              横排之后它和「名称 …… 未填写」读起来是同一行东西。
            */}
            {measures.length === 0 ? (
              <div className={CELL_ROW}>
                <CellLabel zh="尺码数据" />
                <div className={CELL_ROW_VALUE}>
                  <p className={`${valueText("sm")} text-l3`} style={WIDE}>
                    {category === null ? "请先填写品类" : `${category}不涉及围度`}
                  </p>
                </div>
              </div>
            ) : (
            <div className={CELL}>
              <CellLabel
                zh="尺码数据"
                hint={sizeLabel ? sizeText(sizeLabel) : undefined}
              />
              {/* 有围度可填时才竖排：里面是个两列栅格，不是一行。
                  内容区补 `min-h-11` 并底对齐 —— 它套不了 `VALUE_ROW`，
                  少了这一句整格会比上面每一格矮一截，一栏的行距就在最后一行断掉。 */}
              <div className="items-end gap-2 grid grid-cols-2 min-h-11">
                    {measures.map((key) => (
                      <label key={key} className="flex items-center gap-2">
                        {/* 胸围 / 肩宽是**字段标签**，不是单位 —— 走 DESIGN.md §3 的
                            「标签」档（text-xs lg:text-sm），不走 META 那个角标档。
                            颜色取 l2：它比格标签「尺码数据」低一级，但仍是要读的字，
                            不是 l3 那种单位与元数据。 */}
                        <span className="w-8 text-l2 text-xs lg:text-sm shrink-0">
                          {MEASURE_LABEL[key]}
                        </span>
                        <input
                          inputMode="numeric"
                          value={chart[key]}
                          onChange={(event) =>
                            setChart((current) => ({
                              ...current,
                              [key]: event.target.value.replace(/\D/g, ""),
                            }))
                          }
                          placeholder="cm"
                          className="flex-1 bg-transparent px-2 py-1.5 border border-line focus:border-accent min-w-0 text-l1 placeholder:text-l3 text-xs lg:text-sm text-right tabular-nums transition-colors duration-200 outline-none"
                        />
                      </label>
                    ))}
              </div>
            </div>
            )}

          </div>

        </Panel>

        {/*
          出分**由这颗按钮触发**，不跟着输入实时重算（见 `generate` 上面那段）。

          **它在商品信息那张面板之外**，接在它下面：
          按钮不是这张表的一个字段，塞进面板里就会被那圈框读成表的一部分 ——
          先看完整张表、再看见一颗按钮，动作的先后关系才落在版式上。
          它和面板同属上面那个 `lg:col-span-5` 的容器，所以停在这一栏的正下方。
        */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={!ready}
            // 字号字体跟隔壁「名称 / 品牌」填进去的值走（`valueText("sm")` 那一档）：
            // font-sans + medium + 14/16 + wdth 120。只取排版，不取 valueText 里的
            // `h-[1em] p-0` —— 那两条是给输入框对齐值行用的，会和这里的 py-3 打架。
            className={`w-full py-3 font-sans font-medium text-sm lg:text-base transition-colors duration-200 motion-reduce:transition-none ${
              ready
                ? "bg-accent text-card lg:hover:opacity-85 cursor-pointer"
                : "bg-l4 text-card cursor-not-allowed"
            }`}
            style={WIDE}
          >
            {report ? "重新生成评分报告" : "生成评分报告"}
          </button>
          {/* 缺必填项时不再写一句「填写品类、款式与价格后可生成」——
              按钮已经是禁用态，那三项也各自挂着「必填」，说第三遍是噪音。 */}
          {ready && stale ? (
            // 报告还挂在隔壁，但表已经改过了 —— 不说一声的话，屏幕上那个分是错的。
            <p className={`${META} text-accent text-center normal-case`}>商品信息已改动，重新生成以更新评分</p>
          ) : null}
        </div>
        </div>

        {/* ── 03 评分 ──────────────────────────────── */}
        <Panel
          id="score"
          index="03"
          zh="评分报告"
          en="Score"
          className="col-span-12 lg:col-span-7"
          action={
            result ? (
              <button
                type="button"
                onClick={() => {
                  save({ photo, name: name.trim() || sub, candidate: report!.candidate, result });
                  setSaved(sub);
                  window.setTimeout(() => setSaved(null), 2000);
                }}
                className={`${META} border border-line lg:hover:border-accent px-2.5 py-1.5 text-l2 lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
              >
                {saved ? "已存" : "存为决策记录"}
              </button>
            ) : undefined
          }
        >
          {report ? (
            <>
              <ScoreReport result={report.result} />
              {/* 追问接在报告正文下方、同一张面板里往下走（DESIGN.md §5.18）——
                  用户问的每一句都指着上面那几行分维度得分。 */}
              <ReportChat
                key={reportKey}
                candidate={report.candidate}
                result={report.result}
                wardrobeSize={liveCount}
                budgetLeft={budgetLeft}
                rescore={(patch) =>
                  // 套在 `report.candidate` 上而不是当前表单：报告是「按下那一刻」的
                  // 存档，表单后来又改过什么，跟这次假设无关。
                  scoreCandidate(
                    { ...report.candidate, ...patch },
                    items,
                    budgetLeft,
                    body,
                    snapshotAt,
                    profile.skinTone || undefined,
                  )
                }
              />
            </>
          ) : (
            /* 两句提示**不限宽**：原来挂着 `max-w-sm`（384px），而这两句都在
               390px 上下，正好卡在断点上 —— 折下来的第二行只有一个「分」字。
               这一栏本身就够宽，交给容器去决定折不折。
               `text-balance` 是窄屏的兜底：真要折时把两行匀开，不留孤字。 */
            /* `flex-1` 才是垂直居中的关键：`Panel` 的正文容器已经是
               `flex flex-col flex-1`，但这一块自己不撑满的话，就只按内容高度
               贴在顶上 —— 而 03 和 02 同处一个栅格行、高度被隔壁那张长表拉高，
               不撑满就会在下方留一大片空白。撑满之后 `justify-center` 才有意义。 */
            <div className="flex flex-col flex-1 justify-center items-center gap-2 px-6 py-16 text-center">
              <p className="text-l3 text-xs lg:text-sm text-balance leading-relaxed">
                系统将结合您的身材数据、衣橱记录与商品信息，生成本次评分。
              </p>
              <p className="text-l3 text-xs lg:text-sm text-balance leading-relaxed">
                填写品类、款式与价格即可评分；信息越完整，评分维度越充分。
              </p>
            </div>
          )}
        </Panel>

        {/* ── 04 决策记录 ──────────────────────────── */}
        <Panel
          id="history"
          index="04"
          zh="决策记录"
          en="History"
          meta={`${decisions.length} 条`}
          className="col-span-12"
        >
          {/* 「存为决策记录」按钮点完会变成「已存」—— 那句话在写盘失败时是假的。
              这一行只在真失败时出现，就在记录列表正上方。 */}
          <div className="px-4 lg:px-5 pt-3 empty:hidden">
            <SaveAlert state={saveState} />
          </div>

          {decisions.length === 0 ? (
            <p className="px-4 lg:px-5 py-8 text-l3 text-xs lg:text-sm text-center">
              尚未保存记录。衣橱数据变化后，同一件衣服的评分也会随之更新。
            </p>
          ) : (
            <ul>
              {decisions.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 lg:gap-4 px-4 lg:px-5 py-3 border-line border-b last:border-b-0"
                >
                  {entry.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.photo} alt="" className="border border-line w-10 h-10 object-cover shrink-0" />
                  ) : (
                    <span className="border border-line w-10 h-10 shrink-0" />
                  )}

                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-sans font-bold text-l1 text-sm truncate">{entry.name}</span>
                    <span className={`${META} text-l3 truncate`}>
                      {entry.candidate.category} / {entry.candidate.sub} · {yuan(entry.candidate.price)}
                    </span>
                  </span>

                  <span className="flex items-baseline gap-1 ml-auto shrink-0">
                    <span className="font-sans font-bold text-l1 text-lg lg:text-xl tabular-nums">
                      {entry.result.total}
                    </span>
                    <span className={`${META} text-l3`}>分</span>
                  </span>

                  <span className={`${META} w-20 text-l3 text-right tabular-nums shrink-0`}>{formatDate(entry.at)}</span>

                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    aria-label={`删除 ${entry.name} 的决策记录`}
                    className="text-l3 lg:hover:text-accent text-xs transition-colors duration-200 cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        </div>
      </div>

      {/* 纯白场。和衣橱 / 统计 / 日志统一 —— 分层交给发丝线，底不需要颜色。 */}
      <div aria-hidden="true" className="-z-1 fixed inset-0 bg-white pointer-events-none" />

      {consent.asking ? (
        <AiConsentDialog onAccept={consent.accept} onDecline={consent.decline} />
      ) : null}
    </div>
  );
}
