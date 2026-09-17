'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { AUTH_COOKIE, verifyPassword } from '@/lib/auth';
import {
  BANK_PERSON,
  FIXED_CATEGORIES,
  SAVINGS_CATEGORY,
  computeDashboard,
  computeSettlementMessage,
} from '@/lib/calc';
import type {
  BudgetItem,
  BudgetType,
  FixedVariableActual,
  FixedVariableRow,
  Reimbursement,
  Transaction,
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

// ===================== マスタ =====================

export async function getPeople(): Promise<string[]> {
  const { data, error } = await supabase.from('transactions').select('person');
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  (data || []).forEach((r) => {
    if (r.person && r.person !== BANK_PERSON) set.add(r.person);
  });
  if (set.size === 0) return ['みどり', 'こうへい'];
  return Array.from(set).sort();
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
}

export async function addHistory(entry: HistoryEntryInput): Promise<void> {
  const { error } = await supabase.from('transactions').insert({
    date: entry.date,
    person: entry.person,
    category: entry.category,
    amount: Number(entry.amount),
    memo: entry.memo || '',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function updateHistory(id: number, entry: HistoryEntryInput): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      date: entry.date,
      person: entry.person,
      category: entry.category,
      amount: Number(entry.amount),
      memo: entry.memo || '',
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function deleteHistory(id: number): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

// ===================== 予算 =====================

export async function getBudget(monthStr: string): Promise<BudgetItem[]> {
  const { data, error } = await supabase.from('budgets').select('*').eq('target_month', monthStr);
  if (error) throw new Error(error.message);
  return (data || []) as BudgetItem[];
}

async function getAllBudgetRaw(): Promise<BudgetItem[]> {
  const { data, error } = await supabase.from('budgets').select('*');
  if (error) throw new Error(error.message);
  return (data || []) as BudgetItem[];
}

export async function setBudgetItem(
  monthStr: string,
  category: string,
  amount: number,
  type: BudgetType
): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { target_month: monthStr, category, amount: Number(amount), type },
      { onConflict: 'target_month,category' }
    );
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function deleteBudgetItem(monthStr: string, category: string): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('target_month', monthStr)
    .eq('category', category);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function copyBudgetFromPreviousMonth(monthStr: string): Promise<BudgetItem[]> {
  const [y, m] = monthStr.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prevItems = await getBudget(prevMonth);
  const current = await getBudget(monthStr);
  const currentCategories = new Set(current.map((b) => b.category));

  const toInsert = prevItems
    .filter((item) => !currentCategories.has(item.category))
    .map((item) => ({
      target_month: monthStr,
      category: item.category,
      amount: item.amount,
      type: item.type,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from('budgets').insert(toInsert);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/');
  return getBudget(monthStr);
}

// ===================== 固定費・変動費 =====================

async function getAllFixedVariableRaw(): Promise<FixedVariableActual[]> {
  const { data, error } = await supabase.from('fixed_variable_actuals').select('*');
  if (error) throw new Error(error.message);
  return (data || []) as FixedVariableActual[];
}

async function getAllTransactionsRaw(): Promise<Transaction[]> {
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) throw new Error(error.message);
  return (data || []) as Transaction[];
}

export async function getFixedVariableActuals(monthStr: string): Promise<FixedVariableRow[]> {
  const budgetItems = (await getBudget(monthStr)).filter(
    (b) => b.type === '固定費' || b.type === '変動費' || b.category === SAVINGS_CATEGORY
  );

  const { data: fvData, error: fvErr } = await supabase
    .from('fixed_variable_actuals')
    .select('*')
    .eq('target_month', monthStr);
  if (fvErr) throw new Error(fvErr.message);
  const actualMap: Record<string, { amount: number; person: string }> = {};
  (fvData || []).forEach((row: FixedVariableActual) => {
    actualMap[row.category] = { amount: row.amount, person: row.person || '' };
  });

  const { data: histData, error: histErr } = await supabase
    .from('transactions')
    .select('date, category, amount')
    .gte('date', `${monthStr}-01`)
    .lt(
      'date',
      (() => {
        const [y, m] = monthStr.split('-').map(Number);
        const next = new Date(y, m, 1);
        return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      })()
    );
  if (histErr) throw new Error(histErr.message);
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
  revalidatePath('/');
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
  amount: number
): Promise<void> {
  const { error } = await supabase.from('reimbursements').insert({
    payer: user,
    incurred_date: date,
    content,
    amount: Number(amount),
    status: '未精算',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function deleteReimbursement(id: number): Promise<void> {
  const { error } = await supabase.from('reimbursements').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export async function settleAll(): Promise<void> {
  const { error } = await supabase
    .from('reimbursements')
    .update({ status: '精算済' })
    .eq('status', '未精算');
  if (error) throw new Error(error.message);
  revalidatePath('/');
}

export interface TatekaeData {
  totalMidori: number;
  totalKohei: number;
  settlementMessage: string;
  list: { id: number; date: string; user: string; content: string; amount: number }[];
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
    .map((r) => ({ id: r.id, date: r.incurred_date, user: r.payer, content: r.content, amount: r.amount }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    totalMidori,
    totalKohei,
    settlementMessage: computeSettlementMessage(totalMidori, totalKohei),
    list,
  };
}

export async function getAllTatekaeData(): Promise<
  { id: number; date: string; user: string; content: string; amount: number }[]
> {
  const settled = await getReimbursements({ status: '精算済' });
  return settled
    .map((r) => ({ id: r.id, date: r.incurred_date, user: r.payer, content: r.content, amount: r.amount }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ===================== ダッシュボード =====================

export async function getDashboard(monthStr: string) {
  const [allTransactions, allBudget, allFixedVariable, people] = await Promise.all([
    getAllTransactionsRaw(),
    getAllBudgetRaw(),
    getAllFixedVariableRaw(),
    getPeople(),
  ]);
  return computeDashboard(monthStr, allTransactions, allBudget, allFixedVariable, people);
}
