"use client";

import { useMemo, useRef, useState } from "react";

import { CheckTag, DottedSelect, UnderlineInput } from "@/components/form-controls";
import GridOverlay from "@/components/grid-overlay";
import PhotoUpload from "@/components/photo-upload";
import ScrambleText from "@/components/scramble-text";
import SignatureSign from "@/components/signature-sign";
import SiteHeader from "@/components/site-header";
import { DOTTED_BORDER_BASE } from "@/lib/dotted-border";
import { BODY_FIELDS, CITIES, MEASURE_TIPS, SKIN_TONES, STYLE_TAGS } from "@/lib/profile-options";
import { completeness, useProfile } from "@/lib/profile-store";
import { useStatusLine } from "@/lib/season";
import { useSectionRects, type TrackedSection } from "@/lib/use-section-rects";
import ProfileScene from "@/webgl/profile-scene";

const TAGLINE = "认识自己，再让衣橱成为你的另一种表达";

/**
 * 组标题。右边那句是这组数据的下游去处 —— PRD 6.3 立的规矩是「每个字段都有
 * 下游用途，不做无用的注册表单」，把去处写在标题上，用户填的时候就知道为什么填。
 */
function GroupHeader({ zh, en, feeds }: { zh: string; en: string; feeds?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4 pb-1.5 border-line border-b">
      <h2 className="flex items-baseline gap-2 px-2">
        <span
          className="font-sans font-bold text-l1 text-sm lg:text-base"
          style={{ fontVariationSettings: '"wdth" 120' }}
        >
          {zh}
        </span>
        <span className="font-mono-2 text-l3 text-[10px] lg:text-xs uppercase">{en}</span>
      </h2>
      {feeds ? (
        <span className="hidden sm:block px-2 font-mono-2 text-l3 text-[10px] lg:text-xs shrink-0">→ {feeds}</span>
      ) : null}
    </div>
  );
}

export default function ProfilePage() {
  const statusLine = useStatusLine();
  const { profile, saveState, setField, toggleStyle } = useProfile();
  const [showTips, setShowTips] = useState(false);

  const bannerRef = useRef<HTMLDivElement | null>(null);
  const trackedSections = useMemo<TrackedSection[]>(() => [{ name: "banner", ref: bannerRef }], []);
  const sectionRects = useSectionRects(trackedSections);

  const { filled, total } = completeness(profile);

  return (
    <>
      <div ref={bannerRef} className="z-10 fixed inset-0 flex flex-col px-4 lg:px-14 py-4 lg:py-7">
        <SiteHeader title={TAGLINE} />

        <h1 className="sr-only">认识自己 — 个人档案</h1>

        <main className="flex-1 gap-x-6 grid grid-cols-12 mt-6 lg:mt-8 min-h-0 overflow-y-auto no-scrollbar">
          {/* ── 左：全身照 ─────────────────────────────── */}
          <div className="flex flex-col justify-between col-span-12 sm:col-span-5 lg:col-span-4 xl:col-span-3 gap-6 p-2">
            <div className="relative">
              <SignatureSign
                variant="girl"
                className="-top-6 -left-3 z-10 absolute w-1/2 pointer-events-none"
              />
              <PhotoUpload value={profile.photo} onChange={(next) => setField("photo", next)} />
            </div>

            <p className="hidden sm:block font-mono-2 text-l1 text-xs lg:text-sm tabular-nums">{statusLine}</p>
          </div>

          {/* ── 右：档案 ───────────────────────────────── */}
          <div className="flex flex-col col-span-12 sm:col-span-7 lg:col-span-8 xl:col-span-9 gap-6 lg:gap-7 mt-8 sm:mt-0">
            {/* 基础信息 */}
            <section className="flex flex-col gap-1">
              <GroupHeader zh="基础信息" en="Basic Information" feeds="价格合理性 · 季节窗口" />
              <div className="gap-x-4 grid grid-cols-2 md:grid-cols-3">
                <UnderlineInput
                  zh="年龄"
                  en="Age"
                  value={profile.age}
                  onChange={(next) => setField("age", next)}
                  maxLength={3}
                />
                <DottedSelect
                  zh="常居城市"
                  en="City"
                  value={profile.city}
                  options={CITIES}
                  onChange={(next) => setField("city", next)}
                />
                <UnderlineInput
                  zh="月预算"
                  en="Budget"
                  unit="元"
                  value={profile.monthlyBudget}
                  onChange={(next) => setField("monthlyBudget", next)}
                />
              </div>
            </section>

            {/* 风格偏好 */}
            <section className="flex flex-col gap-1">
              <GroupHeader zh="风格偏好" en="Style Preferences" feeds="仅作展示，不参与评分" />
              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
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
            </section>

            {/* 肤色 */}
            <section className="flex flex-col gap-1">
              <GroupHeader zh="肤色选择" en="Skin Color" />
              <div className="flex flex-wrap items-end gap-x-2 gap-y-2 p-2">
                {SKIN_TONES.map((tone) => {
                  const selected = profile.skinTone.toUpperCase() === tone.value.toUpperCase();
                  return (
                    <button
                      key={tone.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setField("skinTone", tone.value)}
                      className={`${DOTTED_BORDER_BASE} flex flex-col gap-1 p-1.5 cursor-pointer`}
                    >
                      <span
                        className={`block border w-16 lg:w-20 h-9 lg:h-10 transition-colors duration-200 motion-reduce:transition-none ${
                          selected ? "border-l1" : "border-line"
                        }`}
                        style={{ backgroundColor: tone.value }}
                      />
                      <span
                        className={`text-[10px] transition-colors duration-200 motion-reduce:transition-none ${
                          selected ? "text-l1" : "text-l2"
                        }`}
                      >
                        {tone.zh}
                      </span>
                      <span className="font-mono-2 text-l3 text-[9px] uppercase tabular-nums">{tone.value}</span>
                    </button>
                  );
                })}

                <label className={`${DOTTED_BORDER_BASE} flex flex-col gap-1 p-1.5 cursor-pointer`}>
                  <input
                    type="color"
                    value={profile.skinTone || "#D9AC8D"}
                    onChange={(event) => setField("skinTone", event.target.value.toUpperCase())}
                    className="block border border-line w-16 lg:w-20 h-9 lg:h-10 bg-transparent cursor-pointer"
                  />
                  <span className="text-l2 text-[10px]">自定义肤色</span>
                  <span className="font-mono-2 text-l3 text-[9px] uppercase tabular-nums">
                    {profile.skinTone || "—"}
                  </span>
                </label>
              </div>
            </section>

            {/* 身体数据 */}
            <section className="flex flex-col gap-1">
              <GroupHeader zh="身体数据" en="Body Data" feeds="身材适配度" />

              <div className="gap-x-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
                {BODY_FIELDS.map((field) => (
                  <UnderlineInput
                    key={field.key}
                    zh={field.zh}
                    en={field.en}
                    unit={field.unit}
                    value={profile[field.key]}
                    onChange={(next) => setField(field.key, next)}
                  />
                ))}
              </div>

              <div className="flex flex-col items-start px-2">
                <button
                  type="button"
                  aria-expanded={showTips}
                  onClick={() => setShowTips((current) => !current)}
                  className={`${DOTTED_BORDER_BASE} p-1 font-mono-2 text-l2 lg:hover:text-l1 text-[10px] lg:text-xs cursor-pointer`}
                >
                  如何正确测量身体数据 {showTips ? "▴" : "▾"}
                </button>

                {showTips ? (
                  <dl className="gap-x-6 gap-y-1 grid sm:grid-cols-2 mt-2 text-l2 text-[11px] lg:text-xs leading-relaxed">
                    {MEASURE_TIPS.map((tip) => (
                      <div key={tip.zh} className="flex gap-2">
                        <dt className="shrink-0 font-mono-2 text-l3 uppercase">{tip.en}</dt>
                        <dd>{tip.tip}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </section>
          </div>
        </main>

        {/* ── 底部读数 ────────────────────────────────── */}
        <footer className="flex justify-between items-center gap-4 mt-4 px-2 pt-3 border-line border-t font-mono-2 text-[10px] lg:text-xs uppercase">
          <ScrambleText text="PROFILE" letterDelayMs={40} scrambleColors={false} />
          <span className="flex items-center gap-3 tabular-nums">
            <span className="text-l3">
              档案完成度 {filled}/{total}
            </span>
            <span className={saveState === "error" ? "text-l1" : "text-l3"}>
              {saveState === "saved" ? "已保存" : saveState === "error" ? "保存失败 · 存储空间不足" : "本地保存"}
            </span>
          </span>
        </footer>
      </div>

      <GridOverlay />

      <div className="top-0 left-0 -z-1 fixed w-full h-dvh lg:h-screen">
        <ProfileScene sectionPosition={sectionRects} layers={[]} />
      </div>
    </>
  );
}
