"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import CategoryIcon from "@/components/category-icons";
import DatePicker from "@/components/date-picker";
import ColorField from "@/components/color-field";
import DropdownMenu from "@/components/dropdown-menu";
import { META, WIDE } from "@/components/panel";
import WearCalendar from "@/components/wear-calendar";
import { formatDate, formatDateShort, today } from "@/lib/date";
import { useOotd, type OotdMap } from "@/lib/ootd-store";
import { MATERIAL_NAMES } from "@/lib/scoring";
import {
  CATEGORIES,
  COLOR_PRESETS,
  SEASONS,
  STATUSES,
  SUBCATEGORIES,
  cpw,
  familyOf,
  toggleSeason,
  type CareRecord,
  type Item,
  type Material,
} from "@/lib/wardrobe";

/** 抽屉里所有分节共用的内边距。 */
const PAD = "px-5 lg:px-7";

/**
 * 只读态的值。**空的字段照样占一行，显示弱化的「未填写」** ——
 * 直接把空行藏掉的话，用户根本不知道还有这个字段可以补，
 * 而 PRD 6.2 的「先入库、后补全」正指着这条路。
 */
function Filled({ text }: { text: string }) {
  return text ? <>{text}</> : <span className="text-l3">未填写</span>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5 border-line border-b">
      <span className={`${META} w-20 text-l2 shrink-0`}>{label}</span>
      <span className="flex-1 min-w-0 text-l1 text-xs lg:text-sm text-right">{value}</span>
    </div>
  );
}

/**
 * 分节标题。**必须明显大于它下面的字段标签**，否则整段的层级是塌的 ——
 * 之前标题和标签同为 12px，只靠颜色区分，读起来像一串并列的标签。
 * 走「正文」档 + bold + wdth 110（卡片级标题的宽度轴）。
 */
function SectionTitle({ zh, hint }: { zh: string; hint?: React.ReactNode }) {
  return (
    <p className="flex items-baseline gap-2 mb-3">
      <span
        className="font-sans font-bold text-l1 text-sm lg:text-base leading-none"
        style={{ fontVariationSettings: '"wdth" 110' }}
      >
        {zh}
      </span>
      {hint ? <span className={`${META} text-l2`}>{hint}</span> : null}
    </p>
  );
}

/**
 * 可就地编辑的属性行。看起来和只读的 `Row` 一样（同样的行高、同样右对齐），
 * 聚焦时才显出下划线 —— 平时是一张规格表，需要补的时候直接点进去写。
 *
 * 值在失焦时才提交，不是每敲一个字符就写一次 localStorage。
 */
function EditRow({
  label,
  value,
  placeholder,
  maxLength,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // 切换单品时抽屉不重挂，本地草稿要跟着换过去
  useEffect(() => setDraft(value), [value]);

  return (
    <label className="flex items-baseline gap-3 py-2.5 border-line border-b cursor-text">
      <span className={`${META} w-20 text-l2 shrink-0`}>{label}</span>
      <input
        type="text"
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft.trim())}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        // placeholder 必须弱化到 l3。写成 l1 会和真实值同色 ——
        // 空着的「尺码」显示一个正常黑度的「M」，用户以为已经填过了，
        // 退出编辑态才发现是「未填写」。
        className="flex-1 bg-transparent border-transparent focus:border-accent border-b min-w-0 text-l1 text-xs lg:text-sm text-right transition-colors duration-200 outline-none placeholder:text-l3"
      />
    </label>
  );
}

/**
 * 数字属性行。目前只有购入价格用它 —— 价格进 CPW 的分子，
 * 空值和 0 都会让 CPW 失去意义，所以**读不出正数就退回原值**，不写脏数据。
 */
function NumberRow({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const next = Number(draft);
    if (Number.isFinite(next) && next > 0) onCommit(Math.round(next));
    else setDraft(String(value));
  };

  return (
    <label className="flex items-baseline gap-3 py-2.5 border-line border-b cursor-text">
      <span className={`${META} w-20 text-l2 shrink-0`}>{label}</span>
      <span className="flex flex-1 justify-end items-baseline gap-1 min-w-0">
        <span className="text-l3 text-xs lg:text-sm">¥</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          maxLength={7}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          className="bg-transparent border-transparent focus:border-accent border-b w-24 text-l1 text-xs lg:text-sm text-right tabular-nums transition-colors duration-200 outline-none"
        />
      </span>
    </label>
  );
}

/** 成分表的只读+编辑混合行。加减成分直接落到单品上，供决策④取用。 */
function MaterialRows({
  value,
  onChange,
}: {
  value: Material[];
  onChange: (next: Material[]) => void;
}) {
  const patch = (index: number, next: Partial<Material>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));

  return (
    <div className="flex flex-col gap-2">
      {value.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* 走全站同一套下拉（DESIGN.md §5.4），不用原生 select —— 原生弹的是系统菜单，
              选中态由系统画，塞不进对勾也压不住高亮色。面板 portal 到 body，
              不会被抽屉正文那层 overflow-y-auto 裁断；14 种成分放不下，所以传 maxHeight。 */}
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
            aria-label="成分占比"
            className="bg-transparent px-2 py-1.5 border border-line focus:border-accent w-14 text-l1 text-xs lg:text-sm text-right tabular-nums transition-colors duration-200 outline-none"
          />
          <span className={`${META} w-3 text-l3 shrink-0`}>%</span>
          <button
            type="button"
            aria-label={`删除 ${entry.name}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="text-l3 lg:hover:text-accent text-xs transition-colors duration-200 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, { name: MATERIAL_NAMES[0], pct: 0 }])}
        className={`${META} self-start border border-line px-2.5 py-1.5 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
      >
        + 添加材质成分
      </button>
    </div>
  );
}

/** 三个核心读数。CPW 是主角，所以它独占一格且字号最大。 */
function Readouts({ item }: { item: Item }) {
  const value = cpw(item);
  const invested = item.price + item.care;

  return (
    <div className="gap-px grid grid-cols-3 bg-line border-line border-y">
      <div className="bg-card px-3 py-3.5">
        <p className={`${META} mb-1.5 text-l2`}>单次成本</p>
        {value === null ? (
          <p className="font-sans font-bold text-l2 text-lg leading-none" style={WIDE}>
            尚未穿着
          </p>
        ) : (
          <p className="font-sans font-bold text-accent text-2xl lg:text-3xl leading-none" style={WIDE}>
            ¥{value.toFixed(value >= 100 ? 0 : 1)}
          </p>
        )}
      </div>
      <div className="bg-card px-3 py-3.5">
        <p className={`${META} mb-1.5 text-l2`}>穿着次数</p>
        <p className="font-sans font-bold text-l1 text-2xl lg:text-3xl leading-none tabular-nums" style={WIDE}>
          {item.wears}
        </p>
      </div>
      <div className="bg-card px-3 py-3.5">
        <p className={`${META} mb-1.5 text-l2`}>已投入</p>
        <p className="font-sans font-bold text-l1 text-2xl lg:text-3xl leading-none tabular-nums" style={WIDE}>
          ¥{invested}
        </p>
      </div>
    </div>
  );
}

/** 记录行右侧的「改」。12px 见方，和同排的 ✕ 一样只有描边，不填色。 */
function PencilIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="block w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M8.1 1.4 10.6 3.9 4.4 10.1 1.4 10.6 1.9 7.6z" strokeLinejoin="round" />
      <path d="M7.1 2.4 9.6 4.9" />
    </svg>
  );
}

/** 「添加穿搭记录」下拉的触发图标。规格同 `filter-icons`：15px、24 视框、描边 1.7。 */
function CalendarIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 养护记账的一行输入。**新增与修改共用这一份** —— 两处的字段、校验、退出方式
 * 完全一样，各写一份迟早会漂。列序也跟着上面的列表走（日期 / 备注 / 金额），
 * 改的时候值就落在它原来那一列上，眼睛不用重新找。
 */
function CareFields({
  date,
  amount,
  note,
  marked,
  onDate,
  onAmount,
  onNote,
  onCancel,
  onSubmit,
}: {
  date: string;
  amount: string;
  note: string;
  marked: string[];
  onDate: (value: string) => void;
  onAmount: (value: string) => void;
  onNote: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const canSave = Number(amount) > 0 && date !== "";

  return (
    /**
     * Esc 退出。**必须掐断冒泡** —— 抽屉的关闭监听挂在 document 的冒泡阶段，
     * 不拦住的话按一下 Esc 会把整个抽屉一起关掉，用户想退的只是这半张草稿。
     * 日历浮层自己在捕获阶段先接走 Esc，两层不会打架。
     */
    <div
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      <DatePicker value={date} onChange={onDate} label="养护日期" max={today()} marked={marked} />
      <input
        type="text"
        value={note}
        maxLength={16}
        placeholder="干洗"
        onChange={(event) => onNote(event.target.value)}
        aria-label="养护备注"
        className="flex-1 bg-transparent px-2 py-1.5 border border-line focus:border-accent min-w-24 text-l1 text-xs lg:text-sm transition-colors duration-200 outline-none"
      />
      <input
        type="text"
        inputMode="decimal"
        value={amount}
        maxLength={6}
        placeholder="金额"
        autoFocus
        onChange={(event) => onAmount(event.target.value.replace(/[^\d.]/g, ""))}
        aria-label="养护金额"
        className="bg-transparent px-2 py-1.5 border border-line focus:border-accent w-20 text-l1 text-xs lg:text-sm text-right tabular-nums transition-colors duration-200 outline-none shrink-0"
      />
      {/* 退出口在前、落定在后 —— 和页脚的「取消 / 确认删除」同一个次序 */}
      <button
        type="button"
        onClick={onCancel}
        className={`${META} shrink-0 border border-line px-3 py-1.5 text-l2 lg:hover:border-l1 lg:hover:text-l1 transition-colors duration-200 cursor-pointer`}
      >
        取消
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSave}
        className={`${META} shrink-0 px-3 py-1.5 transition-colors duration-200 ${
          canSave ? "bg-accent text-card lg:hover:opacity-85 cursor-pointer" : "bg-l4 text-card cursor-not-allowed"
        }`}
      >
        保存
      </button>
    </div>
  );
}

/**
 * 养护记账。**这是 CPW 分子的组成部分**（PRD 附录 B），不是附属信息 ——
 * 金额进分子、日期决定它挂在支出趋势的哪个月，所以两样都要填。
 */
function CareLog({
  item,
  onAdd,
  onUpdate,
  onRemove,
}: {
  item: Item;
  onAdd: (record: CareRecord) => void;
  onUpdate: (index: number, record: CareRecord) => void;
  onRemove: (index: number) => void;
}) {
  /** 正在改第几条。改是**就地**发生的：那一行本身换成输入，不在底下另开一行。 */
  const [editing, setEditing] = useState<number | null>(null);
  /** 底下那张「记一笔新的」表单开着没有。 */
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");

  const log = item.careLog ?? [];
  const marked = log.map((record) => record.date);

  /** 收起表单并清空这半张草稿。留着的话下次点开是上次写了一半的东西。 */
  const reset = () => {
    setAmount("");
    setNote("");
    setDate(today());
    setEditing(null);
    setAdding(false);
  };

  /**
   * 点铅笔：把那一条灌进字段，并让**那一行**变成输入。
   * 同时关掉底下的新增表单 —— 两张表共用一份字段状态，同时开着会互相覆盖。
   */
  const startEdit = (index: number) => {
    const record = log[index];
    if (!record) return;
    setAmount(String(record.amount));
    setDate(record.date);
    setNote(record.note);
    setAdding(false);
    setEditing(index);
  };

  const startAdd = () => {
    setAmount("");
    setNote("");
    setDate(today());
    setEditing(null);
    setAdding(true);
  };

  const submit = () => {
    if (!(Number(amount) > 0 && date !== "")) return;
    const record = { date, amount: Number(amount), note: note.trim() || "养护" };
    if (editing === null) onAdd(record);
    else onUpdate(editing, record);
    reset();
  };

  const fields = (
    <CareFields
      date={date}
      amount={amount}
      note={note}
      marked={marked}
      onDate={setDate}
      onAmount={setAmount}
      onNote={setNote}
      onCancel={reset}
      onSubmit={submit}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {log.length > 0 ? (
        <div className="flex flex-col">
          {log.map((record, index) =>
            editing === index ? (
              // 就地改：这一行整个换成输入，行高与分隔线跟着邻行走，列表不跳。
              <div key={`edit-${index}`} className="py-2 border-line border-b">
                {fields}
              </div>
            ) : (
              <div key={`${record.date}-${index}`} className="flex items-baseline gap-3 py-2 border-line border-b">
                <span className={`${META} text-l2 tabular-nums shrink-0`}>{formatDate(record.date)}</span>
                <span className="flex-1 min-w-0 text-l1 text-xs lg:text-sm truncate">{record.note}</span>
                <span className="font-ui text-l1 text-sm tabular-nums shrink-0">¥{record.amount}</span>
                {/* 两颗操作按钮包一层并 `self-center` —— 外层是 items-baseline，
                    纯图标的按钮没有文字基线，直接摆进去会和旁边的 ✕ 差半格。
                    整块**定宽 32px**（`w-8`），和下面合计行那块占位是同一个常量：
                    ✕ 是个文字字形，宽度随字体走、并不等于字号，靠它自然撑出来的话
                    这一列就没有确定宽度，合计行的金额会和上面每一行差几个像素。 */}
                <span className="flex justify-end items-center gap-2 self-center w-8 shrink-0">
                  <button
                    type="button"
                    aria-label={`修改 ${formatDate(record.date)} 的养护记录`}
                    onClick={() => startEdit(index)}
                    className="flex justify-center items-center w-3 text-l3 lg:hover:text-accent transition-colors duration-200 cursor-pointer"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${formatDate(record.date)} 的养护记录`}
                    onClick={() => onRemove(index)}
                    className="flex justify-center items-center w-3 text-l3 lg:hover:text-accent text-xs leading-none transition-colors duration-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              </div>
            ),
          )}

          {/* 合计挂在列表末尾而不是标题旁边 —— 它是这几笔的合计，
              位置跟着被加总的内容走，读起来才是一张账。
              右侧那块留白和上面那块操作区都是定宽 32px —— 少了它、或者两边宽度
              各凭内容撑，合计的金额就会和每一行的金额差上几个像素。 */}
          <div className="flex items-baseline gap-3 py-2">
            <span className={`${META} flex-1 text-l2`}>累计养护成本</span>
            <span className="font-sans font-bold text-l1 text-sm tabular-nums shrink-0">¥{item.care}</span>
            <span aria-hidden="true" className="w-8 shrink-0" />
          </div>
        </div>
      ) : null}

      {/* 新增收在按钮后面 —— 大部分时候进来是看记录的，不是记账的。
          正在就地改某一行时不并排再开一张，两张表共用一份字段状态。 */}
      {adding ? fields : editing === null ? (
        <button
          type="button"
          onClick={startAdd}
          className={`${META} self-start border border-line px-3 py-2 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
        >
          + 添加养护记录
        </button>
      ) : null}
    </div>
  );
}

/**
 * 穿搭日志。**在浮层里的日历上点选已有的穿搭记录**，点中就把这件写进那天的 OOTD，
 * 穿着次数同步 +1。
 *
 * 从详情页补关联比先跳去日历再翻回来短得多，而关联率决定了整个 CPW 的分母
 * （PRD 第 9 节把「OOTD 已关联单品比例 > 80%」列为数据完整度指标）。
 *
 * 关联结果按**照片**摆出来，不是一排日期标签：这一节回答的是「这件穿去过哪几天」，
 * 照片一眼能认，`08/12` 认不出来。那天还没传照片的，那一格就只写日期 ——
 * 拿灰块或占位图去填会让人以为图挂了。
 */
function WearLog({
  worn,
  records,
  onLink,
  onUnlink,
}: {
  worn: string[];
  records: OotdMap;
  onLink: (day: string) => void;
  onUnlink: (day: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {worn.length > 0 ? (
        <div className="gap-1.5 grid grid-cols-4 lg:grid-cols-5">
          {worn.slice(0, 20).map((key) => {
            const photo = records[key]?.photo ?? null;
            return (
              <div key={key} className="group relative border border-line aspect-3/4 overflow-hidden">
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt={`${formatDate(key)} 的穿搭`} className="w-full h-full object-cover" />
                    {/* 日期压在左下角，垫一层白底 —— 压在照片上也要读得出 */}
                    <span
                      className={`${META} bottom-0.5 left-0.5 absolute px-1 text-l1 tabular-nums pointer-events-none`}
                      style={{ background: "rgba(255,255,255,0.82)" }}
                    >
                      {formatDateShort(key)}
                    </span>
                  </>
                ) : (
                  // 那天还没传照片：整格就只是一个日期，不拿灰块或占位图糊过去 ——
                  // 空图会让人以为图挂了，一张白纸上写个日子读起来才是「这天穿过」。
                  <span
                    className={`${META} flex justify-center items-center w-full h-full text-l2 tabular-nums`}
                  >
                    {formatDateShort(key)}
                  </span>
                )}

                <button
                  type="button"
                  aria-label={`取消关联 ${formatDate(key)}`}
                  onClick={() => onUnlink(key)}
                  className="top-0.5 right-0.5 absolute flex justify-center items-center bg-card/90 opacity-0 lg:group-hover:opacity-100 border border-line rounded-full w-4 h-4 font-ui text-l1 text-[10px] leading-none transition-opacity duration-200 motion-reduce:transition-none cursor-pointer"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={`${META} text-l2`}>
          关联一条穿搭记录，让每一次穿着都被看见；穿着次数与单次成本会自动更新
        </p>
      )}

      <div className="self-start">
        <WearCalendar worn={worn} records={records} onLink={onLink} onUnlink={onUnlink} />
      </div>
    </div>
  );
}

/**
 * 单品详情抽屉，从右侧滑入。
 *
 * 做成抽屉而不是独立路由：从衣橱翻看单品是个「瞄一眼再回去」的动作，
 * 整页转场会把列表的滚动位置和筛选状态都冲掉。
 *
 * 和录入弹窗一样 portal 到 body —— 首页那层 Lenis 平滑滚动容器会截走滚轮，
 * 留在它子树里抽屉内部滚不动。
 */
export default function ItemDrawer({
  item,
  onClose,
  onUpdate,
  onAddCare,
  onUpdateCare,
  onRemoveCare,
  onDelete,
  onBumpWears,
}: {
  item: Item | null;
  onClose: () => void;
  onUpdate: (patch: Partial<Item>) => void;
  onAddCare: (record: CareRecord) => void;
  onUpdateCare: (index: number, record: CareRecord) => void;
  onRemoveCare: (index: number) => void;
  onDelete: () => void;
  /** 关联/取消关联一天时同步穿着次数。次数是 CPW 的分母，不能只改 OOTD 那一边。 */
  onBumpWears: (delta: number) => void;
}) {
  const { records, setRecord, removeRecord } = useOotd();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /**
   * 抽屉默认是**只读的一张规格表** —— 点「修改」才把字段换成控件。
   * 常驻可编辑会让这一屏读起来像一张待填的表单，而绝大多数时候用户打开抽屉
   * 只是想看一眼这件衣服的账，不是来改它的。
   *
   * 养护记录与穿搭日志不受这个开关管：它们是**日常记账**，不是「这件衣服的信息」，
   * 每记一笔都要先点一次修改，那条路就废了。
   */
  const [editing, setEditing] = useState(false);
  // 先挂载再触发位移，否则初始状态和目标状态在同一帧，过渡不会跑
  const [shown, setShown] = useState(false);

  useEffect(() => setMounted(true), []);

  /**
   * **按 id 而不是按对象**。每改一个字段，store 都会生成一个新的 `item` 对象 ——
   * 依赖整个对象的话，这个 effect 每次编辑都会重跑一遍，把编辑态和删除确认一起清掉：
   * 表现就是「一点色系，整屏跳回只读」。这里要认的是「换了另一件衣服」，那是 id 变了。
   */
  const itemId = item?.id ?? null;

  useEffect(() => {
    if (itemId === null) {
      setShown(false);
      return;
    }
    setConfirmDelete(false);
    // 换一件衣服要退回只读 —— 编辑态跟着上一件留下来，会让人以为自己正在改这一件
    setEditing(false);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [itemId]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  /** 这件衣服出现在哪些 OOTD 里，倒序。 */
  const worn = useMemo(() => {
    if (!item) return [];
    return Object.entries(records)
      .filter(([, record]) => record.items.includes(item.id))
      .map(([key]) => key)
      .sort((a, b) => b.localeCompare(a));
  }, [item, records]);

  const onLink = (day: string) => {
    if (!item) return;
    const current = records[day];
    if (current?.items.includes(item.id)) return;
    setRecord(day, { items: [...(current?.items ?? []), item.id] });
    onBumpWears(1);
  };

  const onUnlink = (day: string) => {
    if (!item) return;
    const current = records[day];
    if (!current?.items.includes(item.id)) return;
    const rest = current.items.filter((entry) => entry !== item.id);

    /**
     * 取空了就把整条记录删掉，不留一条 `{ photo: null, items: [] }` 的空壳。
     *
     * 从这里关联一个没记录的日子会**就地建一条**记录；再取消关联，那条记录就
     * 什么都不剩了。留着它不影响显示与统计（`isRecorded` 只认照片），但它会
     * 一直躺在 localStorage 里，日历上也是个点开全空的日子。
     *
     * 只在**确实空了**的时候删：那天要是还有照片、备注、语音或别的单品，
     * 它就不是这次关联建出来的，动不得。
     */
    if (rest.length === 0 && !current.photo && !current.note && !current.voice) removeRecord(day);
    else setRecord(day, { items: rest });

    onBumpWears(-1);
  };

  if (!item || !mounted) return null;

  const materials = item.materials ?? [];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} 详情`}
      className="z-50 fixed inset-0"
      onPointerDown={(event) => {
        const target = event.target as Node;
        /**
         * 从 portal 冒上来的事件不算「点了外面」。
         *
         * 日历浮层、下拉菜单都 portal 到 body，但在 **React 树里**它们仍是这个
         * 抽屉的后代，pointerdown 照样冒到这里；而下面判的是 DOM `contains`，
         * 浮层不在抽屉的 DOM 子树里 —— 不先拦一道的话，点一下日历格子整个抽屉
         * 就关了。先认 DOM 归属：不是这层遮罩的后代，就是浮层来的，直接放行。
         */
        if (!event.currentTarget.contains(target)) return;
        if (!panelRef.current?.contains(target)) onClose();
      }}
    >
      <div
        aria-hidden="true"
        // 抽屉**不模糊父页**：翻单品时最常做的动作是和列表里别的衣服比对
        // （衣橱重复度就是干这个的），糊掉等于把要比的东西藏起来。
        // 只留一层浅遮罩，负责「左边暂时不可交互」的暗示和点击关闭的落点。
        className={`absolute inset-0 bg-l1/12 transition-opacity duration-300 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        className={`top-0 right-0 absolute flex flex-col bg-card shadow-2xl border-line border-l w-full max-w-xl h-full transition-transform duration-300 ease-66 motion-reduce:transition-none ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── 头 ─────────────────────────────────── */}
        <header className={`${PAD} flex items-start gap-4 bg-be/40 py-4 lg:py-5 border-line border-b shrink-0`}>
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className={`${META} flex items-center gap-2 text-l2`}>
              <CategoryIcon category={item.category} className="w-3.5 h-3.5" />
              {item.category} / {item.sub}
            </p>
            <h2 className="font-sans font-bold text-l1 text-xl lg:text-2xl leading-tight truncate" style={WIDE}>
              {item.name}
            </h2>
          </div>

          <span aria-hidden="true" className="flex-1" />

          {/* 次要操作摆在关闭键左边，和弹窗表头的 `action` 槽同一个位置。
              编辑态下填成 accent —— 这一屏当前是可改的，得有个明确的信号，
              否则用户改完不知道自己还停在编辑态里。 */}
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            aria-pressed={editing}
            className={`${META} h-9 shrink-0 border px-3 transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
              editing
                ? "bg-accent border-accent text-card lg:hover:opacity-85"
                : "bg-card border-l4 text-l2 lg:hover:border-accent lg:hover:text-accent"
            }`}
          >
            {editing ? "保存" : "修改"}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex justify-center items-center border border-l4 lg:hover:border-accent w-9 h-9 text-l2 text-sm lg:hover:text-accent transition-colors duration-200 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </header>

        {/* ── 身 ─────────────────────────────────── */}
        <div data-lenis-prevent className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex justify-center items-center bg-be/25 p-6 lg:p-8">
            {item.image ? (
              // 用户上传的任意图片，尺寸未知，next/image 的静态优化派不上用场。
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.name} className="w-full max-w-64 h-48 object-contain" />
            ) : (
              <div className="flex justify-center items-center border-2 border-line border-dashed w-full max-w-64 h-48">
                <span className={`${META} text-l2`}>没有照片</span>
              </div>
            )}
          </div>

          <Readouts item={item} />

          {/* 属性 */}
          {/* 基本信息 = 录入页填过的那些字段，按「认它」→「这笔买卖」→「怎么穿它」排：
              名称 / 品牌 / 尺码是身份，购入渠道 / 价格 / 日期是账，
              色系 / 季节 / 材质 / 状态是穿搭与决策要读的属性。

              两态：默认只读，点表头的「修改」才换成控件。**两态的行是同一批、同一顺序**，
              切换时表格不跳行 —— 只有值的位置从文字变成控件。
              价格 / 日期 / 品类即使在编辑态也不给改：它们是 CPW 的分子与统计的分组键，
              改一下会连带改历史趋势与已存的决策记录，要动得走另一条明确的路。 */}
          <section className={`${PAD} py-4 lg:py-5`}>
            <SectionTitle zh="基本信息" hint={editing ? "编辑中" : undefined} />

            {editing ? (
              <>
                {/* 名称留空落回二级品类名，品牌留空落回「未填写」—— 和录入弹窗保存时
                    同一套口径，两边不一致的话，同一件衣服在列表里的显示会因为
                    「从哪儿改的」而不同。 */}
                <EditRow
                  label="名称"
                  value={item.name}
                  placeholder={item.sub}
                  maxLength={24}
                  onCommit={(next) => onUpdate({ name: next || item.sub })}
                />
                <EditRow
                  label="品牌"
                  value={item.brand === "未填写" ? "" : item.brand}
                  placeholder="优衣库"
                  maxLength={24}
                  onCommit={(next) => onUpdate({ brand: next || "未填写" })}
                />
                <EditRow
                  label="尺码"
                  value={item.size ?? ""}
                  placeholder="M"
                  maxLength={10}
                  onCommit={(next) => onUpdate({ size: next || undefined })}
                />
                <EditRow
                  label="购入渠道"
                  value={item.channel ?? ""}
                  placeholder="淘宝"
                  maxLength={16}
                  onCommit={(next) => onUpdate({ channel: next || undefined })}
                />
              </>
            ) : (
              <>
                <Row label="名称" value={item.name} />
                <Row label="品牌" value={<Filled text={item.brand === "未填写" ? "" : item.brand} />} />
                <Row label="尺码" value={<Filled text={item.size ?? ""} />} />
                <Row label="购入渠道" value={<Filled text={item.channel ?? ""} />} />
              </>
            )}

            {editing ? (
              <>
                <NumberRow
                  label="购入价格"
                  value={item.price}
                  onCommit={(next) => onUpdate({ price: next })}
                />
                <div className="flex items-baseline gap-3 py-2.5 border-line border-b">
                  <span className={`${META} w-20 text-l2 shrink-0`}>购入日期</span>
                  <span className="flex flex-1 justify-end min-w-0">
                    <DatePicker
                      value={item.boughtAt}
                      onChange={(next) => onUpdate({ boughtAt: next })}
                      label="购入日期"
                      max={today()}
                    />
                  </span>
                </div>
                {/* 改一级品类必须同时把二级带走 —— 二级品类名不是全局唯一的
                    （「开衫」同时挂在内搭与外套下），留着旧的二级会得到一个
                    在新一级里根本不存在的组合，决策①的相似判定就废了。 */}
                <div className="flex items-baseline gap-3 py-2.5 border-line border-b">
                  <span className={`${META} w-20 text-l2 shrink-0`}>品类</span>
                  <span className="flex flex-1 justify-end gap-2 min-w-0">
                    <DropdownMenu
                      label={item.category}
                      ariaLabel="一级品类"
                      triggerIcon={<CategoryIcon category={item.category} className="w-4 h-4" />}
                      width={160}
                      maxHeight={280}
                      groups={[
                        CATEGORIES.map((entry) => ({
                          key: entry,
                          label: entry,
                          icon: <CategoryIcon category={entry} className="w-4 h-4" />,
                          selected: entry === item.category,
                          onSelect: () =>
                            onUpdate({ category: entry, sub: SUBCATEGORIES[entry][0] }),
                        })),
                      ]}
                    />
                    <DropdownMenu
                      label={item.sub}
                      ariaLabel="二级品类"
                      triggerIcon={null}
                      width={168}
                      maxHeight={280}
                      align="right"
                      groups={[
                        SUBCATEGORIES[item.category].map((entry) => ({
                          key: entry,
                          label: entry,
                          selected: entry === item.sub,
                          onSelect: () => onUpdate({ sub: entry }),
                        })),
                      ]}
                    />
                  </span>
                </div>
              </>
            ) : (
              <>
                <Row label="购入价格" value={`¥${item.price}`} />
                <Row
                  label="购入日期"
                  value={<span className="tabular-nums">{formatDate(item.boughtAt)}</span>}
                />
                <Row label="品类" value={`${item.category} / ${item.sub}`} />
              </>
            )}

            {editing ? (
              <>
                {/* 色系与季节的控件都比一行值宽，所以走「标签在上、控件在下」——
                    和下面的材质成分同一种版式，不为它们另起一套。 */}
                <div className="py-2.5 border-line border-b">
                  <p className={`${META} mb-2 text-l2`}>色系</p>
                  <ColorField
                    value={item.color}
                    onChange={(hex) => onUpdate({ color: hex, colorFamily: familyOf(hex) })}
                    presets={COLOR_PRESETS}
                    /* 直接在这件衣服自己的照片上点着取色。改色系会连带改
                       `colorFamily`，而重复度①与可搭配②都吃它 —— 取准一点，
                       后面两个维度的判定才准。 */
                    sampleImage={item.image || null}
                  />
                </div>
                <div className="py-2.5 border-line border-b">
                  <p className={`${META} mb-2 text-l2`}>季节</p>
                  <div className="flex gap-px bg-line border border-line">
                    {SEASONS.map((season) => {
                      const on = item.seasons.includes(season);
                      return (
                        <button
                          key={season}
                          type="button"
                          aria-pressed={on}
                          onClick={() => onUpdate({ seasons: toggleSeason(item.seasons, season) })}
                          className={`flex-1 py-2 lg:py-2.5 text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
                            on ? "bg-accent text-card" : "bg-card text-l2 lg:hover:bg-accent-wash"
                          }`}
                        >
                          {season}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="py-2.5 border-line border-b">
                  <p className={`${META} mb-2 text-l2`}>穿着状态</p>
                  <div className="flex gap-px bg-line border border-line">
                    {STATUSES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={item.status === option}
                        onClick={() => onUpdate({ status: option })}
                        className={`flex-1 py-2 lg:py-2.5 text-xs lg:text-sm transition-colors duration-200 motion-reduce:transition-none cursor-pointer ${
                          item.status === option
                            ? "bg-accent text-card"
                            : "bg-card text-l2 lg:hover:bg-accent-wash"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-2.5">
                  <p className={`${META} mb-2 text-l2`}>材质成分</p>
                  <MaterialRows value={materials} onChange={(next) => onUpdate({ materials: next })} />
                </div>
              </>
            ) : (
              <>
                <Row
                  label="色系"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="block border border-line rounded-full w-4 h-4"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.colorFamily}
                    </span>
                  }
                />
                <Row
                  label="季节"
                  value={item.seasons.length === SEASONS.length ? "四季" : item.seasons.join(" / ")}
                />
                <Row label="穿着状态" value={item.status} />
                <Row
                  label="材质成分"
                  value={
                    <Filled
                      text={materials
                        .filter((entry) => entry.pct > 0)
                        .map((entry) => `${entry.name} ${entry.pct}%`)
                        .join(" / ")}
                    />
                  }
                />
              </>
            )}
          </section>

          {/* 养护支出 —— CPW 的分子（附录 B） */}
          <section className={`${PAD} py-4 lg:py-5 border-line border-t`}>
            <SectionTitle zh="养护记录" />
            <CareLog item={item} onAdd={onAddCare} onUpdate={onUpdateCare} onRemove={onRemoveCare} />
          </section>

          {/* 穿搭日志 —— 可以直接从这里补关联，写回当天的 OOTD */}
          <section className={`${PAD} py-4 lg:py-5 border-line border-t`}>
            <SectionTitle zh="穿搭日志" hint={worn.length > 0 ? `最近 ${formatDate(worn[0])}` : undefined} />
            <WearLog worn={worn} records={records} onLink={onLink} onUnlink={onUnlink} />
          </section>

          {/* 备注收在最底：它是自由文本，长度不定，压在结构化字段后面
              才不会把下面几节推得忽上忽下。 */}
          <section className={`${PAD} py-4 lg:py-5 border-line border-t`}>
            <SectionTitle zh="备注" />
            {editing ? (
              <textarea
                aria-label="备注"
                value={item.note ?? ""}
                maxLength={200}
                rows={2}
                placeholder="记下搭配灵感、穿着感受，和下次要留意的细节"
                onChange={(event) => onUpdate({ note: event.target.value || undefined })}
                className="bg-transparent p-0 w-full min-h-12 text-l1 text-xs lg:text-sm leading-relaxed outline-none resize-none placeholder:text-l3"
              />
            ) : (
              <p className="min-h-12 text-l1 text-xs lg:text-sm leading-relaxed whitespace-pre-wrap">
                <Filled text={item.note ?? ""} />
              </p>
            )}
          </section>
        </div>

        {/* ── 脚 ─────────────────────────────────── */}
        <footer className={`${PAD} flex justify-end items-center gap-3 bg-be/40 py-3.5 border-line border-t shrink-0`}>
          {confirmDelete ? (
            <>
              <span className={`${META} mr-auto text-accent`}>删除后无法恢复</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={`${META} border border-line px-3 py-2 text-l2 lg:hover:text-l1 transition-colors duration-200 cursor-pointer`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={onDelete}
                className={`${META} bg-accent px-3 py-2 text-card lg:hover:opacity-85 transition-opacity duration-200 cursor-pointer`}
              >
                确认删除
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`${META} border border-line px-3 py-2 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 cursor-pointer`}
            >
              删除这件
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
