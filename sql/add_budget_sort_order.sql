-- 月次予算の並び順を保存する列を追加する(Supabase の SQL Editor で実行してください)
-- null の行は従来の既定の並び順(lib/calc.ts の BUDGET_DISPLAY_ORDER)で表示されます。
alter table budgets add column if not exists sort_order integer;
