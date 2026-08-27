"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import CategoryIcon from "@/components/category-icons";
import SaveAlert from "@/components/save-alert";
import { META, WIDE } from "@/components/panel";
import { useCustomSubs } from "@/lib/custom-subs";
import { CATEGORIES, SUBCATEGORIES, type Category } from "@/lib/wardrobe";

const CHIP = "px-3 py-1.5 rounded-full font-sans font-bold text-xs lg:text-sm";

/**
 * 添加衣服分类 —— 一屏铺开全部一级与二级品类，每组末尾一颗「+ 添加分类」。
 *
 * 不做「先选一级、再填名字」的分步式：那样用户看不见已有哪些二级品类，
 * 只能凭记忆猜自己要加的那个是不是已经有了，重名提示会频繁触发。
 * 全量铺开之后，「有没有」和「加在哪」是同一眼的事。
 *
 * 只加**二级**，一级 10 类固定（原因见 `lib/custom-subs.ts`）。
 */
export default function AddCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { custom, saveState, addSub, removeSub } = useCustomSubs();
  /** 正在哪一组里输入。null = 没有任何一组展开输入框。 */
  const [editing, setEditing] = useState<Category | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setDraft("");
    setError(null);
  }, [open]);

  /**
   * Esc 只在一处处理，优先级写死：有输入框展开就先收输入框，否则关弹窗。
   *
   * 不靠在 input 上 `stopPropagation` 去拦 —— 弹窗是 portal 到 body 的，
   * 合成事件能不能拦住挂在 document 上的监听，取决于 React 给 portal 容器
   * 挂监听的实现细节。这种事不该赌。
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (editing !== null) setEditing(null);
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, editing, onClose]);

  // 展开某一组的输入框后把焦点送进去，省一次点击。
  useEffect(() => {
    if (editing !== null) inputRef.current?.focus();
  }, [editing]);

  if (!open) return null;

  const startEditing = (category: Category) => {
    setEditing(category);
    setDraft("");
    setError(null);
  };

  const submit = (category: Category) => {
    const reason = addSub(category, draft);
    setError(reason);
    // 成功就清空但**留在这一组**：连着加几个同类的是常态，不该每次都重新点开。
    if (reason === null) setDraft("");
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="添加衣服分类"
      className="z-50 fixed inset-0 flex justify-center items-center bg-l1/25 backdrop-blur-md p-4 lg:p-8"
      onPointerDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex flex-col bg-card shadow-2xl border border-l4 w-full max-w-5xl max-h-[88vh] overflow-hidden"
      >
        <header className="relative flex flex-col items-start gap-2 lg:gap-2.5 pr-14 lg:pr-16 pl-5 lg:pl-7 py-4 lg:py-5 border-line border-b shrink-0">
          <p className={`${META} text-l3 tracking-[0.2em]`}>New Category</p>
          <h2 className="font-sans font-bold text-l1 text-lg lg:text-2xl leading-none" style={WIDE}>
            添加衣服分类
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

        <div data-lenis-prevent className="flex-1 min-h-0 overflow-y-auto">
          {CATEGORIES.map((category) => {
            const mine = custom[category] ?? [];
            const on = editing === category;
            return (
              <section key={category} className="px-5 lg:px-7 py-4 lg:py-5 border-line border-b last:border-b-0">
                <p className="flex items-center gap-2 mb-3">
                  <span aria-hidden="true" className="text-l1">
                    <CategoryIcon category={category} className="w-[18px] h-[18px]" />
                  </span>
                  <span className="font-sans font-bold text-l1 text-sm lg:text-base" style={WIDE}>
                    {category}
                  </span>
                  <span className={`${META} text-l3 tabular-nums`}>
                    {SUBCATEGORIES[category].length + mine.length}
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {SUBCATEGORIES[category].map((entry) => (
                    <span key={entry} className={`${CHIP} bg-be/50 text-l2`} style={WIDE}>
                      {entry}
                    </span>
                  ))}

                  {/* 自建项带删除；内置的删不得 —— 已录入的单品会挂空。 */}
                  {mine.map((entry) => (
                    <span
                      key={entry}
                      className={`${CHIP} flex items-center gap-1.5 bg-accent-wash border border-accent/35 text-l1`}
                      style={WIDE}
                    >
                      {entry}
                      <button
                        type="button"
                        onClick={() => removeSub(category, entry)}
                        aria-label={`删除自建分类 ${entry}`}
                        className="text-l3 lg:hover:text-accent transition-colors duration-200 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  {on ? (
                    <span className="flex items-center gap-1.5">
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          setError(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            submit(category);
                          }
                        }}
                        maxLength={12}
                        placeholder="新分类名称"
                        aria-label={`${category}的新分类名称`}
                        className={`${CHIP} bg-transparent border border-accent outline-none w-40 text-l1 placeholder:text-l3`}
                        style={WIDE}
                      />
                      <button
                        type="button"
                        onClick={() => submit(category)}
                        className={`${CHIP} bg-accent text-card transition-opacity duration-200 motion-reduce:transition-none lg:hover:opacity-85 cursor-pointer`}
                        style={WIDE}
                      >
                        添加
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className={`${CHIP} text-l3 lg:hover:text-l1 transition-colors duration-200 cursor-pointer`}
                        style={WIDE}
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      className={`${CHIP} flex items-center gap-1 border border-accent text-accent transition-colors duration-200 motion-reduce:transition-none lg:hover:bg-accent-wash cursor-pointer`}
                      style={WIDE}
                    >
                      <span aria-hidden="true">+</span>
                      添加分类
                    </button>
                  )}
                </div>

                {/* 失败原因贴着出错的那一组 —— 重名时静默不加，用户会以为已经加上了。 */}
                {on && error ? (
                  <p className={`${META} mt-2.5 text-accent`} aria-live="polite">
                    {error}
                  </p>
                ) : null}

                {/* 校验没过（重名、太长）走上面那行；这行是**写盘失败** ——
                    名字合法、界面上也加上了，但下次打开就不见了。 */}
                {on ? (
                  <div className="mt-2.5 empty:mt-0">
                    <SaveAlert state={saveState} />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
