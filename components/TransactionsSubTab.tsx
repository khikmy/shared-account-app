'use client';

import { useEffect, useState } from 'react';
import { addHistory, deleteHistory, getHistory, getPeople, updateHistory } from '@/app/actions';
import { FIXED_CATEGORIES, formatYen } from '@/lib/calc';
import type { Transaction } from '@/lib/types';
import { useToast } from './ToastContext';

function personBadgeClass(person: string) {
  if (person === 'みどり') return 'badge-midori';
  if (person === 'こうへい') return 'badge-kohei';
  return 'badge-other';
}

const emptyForm = { date: '', person: '', category: '', amount: '' as number | '', memo: '' };

export default function TransactionsSubTab({ month }: { month: string }) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthOnly, setMonthOnly] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const showToast = useToast();

  useEffect(() => {
    getPeople().then(setPeople).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    getHistory({
      month: monthOnly ? month : undefined,
      person: personFilter || undefined,
      category: categoryFilter || undefined,
      keyword: keyword || undefined,
    })
      .then(setRows)
      .catch((err) => showToast('エラー: ' + err.message, true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, monthOnly, personFilter, categoryFilter, keyword]);

  const total = rows.reduce((sum, r) => (r.person === '銀行' ? sum : sum + Number(r.amount || 0)), 0);
  const categoryTotals: Record<string, number> = { 食費: 0, 消耗品費: 0, 交際費: 0 };
  let bankTotal = 0;
  rows.forEach((r) => {
    if (r.person === '銀行') bankTotal += Number(r.amount || 0);
    else if (r.category in categoryTotals) categoryTotals[r.category] += Number(r.amount || 0);
  });

  function openAdd() {
    setEditId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setModalOpen(true);
  }

  function openEdit(row: Transaction) {
    setEditId(row.id);
    setForm({ date: row.date, person: row.person, category: row.category, amount: row.amount, memo: row.memo || '' });
    setModalOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.amount === '') return;
    const entry = {
      date: form.date,
      person: form.person,
      category: form.category,
      amount: Number(form.amount),
      memo: form.memo,
    };
    try {
      if (editId) {
        await updateHistory(editId, entry);
        showToast('取引を更新しました');
      } else {
        await addHistory(entry);
        showToast('取引を追加しました');
      }
      setModalOpen(false);
      getPeople().then(setPeople).catch(() => {});
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  async function onDelete(id: number) {
    if (!confirm('この取引を削除しますか？')) return;
    try {
      await deleteHistory(id);
      showToast('削除しました');
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">食費・消耗品費・交際費一覧</h2>
        <button className="btn-primary text-xs" onClick={openAdd}>
          ＋
        </button>
      </div>

      <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center mb-3">
        <div className="text-xs text-neutral-500">分類合計金額</div>
        <div className="text-lg font-bold text-primary">{formatYen(total)}</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {['食費', '消耗品費', '交際費'].map((c) => (
          <div key={c} className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center flex-1 min-w-[80px]">
            <div className="text-xs text-neutral-500">{c}</div>
            <div className="font-bold">{formatYen(categoryTotals[c])}</div>
          </div>
        ))}
        <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center flex-1 min-w-[80px]">
          <div className="text-xs text-neutral-500">銀行</div>
          <div className="font-bold text-neutral-500">{formatYen(bankTotal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-3">
        <input className="input" placeholder="メモで検索" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="">全員</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">全分類</option>
            {FIXED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={monthOnly} onChange={(e) => setMonthOnly(e.target.checked)} />
          対象月のみ表示
        </label>
      </div>

      <div className="table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>収支対象</th>
              <th>分類</th>
              <th className="text-right">金額</th>
              <th>メモ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-neutral-400 py-4">
                  取引がありません
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="text-xs">{r.date}</span>
                </td>
                <td>
                  <span className={personBadgeClass(r.person)}>{r.person}</span>
                </td>
                <td>{r.category}</td>
                <td className="text-right font-bold">{formatYen(r.amount)}</td>
                <td>{r.memo}</td>
                <td className="whitespace-nowrap">
                  <button className="btn-outline text-xs mr-1" onClick={() => openEdit(r)}>
                    編集
                  </button>
                  <button className="btn-outline-danger text-xs" onClick={() => onDelete(r.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setModalOpen(false)}>
          <form
            className="card w-full max-w-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <h3 className="font-bold mb-3">{editId ? '食費・消耗品費・交際費を編集' : '食費・消耗品費・交際費を追加'}</h3>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">日付</label>
              <input type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">収支対象</label>
              <input
                className="input"
                list="person-list"
                placeholder="例: みどり"
                required
                value={form.person}
                onChange={(e) => setForm({ ...form, person: e.target.value })}
              />
              <datalist id="person-list">
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">分類</label>
              <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="" disabled>
                  選択してください
                </option>
                {FIXED_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">金額</label>
              <input
                type="number"
                className="input"
                placeholder="金額を入力"
                required
                min={0}
                step={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">メモ</label>
              <input className="input" placeholder="任意" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full">
              {editId ? '更新する' : '追加する'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
