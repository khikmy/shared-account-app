'use client';

import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatYen } from '@/lib/calc';

type Point = { month: string; value: number };

export interface Series {
  name: string;
  color: string;
  points: Point[];
  /** y 軸を左右どちらに表示するか。系列ごとに独立した目盛りを持つ */
  axis: 'left' | 'right';
}

function formatMonth(m: string): string {
  return `${m.slice(2, 4)}/${Number(m.slice(5))}`;
}

function formatTick(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return abs >= 10000 ? `${sign}¥${+(abs / 10000).toFixed(2)}万` : `${sign}¥${abs.toLocaleString()}`;
}

interface AxisScale {
  domain: [number, number];
  ticks: number[];
}

/** 1 / 2 / 2.5 / 5 × 10^n を小さい順に返す */
function* niceSteps(from: number): Generator<number> {
  for (let pow = 10 ** Math.floor(Math.log10(from)); ; pow *= 10) {
    for (const f of [1, 2, 2.5, 5]) yield f * pow;
  }
}

/**
 * 各系列の y 軸の目盛りを、目盛りの本数をそろえて作る。
 * 左右の軸で横線(目盛り)が重なり、金額はきりのよい値になる。
 */
function makeScales(ranges: { min: number; max: number }[]): AxisScale[] {
  let best: { score: number; scales: AxisScale[] } | null = null;
  for (let count = 4; count <= 6; count++) {
    const scales = ranges.map(({ min, max }) => {
      const span = max - min || 1;
      for (const step of niceSteps(span / count / 10)) {
        const lo = Math.floor(min / step + 1e-9) * step;
        if (lo + count * step >= max - 1e-9) {
          return { step, lo };
        }
      }
      return { step: 1, lo: 0 };
    });
    // 目盛りの範囲がデータの範囲より広すぎないほうを選ぶ
    const score =
      scales.reduce((sum, sc, i) => sum + (count * sc.step) / (ranges[i].max - ranges[i].min || 1), 0) + count * 0.05;
    if (!best || score < best.score) {
      best = {
        score,
        scales: scales.map((sc) => ({
          domain: [sc.lo, sc.lo + count * sc.step],
          ticks: Array.from({ length: count + 1 }, (_, i) => sc.lo + i * sc.step),
        })),
      };
    }
  }
  return best!.scales;
}

const AXIS_TICK = { fontSize: 12, fill: '#64748b' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <div className="text-base text-slate-900">{formatMonth(label)}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-sm" style={{ color: p.color }}>
          {p.name} : {formatYen(p.value)}
        </div>
      ))}
    </div>
  );
}

/** 月別の値の折れ線グラフ。系列ごとに左右の y 軸を持てる。months は x 軸に並べる全ての月 */
export default function LineChart({
  months,
  series,
  highlightMonth,
  referenceValue,
  height = 288,
  label,
}: {
  months: string[];
  series: Series[];
  highlightMonth?: string;
  /** 左軸に引く補助線 (例: 中央値) */
  referenceValue?: { value: number; label: string; color: string };
  height?: number;
  label: string;
}) {
  const data = months.map((month) => {
    const row: Record<string, string | number | null> = { month };
    series.forEach((s, i) => {
      row[`s${i}`] = s.points.find((p) => p.month === month)?.value ?? null;
    });
    return row;
  });
  const hasRight = series.some((s) => s.axis === 'right');
  const axes = Array.from(new Set(series.map((s) => s.axis)));
  const scales = makeScales(
    axes.map((axis) => {
      const nums = series.filter((s) => s.axis === axis).flatMap((s) => s.points.map((p) => p.value));
      return { min: Math.min(0, ...nums), max: Math.max(0, ...nums) };
    })
  );
  const scaleOf = (axis: 'left' | 'right') => scales[axes.indexOf(axis)];
  const left = scaleOf(axes.includes('left') ? 'left' : axes[0]);

  return (
    <div role="img" aria-label={label}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={data} margin={{ top: 24, right: hasRight ? 4 : 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
            <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS_TICK} stroke="#94a3b8" strokeOpacity={0.3} interval={0} />
            <YAxis yAxisId="left" orientation="left" tickFormatter={formatTick} tick={AXIS_TICK} stroke="#94a3b8" strokeOpacity={0.3} width={64} domain={left.domain} ticks={left.ticks} />
            {hasRight && (
              <YAxis yAxisId="right" orientation="right" tickFormatter={formatTick} tick={AXIS_TICK} stroke="#94a3b8" strokeOpacity={0.3} width={64} domain={scaleOf('right').domain} ticks={scaleOf('right').ticks} />
            )}
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
            {highlightMonth && months.includes(highlightMonth) && (
              <ReferenceLine
                yAxisId="left"
                x={highlightMonth}
                stroke="#dc2626"
                strokeDasharray="4 3"
                label={{ value: '対象月', position: 'top', fill: '#dc2626', fontSize: 12, fontWeight: 700 }}
              />
            )}
            {referenceValue && (
              <ReferenceLine
                yAxisId="left"
                y={referenceValue.value}
                stroke={referenceValue.color}
                strokeDasharray="4 3"
                label={{ value: referenceValue.label, position: 'insideTopRight', fill: referenceValue.color, fontSize: 12 }}
              />
            )}
            {series.map((s, i) => (
              <Line
                key={s.name}
                yAxisId={s.axis}
                type="monotone"
                dataKey={`s${i}`}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload, index } = props;
                  if (cx == null || cy == null) return <g key={index} />;
                  const isTarget = payload.month === highlightMonth;
                  return (
                    <circle key={index} cx={cx} cy={cy} r={isTarget ? 6 : 3.5} fill={isTarget ? '#dc2626' : s.color} stroke={isTarget ? '#fecaca' : 'none'} strokeWidth={4} />
                  );
                }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 mt-1">
        {series.map((s) => (
          <span key={s.name}>
            <span style={{ color: s.color }}>●</span> {s.name}
            {hasRight ? `(${s.axis === 'left' ? '左軸' : '右軸'})` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
