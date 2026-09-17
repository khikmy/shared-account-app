import { createClient } from '@supabase/supabase-js';

// このアプリはブラウザに一切 Supabase の鍵を渡さない構成。
// Server Actions / Route Handler など、サーバー側でのみこのクライアントを使う。
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が環境変数に設定されていません。');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
