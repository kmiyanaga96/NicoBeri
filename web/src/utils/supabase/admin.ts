import { createClient } from '@supabase/supabase-js'

/**
 * サーバー側でのみ使用する、特権を持ったSupabaseクライアントを生成します。
 * auth.admin.createUser や auth.admin.updateUser などの管理用APIの呼び出しに使用します。
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL or Service Role Key is missing in environment variables.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
