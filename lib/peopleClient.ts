import { getPeople } from '@/app/actions';

// Server Actions は直列に処理されるため、複数のタブが同時に getPeople を呼ぶと待ち行列が伸びる。
// 呼び出しを1回にまとめ、結果を共有する。取引を追加・更新した後は force=true で取り直す。
let cached: Promise<string[]> | null = null;

export function loadPeople(force = false): Promise<string[]> {
  if (!cached || force) {
    cached = getPeople().catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}
