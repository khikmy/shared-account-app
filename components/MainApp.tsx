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
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set(['dashboard']));

  function selectTab(key: TabKey) {
    setTab(key);
    setVisitedTabs((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  return (
    <ToastProvider>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-bold text-lg text-slate-800">
            <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
                <path d="M16 13h2" />
              </svg>
            </span>
            共有口座管理
          </h1>
          <button
            className="text-xs text-slate-500 hover:text-slate-700 underline"
            onClick={() => {
              logout().then(() => window.location.reload());
            }}
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4">
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
              onClick={() => selectTab(t.key)}
              className={`rounded-lg py-2 text-xs sm:text-sm transition ${
                tab === t.key
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {visitedTabs.has('dashboard') && (
          <div hidden={tab !== 'dashboard'}>
            <DashboardTab month={month} />
          </div>
        )}
        {visitedTabs.has('history') && (
          <div hidden={tab !== 'history'}>
            <HistoryTab month={month} />
          </div>
        )}
        {visitedTabs.has('budget') && (
          <div hidden={tab !== 'budget'}>
            <BudgetTab month={month} />
          </div>
        )}
        {visitedTabs.has('reimburse') && (
          <div hidden={tab !== 'reimburse'}>
            <ReimburseTab />
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
