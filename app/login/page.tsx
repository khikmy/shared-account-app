'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '../actions';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await login(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.message || 'ログインに失敗しました');
      return;
    }
    router.replace(params.get('next') || '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm">
      <h1 className="text-lg font-bold text-center mb-4">共有口座管理</h1>
      <label className="block text-sm font-bold mb-1" htmlFor="password">
        パスワード
      </label>
      <input
        id="password"
        type="password"
        className="input mb-3"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
      />
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'ログイン中...' : 'ログイン'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
