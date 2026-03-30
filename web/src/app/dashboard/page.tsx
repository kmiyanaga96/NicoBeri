import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout, markAsArrived, markAsDeparted, toggleTransport, updateChildNotes } from './actions'
import { Clock, CheckCircle2, User, AlertCircle, CalendarDays, Settings, CarTaxiFront, Save } from 'lucide-react'

// 時刻フォーマット用のヘルパー関数
function formatTime(isoString: string | null) {
  if (!isoString) return '--:--'
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const resolvedParams = await searchParams
  const isTomorrow = resolvedParams?.day === 'tomorrow'
  const supabase = await createClient()

  // セッションの確認
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }

  // スタッフプロフィールの取得（is_activeとroleの確認）
  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  // アカウントが凍結されている場合は強制的にリダイレクト
  if (staffProfile && staffProfile.is_active === false) {
    redirect('/?error=inactive')
  }

  const isAdmin = staffProfile?.role === 'admin'

  // 対象の日付文字列（YYYY-MM-DD）を算出
  const targetDate = new Date()
  if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1)
  const targetDateStr = targetDate.toISOString().split('T')[0]
  const displayDateStr = targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  // Supabaseから本日のスケジュールと児童詳細情報をJOINして取得
  const { data: schedules, error } = await supabase
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
        medical_notes,
        notes
      )
    `)
    .eq('date', targetDateStr)
    .order('created_at', { ascending: true })

  // 型安全と存在チェックのためのキャスト
  const typedSchedules = (schedules as any[]) || []

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
              {displayDateStr}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/50 dark:bg-black/50 px-4 py-2 rounded-2xl border border-white/20 shadow-sm backdrop-blur-sm">
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-bold transition-colors mr-2">
                <Settings className="w-4 h-4" />
                管理者パネル
              </Link>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
              <User className="w-4 h-4" />
              <span className="truncate max-w-[120px]" title={user.email?.split('@')[0]}>{user.email?.split('@')[0]}</span>
            </div>
            <form action={logout}>
              <button type="submit" className="text-sm px-4 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors">
                ログアウト
              </button>
            </form>
          </div>
        </header>

        {/* Error Info Card */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-2xl flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <p className="text-sm">スケジュールの取得に失敗しました: {error.message}</p>
          </div>
        )}

        {/* Date Tabs (今日 / 明日) */}
        <div className="flex bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl w-fit mb-6 shadow-inner border border-black/5 dark:border-white/5">
          <Link
            href="/dashboard"
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all duration-300 ${!isTomorrow ? 'bg-primary text-primary-foreground shadow-sm scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            今日
          </Link>
          <Link
            href="/dashboard?day=tomorrow"
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all duration-300 ${isTomorrow ? 'bg-primary text-primary-foreground shadow-sm scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            明日
          </Link>
        </div>

        {/* Schedule List */}
        <div className="space-y-4 pb-12">
          {typedSchedules.length === 0 && !error ? (
            <div className="glass p-12 rounded-3xl text-center flex flex-col items-center justify-center text-muted-foreground border-dashed border-2 border-border/50">
              <CalendarDays className="w-12 h-12 mb-4 opacity-50" />
              <p>来所予定は登録されていません。</p>
            </div>
          ) : (
            typedSchedules.map((schedule) => {
              const child = schedule.children;
              const isArrived = !!schedule.clock_in; // 到着打刻済みかどうか
              const isDeparted = !!schedule.clock_out; // 退出打刻済みかどうか
              const isCancelled = schedule.status === 'cancelled';

              return (
                <div
                  key={schedule.id}
                  className={`glass p-5 md:p-6 rounded-3xl border border-white/20 shadow-lg transition-all duration-300 hover:shadow-xl ${isDeparted || isCancelled ? 'opacity-70 bg-secondary/10' : ''}`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0">

                    {/* Child Info */}
                    <div className="flex items-start gap-4">
                      {/* Avatar Placeholder */}
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
                        <div className="mt-2 w-full max-w-md">
                          <details className="group [&_summary::-webkit-details-marker]:hidden">
                            <summary className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-100/50 dark:bg-orange-950/30 px-3 py-1.5 rounded-lg border border-orange-200/50 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span className="leading-snug truncate max-w-[200px]">{child.notes || child.medical_notes || 'スタッフ共有事項を追加...'}</span>
                              <span className="text-[10px] ml-auto uppercase tracking-wider opacity-60">Edit</span>
                            </summary>
                            <div className="mt-2 p-3 bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-orange-900/30 rounded-xl shadow-sm animate-in slide-in-from-top-1">
                              <form action={updateChildNotes} className="flex flex-col gap-2">
                                <input type="hidden" name="childId" value={child.id} />
                                <textarea
                                  name="notes"
                                  defaultValue={child.notes || child.medical_notes || ''}
                                  placeholder="スタッフ共有事項"
                                  className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500 min-h-[60px]"
                                />
                                <button type="submit" className="self-end flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition-colors">
                                  <Save className="w-3.5 h-3.5" />
                                  保存
                                </button>
                              </form>
                            </div>
                          </details>
                        </div>
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
                              <div className="w-[44px] h-[44px]"></div> // プレースホルダー（レイアウト調整）
                            )}
                            {isDeparted && <CheckCircle2 className="w-7 h-7 text-green-500 filter drop-shadow-sm" />}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  )
}
