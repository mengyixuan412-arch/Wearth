-- Wearth 表结构 · 在 Supabase Dashboard 的 SQL Editor 里整段执行
--
-- 五张表对应五个 store（见 ARCHITECTURE.md §3），全部按 user_id 隔离。
-- 建项目时勾了「自动 RLS」，新表默认锁死；下面每张表都显式写了策略，
-- 没有策略的表任何人都读不到，这是**故意的失败方向** —— 宁可访问不了，
-- 不要全世界都能读。
--
-- 访客（未登录）不读这些表：他们看的是代码里的种子数据，可操作但不落库（乙方案）。
-- 所以每条策略都只认 `auth.uid() = user_id`，匿名一律拒绝。

-- ─────────────────────────────────────────────
-- 1. 衣橱单品
-- ─────────────────────────────────────────────
create table if not exists public.items (
  -- 主键用 (user_id, id)：`id` 是应用侧生成的自增字符串（"1" "2" …），
  -- 全局不唯一，但对同一个用户唯一。换成 uuid 会让本地数据迁移时全部重编号，
  -- 而穿搭记录里存的正是这些 id（ARCHITECTURE.md §3 的跨表引用）。
  user_id     uuid not null references auth.users on delete cascade,
  id          text not null,

  name        text not null,
  category    text not null,
  sub         text not null,
  price       integer not null,
  care        integer not null default 0,
  wears       integer not null default 0,
  -- 图片是 dataURL（长边 900px 的 JPEG，约 29KB）。text 存得下，
  -- Postgres 单行上限 1GB，百来件衣服只有几 MB —— localStorage 那 5MB 的天花板没了。
  image       text not null default '',
  color       text not null,
  color_family text not null,
  seasons     text[] not null default '{}',
  brand       text not null default '未填写',
  bought_at   date not null,
  status      text not null default '在用',

  -- 这两个总是跟着单品整取整存，不单独查询，用 jsonb 而不是拆表
  care_log    jsonb not null default '[]'::jsonb,
  materials   jsonb not null default '[]'::jsonb,

  size        text,
  channel     text,
  note        text,

  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ─────────────────────────────────────────────
-- 2. 穿搭日志（一天一行）
-- ─────────────────────────────────────────────
create table if not exists public.ootd (
  user_id    uuid not null references auth.users on delete cascade,
  -- 日期键 `2026-08-12`，和 lib/date.ts 的 dateKey 同格式
  day        date not null,
  photo      text,
  note       text not null default '',
  -- 关联的单品 id。**不设外键** —— 删单品时不该连带删掉那天的穿搭记录，
  -- 读的时候容忍找不到（同 ARCHITECTURE.md §3）
  items      text[] not null default '{}',
  voice      text,
  voice_sec  integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ─────────────────────────────────────────────
-- 3. 个人档案（一人一行）
-- ─────────────────────────────────────────────
create table if not exists public.profile (
  user_id    uuid primary key references auth.users on delete cascade,
  -- 字段多且全是可选的字符串，整体当一份文档存 —— 档案永远是整取整存，
  -- 拆成二十列只会让加一个字段就要改表
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 4. 决策记录
-- ─────────────────────────────────────────────
create table if not exists public.decisions (
  user_id    uuid not null references auth.users on delete cascade,
  id         text not null,
  at         date not null,
  name       text not null default '',
  photo      text,
  -- **值拷贝，不是引用**：评分依赖当时的衣橱快照，事后衣橱变了，
  -- 历史评分不能跟着变（ARCHITECTURE.md §7）
  candidate  jsonb not null,
  result     jsonb not null,
  primary key (user_id, id)
);

-- ─────────────────────────────────────────────
-- 5. 自建二级品类
-- ─────────────────────────────────────────────
create table if not exists public.custom_subs (
  user_id    uuid primary key references auth.users on delete cascade,
  -- { "内搭": ["瑜伽服"], … }
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- RLS：五张表一套策略，只认「这一行是我的」
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['items', 'ootd', 'profile', 'decisions', 'custom_subs'] loop
    execute format('alter table public.%I enable row level security', t);

    -- 重跑本文件时先清掉旧策略，避免 42710 duplicate_object
    execute format('drop policy if exists "own rows" on public.%I', t);

    -- 一条策略管四种操作。`using` 管读/改/删能看见哪些行，
    -- `with check` 管写入时不许把 user_id 填成别人的。
    execute format($f$
      create policy "own rows" on public.%I
        for all
        to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $f$, t);
  end loop;
end $$;

-- 按用户取全部单品是最热的查询（衣橱页一进去就要），主键已经覆盖；
-- 日历按月切片走 day 的范围扫，行数很少，不额外建索引。
