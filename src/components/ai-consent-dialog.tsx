"use client";

import DialogShell, { DIALOG_ACTION } from "@/components/dialog-shell";

/**
 * 照片外发前问一次。逻辑在 `lib/ai-consent.ts`，这里只管长相。
 *
 * **写清楚不外发的是什么，和写清楚外发的是什么一样重要** ——
 * 只说「照片会发送至第三方」，用户会默认包括他的全身照，
 * 而全身照恰恰一次都没离开过设备。
 */
export default function AiConsentDialog({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <DialogShell
      zh="提示"
      en="Notice"
      onClose={onDecline}
      panelClassName="max-w-lg"
    >
      <div className="bg-white px-5 lg:px-7 py-5 lg:py-6 border-t border-frame">
        <p className="text-l1 text-xs lg:text-sm leading-relaxed">
          自动识别与抠图需要把<strong className="font-semibold">单品照片与商品截图</strong>
          发送至第三方识别服务处理，处理完成后不保留副本。
        </p>
        <p className="mt-3 text-l1 text-xs lg:text-sm leading-relaxed">
          你的穿搭全身照与个人档案照片不会外发，只保存在本机或你自己的云端空间。
        </p>
        <p className="mt-3 text-l1 text-xs lg:text-sm leading-relaxed">
          你也可以跳过识别，全部手动填写 —— 除识别外的功能不受影响。
        </p>

        <div className="flex flex-wrap items-center gap-2.5 mt-5">
          <button type="button" onClick={onAccept} className={DIALOG_ACTION}>
            同意并继续
          </button>
          <button type="button" onClick={onDecline} className={DIALOG_ACTION}>
            手动填写
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
