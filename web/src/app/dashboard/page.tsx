import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout, markAsArrived, markAsDeparted, toggleTransport, updateChildNotes, updateScheduleTime, updateScheduleTransport, upsertChild, deleteChild, addSchedule, removeSchedule, upsertFacility, deleteFacility } from './actions'
import { Clock, AlarmClock, CheckCircle2, User, AlertCircle, CalendarDays, Settings, CarTaxiFront, Save, History, Plus, X, Trash2, Users, MapPin, Building } from 'lucide-react'
import { AutoCloseDetails } from '@/app/components/AutoCloseDetails'
import { ConfirmButton } from '@/app/components/ConfirmButton'

// 時刻フォーマット用のヘルパー関数
function formatTime(isoString: string | null, fallback = '--:--') {
  if (!isoString) return fallback
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(date)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const resolvedParams = await searchParams
  const activeTab = resolvedParams?.tab || 'schedule' // 'schedule' | 'history' | 'children'
  const subTab = resolvedParams?.sub || 'today' // 'today' | 'tomorrow' | 'register'
  const supabase = await createClient()

  // セッションの確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }

  // スタッフプロフィールの取得（is_activeとroleの確認）
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('name, role, is_active')
    .eq('id', user.id)
    .single()

  // アカウントが凍結されている場合は強制的にリダイレクト
  if (staffProfile && staffProfile.is_active === false) {
    redirect('/?error=inactive')
  }

  const isAdmin = staffProfile?.role === 'admin'

  // 対象の日付文字列（YYYY-MM-DD）を算出
  const today = new Date()
  const targetDate = new Date()
  if (activeTab === 'schedule' && subTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1)
  const targetDateStr = targetDate.toISOString().split('T')[0]
  const displayDateStr = targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  // --- 今日/明日のスケジュールデータ ---
  let typedSchedules: any[] = []
  if (activeTab === 'schedule' && (subTab === 'today' || subTab === 'tomorrow')) {
    const { data: schedules } = await supabase
      .from('daily_schedules')
      .select(`
        id,
        status,
        clock_in,
        clock_out,
        pickup,
        dropoff,
        children (
          id,
          first_name,
          last_name,
          sei,
          medical_notes,
          notes,
          gender,
          recipient_number,
          disability_level,
          home_address,
          facilities ( name, address )
        )
      `)
      .eq('date', targetDateStr)
      .order('created_at', { ascending: true })

    typedSchedules = ((schedules as any[]) || []).sort((a, b) => {
      const seiA = a.children?.sei || a.children?.last_name || ''
      const seiB = b.children?.sei || b.children?.last_name || ''
      return seiA.localeCompare(seiB, 'ja')
    })
  }

  // --- 児童リスト（スケジュール登録用＆児童名簿用） ---
  let typedChildren: any[] = []
  let typedFacilities: any[] = []
  if (activeTab === 'children' || (activeTab === 'schedule' && subTab === 'register')) {
    const { data: facilitiesData } = await supabase
      .from('facilities')
      .select('*')
      .order('name', { ascending: true })
    typedFacilities = (facilitiesData as any[]) || []

    const { data: childrenData } = await supabase
      .from('children')
      .select('*, facilities(*)')
      .order('sei', { ascending: true })
    typedChildren = (childrenData as any[]) || []
  }

  // --- 予定登録用データ (今後30日間) ---
  const dateSuggestions: { value: string; label: string }[] = []
  const schedulesByDate: Record<string, any[]> = {}
  if (activeTab === 'schedule' && subTab === 'register') {
    const todayDate = new Date()
    for (let i = 0; i <= 30; i++) {
      const d = new Date(todayDate)
      d.setDate(d.getDate() + i)
      const val = d.toISOString().split('T')[0]
      const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
      const label = `${d.getMonth() + 1}/${d.getDate()} (${dow})`
      dateSuggestions.push({ value: val, label })
    }

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

    for (const s of (existingSchedules as any[]) || []) {
      if (!schedulesByDate[s.date]) schedulesByDate[s.date] = []
      schedulesByDate[s.date].push(s)
    }
  }

  // --- 月次履歴データ（当月1日〜前日） ---
  let historyByDate: Record<string, any[]> = {}
  if (activeTab === 'history') {
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    if (yesterdayStr >= monthStart) {
      const { data: historyData } = await supabase
        .from('daily_schedules')
        .select(`
          id,
          date,
          status,
          clock_in,
          clock_out,
          pickup,
          dropoff,
          children ( id, first_name, last_name, sei )
        `)
        .gte('date', monthStart)
        .lte('date', yesterdayStr)
        .order('date', { ascending: false })

      // 日付ごとにグルーピング + フリガナソート
      for (const s of (historyData as any[]) || []) {
        if (!historyByDate[s.date]) historyByDate[s.date] = []
        historyByDate[s.date].push(s)
      }
      // 各日付内をフリガナソート
      for (const date of Object.keys(historyByDate)) {
        historyByDate[date].sort((a: any, b: any) => {
          const seiA = a.children?.sei || a.children?.last_name || ''
          const seiB = b.children?.sei || b.children?.last_name || ''
          return seiA.localeCompare(seiB, 'ja')
        })
      }
    }
  }

  // 月名（履歴タブ用）
  const monthLabel = `${today.getFullYear()}年${today.getMonth() + 1}月`

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background text-foreground p-4 md:p-8">
      {/* Background Decorative Blob */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse-slow pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10 animate-slide-up">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent mb-2">
              ダッシュボード
            </h1>
            <p className="flex items-center text-muted-foreground text-sm font-medium">
              <CalendarDays className="w-4 h-4 mr-2" />
              {activeTab === 'history' ? `${monthLabel}の打刻履歴` : activeTab === 'children' ? '児童名簿・情報管理' : displayDateStr}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-4 bg-white/50 dark:bg-black/50 px-3 md:px-4 py-2 rounded-2xl border border-white/20 shadow-sm backdrop-blur-sm mt-2 md:mt-0 w-full md:w-auto overflow-x-auto no-scrollbar">
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-primary hover:text-primary/80 font-bold transition-colors whitespace-nowrap">
                <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
                管理者パネル
              </Link>
            )}
            <button className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 py-1 px-2 rounded-lg transition-colors cursor-pointer group whitespace-nowrap" title="勤務予定・給与情報 (準備中)">
              <User className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:text-primary transition-colors" />
              <span className="truncate max-w-[100px] md:max-w-[120px] font-bold group-hover:text-foreground transition-colors">{staffProfile?.name}</span>
            </button>
            <form action={logout} className="ml-auto md:ml-0">
              <button type="submit" className="text-xs md:text-sm px-3 md:px-4 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors whitespace-nowrap">
                ログアウト
              </button>
            </form>
          </div>
        </header>

        {/* Tabs (予定 / 月次履歴 / 児童) */}
        <div className="flex overflow-x-auto no-scrollbar bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl w-full max-w-full md:w-fit mb-4 shadow-inner border border-black/5 dark:border-white/5">
          <Link
            href="/dashboard?tab=schedule&sub=today"
            className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 flex flex-shrink-0 items-center gap-1.5 ${activeTab === 'schedule' ? 'bg-primary text-primary-foreground shadow-sm scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            予定
          </Link>
          <Link
            href="/dashboard?tab=history"
            className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 flex flex-shrink-0 items-center gap-1.5 ${activeTab === 'history' ? 'bg-primary text-primary-foreground shadow-sm scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <History className="w-3.5 h-3.5" />
            月次履歴
          </Link>
          <Link
            href="/dashboard?tab=children"
            className={`px-4 md:px-6 py-2 rounded-xl font-bold text-xs md:text-sm transition-all duration-300 flex flex-shrink-0 items-center gap-1.5 ${activeTab === 'children' ? 'bg-primary text-primary-foreground shadow-sm scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            <Users className="w-3.5 h-3.5" />
            児童・住所
          </Link>
        </div>

        {/* Sub Tabs for Schedule */}
        {activeTab === 'schedule' && (
          <div className="flex gap-2 mb-6 ml-2">
            <Link href="/dashboard?tab=schedule&sub=today" className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${subTab === 'today' ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary text-foreground'}`}>今日</Link>
            <Link href="/dashboard?tab=schedule&sub=tomorrow" className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${subTab === 'tomorrow' ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary text-foreground'}`}>明日</Link>
            <Link href="/dashboard?tab=schedule&sub=register" className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${subTab === 'register' ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary text-foreground'}`}>予定登録・キャンセル</Link>
          </div>
        )}

        {/* ===== SCHEDULE (Today / Tomorrow) ===== */}
        {activeTab === 'schedule' && (subTab === 'today' || subTab === 'tomorrow') && (
          <div className="space-y-4 pb-12">
            {typedSchedules.length === 0 ? (
              <div className="glass p-12 rounded-3xl text-center flex flex-col items-center justify-center text-muted-foreground border-dashed border-2 border-border/50">
                <CalendarDays className="w-12 h-12 mb-4 opacity-50" />
                <p>来所予定は登録されていません。</p>
              </div>
            ) : (
              typedSchedules.map((schedule) => {
                const child = schedule.children;
                const isArrived = !!schedule.clock_in;
                const isDeparted = !!schedule.clock_out;
                const isCancelled = schedule.status === 'cancelled';

                return (
                  <div
                    key={schedule.id}
                    className={`glass p-5 md:p-6 rounded-3xl border border-white/20 shadow-lg transition-all duration-300 hover:shadow-xl ${isDeparted || isCancelled ? 'opacity-70 bg-secondary/10' : ''}`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0">

                      {/* Child Info */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner flex-shrink-0 ${isDeparted || isCancelled ? 'bg-secondary text-secondary-foreground' : isArrived ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                          {child.last_name[0]}{child.first_name[0]}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold flex items-center gap-2">
                            {child.last_name} {child.first_name}
                            {isCancelled && (
                              <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium border border-red-200 dark:border-red-800">
                                キャンセル
                              </span>
                            )}
                          </h2>
                          {/* スタッフ共有事項の表示と編集 */}
                          {child.notes && (
                            <div className="mt-2 w-full max-w-md">
                              <AutoCloseDetails
                                className="group [&_summary::-webkit-details-marker]:hidden"
                                summaryClassName="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-950/30 px-3 py-1.5 rounded-lg border border-orange-200/50 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                                summaryContent={<>
                                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                  <span className="leading-snug truncate max-w-[200px]">{child.notes}</span>
                                  <span className="text-[10px] ml-auto uppercase tracking-wider opacity-60">Edit</span>
                                </>}
                              >
                                <div className="mt-2 p-3 bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-orange-900/30 rounded-xl shadow-sm animate-in slide-in-from-top-1">
                                  <form action={updateChildNotes} className="flex flex-col gap-2">
                                    <input type="hidden" name="childId" value={child.id} />
                                    <textarea
                                      name="notes"
                                      defaultValue={child.notes || ''}
                                      placeholder="スタッフ共有事項"
                                      className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500 min-h-[60px]"
                                    />
                                    <button type="submit" className="self-end flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors">
                                      <Save className="w-3.5 h-3.5" />
                                      保存
                                    </button>
                                  </form>
                                </div>
                              </AutoCloseDetails>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Controls (打刻・送迎ボタン) */}
                      {!isCancelled && (
                        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                          {/* 送迎トグル */}
                          <div className="flex gap-2">
                            <form action={toggleTransport.bind(null, schedule.id, 'pickup', schedule.pickup)}>
                              <button type="submit" className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${schedule.pickup ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                <CarTaxiFront className={`w-4 h-4 ${schedule.pickup ? 'text-cyan-500' : 'opacity-50'}`} />
                                迎え
                              </button>
                            </form>
                            <form action={toggleTransport.bind(null, schedule.id, 'dropoff', schedule.dropoff)}>
                              <button type="submit" className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${schedule.dropoff ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                <CarTaxiFront className={`w-4 h-4 ${schedule.dropoff ? 'text-indigo-500' : 'opacity-50'}`} />
                                送り
                              </button>
                            </form>
                          </div>

                          {/* 時間打刻グループ */}
                          <div className="flex flex-row items-center bg-black/5 dark:bg-white/5 p-2 rounded-2xl w-full md:w-auto">
                            {/* 到着 */}
                            <div className="flex-1 md:flex-initial flex items-center justify-between md:justify-start gap-4 px-3 py-1 border-r border-border/50">
                              <div className="flex flex-col">
                                <span className="text-[11px] text-muted-foreground font-semibold mb-0.5 tracking-wider uppercase">到着</span>
                                <span className="font-mono text-xl md:text-2xl font-bold tracking-tight">{formatTime(schedule.clock_in)}</span>
                              </div>
                              {!isArrived && (
                                <form action={markAsArrived.bind(null, schedule.id)}>
                                  <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground p-3 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95">
                                    <Clock className="w-5 h-5" />
                                  </button>
                                </form>
                              )}
                              {isArrived && <CheckCircle2 className="w-7 h-7 text-green-500 filter drop-shadow-sm" />}
                            </div>

                            {/* 退出 */}
                            <div className="flex-1 md:flex-initial flex items-center justify-between md:justify-start gap-4 px-3 py-1">
                              <div className="flex flex-col">
                                <span className="text-[11px] text-muted-foreground font-semibold mb-0.5 tracking-wider uppercase">退出</span>
                                <span className="font-mono text-xl md:text-2xl font-bold tracking-tight">{formatTime(schedule.clock_out)}</span>
                              </div>
                              {isArrived && !isDeparted && (
                                <form action={markAsDeparted.bind(null, schedule.id)}>
                                  <button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground p-3 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95">
                                    <Clock className="w-5 h-5" />
                                  </button>
                                </form>
                              )}
                              {!isArrived && !isDeparted && (
                                <div className="w-[44px] h-[44px]"></div>
                              )}
                              {isDeparted && <CheckCircle2 className="w-7 h-7 text-green-500 filter drop-shadow-sm" />}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ==== ハイブリッド手動打刻修正 (スタッフ・管理者共通) ==== */}
                    <div className="mt-4 pt-4 border-t border-border/20 sm:col-span-2">
                      <details className="group [&_summary::-webkit-details-marker]:hidden relative">
                        <summary className="cursor-pointer text-[11px] font-bold bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-3 py-1.5 rounded-xl text-muted-foreground transition-colors flex items-center justify-center gap-1.5 w-fit ml-auto">
                          <AlarmClock className="w-4 h-4" /> 手動で修正・入力
                        </summary>
                        <div className="mt-3 p-4 bg-background border border-border/50 shadow-sm rounded-2xl flex flex-col gap-3">
                          <form action={updateScheduleTime} className="flex items-center gap-3">
                            <input type="hidden" name="scheduleId" value={schedule.id} />
                            <input type="hidden" name="fieldName" value="clock_in" />
                            <span className="text-xs font-semibold uppercase w-8">到着</span>
                            <input type="time" name="timeValue" defaultValue={formatTime(schedule.clock_in, '')} className="bg-black/5 dark:bg-white/5 border border-border/50 text-foreground rounded flex-1 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary outline-none" />
                            <button type="submit" className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors">変更を保存</button>
                          </form>
                          <form action={updateScheduleTime} className="flex items-center gap-3">
                            <input type="hidden" name="scheduleId" value={schedule.id} />
                            <input type="hidden" name="fieldName" value="clock_out" />
                            <span className="text-xs font-semibold uppercase w-8">退出</span>
                            <input type="time" name="timeValue" defaultValue={formatTime(schedule.clock_out, '')} className="bg-black/5 dark:bg-white/5 border border-border/50 text-foreground rounded flex-1 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary outline-none" />
                            <button type="submit" className="text-xs font-bold bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-lg transition-colors">変更を保存</button>
                          </form>
                          {/* データ削除は管理者のみ */}
                          {isAdmin && (
                            <div className="pt-3 mt-1 border-t border-border/20 flex justify-end">
                              <form action={removeSchedule}>
                                <input type="hidden" name="scheduleId" value={schedule.id} />
                                <button type="submit" className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 font-bold px-2 py-1">
                                  <Trash2 className="w-4 h-4" /> この予定を削除
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== 月次履歴 タブ ===== */}
        {activeTab === 'history' && (
          <div className="space-y-6 pb-12">
            {Object.keys(historyByDate).length === 0 ? (
              <div className="glass p-12 rounded-3xl text-center flex flex-col items-center justify-center text-muted-foreground border-dashed border-2 border-border/50">
                <History className="w-12 h-12 mb-4 opacity-50" />
                <p>当月の打刻履歴はまだありません。</p>
              </div>
            ) : (
              Object.entries(historyByDate)
                .sort(([a], [b]) => b.localeCompare(a)) // 新しい日付順
                .map(([dateStr, records]) => {
                  const d = new Date(dateStr + 'T00:00:00')
                  const dateLabel = d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })
                  const isSunday = d.getDay() === 0
                  const isSaturday = d.getDay() === 6

                  return (
                    <details key={dateStr} className="group glass rounded-2xl border border-white/10 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                      <summary className={`flex items-center justify-between cursor-pointer px-5 py-3.5 font-bold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isSunday ? 'text-red-400' : isSaturday ? 'text-blue-400' : 'text-foreground'}`}>
                        <span className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 opacity-60" />
                          {dateLabel}
                        </span>
                        <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded font-bold">{records.length}名</span>
                      </summary>
                      <div className="border-t border-white/5 dark:border-white/5 divide-y divide-white/5 dark:divide-white/5">
                        {records.map((schedule: any) => {
                          const child = schedule.children
                          if (!child) return null

                          return (
                            <div key={schedule.id} className="px-5 py-3 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                              {/* 児童名・ステータス */}
                              <div className="flex items-center gap-3 min-w-[180px]">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {child.last_name[0]}{child.first_name[0]}
                                </div>
                                <div>
                                  <span className="font-bold text-sm">{child.last_name} {child.first_name}</span>
                                  {schedule.status === 'cancelled' && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400">
                                      キャンセル
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 打刻・送迎の表示 / 修正 */}
                              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                                {isAdmin ? (
                                  <>
                                    <form action={updateScheduleTime} className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-xl">
                                      <input type="hidden" name="scheduleId" value={schedule.id} />
                                      <input type="hidden" name="fieldName" value="clock_in" />
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">到着</span>
                                      <input type="time" name="timeValue" defaultValue={formatTime(schedule.clock_in, '')} className="bg-transparent border border-border/50 text-foreground rounded-lg px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary w-[80px]" />
                                      <button type="submit" className="text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 px-1.5 py-0.5 rounded transition-colors">更新</button>
                                    </form>
                                    <form action={updateScheduleTime} className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-xl">
                                      <input type="hidden" name="scheduleId" value={schedule.id} />
                                      <input type="hidden" name="fieldName" value="clock_out" />
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">退出</span>
                                      <input type="time" name="timeValue" defaultValue={formatTime(schedule.clock_out, '')} className="bg-transparent border border-border/50 text-foreground rounded-lg px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary w-[80px]" />
                                      <button type="submit" className="text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 px-1.5 py-0.5 rounded transition-colors">更新</button>
                                    </form>
                                    <div className="flex gap-1">
                                      <form action={updateScheduleTransport}>
                                        <input type="hidden" name="scheduleId" value={schedule.id} />
                                        <input type="hidden" name="field" value="pickup" />
                                        <input type="hidden" name="currentValue" value={schedule.pickup ? 'true' : 'false'} />
                                        <button type="submit" className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${schedule.pickup ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                          <CarTaxiFront className={`w-3 h-3 ${schedule.pickup ? 'text-cyan-500' : 'opacity-50'}`} />
                                          迎え
                                        </button>
                                      </form>
                                      <form action={updateScheduleTransport}>
                                        <input type="hidden" name="scheduleId" value={schedule.id} />
                                        <input type="hidden" name="field" value="dropoff" />
                                        <input type="hidden" name="currentValue" value={schedule.dropoff ? 'true' : 'false'} />
                                        <button type="submit" className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${schedule.dropoff ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                          <CarTaxiFront className={`w-3 h-3 ${schedule.dropoff ? 'text-indigo-500' : 'opacity-50'}`} />
                                          送り
                                        </button>
                                      </form>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-xl">
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">到着</span>
                                      <span className="font-mono text-xs font-bold">{formatTime(schedule.clock_in)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-xl">
                                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">退出</span>
                                      <span className="font-mono text-xs font-bold">{formatTime(schedule.clock_out)}</span>
                                    </div>
                                    {(schedule.pickup || schedule.dropoff) && (
                                      <div className="flex gap-1">
                                        {schedule.pickup && (
                                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                                            <CarTaxiFront className="w-3 h-3 text-cyan-500" />
                                            迎え
                                          </span>
                                        )}
                                        {schedule.dropoff && (
                                          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                            <CarTaxiFront className="w-3 h-3 text-indigo-500" />
                                            送り
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )
                })
            )}
          </div>
        )}

        {/* ===== 予定登録・キャンセル ===== */}
        {activeTab === 'schedule' && subTab === 'register' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl pb-12">
            {/* 予定追加フォーム */}
            <div className="glass border border-white/20 dark:border-white/10 rounded-3xl p-6">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <CalendarDays className="w-5 h-5 text-primary" />
                新規来所予定の追加
              </h2>
              <form action={addSchedule} className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-muted-foreground mb-1.5 font-bold uppercase">児童</label>
                  <select name="childId" required className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow">
                    <option value="">選択</option>
                    {typedChildren.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-muted-foreground mb-1.5 font-bold uppercase">日付</label>
                  <select name="date" required className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow">
                    {dateSuggestions.map(ds => (
                      <option key={ds.value} value={ds.value}>{ds.label}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-[42px] px-6 rounded-xl transition-all shadow-md active:scale-95">
                  <Plus className="w-4 h-4" />
                  予定を追加
                </button>
              </form>
            </div>

            {/* 予定一覧アコーディオン */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-2 ml-2">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
                確定済みの予定一覧 <span className="text-[11px] font-normal text-muted-foreground ml-2">(今後30日間)</span>
              </h2>
              {dateSuggestions.map(ds => {
                const dayRecords = schedulesByDate[ds.value] || []
                if (dayRecords.length === 0) return null
                const d = new Date(ds.value + 'T00:00:00')
                const isSun = d.getDay() === 0
                const isSat = d.getDay() === 6
                return (
                  <details key={ds.value} className="group glass rounded-2xl border border-white/10 dark:border-white/5 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                    <summary className={`flex items-center justify-between cursor-pointer px-5 py-3.5 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-foreground'}`}>
                      <span>{ds.label}</span>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{dayRecords.length}名</span>
                    </summary>
                    <div className="border-t border-border/20 divide-y divide-border/20">
                      {dayRecords.sort((a: any, b: any) => {
                        const sA = a.children?.sei || a.children?.last_name || ''
                        const sB = b.children?.sei || b.children?.last_name || ''
                        return sA.localeCompare(sB, 'ja')
                      }).map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between px-5 py-3 bg-black/5 dark:bg-black/20">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {s.children?.last_name?.[0]}{s.children?.first_name?.[0]}
                            </div>
                            <span className="text-sm font-bold">{s.children?.last_name} {s.children?.first_name}</span>
                          </div>
                          <form action={removeSchedule}>
                            <input type="hidden" name="scheduleId" value={s.id} />
                            <button type="submit" className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors" title="予定を削除">
                              <X className="w-3.5 h-3.5" />
                              キャンセル
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
        )}

        {/* ===== CHILDREN ===== */}
        {activeTab === 'children' && (
          <div className="space-y-6 pb-12 w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 施設・学校（預かり所）の登録 */}
            <div className="glass border border-white/20 dark:border-white/10 rounded-3xl p-6">
              <details className="group bg-primary/5 border border-primary/20 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-bold text-primary">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    預かり所・学校の登録
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-lg tracking-widest font-bold">登録 {typedFacilities.length}件</span>
                </summary>
                <div className="p-5 pt-0 border-t border-primary/10 bg-background/50 space-y-6 mt-4">
                  {/* 新規施設登録 */}
                  <form action={upsertFacility} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">施設・学校名</label>
                        <input type="text" name="name" required placeholder="例: 第一小学校" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">住所</label>
                        <input type="text" name="address" placeholder="例: 千葉県浦安市..." className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-2 rounded-xl transition-colors shadow-m text-sm">
                        追加する
                      </button>
                    </div>
                  </form>

                  {/* 登録済み施設一覧 */}
                  <div className="space-y-2 mt-6">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase mb-3 border-b border-border/50 pb-1">登録されている施設</h3>
                    {typedFacilities.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 bg-secondary/20 rounded-xl">まだ登録されていません。上のフォームから登録してください。</p>
                    ) : (
                      typedFacilities.map(f => (
                        <AutoCloseDetails key={f.id} className="group glass rounded-2xl border border-white/10 overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                          summaryClassName="px-4 py-3 flex items-center justify-between text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          summaryContent={<>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                                <Building className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="font-bold text-sm block">{f.name}</span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">{f.address || '住所未設定'}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-lg uppercase tracking-widest font-bold flex items-center gap-1.5">
                              <Settings className="w-3 h-3" />
                              詳細・編集
                            </span>
                          </>}
                        >
                          <div className="p-5 pt-4 border-t border-border/50 bg-background/50">
                            <form action={upsertFacility} className="flex flex-col gap-4">
                              <input type="hidden" name="id" value={f.id} />
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div className="md:col-span-2">
                                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">施設・学校名</label>
                                  <input type="text" name="name" defaultValue={f.name} required className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                                </div>
                                <div className="md:col-span-3">
                                  <label className="block text-[10px] text-muted-foreground uppercase mb-1">住所</label>
                                  <input type="text" name="address" defaultValue={f.address || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/50">
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-1.5 rounded-xl transition-colors shadow-m text-sm">
                                  変更を保存
                                </button>
                                <form action={deleteFacility}>
                                  <input type="hidden" name="facilityId" value={f.id} />
                                  <ConfirmButton
                                    message={`${f.name} を削除しますか？\n(既に紐づいている児童からは施設情報のみ解除されます)`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-md text-[10px] font-bold bg-transparent border border-red-500/30 text-red-500 hover:bg-red-500/20"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />この施設を削除
                                  </ConfirmButton>
                                </form>
                              </div>
                            </form>
                          </div>
                        </AutoCloseDetails>
                      ))
                    )}
                  </div>
                </div>
              </details>
            </div>

            <div className="glass border border-white/20 dark:border-white/10 rounded-3xl p-6">
              {/* 新規登録フォーム */}
              <details className="mb-6 group bg-primary/10 border border-primary/20 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer p-4 font-bold text-primary">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    新規児童の登録
                  </div>
                </summary>
                <div className="p-5 pt-0 border-t border-primary/10 bg-background/50">
                  <form action={upsertChild} className="flex flex-col gap-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">姓</label>
                        <input type="text" name="last_name" required className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">名</label>
                        <input type="text" name="first_name" required className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">セイ</label>
                        <input type="text" name="sei" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">メイ</label>
                        <input type="text" name="mei" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">生年月日</label>
                        <input type="date" name="birthdate" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">性別</label>
                        <select name="gender" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                          <option value="男">男</option>
                          <option value="女">女</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">受給者証番号</label>
                        <input type="text" name="recipient_number" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted-foreground uppercase mb-1">支援区分</label>
                        <input type="number" name="disability_level" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase mb-1">スタッフ共有事項</label>
                      <textarea name="notes" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" rows={2}></textarea>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground uppercase mb-1">非公開配慮事項 (管理者等のみ)</label>
                      <textarea name="medical_notes" className="w-full bg-background border border-border/50 text-sm px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-primary outline-none" rows={2}></textarea>
                    </div>
                    <button type="submit" className="self-start bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 px-8 rounded-xl transition-all shadow-md active:scale-95">
                      登録を完了する
                    </button>
                  </form>
                </div>
              </details>

              {/* 既存児童一覧 */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4 ml-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  登録済み児童名簿
                </h2>
                {typedChildren.map((child) => (
                  <AutoCloseDetails
                    key={child.id}
                    className="group bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/5 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                    summaryClassName="flex items-center justify-between cursor-pointer p-4 font-bold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    summaryContent={<>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {child.last_name[0]}{child.first_name[0]}
                        </div>
                        <div>
                          <span>{child.last_name} {child.first_name}</span>
                          <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">{child.sei} {child.mei}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-lg uppercase tracking-widest font-bold flex items-center gap-1.5">
                        <Settings className="w-3 h-3" />
                        詳細・編集
                      </span>
                    </>}
                  >
                    <div className="p-5 pt-4 border-t border-border/50 bg-background/50">
                      <form action={upsertChild} className="flex flex-col gap-4">
                        <input type="hidden" name="id" value={child.id} />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">姓</label>
                            <input type="text" name="last_name" defaultValue={child.last_name} required className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">名</label>
                            <input type="text" name="first_name" defaultValue={child.first_name} required className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">セイ</label>
                            <input type="text" name="sei" defaultValue={child.sei || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">メイ</label>
                            <input type="text" name="mei" defaultValue={child.mei || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">生年月日</label>
                            <input type="date" name="birthdate" defaultValue={child.birthdate || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">性別</label>
                            <select name="gender" defaultValue={child.gender || '男'} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none">
                              <option value="男">男</option>
                              <option value="女">女</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">受給者証番号</label>
                            <input type="text" name="recipient_number" defaultValue={child.recipient_number || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground uppercase mb-1">支援区分</label>
                            <input type="number" name="disability_level" defaultValue={child.disability_level || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground uppercase mb-1">スタッフ共有事項</label>
                          <textarea name="notes" defaultValue={child.notes || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" rows={2}></textarea>
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground uppercase mb-1">非公開配慮事項</label>
                          <textarea name="medical_notes" defaultValue={child.medical_notes || ''} className="w-full bg-background border border-border/50 text-sm px-4 py-2 rounded-xl focus:ring-2 focus:ring-primary outline-none" rows={2}></textarea>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <button type="submit" className="flex items-center gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary font-bold py-2 px-6 rounded-xl transition-all">
                            <Save className="w-4 h-4" />
                            変更を保存
                          </button>
                        </div>
                      </form>

                      <form action={deleteChild} className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                        <input type="hidden" name="childId" value={child.id} />
                        <ConfirmButton
                          message={`${child.last_name} ${child.first_name} を名簿から完全に削除しますか？\nこの操作は取り消せません。`}
                          className="flex items-center gap-1.5 text-red-500 hover:text-red-600 text-xs font-bold hover:bg-red-500/10 px-3 py-2 rounded-xl transition-colors border border-red-500/30 bg-transparent"
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
        )}

      </div>
    </div>
  )
}
