import MainApp from '@/components/MainApp';
import { getDashboard } from '@/app/actions';
import type { DashboardData } from '@/lib/types';

// 毎回最新のデータを取得するため静的化しない
export const dynamic = 'force-dynamic';

// Vercel のサーバーは UTC なので、日本時間の「今月」を明示的に求める
function currentMonthJst(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

export default async function Home() {
  const month = currentMonthJst();
  // 失敗した場合はクライアント側の取得にフォールバックする
  const initialDashboard: DashboardData | null = await getDashboard(month).catch(() => null);
  return <MainApp initialMonth={month} initialDashboard={initialDashboard} />;
}
