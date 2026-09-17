'use client';

import { useEffect, useState } from 'react';
import { getFixedVariableActuals, getPeople, setFixedVariableActual } from '@/app/actions';
import { formatYen, sortByDisplayOrder } from '@/lib/calc';
import type { FixedVariableRow } from '@/lib/types';
import { useToast } from './ToastContext';

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

export default function FixedVariableSubTab({ month }: { month: string }) {
  const [rows, setRows] = useState<FixedVariableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPerson, setEditPerson] = useState<string>('');
  const showToast = useToast();

  function load() {
    setLoading(true);
    getFixedVariableActuals(month)
      .then((rs) => setRows(sortByDisplayOrder(rs)))
      .catch((err) => showToast('エラー: ' + err.message, true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getPeople().then(setPeople).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const totalBudget = rows.reduce((sum, r) => sum + Number(r.budget || 0), 0);
  const totalActual = rows.reduce((sum, r) => sum + Number(r.actual || 0), 0);

  const byType: Record<string, { budget: number; actual: number }> = {
    固定費: { budget: 0, actual: 0 },
    変動費: { budget: 0, actual: 0 },
  };
  rows.forEach((r) => {
    if (!byType[r.type]) byType[r.type] = { budget: 0, actual: 0 };
    byType[r.type].budget += Number(r.budget || 0);
    byType[r.type].actual += Number(r.actual || 0);
  });

  async function onSave(category: string) {
    try {
      await setFixedVariableActual(month, category, editAmount, editPerson);
      showToast('保存しました');
      setEditingCategory(null);
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  return (
    <div className="card">
      <h2 className="font-bold mb-3">固定費・変動費 予算対比</h2>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center">
          <div className="text-xs text-neutral-500">区分合計(予算)</div>
          <div className="font-bold text-primary">{formatYen(totalBudget)}</div>
        </div>
        <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center">
          <div className="text-xs text-neutral-500">区分合計(実績)</div>
          <div className="font-bold text-primary">{formatYen(totalActual)}</div>
        </div>
      </div>

      <div className="space-y-3 mb-3">
        {['固定費', '変動費'].map((t) => {
          const row = byType[t] || { budget: 0, actual: 0 };
          const diff = row.budget - row.actual;
          return (
            <div key={t} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="font-bold mb-3">{t}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">予算</div>
                  <div className="font-bold">{formatYen(row.budget)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">実績</div>
                  <div className="font-bold">{formatYen(row.actual)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">差引</div>
                  <div className={`font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatYen(diff)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="font-bold mb-2">固定費・変動費一覧</h2>
      <p className="text-xs text-neutral-500 mb-3">
        画面上部の「対象月」を選んで、その月に実際に支払った金額を入力・保存してください。
      </p>

      {!loading && rows.length === 0 && (
        <p className="text-center text-neutral-400 py-4">
          この月の固定費・変動費予算がまだありません(先に「予算」タブで設定してください)
        </p>
      )}
      <div className="space-y-3">
        {rows.map((r) => {
          const isEditing = editingCategory === r.category;
          return (
            <div key={r.category} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-bold">{r.category}</span>
                <span className={typeBadgeClass(r.type)}>{r.type}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs text-neutral-500">支払対象者</span>
                {r.bothPersons || !r.editable ? (
                  <div className="flex gap-1">
                    <span className="badge-midori">みどり</span>
                    <span className="badge-kohei">こうへい</span>
                  </div>
                ) : isEditing ? (
                  <select className="input max-w-[140px]" value={editPerson} onChange={(e) => setEditPerson(e.target.value)}>
                    <option value="">未設定</option>
                    {people.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={personBadgeClass(r.person)}>{r.person || '未設定'}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">予算</div>
                  <div className="font-bold">{formatYen(r.budget)}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">実績</div>
                  {r.editable && isEditing ? (
                    <input
                      type="number"
                      className="input"
                      min={0}
                      step={1}
                      value={editAmount}
                      onChange={(e) => setEditAmount(Number(e.target.value))}
                    />
                  ) : (
                    <div className="font-bold">{formatYen(r.actual)}</div>
                  )}
                </div>
              </div>
              {r.editable && (
                <div className="flex justify-end">
                  {isEditing ? (
                    <button className="btn-primary text-xs" onClick={() => onSave(r.category)}>
                      保存
                    </button>
                  ) : (
                    <button
                      className="btn-outline text-xs"
                      onClick={() => {
                        setEditingCategory(r.category);
                        setEditAmount(r.actual);
                        setEditPerson(r.person);
                      }}
                    >
                      編集
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
