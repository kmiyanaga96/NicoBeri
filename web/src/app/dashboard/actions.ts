'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function markAsArrived(scheduleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  // 到着時間の打刻（日時更新）とステータスを'present'にする
  const { error } = await supabase
    .from('daily_schedules')
    .update({ 
      clock_in: new Date().toISOString(),
      status: 'present',
      updated_by: user.id
    })
    .eq('id', scheduleId)

  if (error) {
    console.error('Error clocking in:', error)
    return
  }

  revalidatePath('/dashboard')
}

export async function markAsDeparted(scheduleId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  // 退出時間の打刻（日時更新）
  const { error } = await supabase
    .from('daily_schedules')
    .update({ 
      clock_out: new Date().toISOString(),
      updated_by: user.id
    })
    .eq('id', scheduleId)

  if (error) {
    console.error('Error clocking out:', error)
    return
  }

  revalidatePath('/dashboard')
}

// 送迎フラグのトグル
export async function toggleTransport(scheduleId: string, field: 'pickup' | 'dropoff', currentValue: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('daily_schedules')
    .update({ [field]: !currentValue })
    .eq('id', scheduleId)

  if (error) {
    console.error(`Error toggling ${field}:`, error)
    return
  }
  revalidatePath('/dashboard')
}

// 児童の備考欄の更新
export async function updateChildNotes(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const childId = formData.get('childId') as string
  const notes = formData.get('notes') as string

  if (!childId) return

  const { error } = await supabase
    .from('children')
    .update({ notes })
    .eq('id', childId)

  if (error) {
    console.error('Error updating notes:', error)
    return
  }
  revalidatePath('/dashboard')
}
