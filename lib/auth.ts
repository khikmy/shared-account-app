// 二人だけで使う共有パスワードによる簡易ゲート。
// Edge Runtime (middleware) でも Node Runtime (Server Action) でも動くように
// Web Crypto の SubtleCrypto だけを使って実装する。

export const AUTH_COOKIE = 'shared_account_session';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 現在の APP_PASSWORD から期待されるセッショントークンを計算する */
export async function expectedSessionToken(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.APP_SESSION_SECRET || 'shared-account-app';
  if (!password) return null;
  return sha256Hex(`${secret}:${password}`);
}

export async function verifyPassword(input: string): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  if (input !== password) return null;
  return expectedSessionToken();
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedSessionToken();
  if (!expected) return false;
  return token === expected;
}
