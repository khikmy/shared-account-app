'use client';

import { useState } from 'react';
import { currentMonthStr } from '@/lib/calc';
import { logout } from '@/app/actions';
import { ToastProvider } from './ToastContext';
import DashboardTab from './DashboardTab';
import HistoryTab from './HistoryTab';
import BudgetTab from './BudgetTab';
import ReimburseTab from './ReimburseTab';

type TabKey = 'dashboard' | 'history' | 'budget' | 'reimburse';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'history', label: '支出' },
  { key: 'budget', label: '予算' },
  { key: 'reimburse', label: '立替金' },
];

export default function MainApp() {
  const [month, setMonth] = useState(currentMonthStr());
  const [tab, setTab] = useState<TabKey>('dashboard');

  return (
    <ToastProvider>
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-primary">共有口座管理</h1>
          <button
            className="text-xs text-neutral-500 underline"
            onClick={() => {
              logout().then(() => window.location.reload());
            }}
          >
            ログアウト
          </button>
        </div>

        <div className="card flex items-center justify-center gap-2">
          <label htmlFor="global-month" className="font-bold text-sm">
            対象月
          </label>
          <input
            id="global-month"
            type="month"
            className="input max-w-[180px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-4 gap-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg py-2 text-xs sm:text-sm font-bold transition-colors ${
                tab === t.key ? 'bg-primary text-white' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && <DashboardTab month={month} />}
        {tab === 'history' && <HistoryTab month={month} />}
        {tab === 'budget' && <BudgetTab month={month} />}
        {tab === 'reimburse' && <ReimburseTab />}
      </div>
    </ToastProvider>
  );
}
