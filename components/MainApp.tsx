'use client';

import { useState } from 'react';
import type { DashboardData } from '@/lib/types';
import { logout } from '@/app/actions';
import { ToastProvider } from './ToastContext';
import DashboardTab from './DashboardTab';
import HistoryTab from './HistoryTab';
import BudgetTab from './BudgetTab';
import ReimburseTab from './ReimburseTab';
import WeddingTab from './WeddingTab';

type TabKey = 'dashboard' | 'history' | 'budget';
type ScreenKey = 'account' | 'reimburse' | 'wedding';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'history', label: '支出' },
  { key: 'budget', label: '予算' },
];

const SCREENS: { key: ScreenKey; label: string }[] = [
  { key: 'account', label: '共有口座' },
  { key: 'reimburse', label: '立替金' },
  { key: 'wedding', label: '結婚費用' },
];

export default function MainApp({
  initialMonth,
  initialDashboard,
}: {
  initialMonth: string;
  initialDashboard: DashboardData | null;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [screen, setScreen] = useState<ScreenKey>('account');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reimburseVisited, setReimburseVisited] = useState(false);
  const [tab, setTab] = useState<TabKey>('dashboard');
  // 予算の前月コピーなど、他タブの表示に影響する更新があったときに増やし、各タブを再読み込みさせる
  const [refreshKey, setRefreshKey] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => new Set(['dashboard']));

  function handleLogout() {
    logout().then(() => window.location.reload());
  }

  function selectScreen(key: ScreenKey) {
    setScreen(key);
    if (key === 'reimburse') setReimburseVisited(true);
  }

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
          <nav className="hidden sm:flex items-center gap-1">
            {SCREENS.map((sc) => (
              <button
                key={sc.key}
                onClick={() => selectScreen(sc.key)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  screen === sc.key
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </nav>
          <button
            className="hidden sm:block text-xs text-slate-500 hover:text-slate-700 underline"
            onClick={handleLogout}
          >
            ログアウト
          </button>
          <button
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="メニュー"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-2 flex flex-col gap-1">
            {SCREENS.map((sc) => (
              <button
                key={sc.key}
                onClick={() => {
                  selectScreen(sc.key);
                  setMenuOpen(false);
                }}
                className={`text-left rounded-lg px-3 py-2 text-sm ${
                  screen === sc.key
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 font-medium hover:bg-slate-100'
                }`}
              >
                {sc.label}
              </button>
            ))}
            <button className="text-left rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        )}
      </header>

      <div className="max-w-3xl mx-auto p-4" hidden={screen !== 'account'}>
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

        <div className="grid grid-cols-3 gap-1 mb-4">
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
            <DashboardTab month={month} refreshKey={refreshKey} initialMonth={initialMonth} initialData={initialDashboard} />
          </div>
        )}
        {visitedTabs.has('history') && (
          <div hidden={tab !== 'history'}>
            <HistoryTab month={month} refreshKey={refreshKey} />
          </div>
        )}
        {visitedTabs.has('budget') && (
          <div hidden={tab !== 'budget'}>
            <BudgetTab month={month} onCopied={() => setRefreshKey((k) => k + 1)} />
          </div>
        )}
      </div>

      {screen === 'wedding' && (
        <div className="max-w-3xl mx-auto p-4">
          <h2 className="font-bold text-xl text-slate-800 mb-4">結婚費用</h2>
          <WeddingTab />
        </div>
      )}

      {reimburseVisited && (
        <div className="max-w-3xl mx-auto p-4" hidden={screen !== 'reimburse'}>
          <h2 className="font-bold text-xl text-slate-800 mb-4">立替金</h2>
          <ReimburseTab />
        </div>
      )}
    </ToastProvider>
  );
}
