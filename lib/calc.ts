import type {
  BudgetItem,
  BudgetType,
  DashboardData,
  FixedVariableActual,
  Transaction,
} from './types';

// ===================== 定数 (元GASの Code.gs を踏襲) =====================

export const BASE_MONTH = '2025-11';
export const INITIAL_POOL = 0;
export const INITIAL_SAVINGS = 0;

export const KOHEI_NAME = 'こうへい';
export const MIDORI_NAME = 'みどり';
export const KOHEI_FIXED_DEPOSIT = 200000;

export const SAVINGS_CATEGORY = '積立貯金';
export const BANK_PERSON = '銀行';

export const FIXED_CATEGORIES = ['食費', '消耗品費', '交際費', '銀行'];

export const BUDGET_DISPLAY_ORDER = [
  '家賃', '火災保険', 'Wi-Fi', 'Netflix', 'Amazonプライム', 'ウォーターサーバー', '積立貯金',
  'ガス', 'ガス設備費', '電気', '水道', '食費・日用品', '食費・消耗品費・交際費',
];

// 履歴で使う分類名 → 予算(区分別)で管理している分類名への対応。
export const CATEGORY_MERGE_MAP: Record<string, string> = {
  食費: '食費・日用品',
  消耗品費: '食費・日用品',
  交際費: '食費・日用品',
};
export const CATEGORY_DISPLAY_NAME: Record<string, string> = {
  '食費・日用品': '食費・消耗品費・交際費',
};

// ===================== 実績の中央値による予算 =====================

/** この月以降の予算は、前月までの実績の中央値から決める */
export const MEDIAN_BUDGET_START = '2026-10';
/** 中央値の対象とする最初の月 (2025-11 は引っ越し直後で実績が不完全なため除く) */
export const MEDIAN_BUDGET_FROM = '2025-12';
export const MEDIAN_BUDGET_CATEGORIES = ['ガス', '電気', '水道', '食費・日用品'];
/** 2ヶ月に1度だけ請求がある分類。請求月は偶数月で、それ以外の月は 0 円 */
export const BIMONTHLY_CATEGORIES = ['水道'];

/** 中央値で自動算出される予算は、編集・削除できない */
export function isMedianBudgetLocked(monthStr: string, category: string): boolean {
  return monthStr >= MEDIAN_BUDGET_START && MEDIAN_BUDGET_CATEGORIES.includes(category);
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 前月までの月別実績 (0円の月は未入力・請求なしとして除く) の中央値を100円単位で四捨五入した予算額。
 * 対象月が中央値の適用外、または実績がまだ無い場合は null。
 */
export function medianBudgetAmount(
  category: string,
  monthStr: string,
  actualsByMonth: Record<string, number>
): number | null {
  if (monthStr < MEDIAN_BUDGET_START || !MEDIAN_BUDGET_CATEGORIES.includes(category)) return null;
  if (BIMONTHLY_CATEGORIES.includes(category) && Number(monthStr.slice(5, 7)) % 2 === 1) return 0;
  const values = Object.entries(actualsByMonth)
    .filter(([m, v]) => m >= MEDIAN_BUDGET_FROM && m < monthStr && v > 0)
    .map(([, v]) => v);
  if (values.length === 0) return null;
  return Math.round(median(values) / 100) * 100;
}

export function sortByDisplayOrder<T extends { category: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    let ai = BUDGET_DISPLAY_ORDER.indexOf(a.category);
    let bi = BUDGET_DISPLAY_ORDER.indexOf(b.category);
    if (ai === -1) ai = BUDGET_DISPLAY_ORDER.length;
    if (bi === -1) bi = BUDGET_DISPLAY_ORDER.length;
    return ai - bi;
  });
}

export function formatYen(n: number): string {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + '¥' + Math.abs(v).toLocaleString('ja-JP');
}

export function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthStart(monthStr: string): Date {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' の日付文字列から 'YYYY-MM' を取り出す */
export function monthKeyFromDateStr(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// ===================== 月次集計 =====================

interface MonthSummary {
  byType: Record<BudgetType, { budget: number; actual: number; diff: number }>;
  byCategory: { category: string; type: BudgetType; budget: number; actual: number; diff: number }[];
  spendByPerson: Record<string, number>;
  bankIncome: number;
  savingsActual: number;
  budgetTotal: number;
  spendTotal: number;
  surplus: number;
}

function emptyByType(): Record<BudgetType, { budget: number; actual: number }> {
  return {
    固定費: { budget: 0, actual: 0 },
    変動費: { budget: 0, actual: 0 },
    貯金: { budget: 0, actual: 0 },
  };
}

export function summarizeMonth(
  allTransactions: Transaction[],
  allBudget: BudgetItem[],
  allFixedVariable: FixedVariableActual[],
  monthStr: string
): MonthSummary {
  const byType = emptyByType();
  const categoryType: Record<string, BudgetType> = {};
  const byCategoryBudget: Record<string, number> = {};
  const byCategoryActual: Record<string, number> = {};

  allBudget.forEach((b) => {
    if (b.target_month !== monthStr) return;
    categoryType[b.category] = b.type;
    byCategoryBudget[b.category] = (byCategoryBudget[b.category] || 0) + b.amount;
    byType[b.type].budget += b.amount;
  });

  const spendByPerson: Record<string, number> = {};
  let bankIncome = 0;
  let savingsActual = 0;

  allTransactions.forEach((h) => {
    if (monthKeyFromDateStr(h.date) !== monthStr) return;
    if (h.person === BANK_PERSON) {
      bankIncome += h.amount;
      return;
    }
    spendByPerson[h.person] = (spendByPerson[h.person] || 0) + h.amount;
    const rawCat = h.category || '未分類';
    const cat = CATEGORY_MERGE_MAP[rawCat] || rawCat;
    byCategoryActual[cat] = (byCategoryActual[cat] || 0) + h.amount;
    const type = categoryType[cat] || '変動費';
    byType[type].actual += h.amount;
    if (rawCat === SAVINGS_CATEGORY) savingsActual += h.amount;
  });

  allFixedVariable.forEach((f) => {
    if (f.target_month !== monthStr) return;
    byCategoryActual[f.category] = (byCategoryActual[f.category] || 0) + f.amount;
    const type = categoryType[f.category] || f.type || '変動費';
    byType[type].actual += f.amount;
    if (f.person) spendByPerson[f.person] = (spendByPerson[f.person] || 0) + f.amount;
    if (f.category === SAVINGS_CATEGORY) savingsActual += f.amount;
  });

  const categories = new Set<string>([
    ...Object.keys(byCategoryBudget),
    ...Object.keys(byCategoryActual),
  ]);

  const byCategory = Array.from(categories).map((c) => {
    const budget = byCategoryBudget[c] || 0;
    const actual = byCategoryActual[c] || 0;
    return {
      category: CATEGORY_DISPLAY_NAME[c] || c,
      type: categoryType[c] || ('変動費' as BudgetType),
      budget,
      actual,
      diff: budget - actual,
    };
  });

  const budgetTotal = byType.固定費.budget + byType.変動費.budget + byType.貯金.budget;
  const spendTotal = byType.固定費.actual + byType.変動費.actual + byType.貯金.actual;

  const byTypeWithDiff = {
    固定費: { ...byType.固定費, diff: byType.固定費.budget - byType.固定費.actual },
    変動費: { ...byType.変動費, diff: byType.変動費.budget - byType.変動費.actual },
    貯金: { ...byType.貯金, diff: byType.貯金.budget - byType.貯金.actual },
  };

  return {
    byType: byTypeWithDiff,
    byCategory,
    spendByPerson,
    bankIncome,
    savingsActual,
    budgetTotal,
    spendTotal,
    surplus: budgetTotal - spendTotal,
  };
}

export function computeDashboard(
  monthStr: string,
  allTransactions: Transaction[],
  allBudget: BudgetItem[],
  allFixedVariable: FixedVariableActual[],
  people: string[]
): DashboardData {
  const target = monthStart(monthStr);
  const base = monthStart(BASE_MONTH);

  let pool = INITIAL_POOL;
  let savings = INITIAL_SAVINGS;

  // 対象月の前月末残高を求めつつ、対象年の1〜12月(基準月以降)の月別推移も集める
  const history: DashboardData['history'] = [];
  const yearEnd = new Date(target.getFullYear(), 11, 1);
  let prevPool = pool;
  let prevSavings = savings;
  const actualNets: number[] = [];
  const actualDeltas: number[] = [];

  let cursor = base;
  while (cursor <= yearEnd) {
    const mk = monthKey(cursor);
    if (cursor.getTime() === target.getTime()) {
      prevPool = pool;
      prevSavings = savings;
    }
    const m = summarizeMonth(allTransactions, allBudget, allFixedVariable, mk);
    const before = pool + savings;
    pool = pool + m.surplus + m.bankIncome;
    savings = savings + m.savingsActual;
    if (mk >= MEDIAN_BUDGET_FROM && mk <= monthStr) {
      actualNets.push(m.surplus + m.bankIncome);
      actualDeltas.push(pool + savings - before);
    }
    if (cursor.getFullYear() === target.getFullYear()) {
      history.push({ month: mk, net: m.surplus + m.bankIncome, balance: pool + savings });
    }
    cursor = addMonths(cursor, 1);
  }

  // 対象月より後は、対象月までの実績の中央値で推移を延長する
  if (actualDeltas.length > 0) {
    const medianNet = median(actualNets);
    const medianDelta = median(actualDeltas);
    let projected = history.find((h) => h.month === monthStr)?.balance ?? 0;
    history.forEach((h) => {
      if (h.month <= monthStr) return;
      projected += medianDelta;
      h.net = medianNet;
      h.balance = projected;
    });
  }
  pool = prevPool;
  savings = prevSavings;

  const current = summarizeMonth(allTransactions, allBudget, allFixedVariable, monthStr);

  const personSettlement = people.map((p) => {
    let deposit: number;
    if (p === KOHEI_NAME) {
      deposit = KOHEI_FIXED_DEPOSIT;
    } else if (p === MIDORI_NAME) {
      deposit = current.budgetTotal - KOHEI_FIXED_DEPOSIT;
    } else {
      deposit = 0;
    }
    const spent = current.spendByPerson[p] || 0;
    return { person: p, deposit, spent, net: deposit - spent };
  });

  const prevBalance = pool + savings;
  const monthNet = current.surplus + current.bankIncome + current.savingsActual;
  const accountBalance = prevBalance + monthNet;

  return {
    month: monthStr,
    prevBalance,
    monthNet,
    accountBalance,
    bankIncome: current.bankIncome,
    budgetTotal: current.budgetTotal,
    spendTotal: current.spendTotal,
    surplus: current.surplus,
    byType: current.byType,
    byCategory: current.byCategory,
    spendByPerson: current.spendByPerson,
    savingsActual: current.savingsActual,
    personSettlement,
    history,
  };
}

export function computeSettlementMessage(totalMidori: number, totalKohei: number): string {
  const diff = totalMidori - totalKohei;
  if (diff === 0) return '精算の必要はありません(差額0円)';
  if (diff > 0) return `こうへい → みどり に ${formatYen(diff)} を渡すと精算完了です`;
  return `みどり → こうへい に ${formatYen(-diff)} を渡すと精算完了です`;
}
