'use client';

import { useEffect, useState } from 'react';
import { addTatekae, getAllTatekaeData, getTatekaeData, settleAll } from '@/app/actions';
import type { TatekaeData } from '@/app/actions';
import { useToast } from './ToastContext';

type ListItem = { id: number; date: string; user: string; content: string; amount: number };

function personBadgeClass(person: string) {
  return person === 'みどり' ? 'badge-midori' : 'badge-kohei';
}

export default function ReimburseTab() {
  const [data, setData] = useState<TatekaeData | null>(null);
  const [allList, setAllList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState<'みどり' | 'こうへい'>('みどり');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const showToast = useToast();

  function load() {
    setLoading(true);
    Promise.all([getTatekaeData(), getAllTatekaeData()])
      .then(([d, all]) => {
        setData(d);
        setAllList(all);
      })
      .catch((err) => showToast('エラー: ' + err.message, true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount === '' || !content) return;
    setSubmitting(true);
    try {
      await addTatekae(user, date, content, Number(amount));
      showToast('立替金を追加しました');
      setContent('');
      setAmount('');
      setModalOpen(false);
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSettleAll() {
    if (!confirm('未精算のデータをすべて「精算済」にし、一覧から非表示にします。よろしいですか？')) return;
    try {
      await settleAll();
      showToast('精算済みにしました');
      load();
    } catch (err) {
      showToast('エラー: ' + (err as Error).message, true);
    }
  }

  return (
    <div>
      <div className="card">
        <h2 className="font-bold mb-3">現在の未精算状況</h2>
        <div className="grid grid-cols-2 gap-2 mb-3 text-center">
          <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950">
            <div className="text-xs text-neutral-500">みどりの立替合計</div>
            <div className="text-lg font-bold text-midori">{(data?.totalMidori || 0).toLocaleString()} 円</div>
          </div>
          <div className="p-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-950">
            <div className="text-xs text-neutral-500">こうへいの立替合計</div>
            <div className="text-lg font-bold text-kohei">{(data?.totalKohei || 0).toLocaleString()} 円</div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-center text-sm font-bold text-primary">
          {loading ? '計算中...' : data?.settlementMessage}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">未精算の立替一覧</h2>
          <button className="btn-primary text-xs" onClick={() => setModalOpen(true)}>
            ＋
          </button>
        </div>
        <button className="btn-outline-danger w-full mb-3" onClick={onSettleAll}>
          精算完了
        </button>
        {!loading && (data?.list.length ?? 0) === 0 && (
          <p className="text-center text-neutral-400 py-4">未精算のデータはありません</p>
        )}
        <div className="space-y-3">
          {data?.list.map((item) => (
            <div key={item.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={personBadgeClass(item.user)}>{item.user}</span>
                <span className="text-xs text-neutral-500">{item.date}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300 break-words">{item.content}</span>
                <span className="font-bold shrink-0">{item.amount.toLocaleString()}円</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">精算済の立替履歴</h2>
        {!loading && allList.length === 0 && (
          <p className="text-center text-neutral-400 py-4">精算済みの履歴はありません</p>
        )}
        <div className="space-y-3">
          {allList.map((item) => (
            <div key={item.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={personBadgeClass(item.user)}>{item.user}</span>
                <span className="text-xs text-neutral-500">{item.date}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300 break-words">{item.content}</span>
                <span className="font-bold shrink-0">{item.amount.toLocaleString()}円</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setModalOpen(false)}>
          <form className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
            <h3 className="font-bold mb-3">新しく立替を入力</h3>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">誰が払った？</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`btn ${user === 'みどり' ? 'bg-midori text-white' : 'border border-midori text-midori'}`}
                  onClick={() => setUser('みどり')}
                >
                  みどり
                </button>
                <button
                  type="button"
                  className={`btn ${user === 'こうへい' ? 'bg-kohei text-white' : 'border border-kohei text-kohei'}`}
                  onClick={() => setUser('こうへい')}
                >
                  こうへい
                </button>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">立替日</label>
              <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">内容（何を）</label>
              <input
                className="input"
                placeholder="例: スーパー、晩御飯代"
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1">金額（いくら）</label>
              <input
                type="number"
                className="input"
                placeholder="金額を入力"
                required
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? '送信中...' : '送信する'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
