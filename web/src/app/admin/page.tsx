import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, CalendarClock, ArrowLeft, ShieldCheck, Power, AlertTriangle, UserPlus, KeyRound } from 'lucide-react'
import { toggleStaffActive, updateScheduleTime, createNewStaffAccount, resetStaffPassword, upsertChild } from './actions'

function extractTime(isoString: string | null) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const resolvedParams = await searchParams
  const activeTab = resolvedParams?.tab === 'staff' ? 'staff' : 'office'
  const targetDateStr = typeof resolvedParams?.date === 'string' ? resolvedParams.date : new Date().toISOString().split('T')[0]
  const targetMonthStr = targetDateStr.substring(0, 7) // 'YYYY-MM'

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

  // スタッフ一覧を取得
  const { data: staffList } = await supabase
    .from('staff_profiles')
    .select('*')
    .order('created_at', { ascending: true })

  // 児童一覧を取得
  const { data: childrenList } = await supabase
    .from('children')
    .select('*')
    .order('last_name', { ascending: true })

  // 選択された日付のスケジュール一覧（デフォルトは本日）
  const { data: schedules } = await supabase
    .from('daily_schedules')
    .select(`
      id,
      status,
      date,
      clock_in,
      clock_out,
      children ( id, first_name, last_name )
    `)
    .eq('date', targetDateStr)
    .order('created_at', { ascending: true })

  const typedStaffList = (staffList as any[]) || []
  const typedSchedules = (schedules as any[]) || []
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
            <p className="text-slate-400 text-sm">スタッフ管理と打刻修正を行います。</p>
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
                {typedStaffList.map((staff) => (
                  <div key={staff.id} className={`p-4 rounded-2xl border transition-all ${staff.is_active ? 'bg-white/5 border-white/10' : 'bg-red-950/30 border-red-500/30 opacity-70'}`}>
                    <div className="flex justify-between items-center">
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
                        </p>
                      </div>
                      {/* 自分自身は凍結不可 */}
                      {staff.id !== user.id && staff.role !== 'admin' && (
                        <form action={toggleStaffActive.bind(null, staff.id, staff.is_active)}>
                          <button type="submit" className={`p-2 rounded-xl transition-all shadow-md ${staff.is_active ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'}`}>
                            <Power className="w-5 h-5" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 追加: アカウント作成とパスワード編集UI */}
              <div className="mt-12 space-y-8 border-t border-white/10 pt-8">
                {/* 新規スタッフ登録 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-400" />
                    新規スタッフの登録
                  </h3>
                  <form action={createNewStaffAccount} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">スタッフID (半角英数字)</label>
                        <input type="text" name="staff_id" required placeholder="例: matsushi" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">氏名</label>
                        <input type="text" name="name" required placeholder="例: 増田 督史" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">初期パスワード (6文字以上)</label>
                        <input type="password" name="password" required placeholder="••••••••" minLength={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">権限</label>
                        <select name="role" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
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

                {/* パスワードリセット */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-orange-400" />
                    パスワードの強制変更
                  </h3>
                  <form action={resetStaffPassword} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">対象スタッフ</label>
                        <select name="user_id" required className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                          <option value="">選択してください</option>
                          {typedStaffList.map(staff => (
                            <option key={staff.id} value={staff.id}>{staff.name?.split('@')[0]} ({staff.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">新パスワード (6文字以上)</label>
                        <input type="password" name="new_password" required placeholder="••••••••" minLength={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-xl transition-colors text-sm shadow-md">
                      パスワードを変更する
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

          {/* 事務処理タブ */}
          {activeTab === 'office' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* 左カラム: 日付ごとのスケジュール・打刻管理 */}
              <div className="space-y-8">

                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-3">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <CalendarClock className="w-5 h-5 text-teal-400" />
                      打刻・スケジュール管理
                    </h2>
                    {/* 日付選択 */}
                    <form className="flex items-center gap-2" method="GET" action="/admin">
                      <input type="hidden" name="tab" value="office" />
                      <input
                        type="date"
                        name="date"
                        defaultValue={targetDateStr}
                        className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button type="submit" className="text-sm bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                        表示
                      </button>
                    </form>
                  </div>

                  {/* ここから下に既存の打刻修正カードを展開 */}
                  <div className="space-y-4">
                    {typedSchedules.length === 0 ? (
                      <p className="text-slate-500 text-sm">{targetDateStr} のスケジュールはありません。</p>
                    ) : (
                      typedSchedules.map((schedule) => (
                        <div key={schedule.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">{schedule.children?.last_name} {schedule.children?.first_name}</h3>
                            <span className={`text-xs px-2 py-1 rounded font-bold ${schedule.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-300'}`}>
                              {schedule.status === 'cancelled' ? 'キャンセル済' : schedule.status === 'present' ? '預かり' : schedule.status}
                            </span>
                          </div>

                          <div className="flex flex-col gap-4">
                            {/* 到着時刻の編集フォーム */}
                            <form action={updateScheduleTime} className="flex items-center justify-between gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <input type="hidden" name="fieldName" value="clock_in" />
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase w-10">到着</span>
                                <input
                                  type="time"
                                  name="timeValue"
                                  defaultValue={extractTime(schedule.clock_in)}
                                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                />
                              </div>
                              <button type="submit" className="text-xs font-medium bg-teal-600 hover:bg-teal-500 transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1">
                                更新
                              </button>
                            </form>

                            {/* 退出時刻の編集フォーム */}
                            <form action={updateScheduleTime} className="flex items-center justify-between gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <input type="hidden" name="fieldName" value="clock_out" />
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase w-10">退出</span>
                                <input
                                  type="time"
                                  name="timeValue"
                                  defaultValue={extractTime(schedule.clock_out)}
                                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                />
                              </div>
                              <button type="submit" className="text-xs font-medium bg-teal-600 hover:bg-teal-500 transition-colors px-3 py-1.5 rounded-lg">
                                更新
                              </button>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 右カラム: データ管理・出力系 */}
              <div className="space-y-8">
                {/* 新規予定追加プレースホルダー */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-slate-300">
                    来所予定の登録・キャンセル
                  </h2>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center border-dashed">
                    <p className="text-slate-400 text-sm">（※開発中）指定した日付の児童予定を追加またはキャンセルする機能がここに追加されます。</p>
                  </div>
                </div>

                {/* 児童名簿管理プレースホルダーの置き換え */}
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
                        <details key={child.id} className="group bg-black/20 border border-white/5 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                          <summary className="flex items-center justify-between cursor-pointer p-3 font-medium text-sm text-slate-200 hover:bg-white/5 transition-colors">
                            {child.last_name} {child.first_name}
                            <span className="text-[10px] text-slate-500 bg-black/40 px-2 py-0.5 rounded">編集 v</span>
                          </summary>
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
                              <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold py-1.5 rounded-lg transition-colors mt-2">
                                更新
                              </button>
                            </form>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CSV出力 -> Excel出力への置き換え */}
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
                        全児童の記録を出力 (.xlsx)
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
