'use server';

import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { AUTH_COOKIE, verifyPassword } from '@/lib/auth';
import {
  BANK_PERSON,
  BIMONTHLY_CATEGORIES,
  FIXED_CATEGORIES,
  MEDIAN_BUDGET_CATEGORIES,
  MEDIAN_BUDGET_FROM,
  MEDIAN_BUDGET_START,
  SAVINGS_CATEGORY,
  computeDashboard,
  computeSettlementMessage,
  isMedianBudgetLocked,
  medianBudgetAmount,
  monthKeyFromDateStr,
  sortByDisplayOrder,
} from '@/lib/calc';
import type {
  BudgetItem,
  BudgetType,
  FixedVariableActual,
  FixedVariableRow,
  Reimbursement,
  Transaction,
  WeddingExpense,
} from '@/lib/types';

// ===================== 認証 =====================

export async function login(password: string): Promise<{ ok: boolean; message?: string }> {
  const token = await verifyPassword(password);
  if (!token) return { ok: false, message: 'パスワードが違います' };
  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
}

// ===================== 全件取得 =====================

// Supabase は1回の取得が既定で1000行までで、超えた分は黙って切り捨てられる。
// 1ページ目で総件数を取り、残りのページは並列で取得する。必要な列だけを指定して転送量を減らす。
const PAGE_SIZE = 1000;

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const first = await supabase
    .from(table)
    .select(columns, { count: 'exact' })
    .order('id')
    .range(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);
  const rows = ((first.data || []) as unknown) as T[];
  const total = first.count ?? rows.length;
  if (total <= PAGE_SIZE) return rows;

  const pageCount = Math.ceil(total / PAGE_SIZE) - 1;
  const rest = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from(table)
        .select(columns)
        .order('id')
        .range((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE - 1)
    )
  );
  for (const r of rest) {
    if (r.error) throw new Error(r.error.message);
    rows.push(...(((r.data || []) as unknown) as T[]));
  }
  return rows;
}

// ===================== マスタ =====================

function peopleFromTransactions(rows: { person?: string | null }[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => {
    if (r.person && r.person !== BANK_PERSON) set.add(r.person);
  });
  if (set.size === 0) return ['みどり', 'こうへい'];
  return Array.from(set).sort();
}

// 人名は滅多に増えないので、全取引を読み直さないよう短時間キャッシュする (追加・更新時は破棄)
const PEOPLE_TTL_MS = 60_000;
let peopleCache: { value: string[]; expires: number } | null = null;

export async function getPeople(): Promise<string[]> {
  if (peopleCache && peopleCache.expires > Date.now()) return peopleCache.value;
  const rows = await fetchAll<{ person: string }>('transactions', 'person');
  const value = peopleFromTransactions(rows);
  peopleCache = { value, expires: Date.now() + PEOPLE_TTL_MS };
  return value;
}

export async function getCategories(): Promise<{ name: string; type: string }[]> {
  return FIXED_CATEGORIES.map((c) => ({ name: c, type: '変動費' }));
}

// ===================== 支出履歴 (食費・消耗品費・交際費) =====================

export interface HistoryFilter {
  month?: string;
  person?: string;
  category?: string;
  keyword?: string;
}

export async function getHistory(filter: HistoryFilter = {}): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*');
  if (filter.month) {
    const start = `${filter.month}-01`;
    const [y, m] = filter.month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1);
    const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    query = query.gte('date', start).lt('date', end);
  }
  if (filter.person) query = query.eq('person', filter.person);
  if (filter.category) query = query.eq('category', filter.category);
  if (filter.keyword) query = query.ilike('memo', `%${filter.keyword}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data || []) as Transaction[];
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  return rows;
}

export interface HistoryEntryInput {
  date: string;
  person: string;
  category: string;
  amount: number;
  memo?: string;
  isWedding?: boolean;
}

export async function addHistory(entry: HistoryEntryInput): Promise<void> {
  peopleCache = null;
  const { error } = await supabase.from('transactions').insert({
    date: entry.date,
    person: entry.person,
    category: entry.category,
    amount: Number(entry.amount),
    memo: entry.memo || '',
    is_wedding: !!entry.isWedding,
  });
  if (error) throw new Error(error.message);
}

export async function updateHistory(id: number, entry: HistoryEntryInput): Promise<void> {
  peopleCache = null;
  const { error } = await supabase
    .from('transactions')
    .update({
      date: entry.date,
      person: entry.person,
      category: entry.category,
      amount: Number(entry.amount),
      memo: entry.memo || '',
      is_wedding: !!entry.isWedding,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteHistory(id: number): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ===================== 予算 =====================

export async function getBudget(monthStr: string): Promise<BudgetItem[]> {
  const { data, error } = await supabase.from('budgets').select('*').eq('target_month', monthStr);
  if (error) throw new Error(error.message);
  return sortByDisplayOrder((data || []) as BudgetItem[]);
}

/** 月次予算の並び順を保存する (categories の並びがそのまま表示順になる)。固定費・変動費タブにも反映される */
export async function reorderBudgetItems(monthStr: string, categories: string[]): Promise<void> {
  const results = await Promise.all(
    categories.map((category, index) =>
      supabase.from('budgets').update({ sort_order: index }).eq('target_month', monthStr).eq('category', category)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

async function getAllBudgetRaw(): Promise<BudgetItem[]> {
  return fetchAll<BudgetItem>('budgets', 'id,target_month,type,category,amount');
}

export async function setBudgetItem(
  monthStr: string,
  category: string,
  amount: number,
  type: BudgetType
): Promise<void> {
  if (isMedianBudgetLocked(monthStr, category)) {
    throw new Error('この予算は実績の中央値で自動算出されるため、編集できません');
  }
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { target_month: monthStr, category, amount: Number(amount), type },
      { onConflict: 'target_month,category' }
    );
  if (error) throw new Error(error.message);
}

export async function deleteBudgetItem(monthStr: string, category: string): Promise<void> {
  if (isMedianBudgetLocked(monthStr, category)) {
    throw new Error('この予算は実績の中央値で自動算出されるため、削除できません');
  }
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('target_month', monthStr)
    .eq('category', category);
  if (error) throw new Error(error.message);
}

export async function copyBudgetFromPreviousMonth(monthStr: string): Promise<BudgetItem[]> {
  const [y, m] = monthStr.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const [prevItems, current] = await Promise.all([getBudget(prevMonth), getBudget(monthStr)]);
  const currentCategories = new Set(current.map((b) => b.category));

  const toInsert = prevItems
    .filter((item) => !currentCategories.has(item.category))
    .map((item) => ({
      target_month: monthStr,
      category: item.category,
      amount: item.amount,
      type: item.type,
      // 前月の並び順も引き継ぐ (未設定なら列自体を送らない)
      ...(item.sort_order != null ? { sort_order: item.sort_order } : {}),
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('budgets').insert(toInsert);
    if (error) throw new Error(error.message);
  }
  await applyMedianBudgets(monthStr);
  await copyFixedVariableActualsFromPreviousMonth(prevMonth, monthStr);
  return getBudget(monthStr);
}

/** 前月の固定費・変動費の実績と対象者を、未入力の分類についてコピーする (食費・日用品は自動計算のため除く) */
async function copyFixedVariableActualsFromPreviousMonth(prevMonth: string, monthStr: string): Promise<void> {
  const [prevRes, currentRes] = await Promise.all([
    supabase.from('fixed_variable_actuals').select('*').eq('target_month', prevMonth),
    supabase.from('fixed_variable_actuals').select('category').eq('target_month', monthStr),
  ]);
  if (prevRes.error) throw new Error(prevRes.error.message);
  if (currentRes.error) throw new Error(currentRes.error.message);

  const existing = new Set((currentRes.data || []).map((r: { category: string }) => r.category));
  const toInsert = ((prevRes.data || []) as FixedVariableActual[])
    .filter((r) => r.category !== '食費・日用品' && !existing.has(r.category))
    .map((r) => ({
      target_month: monthStr,
      category: r.category,
      type: r.type,
      person: r.person,
      amount: r.amount,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('fixed_variable_actuals').insert(toInsert);
    if (error) throw new Error(error.message);
  }
}

/** 中央値の算出対象分類ごとの月別実績 (食費・日用品は食費・消耗品費・交際費の取引合計) */
async function getMedianActuals(): Promise<Record<string, Record<string, number>>> {
  const actuals: Record<string, Record<string, number>> = {};
  const [fixedVariable, transactions] = await Promise.all([getAllFixedVariableRaw(), getAllTransactionsRaw()]);
  fixedVariable.forEach((r) => {
    (actuals[r.category] ??= {})[r.target_month] = Number(r.amount);
  });
  const foodCategories = new Set(['食費', '消耗品費', '交際費']);
  const food: Record<string, number> = {};
  transactions.forEach((t) => {
    if (t.person === BANK_PERSON || !foodCategories.has(t.category)) return;
    const m = monthKeyFromDateStr(t.date);
    food[m] = (food[m] || 0) + Number(t.amount);
  });
  actuals['食費・日用品'] = food;
  return actuals;
}

/** 中央値の算出に使う月別実績の推移 (MEDIAN_BUDGET_FROM から前月まで、月順。2ヶ月に1度の請求の分類は0円の月を除く) */
export async function getMedianActualTrend(
  monthStr: string,
  category: string
): Promise<{ month: string; amount: number }[]> {
  const actual = (await getMedianActuals())[category] || {};
  return Object.entries(actual)
    .filter(([m, v]) => m >= MEDIAN_BUDGET_FROM && m < monthStr && !(BIMONTHLY_CATEGORIES.includes(category) && v === 0))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));
}

/** MEDIAN_BUDGET_START 以降の月は、ガス・電気・水道・食費日用品の予算を前月までの実績の中央値で上書きする */
async function applyMedianBudgets(monthStr: string): Promise<void> {
  if (monthStr < MEDIAN_BUDGET_START) return;

  const [actuals, current] = await Promise.all([getMedianActuals(), getBudget(monthStr)]);
  const rows = MEDIAN_BUDGET_CATEGORIES.flatMap((category) => {
    const amount = medianBudgetAmount(category, monthStr, actuals[category] || {});
    if (amount === null) return [];
    const type = current.find((b) => b.category === category)?.type ?? '変動費';
    return [{ target_month: monthStr, category, amount, type }];
  });
  if (rows.length === 0) return;
  const { error } = await supabase.from('budgets').upsert(rows, { onConflict: 'target_month,category' });
  if (error) throw new Error(error.message);
}

// ===================== 固定費・変動費 =====================

async function getAllFixedVariableRaw(): Promise<FixedVariableActual[]> {
  return fetchAll<FixedVariableActual>('fixed_variable_actuals', 'id,target_month,type,category,person,amount');
}

async function getAllTransactionsRaw(): Promise<Transaction[]> {
  return fetchAll<Transaction>('transactions', 'id,date,person,category,amount');
}

export async function getFixedVariableActuals(monthStr: string): Promise<FixedVariableRow[]> {
  const [y, m] = monthStr.split('-').map(Number);
  const next = new Date(y, m, 1);
  const nextMonthStart = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;

  // 予算・実績・取引は互いに独立なので並列で取得する
  const [allBudgetItems, fvRes, histRes] = await Promise.all([
    getBudget(monthStr),
    supabase.from('fixed_variable_actuals').select('category,person,amount').eq('target_month', monthStr),
    supabase.from('transactions').select('category,amount').gte('date', `${monthStr}-01`).lt('date', nextMonthStart),
  ]);
  if (fvRes.error) throw new Error(fvRes.error.message);
  if (histRes.error) throw new Error(histRes.error.message);

  const budgetItems = allBudgetItems.filter(
    (b) => b.type === '固定費' || b.type === '変動費' || b.category === SAVINGS_CATEGORY
  );
  const actualMap: Record<string, { amount: number; person: string }> = {};
  (fvRes.data || []).forEach((row: { category: string; person: string | null; amount: number }) => {
    actualMap[row.category] = { amount: row.amount, person: row.person || '' };
  });
  const histData = histRes.data;
  const foodCategories = new Set(['食費', '消耗品費', '交際費']);
  const foodTotal = (histData || []).reduce(
    (sum: number, r: { category: string; amount: number }) =>
      foodCategories.has(r.category) ? sum + Number(r.amount) : sum,
    0
  );

  return budgetItems.map((b) => {
    if (b.category === '食費・日用品') {
      return {
        category: '食費・消耗品費・交際費',
        type: b.type,
        budget: b.amount,
        actual: foodTotal,
        person: '',
        editable: false,
      };
    }
    if (b.category === SAVINGS_CATEGORY) {
      const s = actualMap[b.category] || { amount: 0, person: '' };
      return {
        category: b.category,
        type: '固定費' as BudgetType,
        budget: b.amount,
        actual: s.amount,
        person: 'みどり・こうへい',
        editable: true,
        bothPersons: true,
      };
    }
    const a = actualMap[b.category] || { amount: 0, person: '' };
    return {
      category: b.category,
      type: b.type,
      budget: b.amount,
      actual: a.amount,
      person: a.person,
      editable: true,
    };
  });
}

export async function setFixedVariableActual(
  monthStr: string,
  category: string,
  amount: number,
  person: string
): Promise<void> {
  if (category === '食費・日用品' || category === '食費・消耗品費・交際費') {
    throw new Error('食費・消耗品費・交際費の実績は自動計算のため、このタブでは編集できません。');
  }
  const budgetItems = await getBudget(monthStr);
  let type: BudgetType = '変動費';
  budgetItems.forEach((b) => {
    if (b.category === category) type = b.type;
  });
  let finalPerson = person || '';
  if (category === SAVINGS_CATEGORY) {
    type = '固定費';
    finalPerson = 'みどり・こうへい';
  }

  const { error } = await supabase.from('fixed_variable_actuals').upsert(
    { target_month: monthStr, category, type, person: finalPerson, amount: Number(amount) },
    { onConflict: 'target_month,category' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteFixedVariableActual(monthStr: string, category: string): Promise<void> {
  if (category === '食費・日用品' || category === '食費・消耗品費・交際費') {
    throw new Error('食費・消耗品費・交際費の実績は自動計算のため、このタブでは削除できません。');
  }
  const { error } = await supabase
    .from('fixed_variable_actuals')
    .delete()
    .eq('target_month', monthStr)
    .eq('category', category);
  if (error) throw new Error(error.message);
}

// ===================== 立替金 =====================

export interface ReimburseFilter {
  status?: string;
  person?: string;
}

export async function getReimbursements(filter: ReimburseFilter = {}): Promise<Reimbursement[]> {
  let query = supabase.from('reimbursements').select('*');
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.person) query = query.eq('payer', filter.person);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data || []) as Reimbursement[];
  rows.sort((a, b) => b.id - a.id);
  return rows;
}

export async function addTatekae(
  user: string,
  date: string,
  content: string,
  amount: number,
  isWedding = false
): Promise<void> {
  const { error } = await supabase.from('reimbursements').insert({
    payer: user,
    incurred_date: date,
    content,
    amount: Number(amount),
    status: '未精算',
    is_wedding: isWedding,
  });
  if (error) throw new Error(error.message);
}

// ===================== 結婚費用 =====================

export async function getWeddingExpenses(): Promise<WeddingExpense[]> {
  const [tx, re] = await Promise.all([
    supabase.from('transactions').select('*').eq('is_wedding', true),
    supabase.from('reimbursements').select('*').eq('is_wedding', true),
  ]);
  if (tx.error) throw new Error(tx.error.message);
  if (re.error) throw new Error(re.error.message);

  const rows: WeddingExpense[] = [
    ...((tx.data || []) as Transaction[]).map((t) => ({
      key: `tx-${t.id}`,
      source: '共有口座' as const,
      date: t.date,
      person: t.person,
      content: t.memo || t.category,
      amount: Number(t.amount),
      category: t.category,
    })),
    ...((re.data || []) as Reimbursement[]).map((r) => ({
      key: `re-${r.id}`,
      source: '立替金' as const,
      date: r.incurred_date,
      person: r.payer,
      content: r.content,
      // 立替金は割り勘後の金額で入力されているため、総額に戻して2倍で扱う
      amount: Number(r.amount) * 2,
      status: r.status,
    })),
  ];
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

export async function updateTatekae(
  id: number,
  user: string,
  date: string,
  content: string,
  amount: number,
  isWedding = false
): Promise<void> {
  const { error } = await supabase
    .from('reimbursements')
    .update({ payer: user, incurred_date: date, content, amount: Number(amount), is_wedding: isWedding })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteReimbursement(id: number): Promise<void> {
  const { error } = await supabase.from('reimbursements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function settleAll(): Promise<void> {
  const { error } = await supabase
    .from('reimbursements')
    .update({ status: '精算済' })
    .eq('status', '未精算');
  if (error) throw new Error(error.message);
}

export interface TatekaeData {
  totalMidori: number;
  totalKohei: number;
  settlementMessage: string;
  list: { id: number; date: string; user: string; content: string; amount: number; isWedding: boolean }[];
}

export async function getTatekaeData(): Promise<TatekaeData> {
  const unsettled = await getReimbursements({ status: '未精算' });
  let totalMidori = 0;
  let totalKohei = 0;
  unsettled.forEach((r) => {
    if (r.payer === 'みどり') totalMidori += r.amount;
    else if (r.payer === 'こうへい') totalKohei += r.amount;
  });

  const list = unsettled
    .map((r) => ({ id: r.id, date: r.incurred_date, user: r.payer, content: r.content, amount: r.amount, isWedding: !!r.is_wedding }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    totalMidori,
    totalKohei,
    settlementMessage: computeSettlementMessage(totalMidori, totalKohei),
    list,
  };
}

export async function getAllTatekaeData(): Promise<
  { id: number; date: string; user: string; content: string; amount: number; isWedding: boolean }[]
> {
  const settled = await getReimbursements({ status: '精算済' });
  return settled
    .map((r) => ({ id: r.id, date: r.incurred_date, user: r.payer, content: r.content, amount: r.amount, isWedding: !!r.is_wedding }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ===================== ダッシュボード =====================

export async function getDashboard(monthStr: string) {
  const [allTransactions, allBudget, allFixedVariable] = await Promise.all([
    getAllTransactionsRaw(),
    getAllBudgetRaw(),
    getAllFixedVariableRaw(),
  ]);
  return computeDashboard(monthStr, allTransactions, allBudget, allFixedVariable, peopleFromTransactions(allTransactions));
}
