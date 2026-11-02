-- 結婚関連の費用を示すフラグを追加する(Supabase の SQL Editor で実行してください)
alter table transactions add column if not exists is_wedding boolean not null default false;
alter table reimbursements add column if not exists is_wedding boolean not null default false;
