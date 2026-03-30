import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, CalendarClock, ArrowLeft, ShieldCheck, Power, AlertTriangle, Clock } from 'lucide-react'
import { toggleStaffActive, updateScheduleTime } from './actions'

function extractTime(isoString: string | null) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const activeTab = resolvedParams?.tab === 'staff' ? 'staff' : 'office'
  const targetDateStr = typeof resolvedParams?.date === 'string' ? resolvedParams.date : new Date().toISOString().split('T')[0]

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      {/* Decorative */}
      <div className="fixed top-20 right-1/4 w-[400px] h-[400px] bg-red-500/10 rounded-full mix-blend-screen filter blur-[100px] animate-pulse-slow pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-indigo-400">
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
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === 'office' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <CalendarClock className="w-4 h-4" />
            事務処理
          </Link>
          <Link 
            href="/admin?tab=staff" 
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${activeTab === 'staff' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
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
                <Users className="w-5 h-5 text-blue-400" />
                スタッフ権限・アカウント凍結管理
              </h2>
              <div className="space-y-3">
                {typedStaffList.map((staff) => (
                  <div key={staff.id} className={`p-4 rounded-2xl border transition-all ${staff.is_active ? 'bg-white/5 border-white/10' : 'bg-red-950/30 border-red-500/30 opacity-70'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{staff.name || '名称未設定'}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${staff.role === 'admin' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'}`}>
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
                      <CalendarClock className="w-5 h-5 text-indigo-400" />
                      打刻・スケジュール管理
                    </h2>
                    {/* 日付選択 */}
                    <form className="flex items-center gap-2" method="GET" action="/admin">
                      <input type="hidden" name="tab" value="office" />
                      <input 
                        type="date" 
                        name="date" 
                        defaultValue={targetDateStr}
                        className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                        onChange={(e) => e.target.form?.submit()}
                      />
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
                            <span className={`text-xs px-2 py-1 rounded font-bold ${schedule.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-300'}`}>
                              {schedule.status === 'cancelled' ? 'キャンセル済' : schedule.status}
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
                                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <button type="submit" className="text-xs font-medium bg-indigo-600 hover:bg-indigo-500 transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1">
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
                                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                />
                              </div>
                              <button type="submit" className="text-xs font-medium bg-indigo-600 hover:bg-indigo-500 transition-colors px-3 py-1.5 rounded-lg">
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

                {/* 児童名簿管理プレースホルダー */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-slate-300">
                    児童名簿編集
                  </h2>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center border-dashed">
                    <p className="text-slate-400 text-sm">（※開発中）新規児童の登録や、アレルギー等の配慮事項を編集する機能がここに追加されます。</p>
                  </div>
                </div>

                {/* CSV出力プレースホルダー */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-emerald-400">
                    データ出力・エクスポート
                  </h2>
                  <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-center">
                    <p className="text-emerald-400/80 text-sm mb-4">フォーマット共有待ち</p>
                    <div className="flex flex-col gap-3">
                      <button disabled className="bg-white/5 text-slate-500 px-4 py-2 rounded-xl cursor-not-allowed text-sm">
                        実績記録表を出力 (.csv)
                      </button>
                      <button disabled className="bg-white/5 text-slate-500 px-4 py-2 rounded-xl cursor-not-allowed text-sm">
                        月間スケジュール表を出力 (.csv)
                      </button>
                    </div>
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
