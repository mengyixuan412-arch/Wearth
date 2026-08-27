"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import AccountPanel from "@/components/account-panel";
import { supabaseEnabled } from "@/lib/supabase/client";
import ColorField, { presetOf } from "@/components/color-field";
import { CascadeSelect, CELL, CheckTag, NumberCell, VALUE_ROW } from "@/components/form-controls";
import DottedLink from "@/components/dotted-link";
import PhotoUpload from "@/components/photo-upload";
import Panel, { META, WIDE } from "@/components/panel";
import SectionNav from "@/components/section-nav";
import SiteHeader from "@/components/site-header";
import {
  BODY_FIELDS,
  DEFAULT_SKIN_TONE,
  MEASURE_TIPS,
  REGIONS,
  SKIN_PRESETS,
  STYLE_TAGS,
} from "@/lib/profile-options";
import { useSession } from "@/lib/supabase/session";
import { useProfile, type Profile } from "@/lib/profile-store";
import { HERO_GAP } from "@/lib/layout";

/**
 * 左栏目录。id 同时是锚点与 IntersectionObserver 的观察对象，
 * `count` 报出这一节「填了几项 / 共几项」—— 圆点填成粉色的条件就是它填满。
 */
type SectionSpec = {
  id: string;
  index: string;
  zh: string;
  en: string;
  count: (profile: Profile) => [number, number];
};

const filledOf = (...values: string[]) => values.filter((value) => value.trim() !== "").length;

const SECTIONS: SectionSpec[] = [
  {
    id: "basic",
    index: "01",
    zh: "基础信息",
    en: "Basic Information",
    count: (p) => [filledOf(p.age, p.city, p.monthlyBudget), 3],
  },
  {
    id: "photo",
    index: "02",
    zh: "参考照片",
    en: "Reference Photo",
    count: (p) => [p.photo ? 1 : 0, 1],
  },
  {
    id: "styles",
    index: "03",
    zh: "风格偏好",
    en: "Style Preferences",
    count: (p) => [p.styles.length > 0 ? 1 : 0, 1],
  },
  {
    id: "skin",
    index: "04",
    zh: "肤色选择",
    en: "Skin Color",
    count: (p) => [p.skinTone.trim() !== "" ? 1 : 0, 1],
  },
  {
    id: "body",
    index: "05",
    zh: "身体数据",
    en: "Body Data",
    count: (p) => [BODY_FIELDS.filter((field) => p[field.key].trim() !== "").length, BODY_FIELDS.length],
  },
];

/**
 * 账号那一节的目录项。**单独列出来，不进 `SECTIONS`** ——
 * 其余五节的读数是「这份表填了几项」，账号的读数是「登录了没有」，
 * 算法不同（它不看 `profile`，看会话），塞进同一个数组会让 `count` 的签名变脏。
 *
 * 没配 Supabase 时不出现 —— 和 `AccountPanel` 自己返回 null 是同一个判断。
 */
const ACCOUNT_SECTION = { id: "account", index: "06", zh: "账号同步" };

/** 目录里的状态点：填满是粉色实心，没填满是一圈灰环。 */
export default function ProfilePage() {
  const { profile, saveState, setField, toggleStyle } = useProfile();
  const { userId } = useSession();
  const [showTips, setShowTips] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  /** 没选过时落回第一档 —— 空串会让颜色格的自定义圈填成透明，读成一个坏掉的圈。 */
  /**
   * 肤色**选过没有**。兜底色只用来给取色器一个起点，不代表用户做过选择 ——
   * 评分那边（附录 D-⑤ 的 5b）读的是 `profile.skinTone` 原值，空串按未设处理。
   * 界面必须跟着这个真值画，否则显示「已选自然肤色」而计分按未设，两边对不上。
   */
  const skinChosen = profile.skinTone.trim() !== "";
  const skinTone = profile.skinTone || DEFAULT_SKIN_TONE;
  /**
   * 选中的是第几颗色圆。自定义色不在预设里，落在末尾那颗「＋」上 ——
   * 档名要停在哪，就看这个数。
   */
  const skinSlot = (() => {
    const index = SKIN_PRESETS.findIndex(
      (preset) => preset.value.toLowerCase() === skinTone.toLowerCase(),
    );
    return index < 0 ? SKIN_PRESETS.length : index;
  })();

  /**
   * 档名要和选中那颗色圆**居中对齐**，所以得知道这行字有多宽 —— 换一档
   * 字数就变（「偏冷 · 白皙肤色」比「自定义」长一截），没法写死一个偏移。
   *
   * `useLayoutEffect` 而不是 `useEffect`：量完要立刻定位，放到绘制之后
   * 会先闪一帧在错的位置上。
   */
  const skinLabelRef = useRef<HTMLParagraphElement | null>(null);
  const [skinLabelWidth, setSkinLabelWidth] = useState(0);
  useLayoutEffect(() => {
    setSkinLabelWidth(skinLabelRef.current?.offsetWidth ?? 0);
  }, [skinTone]);
  const counts = useMemo(
    () => SECTIONS.map((section) => ({ ...section, value: section.count(profile) })),
    [profile],
  );

  return (
    <div className="z-10 fixed inset-0 flex flex-col bg-card px-4 lg:px-14 pt-4 lg:pt-7">
      <SiteHeader title={null} />

      <main ref={mainRef} className="flex-1 mt-2 lg:mt-3 min-h-0 overflow-y-auto no-scrollbar">
        {/* ── 主视觉：标题、编号、副标都画在图里，DOM 不再重复一遍。
             4:1 横幅，按原始画幅铺满 —— 标题在最左、拼贴在最右，
             中间是留白，任何方向的裁切都会丢掉一头。
             图由 tools/build-hero.mjs 从设计稿生成。 ───── */}
        <div className="pt-4 lg:pt-6">
          <img
            src="/img/hero/profile.webp"
            alt="个人档案 Personal Profile —— 认识自己，再让衣橱成为你的另一种表达"
            width={2000}
            height={500}
            fetchPriority="high"
            className="block border border-l4 w-full h-auto"
          />
        </div>

        {/* ── 目录 + 面板 ─────────────────────────────── */}
        <div className={`gap-4 lg:gap-6 grid grid-cols-12 ${HERO_GAP} pb-10 lg:pb-16`}>
          <aside className="flex flex-col gap-6 lg:gap-8 col-span-12 lg:col-span-3 xl:col-span-2">
            <SectionNav
              ariaLabel="档案目录"
              rootRef={mainRef}
              sections={[
                ...counts.map((section) => ({
                  id: section.id,
                  index: section.index,
                  zh: section.zh,
                  done: section.value[0],
                  need: section.value[1],
                })),
                ...(supabaseEnabled()
                  ? [{ ...ACCOUNT_SECTION, done: userId ? 1 : 0, need: 1 }]
                  : []),
              ]}
            />

            {/* 反色说明块。粉色标签在这里用 accent-soft —— 底色是 l1，
                和页面上其它粉字的底不是同一张，色号得换那一档。

                这块答的是用户填到一半会问的那句「你问这些干嘛」，但**只讲对用户的好处，
                不讲评分规则**：附录 D 那套权重与分档还没定稿，界面上一旦写出「身材适配度
                20 分」，改口径就等于打自己的脸，用户也会拿它当承诺。等规则定了再说。

                数据存在哪由「06 账号同步」那一节讲，这块只回答「你问这些干嘛」。 */}
            <div className="bg-l1 p-4 lg:p-5">
              <p className={`${META} text-accent-soft mb-3 tracking-[0.2em]`}>Why we ask</p>
              <p className="text-b1/75 text-xs lg:text-sm leading-relaxed">
                量一次肩宽、腰围、臀围，往后挑衣服就不必再靠「看着应该合身」来猜 ——
                尺码表上的数对得上，才知道那件衣服适不适合你。
              </p>
            </div>
          </aside>

          <div className="gap-4 lg:gap-5 grid grid-cols-12 col-span-12 lg:col-span-9 xl:col-span-10 auto-rows-min">
            {/* 左列：基础信息 → 风格偏好 → 肤色选择 */}
            <div className="flex flex-col gap-4 lg:gap-5 col-span-12 xl:col-span-8">
              <Panel id="basic" index="01" zh="基础信息" en="Basic" delay={300}>
                <div className="gap-px grid grid-cols-1 sm:grid-cols-3 bg-line">
                  <NumberCell
                    zh="年龄"
                    unit="岁"
                    required
                    value={profile.age}
                    placeholder="26"
                    max={120}
                    onChange={(next) => setField("age", next)}
                  />
                  <CascadeSelect
                    zh="常居城市"
                    required
                    value={profile.city}
                    regions={REGIONS}
                    onChange={(next) => setField("city", next)}
                  />
                  <NumberCell
                    zh="月预算"
                    unit="元"
                    value={profile.monthlyBudget}
                    placeholder="1500"
                    step={100}
                    max={99999}
                    onChange={(next) => setField("monthlyBudget", next)}
                  />
                </div>
              </Panel>

              <Panel
                id="styles"
                index="03"
                zh="风格偏好"
                en="Styles"
                meta={`已选 ${profile.styles.length} / ${STYLE_TAGS.length}`}
                delay={420}
              >
                <div className="gap-px grid grid-cols-2 sm:grid-cols-4 bg-line">
                  {STYLE_TAGS.map((tag) => (
                    <CheckTag
                      key={tag.value}
                      zh={tag.zh}
                      en={tag.en}
                      checked={profile.styles.includes(tag.value)}
                      onToggle={() => toggleStyle(tag.value)}
                    />
                  ))}
                </div>
              </Panel>
              {/* 肤色和衣橱里的色系是同一件事 —— 选一个颜色，所以走同一套颜色格。
                  预设不再各占一格带文字：档名改挂在 `hint` 上（随选中项变），hex 挂在
                  面板表头的右端读数上，圆点这一行因此和录入页那一行完全同宽同距。 */}
              <Panel
                id="skin"
                index="04"
                zh="肤色选择"
                en="Skin Color"
                delay={480}
              >
                {/* 不再写「肤色 选填」那一行 —— 面板表头已经是「04 肤色选择」，
                    格里再写一遍等于同一个词连着出现两次。 */}
                <div className={CELL}>
                  <div className={VALUE_ROW}>
                    <ColorField
                      value={skinTone}
                      onChange={(hex) => setField("skinTone", hex.toUpperCase())}
                      presets={SKIN_PRESETS}
                      customLabel="自定义肤色"
                      unset={!skinChosen}
                      /* 直接在 02 传的那张参考照上取肤色 —— 肤色本来就没法凭记忆
                         报一个色号，对着自己的照片点一下才是准的。
                         没传照片时取样条不渲染，和衣物那三处同一个条件。 */
                      sampleImage={profile.photo}
                      sampleLabel="照片取色"
                    />
                  </div>
                  {/*
                    档名和**选中那颗色圆居中对齐**，跟着选中项左右移动 ——
                    它读的是「你选中的是哪一档」，落在被读的那颗底下才指得明白。

                    圆心按色圆的排布算：`ColorField` 的圆点是 `w-8`（32px）、
                    行距 `gap-2.5`（10px），一格 42px，第 n 颗的圆心在 `n*42+16`。
                    **这两个数改了这里要跟着改。**

                    左边夹到 0：选第一颗时圆心才 16px，居中会让这行字往左探出
                    格子的内边距，宁可那一档略微偏右也不越界。
                  */}
                  <p
                    ref={skinLabelRef}
                    className={`${META} w-max text-l3 normal-case transition-[margin] duration-200 motion-reduce:transition-none`}
                    style={{ marginLeft: skinChosen ? Math.max(0, skinSlot * 42 + 16 - skinLabelWidth / 2) : 0 }}
                  >
                    {/* 没选过时说清楚它对下游的影响 —— 这一档不填，⑤ 就只按围度算，
                        而围度对鞋 / 包 / 配饰又不适用，那几类会整个维度不计分。 */}
                    {skinChosen ? (presetOf(SKIN_PRESETS, skinTone)?.label ?? "自定义") : "未选择 · 不参与评分"}
                  </p>
                </div>
              </Panel>
            </div>

            {/* 右列：参考照片 + 主按钮 */}
            <div className="col-span-12 xl:col-span-4 min-h-0">
              <Panel
                id="photo"
                index="02"
                zh="参考照片"
                en="Photo"
                delay={360}
                className="h-full"
              >
                <div className="flex flex-col flex-1 gap-4 p-4 lg:p-5">
                  <PhotoUpload fill value={profile.photo} onChange={(next) => setField("photo", next)} />

                  {/* 全站唯一的粉色填充按钮。用 text-card 而不是写死白色：
                      暗色态下 accent 翻成亮粉，字得跟着翻成深色才读得清。 */}
                  <DottedLink
                    href="/wardrobe"
                    className="group flex justify-between items-center gap-3 bg-accent px-4 py-3.5 text-card lg:hover:opacity-85 transition-opacity duration-200 motion-reduce:transition-none"
                  >
                    <span className="font-sans font-bold text-sm lg:text-base" style={WIDE}>
                      下一步 · 我的衣橱
                    </span>
                    <span
                      aria-hidden="true"
                      className="lg:group-hover:translate-x-1 font-ui text-sm transition-transform duration-200 motion-reduce:transition-none"
                    >
                      ⟶
                    </span>
                  </DottedLink>
                </div>
              </Panel>
            </div>

            {/* 身体数据 */}
            <div className="col-span-12">
              <Panel
                id="body"
                index="05"
                zh="身体数据"
                en="Body Data"
                delay={540}
                action={
                  <button
                    type="button"
                    aria-expanded={showTips}
                    onClick={() => setShowTips((current) => !current)}
                    className={`${META} shrink-0 border border-line px-2 py-1 text-l2 lg:hover:border-accent lg:hover:text-accent transition-colors duration-200 motion-reduce:transition-none cursor-pointer`}
                  >
                    如何测量 {showTips ? "▴" : "▾"}
                  </button>
                }
              >
                {showTips ? (
                  <dl className="gap-x-8 gap-y-1.5 grid sm:grid-cols-2 bg-be/60 px-4 lg:px-5 py-3 border-line border-b text-l2 text-xs leading-relaxed">
                    {MEASURE_TIPS.map((tip) => (
                      <div key={tip.zh} className="flex gap-2">
                        {/* 部位名读中文 —— 这几行是照着做的操作说明，
                            旁边那一排输入格的标签也是「肩宽 / 胸围」，
                            提示里换成 SHOULDER / BUST，读者得先在两套名字之间对一次。 */}
                        <dt className="text-l3 text-xs shrink-0">{tip.zh}</dt>
                        <dd>{tip.tip}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <div className="gap-px grid grid-cols-1 sm:grid-cols-3 bg-line">
                  {BODY_FIELDS.map((field) => (
                    <NumberCell
                      key={field.key}
                      zh={field.zh}
                      unit={field.unit}
                      required={field.required}
                      step={field.step}
                      placeholder={field.placeholder}
                      value={profile[field.key]}
                      onChange={(next) => setField(field.key, next)}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            {/* 账号与同步。**没配 Supabase 时组件自己返回 null** ——
                纯本地模式下不该出现登录入口。 */}
            <div className="col-span-12">
              <AccountPanel saveFailed={saveState === "error"} />
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
