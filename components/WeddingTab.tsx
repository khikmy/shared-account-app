'use client';

import { useEffect, useState } from 'react';
import { getWeddingExpenses } from '@/app/actions';
import { formatYen } from '@/lib/calc';
import type { WeddingExpense } from '@/lib/types';
import { useToast } from './ToastContext';

function personBadgeClass(person: string) {
  if (person === 'みどり') return 'badge-midori';
  if (person === 'こうへい') return 'badge-kohei';
  return 'badge-other';
}

function sourceBadgeClass(source: WeddingExpense['source']) {
  return source === '共有口座'
    ? 'text-xs rounded-full px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold'
    : 'text-xs rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold';
}

export default function WeddingTab() {
  const [rows, setRows] = useState<WeddingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

  useEffect(() => {
    getWeddingExpenses()
      .then(setRows)
      .catch((err) => showToast('エラー: ' + err.message, true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const accountTotal = rows.filter((r) => r.source === '共有口座').reduce((sum, r) => sum + r.amount, 0);
  const reimburseTotal = total - accountTotal;

  return (
    <div>
      <div className="card">
        <h2 className="font-bold mb-3">結婚費用の合計</h2>
        <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-center mb-3">
          <div className="text-xs text-slate-500">合計</div>
          <div className="text-lg font-bold text-primary">{loading ? '-' : formatYen(total)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 border border-slate-200 rounded-lg bg-slate-50">
            <div className="text-xs text-slate-500">共有口座から</div>
            <div className="font-bold">{loading ? '-' : formatYen(accountTotal)}</div>
          </div>
          <div className="p-2 border border-slate-200 rounded-lg bg-slate-50">
            <div className="text-xs text-slate-500">立替金から</div>
            <div className="font-bold">{loading ? '-' : formatYen(reimburseTotal)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold mb-1">結婚費用の一覧</h2>
        <p className="text-xs text-slate-400 mb-3">立替金は割り勘後の金額で入力されているため、2倍にして表示しています。</p>
        {!loading && rows.length === 0 && (
          <p className="text-center text-slate-400 py-4">
            結婚関連の費用がありません。共有口座の支出や立替金で「結婚関連の費用」にチェックを付けると表示されます。
          </p>
        )}
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="flex items-center gap-2">
                  <span className={sourceBadgeClass(r.source)}>{r.source}</span>
                  <span className={personBadgeClass(r.person)}>{r.person}</span>
                </span>
                <span className="text-xs text-slate-500">{r.date}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-600 break-words">
                  {r.content}
                  {r.status && <span className="ml-2 text-xs text-slate-400">({r.status})</span>}
                </span>
                <span className="font-bold shrink-0">{formatYen(r.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
