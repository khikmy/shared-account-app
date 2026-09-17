# 共有口座管理アプリ

こうへい・みどりの共有口座管理用アプリ。元は Google Apps Script (GAS) + スプレッドシートで動いていたものを、
Next.js (App Router) + Supabase (Postgres) + Vercel の構成に移行したもの。

## 機能

- ダッシュボード: 前月末残高・今月の収支・口座残高、個人別の翌月精算額、分類別の予算対比
- 支出: 食費・消耗品費・交際費の記録(追加/編集/削除/検索・絞り込み)、固定費・変動費の月次実績入力
- 予算: 月次予算の設定(前月コピー機能あり)
- 立替金: 立替の記録・未精算/精算済の管理・精算メッセージの自動計算

## 技術構成

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres) — **Service Role キーはサーバー側 (Server Actions) のみで使用し、ブラウザには一切渡さない**
- 認証は二人で共有する1つのパスワードによる簡易ゲート(`APP_PASSWORD`)。Vercel上で誰でも見られる状態を避けるため。

## セットアップ

### 1. Supabase プロジェクトを準備

1. https://supabase.com でプロジェクトを作成
2. SQL Editor で `sql/schema.sql` の内容を実行してテーブルを作成
3. 続けて `sql/seed_data.sql` を実行すると、共有スプレッドシートにあった過去データ(予算・固定費変動費実績・立替金・食費等の履歴)が投入されます
4. プロジェクトの Settings > API から `Project URL` と `service_role` キー(**anon キーではない**)を控える

### 2. 環境変数を設定

`.env.local.example` を `.env.local` にコピーして値を埋める。

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_PASSWORD=二人で使うログインパスワード
APP_SESSION_SECRET=適当なランダム文字列
```

### 3. ローカル起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開き、`APP_PASSWORD` でログイン。

## Vercel へのデプロイ

1. このリポジトリを GitHub に push
2. Vercel でこのリポジトリを Import
3. Vercel の Project Settings > Environment Variables に `.env.local` と同じ4つの値を設定
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `APP_PASSWORD` / `APP_SESSION_SECRET`)
4. Deploy

Service Role キーは強い権限を持つため、`NEXT_PUBLIC_` を絶対に付けないこと(付けるとブラウザに露出する)。

## データモデル

| テーブル | 用途 | 旧シート |
|---|---|---|
| `transactions` | 食費・消耗品費・交際費の取引履歴 | 食費・消耗品費・交際費 |
| `budgets` | 月次予算 (対象月・区分・分類・予算金額) | 予算 |
| `fixed_variable_actuals` | 固定費・変動費の月次実績 | 固定費・変動費 |
| `reimbursements` | 立替金 | 立替金 |

金額計算・ダッシュボードの集計ロジックは `lib/calc.ts` に、元の `Code.gs` のロジックを忠実に移植している
(基準月 `2025-11` からの繰越計算、こうへいの固定入金額 ¥200,000 など)。
