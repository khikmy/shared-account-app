'use client';

import { useEffect, useState } from 'react';
import { getMedianActualTrend } from '@/app/actions';
import { formatYen, median } from '@/lib/calc';
import LineChart from './LineChart';

type Point = { month: string; amount: number };

export default function MedianTrendChart({ month, category }: { month: string; category: string }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPoints(null);
    getMedianActualTrend(month, category)
      .then(setPoints)
      .catch((e) => setError(e.message));
  }, [month, category]);

  if (error) return <p className="text-xs text-red-500 mt-3">エラー: {error}</p>;
  if (!points) return <p className="text-xs text-slate-400 mt-3">読み込み中...</p>;
  if (points.length === 0) return <p className="text-xs text-slate-400 mt-3">実績がありません</p>;

  // 中央値の対象は 0 円の月を除いた実績
  const nonZero = points.filter((p) => p.amount > 0).map((p) => p.amount);
  const med = nonZero.length ? Math.round(median(nonZero) / 100) * 100 : null;

  return (
    <div className="mt-3">
      <LineChart
        months={points.map((p) => p.month)}
        series={[{ name: '月別実績', color: '#2563eb', axis: 'left', points: points.map((p) => ({ month: p.month, value: p.amount })) }]}
        referenceValue={med !== null ? { value: med, label: `中央値 ${formatYen(med)}`, color: '#f59e0b' } : undefined}
        height={240}
        label={`${category}の実績推移`}
      />
    </div>
  );
}
