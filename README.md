# 欢愉值时间银行

一个游戏化时间与效率管理 PWA，支持移动端和桌面端自适应。配置 Supabase 后，Mac 和 iPhone 可以实时同步同一份数据；未配置时会自动使用本地缓存，方便先体验。

## 核心公式

```txt
十进制小时 = 小时 + 分钟 / 60
本次获得积分 = 十进制小时 * 专注评分
本次获得娱乐时间（分钟） = 本次获得积分 * 4
当前可用娱乐时间 = 历史总赚取娱乐时间 - 历史总消耗娱乐时间
```

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:3000`。

如果要用 iPhone 打开，需要让服务监听局域网地址：

```bash
pnpm dev:lan
```

然后在 Mac 上查看局域网 IP：

```bash
ipconfig getifaddr en0
```

假设输出是 `192.168.1.23`，iPhone Safari 打开：

```txt
http://192.168.1.23:3000
```

注意：`http://127.0.0.1:3000` 只代表“当前这台设备自己”。在 iPhone 上输入它，会访问 iPhone 自己，不会访问 Mac。

如果页面曾经出现“只有文字、没有样式”，请刷新一次；开发环境已禁用 PWA 缓存，避免旧缓存拦截样式文件。

## 外出时用手机记录

外出时不能再使用 `localhost`、`127.0.0.1` 或 `192.168.x.x` 这类地址。这些都只适合本机或同一 Wi-Fi。想在户外用 iPhone 记录，需要把应用部署到公网 HTTPS 地址。

推荐组合：

```txt
前端部署：Vercel
云端数据库：Supabase
手机使用：Safari 打开部署后的 HTTPS 地址，并添加到主屏幕
```

### 1. 创建 Supabase 项目

在 Supabase 新建项目后，进入 SQL Editor，执行下面“Supabase 表结构”里的 SQL。

如果只是自己使用、还没有做账号登录，可以先使用临时宽松策略：

```sql
create policy "temporary activity access"
  on public.activity_records for all
  using (true)
  with check (true);

create policy "temporary spend access"
  on public.entertainment_spends for all
  using (true)
  with check (true);
```

这样 Mac 和 iPhone 都能读写同一份数据。等以后需要更安全的多人隔离，再接 Supabase Auth。

### 2. 配置云同步环境变量

在 Vercel 的项目设置里添加：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_PROFILE_ID=your-private-sync-key
```

`NEXT_PUBLIC_APP_PROFILE_ID` 请填一串自己生成的随机文本，比如：

```txt
joy-bank-8f4c2a91-private
```

同一个部署地址会使用这一个身份标识，所以你的 Mac 和 iPhone 会看到同一份记录。

### 3. 部署到 Vercel

把这个项目上传到 GitHub，然后在 Vercel 导入该仓库。构建设置保持默认即可：

```txt
Build Command: pnpm build
Output: Next.js 默认
```

部署完成后，Vercel 会给你一个类似下面的地址：

```txt
https://your-app.vercel.app
```

之后在户外用 iPhone 打开这个 HTTPS 地址就可以记录。

### 4. 添加到 iPhone 主屏幕

在 iPhone Safari 打开部署地址，然后点“分享”按钮，选择“添加到主屏幕”。之后它会像普通 App 一样从桌面打开。

## 环境变量

复制 `.env.example` 为 `.env.local`，填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_PROFILE_ID=your-private-sync-key
```

`NEXT_PUBLIC_APP_PROFILE_ID` 是你的同步身份标识。Mac 和 iPhone 使用同一个部署地址和同一个值，就会看到同一份数据。建议使用一串不容易猜到的随机文本。

## Supabase 表结构

在 Supabase SQL Editor 中执行：

```sql
create table public.activity_records (
  id uuid primary key,
  profile_id text not null,
  category text not null check (category in ('投资', '套利', '健身', '羽毛球', '阅读')),
  hours integer not null check (hours >= 0 and hours <= 24),
  minutes integer not null check (minutes >= 0 and minutes <= 59),
  decimal_hours numeric(8, 2) not null,
  focus_score integer not null check (focus_score >= 0 and focus_score <= 20),
  points numeric(10, 2) not null,
  earned_minutes numeric(10, 1) not null,
  created_at timestamptz not null default now()
);

create table public.entertainment_spends (
  id uuid primary key,
  profile_id text not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  created_at timestamptz not null default now()
);

create index activity_records_profile_created_idx
  on public.activity_records (profile_id, created_at desc);

create index entertainment_spends_profile_created_idx
  on public.entertainment_spends (profile_id, created_at desc);

alter table public.activity_records enable row level security;
alter table public.entertainment_spends enable row level security;

create policy "profile activity read"
  on public.activity_records for select
  using (profile_id = current_setting('request.jwt.claims', true)::jsonb->>'profile_id');

create policy "profile activity insert"
  on public.activity_records for insert
  with check (profile_id = current_setting('request.jwt.claims', true)::jsonb->>'profile_id');

create policy "profile activity delete"
  on public.activity_records for delete
  using (profile_id = current_setting('request.jwt.claims', true)::jsonb->>'profile_id');

create policy "profile spend read"
  on public.entertainment_spends for select
  using (profile_id = current_setting('request.jwt.claims', true)::jsonb->>'profile_id');

create policy "profile spend insert"
  on public.entertainment_spends for insert
  with check (profile_id = current_setting('request.jwt.claims', true)::jsonb->>'profile_id');
```

如果暂时不接入 Supabase Auth，可以先在开发阶段使用下面的宽松策略，之后再切换成上面的严格策略：

```sql
create policy "temporary activity access"
  on public.activity_records for all
  using (true)
  with check (true);

create policy "temporary spend access"
  on public.entertainment_spends for all
  using (true)
  with check (true);
```

## PWA

项目已包含 `public/manifest.webmanifest` 和 `public/sw.js`。部署到 HTTPS 域名后，可在 iPhone Safari 中通过“添加到主屏幕”安装。
