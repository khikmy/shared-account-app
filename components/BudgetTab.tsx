'use client';

import { useEffect, useState } from 'react';
import { copyBudgetFromPreviousMonth, deleteBudgetItem, getBudget, setBudgetItem } from '@/app/actions';
import { formatYen, isMedianBudgetLocked, sortByDisplayOrder } from '@/lib/calc';
import type { BudgetItem, BudgetType } from '@/lib/types';
import MedianTrendChart from './MedianTrendChart';
import { useToast } from './ToastContext';

function typeBadgeClass(type: string) {
  if (type === '固定費') return 'badge-fixed';
  if (type === '変動費') return 'badge-variable';
  return 'badge-savings';
}

export default function BudgetTab({ month }: { month: string }) {
  const [rows, setRows] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [savingCopy, setSavingCopy] = useState(false);
  const [chartCategory, setChartCategory] = useState<string | null>(null);
  const showToast = useToast();

  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState<BudgetType>('変動費');
  const [newAmount, setNewAmount] = useState<number | ''>('');

  function load() {
    setLoading(true);
    getBudget(month)
      .then((rs) => setRows(sortByDisplayOrder(rs)))
      .catch((err) => showToast('エラー: ' + err.message, true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  async function onAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory || newAmount === '') return;
    try {
      await setBudgetItem(month, newCategory, Number(newAmount), newType);
      showToast('分類を追加しました');
      setNewCategory('');
      setNewAmount('');
      setNewType('変動費');
      setShowForm(false);
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  async function onSaveEdit(category: string, type: BudgetType) {
    try {
      await setBudgetItem(month, category, editAmount, type);
      showToast('予算を保存しました');
      setEditingCategory(null);
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  async function onDelete(category: string) {
    if (!confirm('この予算分類を削除しますか？')) return;
    try {
      await deleteBudgetItem(month, category);
      showToast('削除しました');
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  async function onCopyPrev() {
    setSavingCopy(true);
    try {
      const rs = await copyBudgetFromPreviousMonth(month);
      showToast('前月の予算をコピーしました');
      setRows(sortByDisplayOrder(rs));
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    } finally {
      setSavingCopy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">月次予算</h2>
        <div className="flex gap-2">
          <button className="btn-outline text-xs" onClick={onCopyPrev} disabled={savingCopy}>
            {savingCopy ? '処理中...' : '前月コピー'}
          </button>
          <button className="btn-primary text-xs" onClick={() => setShowForm((v) => !v)}>
            ＋
          </button>
        </div>
      </div>

      <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-center mb-3">
        <div className="text-xs text-slate-500">予算合計</div>
        <div className="text-lg font-bold text-primary">{formatYen(total)}</div>
      </div>

      {showForm && (
        <form onSubmit={onAddSubmit} className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50 space-y-3">
          <div>
            <label className="text-sm font-bold block mb-1">分類名</label>
            <input className="input" placeholder="例: 家賃" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">区分</label>
            <select className="input" value={newType} onChange={(e) => setNewType(e.target.value as BudgetType)}>
              <option value="固定費">固定費</option>
              <option value="変動費">変動費</option>
              <option value="貯金">貯金</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-bold block mb-1">予算金額</label>
            <input
              type="number"
              className="input"
              placeholder="金額を入力"
              min={0}
              step={1}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            追加する
          </button>
        </form>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-center text-slate-400 py-4">この月の予算はまだ設定されていません</p>
      )}
      <div className="space-y-3">
        {rows.map((r) => {
          const isEditing = editingCategory === r.category;
          const locked = isMedianBudgetLocked(month, r.category);
          return (
            <div key={r.category} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-bold">{r.category}</span>
                <span className={typeBadgeClass(r.type)}>{r.type}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                {isEditing ? (
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step={1}
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                  />
                ) : (
                  <span className="text-lg font-bold">{formatYen(r.amount)}</span>
                )}
                {isEditing ? (
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-outline text-xs" onClick={() => setEditingCategory(null)}>
                      戻る
                    </button>
                    <button className="btn-primary text-xs" onClick={() => onSaveEdit(r.category, r.type)}>
                      保存
                    </button>
                  </div>
                ) : locked ? (
                  <button
                    className="btn-outline text-xs shrink-0"
                    onClick={() => setChartCategory(r.category)}
                  >
                    実績の中央値で自動算出
                  </button>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-outline-danger text-xs" onClick={() => onDelete(r.category)}>
                      削除
                    </button>
                    <button
                      className="btn-outline text-xs"
                      onClick={() => {
                        setEditingCategory(r.category);
                        setEditAmount(r.amount);
                      }}
                    >
                      編集
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {chartCategory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setChartCategory(null)}>
          <div className="card w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{chartCategory}の実績の推移</h3>
            <MedianTrendChart month={month} category={chartCategory} />
            <button className="btn-outline w-full mt-3" onClick={() => setChartCategory(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
