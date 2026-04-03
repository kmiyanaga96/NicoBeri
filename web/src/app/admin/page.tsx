import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, ArrowLeft, ShieldCheck, Power, AlertTriangle, UserPlus, KeyRound, CalendarClock, Trash2, Plus, X, Pencil } from 'lucide-react'
import { toggleStaffActive, createNewStaffAccount, resetStaffPassword, deleteStaffAccount, updateStaffProfile, upsertChild, deleteChild, addSchedule, removeSchedule } from './actions'
import { createAdminClient } from '@/utils/supabase/admin'
import { AutoCloseDetails } from '@/app/components/AutoCloseDetails'
import { ConfirmButton } from '@/app/components/ConfirmButton'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const resolvedParams = await searchParams
  const activeTab = resolvedParams?.tab === 'staff' ? 'staff' : 'office'
  const targetMonthStr = new Date().toISOString().substring(0, 7) // 'YYYY-MM'

  const supabase = await createClient()

  // セッション・権限確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.is_active === false || profile.role !== 'admin') {
    redirect('/dashboard') // 管理者以外は追い出す
  }

  // スタッフ一覧を取得（nameのアルファベット順）
  const { data: staffList } = await supabase
    .from('staff_profiles')
    .select('*')
    .order('name', { ascending: true })

  // auth.usersからメール（=スタッフID）を取得
  const adminClient = createAdminClient()
  const { data: authUsers } = await adminClient.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  for (const au of authUsers?.users || []) {
    if (au.email) {
      emailMap[au.id] = au.email.replace('@nicoberi.com', '')
    }
  }

  // 児童一覧を取得（フリガナあいうえお順）
  const { data: childrenList } = await supabase
    .from('children')
    .select('*')
    .order('sei', { ascending: true })

  // 今日から1ヶ月先までの日付リスト（予定登録用）
  const dateSuggestions: { value: string; label: string }[] = []
  const todayDate = new Date()
  for (let i = 0; i <= 30; i++) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + i)
    const val = d.toISOString().split('T')[0]
    const dow = ['日','月','火','水','木','金','土'][d.getDay()]
    const label = `${d.getMonth()+1}/${d.getDate()} (${dow})`
    dateSuggestions.push({ value: val, label })
  }

  // 対象期間の既存スケジュール（予定管理用: 今日〜1ヶ月後）
  const scheduleRangeStart = todayDate.toISOString().split('T')[0]
  const endD = new Date(todayDate); endD.setDate(endD.getDate() + 30)
  const scheduleRangeEnd = endD.toISOString().split('T')[0]

  const { data: existingSchedules } = await supabase
    .from('daily_schedules')
    .select(`
      id, date, status,
      children ( id, first_name, last_name, sei )
    `)
    .gte('date', scheduleRangeStart)
    .lte('date', scheduleRangeEnd)
    .order('date', { ascending: true })

  // 日付ごとにグルーピング
  const schedulesByDate: Record<string, any[]> = {}
  for (const s of (existingSchedules as any[]) || []) {
    if (!schedulesByDate[s.date]) schedulesByDate[s.date] = []
    schedulesByDate[s.date].push(s)
  }

  const typedStaffList = (staffList as any[]) || []
  const typedChildren = (childrenList as any[]) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      {/* Decorative */}
      <div className="fixed top-20 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-8 h-8 text-teal-400" />
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-teal-500">
                管理者パネル
              </h1>
            </div>
            <p className="text-slate-400 text-sm">スタッフ管理とデータ管理を行います。</p>
          </div>
          <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            ダッシュボードに戻る
          </Link>
        </header>

        {/* Tab Navigation */}
        <div className="flex bg-white/5 p-1.5 rounded-2xl w-fit mb-8 shadow-inner border border-white/10">
          <Link
            href="/admin?tab=office"
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === 'office' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <CalendarClock className="w-4 h-4" />
            事務処理
          </Link>
          <Link
            href="/admin?tab=staff"
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === 'staff' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Users className="w-4 h-4" />
            スタッフ管理
          </Link>
        </div>

        {/* Tab Content */}
        <div className="w-full">

          {/* スタッフ管理タブ */}
          {activeTab === 'staff' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
              <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3">
                <Users className="w-5 h-5 text-cyan-400" />
                スタッフ権限・アカウント凍結管理
              </h2>
              <div className="space-y-3">
                {typedStaffList.map((staff) => {
                  const staffId = emailMap[staff.id] || '不明'
                  return (
                    <AutoCloseDetails
                      key={staff.id}
                      className={`rounded-2xl border transition-all overflow-hidden [&_summary::-webkit-details-marker]:hidden ${staff.is_active ? 'bg-white/5 border-white/10' : 'bg-red-950/30 border-red-500/30 opacity-70'}`}
                      summaryClassName="flex justify-between items-center p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      summaryContent={<>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{staff.name?.split('@')[0] || '名称未設定'}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${staff.role === 'admin' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700 text-slate-300'}`}>
                              {staff.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            {staff.is_active ? (
                              <span className="text-green-400">● アクティブ</span>
                            ) : (
                              <span className="text-red-400"><AlertTriangle className="w-3 h-3 inline mr-1" />凍結済み</span>
                            )}
                            <span className="text-slate-500 ml-2">ID: {staffId}</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-500 bg-black/40 px-2 py-0.5 rounded">詳細 ▼</span>
                      </>}
                    >
                      <div className="p-4 pt-2 border-t border-white/5 space-y-4">
                        {/* スタッフ詳細情報 */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">スタッフID</span>
                            <span className="text-slate-200 font-mono">{staffId}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">スタッフ氏名</span>
                            <span className="text-slate-200">{staff.name || '名称未設定'}</span>
                          </div>
                        </div>

                        {/* 編集フォーム */}
                        <form action={updateStaffProfile} className="space-y-3 pt-2 border-t border-white/5">
                          <input type="hidden" name="user_id" value={staff.id} />
                          <p className="text-xs text-slate-400 flex items-center gap-1"><Pencil className="w-3 h-3" /> 情報を編集</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">スタッフID</label>
                              <input type="text" name="staff_id" defaultValue={staffId} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">氏名</label>
                              <input type="text" name="name" defaultValue={staff.name || ''} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                            </div>
                          </div>
                          <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold py-1.5 px-4 rounded-lg transition-colors">
                            更新
                          </button>
                        </form>

                        {/* パスワード変更 */}
                        <form action={resetStaffPassword} className="space-y-3 pt-2 border-t border-white/5">
                          <input type="hidden" name="user_id" value={staff.id} />
                          <p className="text-xs text-slate-400 flex items-center gap-1"><KeyRound className="w-3 h-3" /> パスワード変更</p>
                          <div className="flex gap-3 items-end">
                            <div className="flex-1">
                              <label className="block text-[10px] text-slate-400 mb-1">新パスワード (6文字以上)</label>
                              <input type="password" name="new_password" required placeholder="••••••••" minLength={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500" />
                            </div>
                            <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors whitespace-nowrap">
                              変更
                            </button>
                          </div>
                        </form>

                        {/* アクション: 凍結 / 削除 */}
                        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                          {staff.id !== user.id && staff.role !== 'admin' && (
                            <form action={toggleStaffActive.bind(null, staff.id, staff.is_active)}>
                              <button type="submit" className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${staff.is_active ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'}`}>
                                <Power className="w-4 h-4" />
                                {staff.is_active ? 'アカウントを凍結' : '凍結を解除'}
                              </button>
                            </form>
                          )}
                          {staff.id !== user.id && (
                            <form action={deleteStaffAccount}>
                              <input type="hidden" name="user_id" value={staff.id} />
                              <ConfirmButton
                                message={`${staff.name || staffId} のアカウントを完全に削除しますか？\nこの操作は取り消せません。`}
                                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                アカウントを削除
                              </ConfirmButton>
                            </form>
                          )}
                        </div>
                      </div>
                    </AutoCloseDetails>
                  )
                })}
              </div>

              {/* 新規スタッフ登録 */}
              <div className="mt-8 border-t border-white/10 pt-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-400" />
                    新規スタッフの登録
                  </h3>
                  <form action={createNewStaffAccount} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">スタッフID (半角英数字)</label>
                        <input type="text" name="staff_id" required placeholder="例: matsushi" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">氏名</label>
                        <input type="text" name="name" required placeholder="例: 増田 督史" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">初期パスワード (6文字以上)</label>
                        <input type="password" name="password" required placeholder="••••••••" minLength={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">権限</label>
                        <select name="role" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500">
                          <option value="staff">一般スタッフ (staff)</option>
                          <option value="admin">管理者 (admin)</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-xl transition-colors text-sm shadow-md">
                      アカウントを発行する
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'office' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">

              {/* 来所予定の登録・キャンセル */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-slate-300">
                  <CalendarClock className="w-5 h-5 text-teal-400" />
                  来所予定の登録・キャンセル
                </h2>
                {/* 予定追加フォーム */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <form action={addSchedule} className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">児童</label>
                      <select name="childId" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                        <option value="">選択</option>
                        {typedChildren.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">日付</label>
                      <select name="date" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                        {dateSuggestions.map(ds => (
                          <option key={ds.value} value={ds.value}>{ds.label}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors">
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </form>
                </div>

                {/* 登録済み予定の一覧（日別アコーディオン） */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {dateSuggestions.map(ds => {
                    const dayRecords = schedulesByDate[ds.value] || []
                    if (dayRecords.length === 0) return null
                    const d = new Date(ds.value + 'T00:00:00')
                    const isSun = d.getDay() === 0
                    const isSat = d.getDay() === 6
                    return (
                      <details key={ds.value} className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                        <summary className={`flex items-center justify-between cursor-pointer px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors ${
                          isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-slate-200'
                        }`}>
                          <span>{ds.label}</span>
                          <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-bold">{dayRecords.length}名</span>
                        </summary>
                        <div className="border-t border-white/5 divide-y divide-white/5">
                          {dayRecords.sort((a: any, b: any) => {
                            const sA = a.children?.sei || a.children?.last_name || ''
                            const sB = b.children?.sei || b.children?.last_name || ''
                            return sA.localeCompare(sB, 'ja')
                          }).map((s: any) => (
                            <div key={s.id} className="flex items-center justify-between px-4 py-2">
                              <span className="text-sm">{s.children?.last_name} {s.children?.first_name}</span>
                              <form action={removeSchedule}>
                                <input type="hidden" name="scheduleId" value={s.id} />
                                <button type="submit" className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="予定を削除">
                                  <X className="w-4 h-4" />
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      </details>
                    )
                  })}
                </div>
              </div>

              {/* 児童名簿管理 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-slate-300">
                  児童名簿・情報編集
                </h2>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-[500px] overflow-y-auto">
                  {/* 新規登録フォーム用 */}
                  <details className="mb-4 group bg-teal-900/40 border border-teal-500/30 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between cursor-pointer p-4 font-bold text-teal-300">
                      + 新規児童の追加
                    </summary>
                    <div className="p-4 pt-0 border-t border-teal-500/20 bg-black/20">
                      <form action={upsertChild} className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" name="last_name" required placeholder="姓" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                          <input type="text" name="first_name" required placeholder="名" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                          <input type="text" name="sei" placeholder="セイ (フリガナ)" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                          <input type="text" name="mei" placeholder="メイ (フリガナ)" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          <select name="gender" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg text-slate-300">
                            <option value="男">男</option>
                            <option value="女">女</option>
                          </select>
                          <input type="text" name="recipient_number" placeholder="受給者証番号 (例:3980)" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                          <input type="number" name="disability_level" placeholder="支援区分 (例:3)" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                        </div>
                        <textarea name="notes" placeholder="スタッフ共有事項" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg w-full" rows={2}></textarea>
                        <textarea name="medical_notes" placeholder="非公開配慮事項" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg w-full" rows={2}></textarea>
                        <button type="submit" className="bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold py-2 rounded-lg transition-colors mt-2">
                          登録
                        </button>
                      </form>
                    </div>
                  </details>

                  {/* 既存児童一括表示 */}
                  <div className="space-y-2">
                    {typedChildren.map((child) => (
                      <AutoCloseDetails
                        key={child.id}
                        className="group bg-black/20 border border-white/5 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                        summaryClassName="flex items-center justify-between cursor-pointer p-3 font-medium text-sm text-slate-200 hover:bg-white/5 transition-colors"
                        summaryContent={<>
                          {child.last_name} {child.first_name}
                          <span className="text-[10px] text-slate-500 bg-black/40 px-2 py-0.5 rounded">編集 v</span>
                        </>}
                      >
                        <div className="p-4 pt-2 border-t border-white/5">
                          <form action={upsertChild} className="flex flex-col gap-3">
                            <input type="hidden" name="id" value={child.id} />
                            <div className="grid grid-cols-2 gap-3">
                              <input type="text" name="last_name" defaultValue={child.last_name} required placeholder="姓" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                              <input type="text" name="first_name" defaultValue={child.first_name} required placeholder="名" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                              <input type="text" name="sei" defaultValue={child.sei || ''} placeholder="セイ (フリガナ)" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                              <input type="text" name="mei" defaultValue={child.mei || ''} placeholder="メイ (フリガナ)" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                              <select name="gender" defaultValue={child.gender || '男'} className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg text-slate-300">
                                <option value="男">男</option>
                                <option value="女">女</option>
                              </select>
                              <input type="text" name="recipient_number" defaultValue={child.recipient_number || ''} placeholder="受給者証番号" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                              <input type="number" name="disability_level" defaultValue={child.disability_level || ''} placeholder="支援区分" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg" />
                            </div>
                            <textarea name="notes" defaultValue={child.notes || ''} placeholder="スタッフ共有事項" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg w-full" rows={2}></textarea>
                            <textarea name="medical_notes" defaultValue={child.medical_notes || ''} placeholder="非公開配慮事項" className="bg-slate-900 border border-slate-700 text-sm px-3 py-2 rounded-lg w-full" rows={2}></textarea>
                            <div className="flex items-center gap-3 mt-2">
                              <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold py-1.5 px-4 rounded-lg transition-colors">
                                更新
                              </button>
                            </div>
                          </form>
                          <form action={deleteChild} className="mt-3 pt-3 border-t border-white/5">
                            <input type="hidden" name="childId" value={child.id} />
                            <ConfirmButton
                              message={`${child.last_name} ${child.first_name} を名簿から削除しますか？\nこの操作は取り消せません。`}
                              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-medium hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              この児童を削除
                            </ConfirmButton>
                          </form>
                        </div>
                      </AutoCloseDetails>
                    ))}
                  </div>
                </div>
              </div>

              {/* Excel出力 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-emerald-400">
                  月次実績記録表・スケジュール表の出力
                </h2>
                <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
                  <p className="text-emerald-400/80 text-sm mb-4">
                    浦安市提出の所定フォーマットを自動生成し、Excelファイルとしてダウンロードします。
                  </p>
                  <form method="GET" action="/api/export" className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="month"
                      name="month"
                      defaultValue={targetMonthStr}
                      className="bg-slate-900 border border-slate-700 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2 rounded-xl transition-colors text-sm shadow-md"
                    >
                      出力 (.xlsx)
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
