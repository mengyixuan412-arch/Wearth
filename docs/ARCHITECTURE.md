# Wearth 开发约束

本文管**代码怎么写**。产品口径看 `PRD.md`，视觉与交互看 `DESIGN.md`。
三份冲突时：PRD 定要不要做，DESIGN 定长什么样，本文定怎么落地。

---

## 1. 技术栈

| | 选型 | 说明 |
|---|---|---|
| 框架 | Next.js 15 · App Router · Turbopack | `npm run dev` / `npm run build` 都带 `--turbopack` |
| UI | React 19 | 六个页面**全部是 `"use client"`** |
| 样式 | Tailwind CSS v4 | 令牌在 `CODE/src/app/globals.css`，别名见 DESIGN.md §2 |
| 3D | three r184 · @react-three/fiber 9 · postprocessing | **只有首页用**，内页没有 canvas |
| 滚动 | lenis | 同上，只有首页 |
| 动效 | motion | |
| 语言 | TypeScript 5.9 | `strict` |

**双模式存储。** 未登录：数据存浏览器 localStorage，可操作、不上云 ——
访客点开链接就是一个完整产品，不用注册。已登录：走 Supabase，跨设备同步。
两条路的分叉只在 `lib/*-store.ts` 内部，页面感知不到。

登录用 Supabase 魔法链接（邮箱，无密码），入口在档案页 §06，不做登录页。
没配 `NEXT_PUBLIC_SUPABASE_*` 时整套云端能力静默消失，退回纯本地 ——
`lib/supabase/client.ts` 返回 `null` 而不抛错，缺配置不该让整站白屏。

服务端只有 Route Handler，**都不碰存储，只是模型 key 的代理** ——
key 不能进前端包，这是它们存在的唯一理由。已落地的见 §5 那张表。
除它们之外，全站唯一的网络请求是 `lib/use-weather.ts` 的天气查询。

`gray-matter` / `next-mdx-remote` / `prism-react-renderer` 是前身项目留下的依赖，
当前代码不引用。清理前先确认没有引用再删。

---

## 2. 目录结构

```
CODE/
  src/
    app/              路由。六个模块六条路由，外加 error / not-found
      layout.tsx      Provider 树 + 全局壳，见 §6「壳的层级」
      page.tsx        主页（唯一带 WebGL 的路由）
      profile|wardrobe|ootd|analysis|decide/page.tsx
      wardrobe/new/   跳板，replace 到 /wardrobe?new=1
      api/            模型代理，**全站仅有的服务端代码**（清单见 §5）
      error.tsx       渲染异常兜底（客户端组件，必须）
      not-found.tsx   地址不存在
      globals.css     全套设计令牌
    components/       纯展示与交互件，不含业务规则
    lib/              数据、规则、工具。**业务逻辑只写在这里**
    providers/        主题 / 媒体 / 指针 / 转场
    webgl/            首页 3D，与业务无关
  tools/              资产生成脚本（首图、字标、3D 模型）
  public/             交付产物。**设计源文件不放这里**，留在 Design/
```

**一条硬边界：`components/` 不写业务规则。** CPW 怎么算、评分怎么归一化、
季节怎么判，全部在 `lib/`。组件只负责把 `lib/` 的结果画出来。
理由是这些规则要被多个页面复用，散进组件就会出现两份算不一样的实现。

---

## 3. 数据模型

六个 localStorage 键，各自独立，**没有外键约束**——引用完整性靠代码维护。
登录后前五个各对应一张 Supabase 表（`recent-colors` 是本机偏好，不上云）。

| 键 | 类型 | 出处 |
|---|---|---|
| `wearth.wardrobe.v3` | `Item[]` | `lib/wardrobe.ts` |
| `wearth:ootd` | `Record<dateKey, OotdRecord>` | `lib/ootd-store.ts` |
| `wearth:profile` | `Profile` | `lib/profile-store.ts` |
| `wearth.decisions.v1` | `Decision[]` | `lib/decision-store.ts` |
| `wearth.customSubs.v1` | 自建二级品类 | `lib/custom-subs.ts` |
| `wearth:recent-colors` | `string[]` | `components/color-picker.tsx` |

云端五张表见 `CODE/supabase/schema.sql`，RLS 一套策略只认 `auth.uid() = user_id`。
形状按读写模式分两类：

| 表 | 主键 | 写法 | 为什么 |
|---|---|---|---|
| `items` | `(user_id, id)` | 按件 upsert | 一件连图约 30KB，整柜重传是几 MB |
| `ootd` | `(user_id, day)` | 按天 upsert | 同上，一条带全身照 |
| `decisions` | `(user_id, id)` | 按条 upsert | `candidate`/`result` 整份存 jsonb，见 §7 |
| `profile` | `user_id` | 整份覆盖 jsonb | 二十来个可选字段，从来没有「只改一项」的读写模式 |
| `custom_subs` | `user_id` | 整份覆盖 jsonb | 同上，且是变长映射表，拆列加字段就要迁移 |

### 键名带版本号的那几个

`v3` / `v1` 不是装饰。**改动会让存量数据算错的字段时，必须进版本号**，
否则旧数据会被当成新结构读进来。已经发生过两次：

- `v2` 加 `careLog`（养护支出要挂在发生月，只存一个合计数做不到）
- `v3` 换色系六档（旧数据里的「米棕」「粉紫」在新表里不存在，按色系筛选会一件都选不出）

加字段且旧数据缺它无害 → 声明成可选（`materials?`、`Decision.chat?`），不进版本号。
报告追问的对话就是这么挂的：旧记录没有这个字段，读出来就是一份还没聊过的报告。
改字段语义 / 改枚举取值 → 进版本号。

### 三个跨表引用

```
OotdRecord.items[]  →  Item.id      关联的单品
Decision.candidate  →  值拷贝，不是引用
Item.careLog[]      →  Item.care    care 必须恒等于 careLog 的合计
```

- **穿搭记录存的是 id，删单品不会自动清理引用。** 读的时候要容忍找不到。
- **决策记录存值拷贝。** 评分依赖当时的衣橱快照，事后衣橱变了，历史评分不能跟着变。
- **`care` 与 `careLog` 必须同时更新。** `lib/wardrobe.ts` 的 `addCare` /
  `updateCare` / `removeCare` 已经保证；不要绕过它们直接改 `care`。

---

## 4. 服务层约定

`lib/*-store.ts` 是数据层，每个导出一个 hook。**页面不直接碰 localStorage，
也不直接碰 Supabase。** 走哪条路由 store 内部决定，页面拿到的永远是同一个接口。

```ts
const { items, hydrated, addItem, updateItem, ... } = useWardrobe();
```

### 四条已经踩过的坑

**① 首帧不能写盘。** 服务端渲染拿不到 localStorage，首帧 state 是种子/空值。
这时若有 `useEffect(..., [state])` 往盘上写，会拿首帧的假数据盖掉用户的真数据。
两种解法都在用：`wardrobe` 在每个 mutator 里直接落盘；`profile` / `ootd`
用 `hydrated` 标志挡住第一次写。**新 store 二选一，不要不做。**

**② `hydrated` 要透出去。** 五个 store 都返回了它，但**当前没有任何页面读它**。
需要区分「还没读到」和「确实是空的」时用它 —— 空状态文案不该在读盘之前闪一下。
新 store 照样要透出，不要因为暂时没人用就省掉。

**③ 副作用 effect 的依赖用 id，不用对象。** 每次更新都会生成新的 `Item` 对象，
依赖整个对象会让 effect 每次编辑都重跑。已经因此出过 bug（编辑态被重置）。

**④ 写失败不能静默。** 配额撑满基本只可能是图片太多。`profile` / `ootd` 用
`saveState: "idle" | "saved" | "error"` 透出：档案页渲染在 §06 账号面板里，
日志页渲染在底栏。**两处平时都不出声，只在 `error` 时才出现** ——
常驻一行「本地保存」是噪音，但失败必须看得见。
五个 store 现在都有 `saveState`，界面共用 `components/save-alert.tsx`：
衣橱页在网格上方、评分页在决策记录上方、添加分类在弹窗里、档案页在 §06、日志页在底栏。

**云端写失败也要出声。** 断网时改动只留在内存，刷新就没了 —— 和配额撑满一样严重，
只是给用户的下一步不同（一个是腾空间，一个是等会儿再试）。

### 双模式 store 的五条

五个 store 都是「未登录写本地、已登录写云端」。写新 store 或改老的，照这五条来 ——
每一条都对应一个真出过的问题。

**① 读之前先等 `ready`。** `useSession()` 的 `ready` 和 `userId` 是两回事：
会话恢复是异步的，首帧一定是「还不知道」。拿 `userId === null` 当未登录，
已登录用户刷新后会闪一下访客态的种子数据 —— 那看起来像他的衣橱被换掉了。

**② 写目标放 `ref`，不要读闭包里的 `userId`。** mutator 都是 `useCallback`，
闭包捕获的是创建那一刻的值，而登录状态在它们创建之后才恢复完。
不这样会一直往本地写。

**③ 分叉只写一处。** 八个 mutator 各判断一次登录状态，加一个字段就要改八遍。
`wardrobe` / `decision` 收在 `persist(next, changed)` 里，`ootd` / `profile`
收在那个写 effect 里。

**④ 按件推，不要整份覆盖。** 带图的表（`items` / `ootd` / `decisions`）
只推这次动过的那几条。`ootd` 靠引用相等算增量 —— mutator 只给动过的键换新对象。

**⑤ 逐字输入的要防抖 + 卸载补交。** `profile` / `ootd` 的备注是一个字一个字敲的，
不防抖等于每个字符一次请求（现为 700ms）。但**只防抖会丢数据**：
窗口内切走页面，最后一次输入就没了 —— 而「填完最后一格随手就走」正是最常见的路径。
两个 store 都在卸载时补交未推的那一份。

读不到云端时的退路分两种，取决于**混进别人的数据有多糟**：
`profile` / `custom_subs` 退回本机那份（顺带成了隐式迁移，第一次编辑就推上去）；
`wardrobe` / `ootd` / `decisions` 维持原状或空表 —— 它们会显示成「你的记录」，
张冠李戴比空着更糟。

### 演示数据不上云

`SEED` 那 21 件都带 `demo: true`，同步时只推 `own`。**不能靠 id 判断**：
种子是 `"1"`–`"21"`，但 `nextId()` 取当前最大 id + 1，用户删几件再新增，
新件完全可能拿到 `"21"`。`isSeedItem()` 比的是 `id|name` 两者。

这个字段是后加的，早于它写进 localStorage 的种子没有标记 ——
`backfillDemo()` 在读本地时回填。删掉它，演示数据会重新污染统计与评分。

### 颜色从图里取，不问模型

`lib/dominant-color.ts`。模型只返回**色系**（闭集），代码拿到后填的是
`FAMILY_SWATCH["粉"]` 这个固定示意色 —— 藕粉和桃粉会填成同一个值。
真值就在用户刚传的图里：精确、即时、免费、不外发、断网也能用。
色值这种东西模型本来也给不准。

**用直方图众数，不用平均值。** 平均会把衣服和背景搅成一坨 ——
白墙前的红上衣平均出来是粉的，那个颜色画面里根本不存在。

取两次：上传后用原图（限中心 60%，并拿模型色系交叉校验，防止取到背景），
抠图完成后再取一次 —— **那次最准，透明底已经把「哪些像素是衣服」解决了**，不需要校验。

### 读完之前不要出内容

`hydrated` 不再是摆设。衣橱页在它之前撑住高度什么都不画，统计页整片淡入。
**「还没读到」和「确实是空的」不是一回事** —— 不区分的话用户会先被告知衣橱空了，
紧接着衣服又冒出来。

配套的是 `useWardrobe` **首帧不从 `SEED` 起步**：从种子起步会让已登录的用户
先看到 21 件不属于他的衣服，云端读回来再清空。种子只在确认「未登录且本机
从没存过东西」之后才铺。

### 图片一律先压

上传的图走 `lib/image.ts` 的 `downscaleImage()`：长边压到 900px 的 JPEG dataURL。
原图直接进 localStorage 会几件衣服就撑满配额。

### 日期只有一个出处

`lib/date.ts`。**不要在别处再写一份** ——
存储写法 `2026-08-12`（`dateKey`，可字符串比大小、可按前缀切年月），
显示写法 `2026/08/12`（`formatDate`）。
不能用 `toISOString()`：它走 UTC，东八区晚上会记成前一天。

一个已存在的例外：`CODE/src/lib/analysis.ts` 自己拼趋势图的月份键 `YYYY-MM`
（`date.ts` 不提供这一档）。格式与 `dateKey` 的前缀兼容，按月分组是对的。
再要新的日期格式，优先加进 `date.ts`，不要就地拼。

---

## 5. AI 引用机制

五项能力要调模型，四项已落地。**共用一个适配层** `lib/ai/`：

```
lib/ai/types.ts    出入参 + AiResult<T>，页面只认这份签名
lib/ai/client.ts   askVision(images, prompt) —— DeepSeek 适配，server-only
lib/ai/prefill.ts  ① 预填：拼闭集提示词 + 逐字段校验归并
lib/ai/extract.ts  ②③ 水洗标 / 详情页：同一套校验，两套提示词
lib/ai/cutout.ts   ④ 抠图：阿里云商品分割
lib/ai/chat.ts     ⑤ 报告追问：把报告压成上下文，纯文本多轮
```

| 能力 | 用在哪 | 落地 |
|---|---|---|
| AI 预填（品类 / 款式 / 色系 / 季节） | 录入单品 | `api/prefill` → `lib/ai/prefill.ts` |
| 水洗标 OCR（材质成分） | 录入单品 | `api/extract` `kind=label` |
| 详情页提取（价格 / 材质 / 尺码表） | 购买评分 | `api/extract` `kind=listing` |
| 自动抠图 | 录入单品 | `api/cutout` → `lib/ai/cutout.ts` |
| 报告追问 + 假设重算 | 购买评分 | `api/chat` → `lib/ai/chat.ts` |

### 两个供应商，各管一段

**识别与提取走 DeepSeek `deepseek-v4-flash-vision-exp`**（只有它接受图片，别的传图 400）。
三条实测约束：

- **没有 JSON Schema，只有 JSON mode** —— 保证是合法 JSON，不保证结构与取值。
  枚举约束因此要两层：提示词里给闭集 + 拿到结果逐字段校验。
  实测不给闭集时模型会自创「上衣」「长袖吊带衫」「粉色」「春季」，四个字段全落表外
- **`reasoning_tokens` 波动五倍（49–261）且与正文共用 `max_tokens`** ——
  给小了 JSON 会被从中间截断。已固定 3000，并在 `finish_reason === "length"` 时判失败
- **成分名让模型照抄原文，归并交给代码**（`MATERIAL_ALIASES`）。让模型自己映射会把
  「莱赛尔」硬套成相近的档，而错的成分算出错的养护建议，是真会把衣服洗坏的

**抠图走阿里云「商品分割」**，不是通用分割。这个区别是决定性的，实测过：
同一张挂在衣柜上的浅色纱裙，`@imgly`（浏览器 WASM）0%、`rembg u2net` 0%、
`u2netp` 47%，**阿里云 62% 且完整**。前三个找的是「画面里显眼的东西」，
会把衣架、手、页面按钮一起抠出来；商品分割的训练目标就是商品主体。

两条实测约束：

- **SDK 默认超时 3 秒不够。** `...Advance` 会先向 `openplatform.aliyuncs.com` 取一次
  临时上传凭证，这一跳从国内直连稳定超时（`ReadTimeout(3000)`）。已调到 60 秒，
  整条链路实测约 10 秒
- **用 `...Advance` 而不是普通版。** 普通版只收公网可访问的 `ImageURL`，
  那意味着要自建 OSS 桶、把用户的衣服照片传成公开链接 —— 既多一套设施又是隐私问题

### 照片会离开设备

抠图和识别都要把照片发给服务商（DeepSeek、阿里云）。登录后照片还会存进 Supabase。
**这改变了产品的隐私口径。**

**首次触发识别或抠图时弹一次确认**（`components/ai-consent-dialog.tsx`），
同意后记进 `wearth.aiConsent.v1`，不再打扰。逻辑在 `lib/ai-consent.ts`。

三条不能改的口径：

- **一次性，不是每次勾选。** 外发的是平铺单品照和电商截图，不含人像。
  为一张衣服照片设一道复选框，摩擦全在用户身上，拦不住任何风险
- **必须写出「什么不外发」。** 只说「照片会发送至第三方」，用户会默认包括他的
  全身照 —— 而 OOTD 全身照和档案参考照一次都没离开过设备
- **「手动填写」只跳过这一次**，不记成永久设置。那是两个决定

新增任何会外发照片的调用，都要包进 `useAiConsent().guard()`。
**若哪天把 OOTD 全身照或档案照片也发出去，这套东西必须重做** ——
那是人像，届时需要真正的单独同意，并写明接收方名称（PIPL 第 17、23 条）。

接入时遵守下面六条。

**追问的三条边界由代码挡，不靠提示词**（`lib/chat.ts` 的 `askReport`，顺序不能重排）：
结论性提问先被正则挡住，模型根本看不到；认出价格改动直接交回 `scoreCandidate()`；
能对到某个维度的直接用报告里那一行。剩下的才交给模型，模型答不上来如实说边界。
提示词里也写了这些，但那是第二道 —— 软约束绕过去一次，这个产品的立场就没了。

**① 模型只做感知，不做判断。** 评分是规则引擎（`lib/scoring.ts`），
模型只负责「从图里读出材质成分是什么」，不负责「这件值不值得买」。
PRD 6.6 的原话：分数必须稳定可复现，同一件商品两次评分不能给出不同结果。

**② 一切模型调用都是「预填」，不是「决定」。** 结果落进表单当默认值，
用户可改。识别失败降级为手填，不能卡住流程。

**③ key 走服务端。** 调用放 Next Route Handler（`CODE/src/app/api/*/route.ts`），
key 只出现在服务端环境变量里。前端不得持有任何模型 key。

**④ 出入参定在 `lib/`。** 每个能力一个纯函数签名，页面只认这个签名。
换模型供应商时只改实现，页面不动。

**⑤ 材质不做图片识别。** PRD §8 明确不做——从面料照片判断成分不可靠，
会给出错误的养护建议。材质只能从**水洗标文字**读。这是产品判断，不是技术限制。

**⑥ 假设重算必须回规则引擎。**「降到 400 呢」这类问题，模型只负责把话解析成一组参数
改动（`Partial<Candidate>`），改动套到 `candidate` 上重新调 `lib/scoring.ts` 的 `score()`。
让模型自己算会得到一个和报告对不上的数 —— 同一件商品报告里 78 分、对话里 82 分，
这个功能就废了。重算结果只回给对话，**不写回 `Decision.result`**（PRD 6.6）。

---

## 6. 开发约束

### 壳的层级

```
ThemeModeProvider → ShellMediaProvider → PointerProvider → FullscreenTransitionProvider
  RouteTransitionLayer   转场画布
  PointerTrail           内页指针拖尾
  Scrollbar              自绘滚动条
  ShellGate              字体就绪前整树 invisible
    ScrollShell          首页 Lenis / 内页原生滚动
      {children}
```

改这棵树之前先读 DESIGN.md §4。**首页与内页的滚动源不同**，
Lenis 只包首页，内页套上去会让表格拖泥带水。

### 浮层一律 portal 到 body

弹窗、下拉、日期面板、取色器都是。两个原因：

- 抽屉与弹窗正文都是 `overflow-y-auto`，绝对定位的浮层会被裁断
- 首页那层 Lenis 会先接走滚轮

portal 之后还有一条**必须补**：面板上要 `onPointerDown={e => e.stopPropagation()}`。
浮层在 DOM 里挂到了 body，但在 **React 树里**仍是抽屉/弹窗的后代，事件照样冒上去；
而那两层的「点外面就关」判的是 DOM `contains` —— 不掐断的话，点一下浮层就把
整个抽屉关掉了。

### `"use client"` 模块不能被服务端引用

**带 `"use client"` 的模块被 Route Handler 引用时，导出会变成客户端引用代理** ——
拿到的不是真正的数组或函数。表现是运行时抛 `CATEGORIES.map is not a function`，
而 **typecheck 完全查不出来**（类型是对的，只有运行时才变），
curl 看到的也只是一个空 body 的 500。

所以 `lib/wardrobe.ts` 拆成了两半：

```
lib/wardrobe-data.ts   纯数据与规则，无 "use client"，服务端可引
lib/wardrobe.ts        "use client" + useWardrobe + 种子数据，整体 re-export 前者
```

客户端的既有引用一行都不用改（re-export 顶着）；**服务端一律引 `wardrobe-data.ts`**。

再写新的 Route Handler 时，凡是要引 `lib/` 里的东西，先确认那个文件顶上没有
`"use client"`。有的话就照上面拆一次，不要在服务端侧另抄一份常量。

### 共用件只此一份

下面这些已经统一过，**不要各写各的**（路径相对 `CODE/src/`）：

```
components/dialog-shell.tsx    弹窗外壳
components/dropdown-menu.tsx   下拉菜单（非原生 select）
components/date-picker.tsx     日期选择（非原生 input[type=date]）
components/color-field.tsx     颜色格（非原生 input[type=color]）
components/photo-drop.tsx      照片投放区
components/panel.tsx           表单族面板
components/form-controls.tsx   CELL / NumberCell / CascadeSelect / CheckTag
lib/date.ts                    全站日期
lib/wardrobe-data.ts           品类 / 色系 / 季节 / CPW（服务端也引这一份）
lib/ai/client.ts               模型调用，换供应商只改这一个文件
```

### 不用原生控件

`<select>` / `<input type="date">` / `<input type="color">` 一律不用：
它们渲染的是系统菜单，长相由操作系统决定，且塞不进图标、对勾、打点这些
产品要表达的信息。全站现在为零，别加回来。

---

## 7. 禁止破坏的逻辑

改到下面任何一条，先回 PRD 对口径。它们是产品的地基，不是实现细节。

### CPW（PRD 附录 B）

```
CPW = (购买价格 + 累计养护支出) ÷ 累计穿着次数
```

- **穿着次数为 0 时 `cpw()` 返回 `null`**，不返回 ∞、不退化成购买价。
  显示为「尚未穿着 · 已投入 ¥X」。退化会污染排行榜和衣橱均值。
- **衣橱平均 CPW = 总支出 ÷ 总穿着次数**，不是各单品 CPW 的算术平均。
  算术平均会被一件只穿过一次的贵外套拉爆。见 `lib/analysis.ts` 的 `overview()`。
- **已处置单品不进 CPW 排行榜**（榜单的行动含义是「该多穿它了」，送人卖掉的
  无法行动），但**仍计入累计支出与穿着次数** —— 那笔钱确实花过。

### 评分（PRD 附录 D）

- **权重 ①15 + ②20 + ③25 + ④20 + ⑤20**，写在 `lib/scoring.ts` 的 `weight` 字段
- **维度不可算时按可算权重归一**：`总分 = (已算得分之和 ÷ 可算权重之和) × 100`
- **冷启动阈值 15 件**（`live.length < 15`）：不足时只出 ④⑤ 与③的参考价路径
- **`snapshotAt` 与整个 `candidate` 一并存进决策记录**，历史评分必须可复现
- **规则引擎产出分数，模型不参与打分**（同 §5 ①）
- **对话不改分数**：报告追问与假设重算都不写回 `Decision.result`，重算一律走 `score()`（§5 ⑥）
- **对话不给购买结论**：同 PRD §8。被直接问到时把决定权还回去、摆出权衡，不给买/不买

### 品类（PRD 附录 A）

- **一级必须显式存**，不能由二级反推：「开衫」同时挂在内搭与外套下，
  二级品类名**不是全局唯一的**。曾经存在的 `categoryOfSub()` 已因此删除。
- 改一级品类时必须同时重置二级，否则会得到新一级里不存在的组合，
  决策①的相似判定就废了。

### 季节（PRD 附录 C）

- 窗口全国统一：春 3–5 / 夏 6–8 / 秋 9–11 / 冬 12–2
- **季节标签不能为空**：空集的单品永远进不了「本季还没穿过」。
  取消最后一档时落回四季（全集）。

### 数据

- **`care` 恒等于 `careLog` 的合计**
- **改动会让存量数据算错时，storage key 必须进版本号**（§3）
- **未登录也必须能完整使用。** 没配 Supabase、断网、RLS 拒绝，
  三种情况都要退回本地照常跑。云端是增强，不是前提
- **演示数据不上云**（§4）

---

## 8. 部署（Vercel）

线上 **https://getwearth.com** —— 阿里云注册的自有域名，DNS 也在阿里云，
A / CNAME 指向 Vercel（`*.vercel.app` 在国内被墙的是域名本身，不是 Vercel 的服务器）。
推 main 自动部署。完整步骤与踩过的坑见 `DEPLOY.md`，这里只列会影响写代码的三条。

**新增 API 路由必须写 `export const maxDuration = 60`。**
Vercel 默认只给 Serverless Function 10 秒，而预填线上实测 8.2 秒 ——
不写的话稍微复杂的图就 504，**而本地 `npm run dev` 永远复现不出来**。
60 这个数和 `lib/ai/client.ts` 的 `TIMEOUT_MS` 对齐：两边不一致时先到期的那边
说了算，另一边的超时处理永远走不到。

**改了 `lib/supabase/` 的表结构，要先在 Supabase 跑迁移再推代码。**
反过来的话，新代码会去读还不存在的列。

**换域名要同时改三处，漏一处都不报错。** `app/layout.tsx` 的 `metadataBase`
（写死自有域名，不读 `VERCEL_URL` —— 后者每推一次就变，抓取器会缓存到一个很快
失效的图片地址）、Supabase 的 Site URL 与 Redirect URLs、`tools/build-og.mjs`
里印在分享卡片上的那行地址。漏掉 Supabase 那处最隐蔽：页面照常打开，只有点邮件
登录链接时才跳回旧域名。

---

## 9. 验收标准

提交前四条全过。

### 必过

```bash
cd CODE && npx tsc --noEmit -p tsconfig.json     # 无输出
```

**页面回归** —— 七条路由都要对：

| 路由 | 期望 |
|---|---|
| `/` `/profile` `/wardrobe` `/ootd` `/analysis` `/decide` | 200，且 HTML 里无 `Build Error` / `Module not found` / `is not defined` |
| 任意不存在的地址 | 404，且渲染的是中文的「找不到这个页面」，不是 Next 自带英文页 |

**碰了 `lib/*-store.ts` 或 `lib/supabase/` 另加** —— 两条路都要走一遍：

| 状态 | 验什么 |
|---|---|
| 未登录 | 填一个值 → 刷新 → 还在（走 localStorage） |
| 已登录 | 填一个值 → 刷新 → 还在；**填完立刻切页再回来 → 还在**（验卸载补交） |

第二条最容易漏。防抖窗口是 700ms，手动测时下意识会等一下，就正好绕开了这个 bug。

**dev server 正在跑时不要执行 `npm run build`** —— 它会覆盖 `.next`，
导致运行中的 dev server 全站 500。要验证构建先停 dev server。

### 碰了 `api/` 下任何一条路由另加

- **没配 key、超时、模型读不出来，一律降级为手填 / 手动，页面其余部分照常。**
  评分和 CPW 都是本地规则引擎算出来的，不该被一条外部依赖拖垮。
- key 只在服务端环境变量里：`grep -r` 构建产物搜不到它，也不带 `NEXT_PUBLIC_` 前缀。
- 假设重算的分数与同参数直接调 `score()` 的结果一致（§5 ⑥）。

### 视觉改动另加

对照 DESIGN.md §8 的落地检查表。最常漏的三条：

- 过渡带 `motion-reduce:transition-none`
- hover 一律 `lg:hover:`（触屏不触发）
- 白底/近白卡上的线用 `--frame`，米白底上的用 `--line`

### 碰了 §7 的逻辑另加

- 回 PRD 对口径，并在代码注释里写明依据的是哪一条附录
- 若改了 storage 结构，确认版本号已进位

### 手工验一遍主流程

自动化只能证明页面没崩。核心闭环要人点一遍：

```
录入一件衣服 → 日历记一天穿搭并关联它 → 详情页看穿着次数与 CPW 变了
→ 统计页看总览与排行跟着变 → 评分页跑一次评分并存进决策记录
```
