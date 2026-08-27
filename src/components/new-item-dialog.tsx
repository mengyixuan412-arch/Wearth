"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import AiConsentDialog from "@/components/ai-consent-dialog";
import CategoryIcon from "@/components/category-icons";
import DatePicker from "@/components/date-picker";
import DropdownMenu from "@/components/dropdown-menu";
import ColorField from "@/components/color-field";
import { rememberColor } from "@/components/color-picker";
import type { AiResult, LabelRead, Prefill } from "@/lib/ai/types";
import { useAiConsent } from "@/lib/ai-consent";
import { dominantColor } from "@/lib/dominant-color";
import { downscaleImage } from "@/lib/image";
import { CELL, NumberCell, VALUE_ROW, valueText } from "@/components/form-controls";
import PhotoDrop from "@/components/photo-drop";
import { META, WIDE } from "@/components/panel";
import { today } from "@/lib/date";
import { useCustomSubs } from "@/lib/custom-subs";
import { MATERIAL_NAMES } from "@/lib/scoring";
import {
  CATEGORIES,
  COLOR_PRESETS,
  FAMILY_SWATCH,
  familyOf,
  SEASONS,
  STATUSES,
  type Category,
  type Item,
  type Material,
  type Season,
} from "@/lib/wardrobe";

/** 「四季」那一格的哨兵值，不会和任何真实季节撞名。 */
const ALL_SEASONS = "__all__";

const SEASON_EN: Record<Season, string> = { 春: "Spring", 夏: "Summer", 秋: "Autumn", 冬: "Winter" };

/** 分节小标题：「01 / 选择分类」。编号走粉，是这一块里唯一的彩色。 */
function StepLabel({ index, zh }: { index: string; zh: string }) {
  return (
    <p className={`${META} flex items-baseline gap-2 mb-3 lg:mb-4`}>
      <span className="text-accent tabular-nums">{index}</span>
      <span className="text-l3">/</span>
      <span className="text-l1 tracking-[0.14em]">{zh}</span>
    </p>
  );
}

/** 钻取行。一级品类和二级品类共用一套行样式，层级只靠左边的图标区分。 */
function DrillRow({
  icon,
  label,
  onClick,
  selected,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 px-1 py-3 lg:py-3.5 border-line border-b w-full text-left transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
        selected ? "bg-accent" : "lg:hover:bg-accent-wash"
      }`}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={`flex justify-center w-6 shrink-0 ${selected ? "text-card" : "text-l2"}`}
        >
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" className="w-6 shrink-0" />
      )}
      <span className={`flex-1 min-w-0 truncate text-sm lg:text-base ${selected ? "text-card" : "text-l1"}`}>
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`font-ui text-sm lg:group-hover:translate-x-1 transition-all duration-200 motion-reduce:transition-none shrink-0 ${
          selected ? "text-card" : "text-l3 lg:group-hover:text-accent"
        }`}
      >
        →
      </span>
    </button>
  );
}

/**
 * 格子标题。整段 03 只有这一个标题样式 —— 14px、text-l1，
 * 必填标记和补充说明都挂在同一行，右边再长也不换行影响下面的值。
 */
function FieldLabel({ zh, required, hint }: { zh: string; required?: boolean; hint?: string }) {
  return (
    <span className="flex items-baseline gap-2 min-w-0">
      <span className="text-l1 text-xs lg:text-sm shrink-0">{zh}</span>
      {required ? <span className={`${META} text-accent shrink-0`}>必填</span> : null}
      {hint ? <span className={`${META} text-l3 truncate`}>{hint}</span> : null}
    </span>
  );
}

/**
 * 手填文本格。名称 / 品牌 / 尺码 / 购入渠道四处同构，共用一份 ——
 * 值的字号与宽度轴（`wdth` 105）必须一致，否则同一行里的几个手填值会看着不齐。
 */
function TextCell({
  zh,
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  zh: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  placeholder: string;
}) {
  return (
    <div className={CELL}>
      <FieldLabel zh={zh} />
      <div className={VALUE_ROW}>
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${valueText("md")} flex-1 bg-transparent min-w-0 text-l1 outline-none placeholder:text-l3`}
          style={{ fontVariationSettings: '"wdth" 105' }}
        />
      </div>
    </div>
  );
}

/**
 * 分段选择控件。状态（单选）、季节（多选）、色系（单选）共用这一套 ——
 * 三处各写各的样式，正是上一版看起来乱的原因。
 *
 * 套在 `VALUE_ROW` 里，和隔壁输入格底对齐；字号固定 14px，是选择控件这一档。
 */
function Segmented({
  options,
  isOn,
  onPick,
  trailing,
}: {
  options: { value: string; label: string; swatch?: string }[];
  isOn: (value: string) => boolean;
  onPick: (value: string) => void;
  /** 末位追加一个自带交互的格子（色系的取色器走这里）。 */
  trailing?: React.ReactNode;
}) {
  return (
    <div className={VALUE_ROW}>
      <div className="flex flex-1 gap-px bg-line border border-line min-w-0">
        {options.map((option) => {
          const on = isOn(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(option.value)}
              className={`flex flex-1 justify-center items-center gap-1.5 py-2 lg:py-2.5 min-w-0 text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
                on ? "bg-accent text-card" : "bg-card text-l2 lg:hover:bg-accent-wash"
              }`}
            >
              {option.swatch ? (
                <span
                  aria-hidden="true"
                  className="block border border-line w-3.5 h-3.5 shrink-0"
                  style={{ backgroundColor: option.swatch }}
                />
              ) : null}
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
        {trailing}
      </div>
    </div>
  );
}

/** 成分表编辑器。结构化存储，决策④要按成分逐项加权（PRD 6.2）。 */
function MaterialEditor({ value, onChange }: { value: Material[]; onChange: (next: Material[]) => void }) {
  const total = value.reduce((sum, entry) => sum + entry.pct, 0);
  const labelInput = useRef<HTMLInputElement | null>(null);
  // 照片外发前问一次，同意过就不再打扰
  const consent = useAiConsent();
  const [reading, setReading] = useState<"idle" | "running" | "failed">("idle");

  /**
   * 拍水洗标读成分。**只读标签上印的文字，不看面料**（PRD §8）——
   * 从照片判断成分不可靠，会给出错误的养护建议，反而害了用户的衣服。
   *
   * 读到就**整表替换**，不和已填的合并：水洗标列的是这件衣服的完整成分，
   * 合并只会得到一份加起来超过 100 的表。这也是它和自动预填的区别 ——
   * 用户是主动点了这颗按钮，覆盖是他要的结果。
   */
  const readLabel = async (file: File) => {
    setReading("running");
    try {
      const image = await downscaleImage(file);
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "label", images: [image] }),
      });
      const result = (await response.json()) as AiResult<LabelRead>;
      if (!result.ok || result.value.materials.length === 0) {
        setReading("failed");
        return;
      }
      onChange(result.value.materials);
      setReading("idle");
    } catch {
      setReading("failed");
    }
  };
  const patch = (index: number, next: Partial<Material>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));

  return (
    <>
    <div className="flex flex-col justify-center gap-2.5 min-h-12">
      {value.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* 走全站同一套下拉，不用原生 select —— 面板 portal 到 body，
              不会被弹窗正文那层 overflow-y-auto 裁断。 */}
          <div className="flex-1 min-w-0">
            <DropdownMenu
              label={entry.name}
              ariaLabel="成分名称"
              triggerIcon={null}
              triggerClassName="w-full"
              width={168}
              maxHeight={280}
              groups={[
                MATERIAL_NAMES.map((name) => ({
                  key: name,
                  label: name,
                  selected: name === entry.name,
                  onSelect: () => patch(index, { name }),
                })),
              ]}
            />
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={String(entry.pct)}
            onChange={(event) => patch(index, { pct: Number(event.target.value.replace(/\D/g, "")) || 0 })}
            className="bg-transparent px-2 py-1.5 border border-line focus:border-accent w-14 text-l1 text-xs lg:text-sm text-right tabular-nums transition-colors duration-200 outline-none"
          />
          <span className={`${META} w-3 text-l3 shrink-0`}>%</span>
          <button
            type="button"
            aria-label={`删除 ${entry.name}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="px-2 py-1.5 border border-line lg:hover:border-accent text-l3 lg:hover:text-accent text-xs transition-colors duration-200 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange([...value, { name: MATERIAL_NAMES[0], pct: 0 }])}
          className={`${META} border border-line px-2.5 py-1.5 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
        >
          + 手动填写
        </button>

        {/* 识别水洗标。**和「手动填写」并排，不做成主路径** —— 手填三行成分
            比掏出手机对着裤腰拍一张快，这颗按钮是给成分多、看不清的那些衣服的。

            **名字里的「水洗标」不能省。** 材质只从标签文字读，绝不从面料照片识别
            （PRD §8）—— 叫「拍照识别成分」用户就会去拍面料，而错的成分会给出
            错的养护建议。也不叫「拍」：桌面端没有拍照这个动作，是选文件。 */}
        <button
          type="button"
          onClick={() => labelInput.current?.click()}
          className={`${META} border border-line px-2.5 py-1.5 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
        >
          {reading === "running" ? "识别中…" : "识别水洗标"}
        </button>
        <input
          ref={labelInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) consent.guard(() => void readLabel(file));
            event.target.value = "";
          }}
        />

        {reading === "failed" ? (
          <span className={`${META} text-l3`}>未能识别，请手动填写</span>
        ) : null}
        {/* 只报事实、不拦保存 —— 水洗标上本来就有加起来不到 100 的。
            **一条成分都没加时不显示**：那时它只是把空列表加了一遍，
            读出来是个恒为 0 的算式，不告诉用户任何事。 */}
        {value.length > 0 ? (
          <span className={`${META} ml-auto tabular-nums ${total === 100 ? "text-l3" : "text-accent"}`}>
            合计 {total}%
          </span>
        ) : null}
      </div>
    </div>
      {consent.asking ? (
        <AiConsentDialog onAccept={consent.accept} onDecline={consent.decline} />
      ) : null}
    </>
  );
}

/**
 * 录入弹窗。
 *
 * **分两段展开**：先只问分类和照片（参考稿的 01 / 02），选定二级品类之后
 * 弹窗才加宽、把价格日期和其余属性铺开。录入速度是这个产品的生死线
 * （PRD 6.2），一上来就摊开十几个字段会让人先关掉。
 *
 * 父页的模糊由这里的 backdrop-blur 负责 —— 不去动父页自己的 filter，
 * 那会让 fixed 定位的子元素脱离视口，整页会错位。
 */
export default function NewItemDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: Omit<Item, "id">) => void;
}) {
  // 和 MaterialEditor 那个各自独立，但共用同一份磁盘状态：一处同意，两处都不再问
  const consent = useAiConsent();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 内置 + 用户自建的二级品类。自建项在「添加衣物分类」里维护。
  const { subsOf } = useCustomSubs();
  const [category, setCategory] = useState<Category | null>(null);
  const [sub, setSub] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState("");
  const [boughtAt, setBoughtAt] = useState(today());
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  // 色系以 hex 为唯一真值 —— 预设点一下就是那一档的代表色，自定义则是用户挑的
  // 精确值；`colorFamily` 由它推出来，只用于衣橱列表的筛选归属。
  const [color, setColor] = useState<string>(FAMILY_SWATCH["黑"]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  /**
   * AI 预填的状态。传完图自动跑一次，**跑的时候要看得见** —— 七秒的静默
   * 会让人以为传图失败了。
   */
  const [prefill, setPrefill] = useState<"idle" | "running" | "failed">("idle");
  /**
   * 抠图。**原图始终留着** —— 抠出来的结果未必比原图好（背景杂、多件入镜时
   * 会把衣架和旁边的东西一起留下），得让用户自己选，而且默认可退回。
   */
  const [cutState, setCutState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [original, setOriginal] = useState("");
  const [cutout, setCutout] = useState("");
  /**
   * 色系有没有被用户动过。
   *
   * 其余三项的「没动过」都能从值本身看出来（品类是 null、款式是空串、季节是空数组），
   * 只有色系的初值就是一个真实颜色（黑），分不清「默认」和「用户选了黑」——
   * 所以单独记一个标志。**AI 不许覆盖用户已经做过的选择**（§5 ②）。
   */
  const [colorTouched, setColorTouched] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [size, setSize] = useState("");
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");
  // 可取消选中，所以要能表示「一个都没选」—— null 在保存时落回「在用」。
  const [status, setStatus] = useState<(typeof STATUSES)[number] | null>("在用");

  // 每次重新打开都从空表开始 —— 上一件的残留值会被误当成这一件的。
  useEffect(() => {
    if (!open) return;
    setCategory(null);
    setSub("");
    setImage("");
    setPrice("");
    setBoughtAt(today());
    setName("");
    setBrand("");
    setColor(FAMILY_SWATCH["黑"]);
    setColorTouched(false);
    setPrefill("idle");
    setCutState("idle");
    setOriginal("");
    setCutout("");
    setSeasons([]);
    setMaterials([]);
    setSize("");
    setChannel("");
    setNote("");
    setStatus("在用");
  }, [open]);

  // 取色器展开时按 Esc 应该只关它 —— 这一层由 `ColorField` 在捕获阶段拦下并掐断传播，
  // 事件到不了这里的冒泡监听，所以下面不必再为它留一个分支。
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!sub) list.push("品类");
    if (price.trim() === "" || Number(price) <= 0) list.push("价格");
    if (!boughtAt) list.push("购入日期");
    return list;
  }, [boughtAt, price, sub]);

  if (!open || !mounted) return null;

  const save = () => {
    if (missing.length > 0 || !category) return;
    rememberColor(color);
    onSave({
      name: name.trim() || sub,
      category,
      sub,
      price: Number(price),
      care: 0,
      careLog: [],
      wears: 0,
      image,
      color,
      colorFamily: familyOf(color),
      // 留空按四季处理，否则「本季还没穿过」永远不会纳入它（附录 C）
      seasons: seasons.length > 0 ? seasons : [...SEASONS],
      brand: brand.trim() || "未填写",
      boughtAt,
      // 留空按「在用」处理：刚录进来的衣服默认就是在穿的，
      // 而 Item.status 是必填字段（闲置 / 已处置要显式选）。
      status: status ?? "在用",
      materials: materials.filter((entry) => entry.pct > 0),
      size: size.trim() || undefined,
      channel: channel.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  const allFourSeasons = seasons.length === SEASONS.length;

  /**
   * 传完图跑一次识别，把认出来的字段回填进表单。
   *
   * **只填用户还没动过的字段。** AI 是预填不是决定（§5 ②）—— 用户先选了品类
   * 再传图，说明他已经做过判断，模型没有资格覆盖它。
   *
   * 品类与款式**要么一起填、要么都不填**：二级品类名不是全局唯一的（「开衫」
   * 同时挂在内搭与外套下，附录 A），把模型的款式塞进用户选的一级里，
   * 可能得到一个那一级里根本不存在的组合。
   *
   * 失败不弹任何东西，就是一张空表单 —— 用户照常手填（§5 ②）。
   */
  const runPrefill = async (dataUrl: string) => {
    setPrefill("running");
    try {
      const response = await fetch("/api/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const result = (await response.json()) as AiResult<Prefill>;
      if (!result.ok) {
        setPrefill("failed");
        return;
      }

      const guess = result.value;
      // 用函数式更新读当前值：这个回调跑在几秒之后，闭包里的 category / sub
      // 是发起那一刻的旧值，期间用户很可能已经自己选了。
      setCategory((current) => {
        if (current !== null || !guess.category) return current;
        if (guess.sub) setSub(guess.sub);
        return guess.category;
      });
      /* 颜色**优先用从图里取到的真实主色调**，模型的色系只是兜底。
         `FAMILY_SWATCH["粉"]` 是一个固定示意色 —— 藕粉和桃粉填进去会是同一个值。

         这里用没抠过的原图 + 中心区域，所以要拿模型的色系做一次校验：
         万一取到的是背景，两者会落在不同色系，那就以模型的为准。
         抠图完成后还会再取一次（那次更准，不需要校验）。 */
      if (!colorTouched) {
        const picked = await dominantColor(dataUrl, true);
        const agreed = picked && (!guess.colorFamily || familyOf(picked) === guess.colorFamily);
        if (agreed && picked) setColor(picked);
        else if (guess.colorFamily) setColor(FAMILY_SWATCH[guess.colorFamily]);
      }
      setSeasons((current) => (current.length > 0 ? current : guess.seasons));

      setPrefill("idle");
    } catch {
      setPrefill("failed");
    }
  };

  /**
   * 抠图。和识别**并行**跑 —— 两个都要十秒上下，串起来用户要等二十秒。
   *
   * 失败不打断任何事：`image` 保持原图，录入照常。抠图纯粹是视觉效果，
   * 不喂任何评分维度（§5 ②）。
   */
  const runCutout = async (dataUrl: string) => {
    setCutState("running");
    try {
      const response = await fetch("/api/cutout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const result = (await response.json()) as AiResult<string>;
      if (!result.ok) {
        setCutState("failed");
        return;
      }
      setCutout(result.value);
      // 抠成了就默认用它 —— 那是用户点上传时期待的结果，想退回原图有切换。
      setImage(result.value);
      setCutState("done");

      /* **抠完再取一次色，这次最准。** 取色最难的一步是「哪些像素是衣服、
         哪些是背景和衣架」，而透明底已经把这件事替我们做完了：
         不透明的像素就是衣服本身。所以这次不需要拿模型的色系再校验一遍。 */
      if (!colorTouched) {
        const picked = await dominantColor(result.value);
        if (picked) setColor(picked);
      }
    } catch {
      setCutState("failed");
    }
  };

  const expanded = sub !== "";

  /**
   * Portal 到 body：ScrollShell 在首页会套一层 Lenis 平滑滚动容器，
   * 弹窗留在那棵子树里，滚轮会被 Lenis 先接走，内部滚不动。
   * 挂到 body 上就彻底脱离了它的管辖，顺带也不受任何祖先的层叠上下文影响。
   */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="添加一件衣物"
      className="z-50 fixed inset-0 flex justify-center items-center bg-l1/25 backdrop-blur-md p-4 lg:p-8"
      onPointerDown={(event) => {
        // 只有点在遮罩本身（不是弹窗内部）才关，避免拖选文字时误关
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`flex flex-col bg-card shadow-2xl border border-l4 w-full max-h-[88vh] overflow-hidden transition-[max-width] duration-500 ease-66 motion-reduce:transition-none ${
          expanded ? "max-w-6xl" : "max-w-4xl"
        }`}
      >
        {/* ── 头 ─────────────────────────────────── */}
        <header className="relative flex flex-col items-start gap-2 lg:gap-2.5 pr-14 lg:pr-16 pl-5 lg:pl-7 py-4 lg:py-5 border-line border-b shrink-0">
          <p className={`${META} text-l3 tracking-[0.2em]`}>New Archive Object</p>
          <h2 className="font-sans font-bold text-l1 text-lg lg:text-2xl leading-none" style={WIDE}>
            添加一件衣物
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="top-1/2 right-4 lg:right-6 absolute flex justify-center items-center border border-l4 lg:hover:border-accent w-7 lg:w-8 h-7 lg:h-8 text-l2 lg:hover:text-accent text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer -translate-y-1/2"
          >
            ✕
          </button>
        </header>

        {/* ── 身 ─────────────────────────────────── */}
        {/* `data-lenis-prevent`：Lenis 在 layout 里全局接管滚轮，不加这个属性，
            弹窗内部永远收不到滚轮事件（实测滚 5 下 scrollTop 仍是 0）。
            这里也**不套 no-scrollbar** —— 弹窗里必须让人看见还有内容没露出来。 */}
        <div data-lenis-prevent className="flex-1 min-h-0 overflow-y-auto">
          <div className="gap-px grid grid-cols-1 md:grid-cols-2 bg-line">
            {/* 01 分类：一级 → 二级 钻取 */}
            <section className="bg-card px-5 lg:px-7 py-4 lg:py-5">
              <StepLabel index="01" zh="选择分类" />

              {sub !== "" && category !== null ? (
                // 选定之后列表就没用了，收成一行 —— 它占着 400 多像素，
                // 而下半段的字段才是这时候要看的东西。
                <div className="flex items-center gap-3 bg-accent px-3 py-3">
                  <span aria-hidden="true" className="text-card shrink-0">
                    <CategoryIcon category={category} />
                  </span>
                  <span className="flex-1 min-w-0 font-sans font-bold text-card text-sm lg:text-base truncate">
                    {category} / {sub}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSub("")}
                    className={`${META} bg-card px-2.5 py-1.5 text-l1 lg:hover:text-accent transition-colors duration-200 cursor-pointer shrink-0`}
                  >
                    更改
                  </button>
                </div>
              ) : category === null ? (
                <div className="border-line border-t">
                  {CATEGORIES.map((entry) => (
                    <DrillRow
                      key={entry}
                      icon={<CategoryIcon category={entry} />}
                      label={entry}
                      onClick={() => setCategory(entry)}
                    />
                  ))}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory(null);
                      setSub("");
                    }}
                    className={`${META} flex items-center gap-2 mb-2 text-l2 lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
                  >
                    <span aria-hidden="true">←</span>
                    <CategoryIcon category={category} className="w-4 h-4" />
                    {category}
                  </button>

                  <div className="border-line border-t">
                    {subsOf(category).map((entry) => (
                      <DrillRow
                        key={entry}
                        label={entry}
                        selected={sub === entry}
                        onClick={() => setSub(entry)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 02 照片 */}
            <section className="flex flex-col bg-card px-5 lg:px-7 py-4 lg:py-5">
              <StepLabel index="02" zh="上传照片" />

              <PhotoDrop
                value={image || null}
                onChange={(next) => {
                  setImage(next ?? "");
                  setOriginal(next ?? "");
                  setCutout("");
                  if (next) {
                    // 两个并行跑，但只会弹一次确认 —— 第二个会并进同一个 pending
                    consent.guard(() => void runPrefill(next));
                    consent.guard(() => void runCutout(next));
                  } else {
                    setPrefill("idle");
                    setCutState("idle");
                  }
                }}
                title="上传一张清晰的单品照"
                /* 商品主图排最前，因为它**不用用户多做任何事** —— 网购的衣服
                   详情页主图就是棚拍：纯色底、光线均匀、单件入镜，正是抠图最吃的条件。 */
                hint="优先上传商品主图；自行拍摄请单件平铺、背景简洁，识别更准确。"
                alt="单品照片"
                ariaLabel={image ? "更换单品照片" : "上传单品照片"}
                className={`flex-1 w-full ${sub === "" ? "min-h-56 lg:min-h-72" : "min-h-36 lg:min-h-40"}`}
              />

              {/* 没图的时候整行不渲染 —— 空着只会在投放区下面留一截白 */}
              {image ? (
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {/* 抠成了就给切换：**抠图未必比原图好**（背景杂、多件入镜时会把
                      衣架和旁边的东西一起留下），让用户自己看着选。
                      默认选抠图 —— 那是点上传时期待的结果。 */}
                  {cutState === "done" ? (
                    <div className="flex gap-px bg-line border border-frame">
                      {([["抠图", cutout], ["原图", original]] as const).map(([label, value]) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={image === value}
                          onClick={() => setImage(value)}
                          className={`${META} px-2.5 py-1 transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
                            image === value ? "bg-accent text-card" : "bg-card text-l2 lg:hover:bg-accent-wash"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* 一行说完两件事。**成功不出声** —— 证据是表单里多出来的值和
                      换掉的那张图，再写一句「识别成功」是噪音。
                      失败也只是陈述，不加感叹号、不给重试：手填和原图本来就是主路径。 */}
                  <span className={`${META} min-w-0 text-l2 truncate`}>
                    {prefill === "running" || cutState === "running" ? "正在识别并去除背景…" : null}
                    {prefill !== "running" && cutState === "failed" ? "未能去除背景，已保留原图" : null}
                    {prefill === "failed" && cutState !== "running" && cutState !== "failed"
                      ? "未能识别，请在下方手动填写"
                      : null}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setImage("");
                      setOriginal("");
                      setCutout("");
                      setPrefill("idle");
                      setCutState("idle");
                    }}
                    className={`${META} ml-auto border border-frame px-2 py-1 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 cursor-pointer shrink-0`}
                  >
                    移除
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          {/* ── 选定二级品类后才展开的后半段 ─────────────
               排版规矩，整段只有三档：
                 标题 14px · 手填值 24px · 选择控件 14px
               并且**输入格和选择格不混排** —— 一行里既有 24px 的数字又有
               一排按钮，无论怎么对齐都会显得高低不齐。所以前两行全是输入，
               第三行全是选择，各自行内自然对得上。 */}
          {expanded ? (
            <div className="border-line border-t">
              <div className="px-5 lg:px-7 pt-4 lg:pt-5">
                <StepLabel index="03" zh="填写信息" />
              </div>

              {/* 输入行 A：认它 —— 这件衣服是什么。三项全选填，
                  名称留空则按二级品类名入库（placeholder 就是那个名字）。 */}
              <div className="gap-px grid grid-cols-1 sm:grid-cols-3 bg-line border-line border-t">
                <TextCell zh="名称" value={name} onChange={setName} maxLength={24} placeholder={sub} />
                <TextCell zh="品牌" value={brand} onChange={setBrand} maxLength={24} placeholder="优衣库" />
                <TextCell zh="尺码" value={size} onChange={setSize} maxLength={10} placeholder="M" />
              </div>

              {/* 输入行 B：这笔买卖 —— 价格、渠道、日期。两项必填。
                  和单品详情页「品牌 / 尺码是身份，渠道 / 价格 / 日期是账」同一套分组。 */}
              <div className="gap-px grid grid-cols-1 sm:grid-cols-3 bg-line border-line border-t">
                <NumberCell
                  zh="购入价格"
                  unit="元"
                  required
                  value={price}
                  placeholder="399"
                  step={50}
                  max={999999}
                  size="md"
                  onChange={setPrice}
                />
                <TextCell
                  zh="购入渠道"
                  value={channel}
                  onChange={setChannel}
                  maxLength={16}
                  placeholder="淘宝"
                />
                <div className={CELL}>
                  <FieldLabel zh="购入日期" required />
                  <div className={VALUE_ROW}>
                    <DatePicker
                      value={boughtAt}
                      onChange={setBoughtAt}
                      label="购入日期"
                      max={today()}
                      variant="cell"
                      size="md"
                    />
                  </div>
                </div>
              </div>

              {/* 选择行：状态单选 + 季节多选，同一套分段控件 */}
              <div className="gap-px grid grid-cols-1 sm:grid-cols-2 bg-line border-line border-t">
                <div className={CELL}>
                  <FieldLabel zh="穿着状态" />
                  <Segmented
                    options={STATUSES.map((option) => ({ value: option, label: option }))}
                    isOn={(value) => status === value}
                    // 再点一下取消选中 —— 状态是三选一里唯一可留空的，
                    // 留空即「在用」，不必为最常见的那一档专门点一次。
                    onPick={(value) =>
                      setStatus((current) =>
                        current === value ? null : (value as (typeof STATUSES)[number]),
                      )
                    }
                  />
                </div>
                <div className={CELL}>
                  <FieldLabel zh="季节" />
                  <Segmented
                    // 「四季」是个开关不是第五个季节：点亮它就是四个全选，
                    // 再点一次全清。四个都选中时它自己也显示为选中。
                    options={[
                      ...SEASONS.map((option) => ({ value: option, label: option })),
                      { value: ALL_SEASONS, label: "四季" },
                    ]}
                    // 存的仍是四个季节（附录 C：「四季」款 = 全集，季节窗口判定要靠它），
                    // 但界面上四季与单季**互斥显示** —— 全选时只点亮「四季」，
                    // 春夏秋冬一起亮着等于把同一件事说两遍。
                    isOn={(value) =>
                      value === ALL_SEASONS
                        ? allFourSeasons
                        : !allFourSeasons && seasons.includes(value as Season)
                    }
                    onPick={(value) => {
                      if (value === ALL_SEASONS) {
                        setSeasons(allFourSeasons ? [] : [...SEASONS]);
                        return;
                      }
                      setSeasons((current) =>
                        // 正处在「四季」上再点单季，是要改成只穿那一季
                        current.length === SEASONS.length
                          ? [value as Season]
                          : current.includes(value as Season)
                            ? current.filter((entry) => entry !== value)
                            : [...current, value as Season],
                      );
                    }}
                  />
                </div>
              </div>

              {/* 色系与材质左右分栏。色系用圆点不用带文字的分段控件 ——
                  颜色本身就是标签，写出「白/黑/灰」反而多一层转译。 */}
              <div className="gap-px grid grid-cols-1 md:grid-cols-2 bg-line border-line border-t">
                <div className={CELL}>
                  <FieldLabel zh="色系" />
                  <div className={VALUE_ROW}>
                    <ColorField
                      value={color}
                      onChange={(hex) => {
                        setColor(hex);
                        setColorTouched(true);
                      }}
                      presets={COLOR_PRESETS}
                      /* 直接在刚传的那张单品照上点着取色 —— 比在方块里凭眼睛拖准得多。
                         没传图时 `""` 是假值，取样条不渲染。 */
                      sampleImage={image || null}
                    />
                  </div>
                </div>

                <div className={CELL}>
                  <FieldLabel zh="材质成分" />
                  <MaterialEditor value={materials} onChange={setMaterials} />
                </div>
              </div>

              <div className={`${CELL} border-line border-t`}>
                <FieldLabel zh="备注" />
                <textarea
                aria-label="备注"
                  value={note}
                  maxLength={200}
                  rows={2}
                  placeholder="记下搭配灵感、穿着感受，和下次要留意的细节"
                  onChange={(event) => setNote(event.target.value)}
                  className="bg-transparent p-0 w-full min-h-12 text-l1 text-sm leading-relaxed outline-none resize-none placeholder:text-l3"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* ── 脚 ─────────────────────────────────── */}
        <footer className="flex justify-end items-center gap-4 bg-be/40 px-5 lg:px-7 py-3.5 lg:py-4 border-line border-t shrink-0">
          <button
            type="button"
            onClick={save}
            disabled={missing.length > 0}
            className="group flex items-center gap-3 bg-accent disabled:bg-l4 px-5 py-3 text-card transition-opacity duration-200 lg:enabled:hover:opacity-85 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <span className="font-sans font-bold text-sm lg:text-base" style={WIDE}>
              存入衣橱
            </span>
            <span
              aria-hidden="true"
              className="lg:group-enabled:group-hover:translate-x-1 font-ui text-sm transition-transform duration-200"
            >
              →
            </span>
          </button>
        </footer>
      </div>

      {consent.asking ? (
        <AiConsentDialog onAccept={consent.accept} onDecline={consent.decline} />
      ) : null}
    </div>,
    document.body,
  );
}
