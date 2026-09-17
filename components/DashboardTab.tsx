'use client';

import { useEffect, useState } from 'react';
import { getDashboard } from '@/app/actions';
import { formatYen } from '@/lib/calc';
import type { DashboardData } from '@/lib/types';
import { useToast } from './ToastContext';

const CATEGORY_DISPLAY_ORDER = [
  '家賃', '火災保険', 'Wi-Fi', 'Netflix', 'Amazonプライム', 'ウォーターサーバー',
  'ガス', 'ガス設備費', '電気', '水道', '食費・消耗品費・交際費', '積立貯金',
];

function typeBadgeClass(type: string) {
  if (type === '固定費') return 'badge-fixed';
  if (type === '変動費') return 'badge-variable';
  return 'badge-savings';
}

function personBadgeClass(person: string) {
  if (person === 'みどり') return 'badge-midori';
  if (person === 'こうへい') return 'badge-kohei';
  return 'badge-other';
}

export default function DashboardTab({ month }: { month: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDashboard(month)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => showToast('エラー: ' + err.message, true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [month, showToast]);

  if (loading && !data) {
    return <div className="card text-center text-neutral-400">読み込み中...</div>;
  }
  if (!data) return null;

  const cards = [
    { label: '前月末時点での残高', value: data.prevBalance },
    { label: '今月の収支', value: data.monthNet, signed: true },
    { label: '共有口座残高', value: data.accountBalance },
  ];

  const catRows = [...data.byCategory].sort((a, b) => {
    let ai = CATEGORY_DISPLAY_ORDER.indexOf(a.category);
    let bi = CATEGORY_DISPLAY_ORDER.indexOf(b.category);
    if (ai === -1) ai = CATEGORY_DISPLAY_ORDER.length;
    if (bi === -1) bi = CATEGORY_DISPLAY_ORDER.length;
    if (ai !== bi) return ai - bi;
    return b.actual - a.actual;
  });

  return (
    <div>
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {cards.map((c) => (
            <div key={c.label} className="p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg text-center">
              <div className="text-xs text-neutral-500">{c.label}</div>
              <div
                className={`text-lg font-bold ${
                  c.signed ? (c.value >= 0 ? 'text-green-600' : 'text-red-500') : ''
                }`}
              >
                {formatYen(c.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">個人別 精算(翌月1日の入出金)</h2>
        <div className="space-y-3">
          {data.personSettlement.map((p) => (
            <div
              key={p.person}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className={personBadgeClass(p.person)}>{p.person}</span>
                <span className={`font-bold ${p.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatYen(Math.abs(p.net))} {p.net >= 0 ? '(翌月入金)' : '(翌月出金)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">入金予定額</div>
                  <div className="text-base font-bold">{formatYen(p.deposit)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">支出実績</div>
                  <div className="text-base font-bold">{formatYen(p.spent)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-3">
          入金予定額は固定ルールで自動計算されます(こうへい:¥200,000、みどり:予算合計−こうへいの額)。
        </p>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">分類別 予算対比</h2>
        {catRows.length === 0 && (
          <p className="text-center text-neutral-400 py-4">データがありません</p>
        )}
        <div className="space-y-3">
          {catRows.map((c) => (
            <div
              key={c.category}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-bold">{c.category}</span>
                <span className={typeBadgeClass(c.type)}>{c.type}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">予算</div>
                  <div className="font-bold">{formatYen(c.budget)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">実績</div>
                  <div className="font-bold">{formatYen(c.actual)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">差引</div>
                  <div className={`font-bold ${c.diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatYen(c.diff)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
