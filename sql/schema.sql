-- 共有口座管理アプリ スキーマ
-- Supabase の SQL Editor でこのファイルの内容をそのまま実行してください。

create table if not exists transactions (
  id bigint generated always as identity primary key,
  date date not null,
  person text not null,
  category text not null,
  amount numeric not null,
  memo text default ''
);
create index if not exists transactions_date_idx on transactions (date);

create table if not exists budgets (
  id bigint generated always as identity primary key,
  target_month text not null, -- 'YYYY-MM'
  type text not null,         -- 固定費 / 変動費 / 貯金
  category text not null,
  amount numeric not null,
  unique (target_month, category)
);
create index if not exists budgets_month_idx on budgets (target_month);

create table if not exists fixed_variable_actuals (
  id bigint generated always as identity primary key,
  target_month text not null,
  type text not null,
  category text not null,
  person text default '',
  amount numeric not null default 0,
  unique (target_month, category)
);
create index if not exists fixed_variable_actuals_month_idx on fixed_variable_actuals (target_month);

create table if not exists reimbursements (
  id bigint generated always as identity primary key,
  payer text not null,
  incurred_date date not null,
  content text not null,
  amount numeric not null,
  status text not null default '未精算'
);
create index if not exists reimbursements_status_idx on reimbursements (status);

-- このアプリはサーバー側の Service Role キーのみで Supabase にアクセスし、
-- ブラウザには一切キーを渡さない構成のため、RLS は有効にしたうえで
-- クライアントからの直接アクセスは全て拒否しておく(Service Role はRLSを無視するため影響なし)。
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table fixed_variable_actuals enable row level security;
alter table reimbursements enable row level security;
