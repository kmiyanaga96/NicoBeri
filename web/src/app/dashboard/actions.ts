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

// admin権限チェックのヘルパー
async function requireAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return profile?.role === 'admin'
}

// 打刻時刻の修正（スタッフは当日のみ、管理者は全日）
export async function updateScheduleTime(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const scheduleId = formData.get('scheduleId') as string
  const fieldName = formData.get('fieldName') as 'clock_in' | 'clock_out'
  const timeValue = formData.get('timeValue') as string

  if (!scheduleId || !fieldName) return

  const { data: schedule } = await supabase
    .from('daily_schedules')
    .select('date')
    .eq('id', scheduleId)
    .single()
  if (!schedule) return

  // 権限チェック: スタッフは当日の予定のみ修正可能、管理者は制限なし
  const isAdmin = await requireAdmin(supabase, user.id)
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  if (!isAdmin && schedule.date !== todayStr) return

  let isoDateTime = null
  if (timeValue) {
    isoDateTime = new Date(`${schedule.date}T${timeValue}:00+09:00`).toISOString()
  }

  await supabase
    .from('daily_schedules')
    .update({
      [fieldName]: isoDateTime,
      status: 'present'
    })
    .eq('id', scheduleId)

  revalidatePath('/dashboard')
}

// 管理者用: 送迎フラグのトグル
export async function updateScheduleTransport(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return

  const scheduleId = formData.get('scheduleId') as string
  const field = formData.get('field') as 'pickup' | 'dropoff'
  const currentValue = formData.get('currentValue') === 'true'

  if (!scheduleId || !field) return

  const { error } = await supabase
    .from('daily_schedules')
    .update({ [field]: !currentValue })
    .eq('id', scheduleId)

  if (error) {
    console.error(`Error toggling ${field}:`, error)
  }
  revalidatePath('/dashboard')
}

// 児童情報の追加・更新（認証必須）
export async function upsertChild(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = formData.get('id') as string
  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const sei = formData.get('sei') as string
  const mei = formData.get('mei') as string
  const gender = formData.get('gender') as string
  const recipient_number = formData.get('recipient_number') as string
  const disability_level = parseInt(formData.get('disability_level') as string) || 3
  const medical_notes = formData.get('medical_notes') as string
  const notes = formData.get('notes') as string

  if (!first_name || !last_name) return

  const home_address = formData.get('home_address') as string || null
  const facility_idStr = formData.get('facility_id') as string
  const facility_id = facility_idStr ? facility_idStr : null
  const birthdateStr = formData.get('birthdate') as string
  const birthdate = birthdateStr ? birthdateStr : null

  const payload = {
    first_name,
    last_name,
    sei,
    mei,
    gender,
    recipient_number,
    disability_level,
    medical_notes,
    notes,
    home_address,
    facility_id,
    birthdate,
    active: true
  }

  if (id) {
    // 既存の更新
    await supabase.from('children').update(payload).eq('id', id)
  } else {
    // 新規作成
    await supabase.from('children').insert(payload)
  }
  
  revalidatePath('/dashboard')
}

// 児童の削除（管理者のみ・物理削除）
export async function deleteChild(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return

  const childId = formData.get('childId') as string
  if (!childId) return

  // 関連するスケジュールも削除
  await supabase.from('daily_schedules').delete().eq('child_id', childId)
  await supabase.from('children').delete().eq('id', childId)

  revalidatePath('/dashboard')
}

// 来所予定の追加
export async function addSchedule(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const childId = formData.get('childId') as string
  const date = formData.get('date') as string

  if (!childId || !date) return

  // 同じ日に同じ児童の予定が既にあれば追加しない
  const { data: existing } = await supabase
    .from('daily_schedules')
    .select('id')
    .eq('child_id', childId)
    .eq('date', date)
    .maybeSingle()

  if (existing) return // 重複防止

  await supabase.from('daily_schedules').insert({
    child_id: childId,
    date,
    status: 'scheduled',
  })

  revalidatePath('/dashboard')
}

// 来所予定の削除
export async function removeSchedule(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const scheduleId = formData.get('scheduleId') as string
  if (!scheduleId) return

  await supabase.from('daily_schedules').delete().eq('id', scheduleId)

  revalidatePath('/dashboard')
}

// --- 施設（預かり所）の追加・更新（管理者のみ） ---
export async function upsertFacility(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const address = formData.get('address') as string

  if (!name) return

  const payload = {
    name,
    address: address || null
  }

  if (id) {
    await supabase.from('facilities').update(payload).eq('id', id)
  } else {
    await supabase.from('facilities').insert(payload)
  }
  
  revalidatePath('/dashboard')
}

// --- 施設の削除（管理者のみ） ---
export async function deleteFacility(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const isAdmin = await requireAdmin(supabase, user.id)
  if (!isAdmin) return

  const facilityId = formData.get('facilityId') as string
  if (!facilityId) return

  await supabase.from('facilities').delete().eq('id', facilityId)

  revalidatePath('/dashboard')
}
