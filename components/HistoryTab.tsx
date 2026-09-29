'use client';

import { useState } from 'react';
import TransactionsSubTab from './TransactionsSubTab';
import FixedVariableSubTab from './FixedVariableSubTab';

type SubTab = 'variable' | 'fixed';

export default function HistoryTab({ month }: { month: string }) {
  const [subTab, setSubTab] = useState<SubTab>('variable');
  const [visitedSubTabs, setVisitedSubTabs] = useState<Set<SubTab>>(() => new Set(['variable']));

  function selectSubTab(key: SubTab) {
    setSubTab(key);
    setVisitedSubTabs((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 mb-3">
        <button
          className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold ${
            subTab === 'variable' ? 'bg-primary text-white' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
          }`}
          onClick={() => selectSubTab('variable')}
        >
          食費・消耗品費・交際費
        </button>
        <button
          className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold ${
            subTab === 'fixed' ? 'bg-primary text-white' : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
          }`}
          onClick={() => selectSubTab('fixed')}
        >
          固定費・変動費
        </button>
      </div>

      {visitedSubTabs.has('variable') && (
        <div hidden={subTab !== 'variable'}>
          <TransactionsSubTab month={month} />
        </div>
      )}
      {visitedSubTabs.has('fixed') && (
        <div hidden={subTab !== 'fixed'}>
          <FixedVariableSubTab month={month} />
        </div>
      )}
    </div>
  );
}
