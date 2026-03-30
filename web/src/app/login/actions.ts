'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const staffId = formData.get('staff_id') as string
  const password = formData.get('password') as string

  if (!staffId || !password) {
    return { error: 'スタッフIDとパスワードを入力してください' }
  }

  // IDからダミーメールを生成して認証する
  const email = `${staffId}@nicoberi.com`

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'ログインに失敗しました。IDとパスワードを確認してください。' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard') // ログイン成功後はダッシュボードへリダイレクト
}
