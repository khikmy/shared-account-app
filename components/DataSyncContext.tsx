'use client';

import { createContext, useContext } from 'react';

// 共有口座の画面で取引・予算・固定費変動費を更新したとき、他の画面(ダッシュボードなど)も再読み込みさせるための合図。
// notify() で version が増え、各画面は version が変わったら取り直す。
export interface DataSync {
  version: number;
  notify: () => void;
}

export const DataSyncContext = createContext<DataSync>({ version: 0, notify: () => {} });

export function useDataSync() {
  return useContext(DataSyncContext);
}
