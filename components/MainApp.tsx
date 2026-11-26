'use client';

import { useCallback, useMemo, useState } from 'react';
import type { DashboardData } from '@/lib/types';
import { logout } from '@/app/actions';
import { DataSyncContext } from './DataSyncContext';
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
  // 取引・予算・固定費変動費の更新があったときに増やし、各タブを再読み込みさせる
  const [refreshKey, setRefreshKey] = useState(0);
  const notify = useCallback(() => setRefreshKey((k) => k + 1), []);
  const dataSync = useMemo(() => ({ version: refreshKey, notify }), [refreshKey, notify]);
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

  const logo = (size: 'sm' | 'md') => (
    <span
      aria-hidden
      className={`seal-press ${size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'} inline-flex items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25`}
    >
      <svg viewBox="0 0 24 24" className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
        <path d="M16 13h2" />
      </svg>
    </span>
  );

  const screenIcon: Record<ScreenKey, React.ReactNode> = {
    account: <path d="M3 10l9-6 9 6M5 10v9h14v-9M9 19v-5h6v5" />,
    reimburse: <path d="M4 7h13l-3-3M20 17H7l3 3" />,
    wedding: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  };

  const navIcon = (key: ScreenKey, active: boolean, cls: string) => (
    <svg viewBox="0 0 24 24" className={`${cls} ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {screenIcon[key]}
    </svg>
  );

  return (
    <ToastProvider>
      <DataSyncContext.Provider value={dataSync}>
      <div className="lg:flex min-h-screen">
        {/* デスクトップ: 左に固定するサイドバー */}
        <aside className="hidden lg:flex sticky top-0 h-screen w-60 shrink-0 flex-col bg-white border-r border-slate-200">
          <div className="flex items-center gap-3 px-5 pt-7 pb-6">
            {logo('md')}
            <h1 className="font-bold text-lg text-slate-800">共有口座管理</h1>
          </div>
          <nav aria-label="メインメニュー" className="flex-1 px-3 space-y-1">
            {SCREENS.map((sc) => {
              const active = screen === sc.key;
              return (
                <button
                  key={sc.key}
                  onClick={() => selectScreen(sc.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 font-medium hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {navIcon(sc.key, active, 'w-[18px] h-[18px]')}
                  {sc.label}
                </button>
              );
            })}
          </nav>
          <button
            className="mx-3 mb-5 px-3.5 py-2.5 text-left rounded-xl text-sm text-slate-500 hover:bg-slate-100"
            onClick={handleLogout}
          >
            ログアウト
          </button>
        </aside>

        <div className="flex-1 min-w-0">
          {/* モバイル/タブレット: 上部バー */}
          <header className="lg:hidden sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b border-slate-200">
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center gap-2.5 font-bold text-lg text-slate-800">
                {logo('sm')}
                共有口座管理
              </div>
              <button
                className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
            {menuOpen && (
              <nav aria-label="メインメニュー" className="border-t border-slate-200 bg-white px-3 pt-2 pb-4 shadow-lg">
                {SCREENS.map((sc) => {
                  const active = screen === sc.key;
                  return (
                    <button
                      key={sc.key}
                      onClick={() => {
                        selectScreen(sc.key);
                        setMenuOpen(false);
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-base ${
                        active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {navIcon(sc.key, active, 'w-5 h-5')}
                      {sc.label}
                    </button>
                  );
                })}
                <button className="w-full text-left px-3 py-3 rounded-xl text-base text-slate-500 hover:bg-slate-50" onClick={handleLogout}>
                  ログアウト
                </button>
              </nav>
            )}
          </header>

          <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8" hidden={screen !== 'account'}>
            <h2 className="text-2xl font-bold text-slate-800 mb-4 hidden lg:block">共有口座</h2>
            <div className="card flex items-center justify-center gap-3">
              <label htmlFor="global-month" className="font-bold text-sm text-slate-700">
                対象月
              </label>
              <input
                id="global-month"
                type="month"
                className="input max-w-[180px] font-semibold"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-3 gap-1 mb-4">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => selectTab(t.key)}
                  className={`rounded-xl py-2.5 text-xs sm:text-sm transition ${
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
                <BudgetTab month={month} />
              </div>
            )}
          </div>

          {screen === 'wedding' && (
            <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
              <h2 className="font-bold text-2xl text-slate-800 mb-4">結婚費用</h2>
              <WeddingTab />
            </div>
          )}

          {reimburseVisited && (
            <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8" hidden={screen !== 'reimburse'}>
              <h2 className="font-bold text-2xl text-slate-800 mb-4">立替金</h2>
              <ReimburseTab />
            </div>
          )}
        </div>
      </div>
      </DataSyncContext.Provider>
    </ToastProvider>
  );
}
