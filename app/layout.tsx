import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '共有口座管理',
  description: 'こうへい・みどりの共有口座管理アプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
