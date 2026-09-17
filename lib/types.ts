export type BudgetType = '固定費' | '変動費' | '貯金';

export interface Transaction {
  id: number;
  date: string; // 'YYYY-MM-DD'
  person: string;
  category: string;
  amount: number;
  memo: string;
}

export interface BudgetItem {
  id: number;
  target_month: string; // 'YYYY-MM'
  type: BudgetType;
  category: string;
  amount: number;
}

export interface FixedVariableActual {
  id: number;
  target_month: string;
  type: BudgetType;
  category: string;
  person: string;
  amount: number;
}

export interface Reimbursement {
  id: number;
  payer: string;
  incurred_date: string;
  content: string;
  amount: number;
  status: '未精算' | '精算済';
}

export interface FixedVariableRow {
  category: string;
  type: BudgetType;
  budget: number;
  actual: number;
  person: string;
  editable: boolean;
  bothPersons?: boolean;
}

export interface CategorySummary {
  category: string;
  type: BudgetType;
  budget: number;
  actual: number;
  diff: number;
}

export interface DashboardData {
  month: string;
  prevBalance: number;
  monthNet: number;
  accountBalance: number;
  bankIncome: number;
  budgetTotal: number;
  spendTotal: number;
  surplus: number;
  byType: Record<BudgetType, { budget: number; actual: number; diff: number }>;
  byCategory: CategorySummary[];
  spendByPerson: Record<string, number>;
  savingsActual: number;
  personSettlement: { person: string; deposit: number; spent: number; net: number }[];
}
