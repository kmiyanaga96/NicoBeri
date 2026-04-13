import { CalendarDays, History, CarTaxiFront, Plus, Trash2 } from 'lucide-react'
import { updateScheduleTime, updateScheduleTransport, addSchedule, removeSchedule } from '../actions'
import { formatTime } from '@/utils/format'
import { ConfirmButton } from '@/app/components/ConfirmButton'
export function HistoryView({ historyByDate, typedChildren }: { historyByDate: Record<string, any[]>; typedChildren: any[] }) {
  return (
    <div className="space-y-6 pb-12">
      {Object.keys(historyByDate).length === 0 ? (
        <div className="glass p-12 rounded-3xl text-center flex flex-col items-center justify-center text-muted-foreground border-dashed border-2 border-border/50">
          <History className="w-12 h-12 mb-4 opacity-50" />
          <p>当月の打刻履歴はまだありません。</p>
        </div>
      ) : (
        Object.entries(historyByDate)
          .sort(([a], [b]) => b.localeCompare(a))
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
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {child.last_name[0]}{child.first_name[0]}
                          </div>
                          <div>
                            <span className="font-bold text-sm">{child.last_name} {child.first_name}</span>
                            {schedule.status === 'cancelled' && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400">キャンセル</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
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
                                <CarTaxiFront className={`w-3 h-3 ${schedule.pickup ? 'text-cyan-500' : 'opacity-50'}`} /> 迎え
                              </button>
                            </form>
                            <form action={updateScheduleTransport}>
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <input type="hidden" name="field" value="dropoff" />
                              <input type="hidden" name="currentValue" value={schedule.dropoff ? 'true' : 'false'} />
                              <button type="submit" className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${schedule.dropoff ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                <CarTaxiFront className={`w-3 h-3 ${schedule.dropoff ? 'text-indigo-500' : 'opacity-50'}`} /> 送り
                              </button>
                            </form>
                          </div>
                          <div className="pl-2 border-l border-white/10 ml-1">
                            <form action={removeSchedule}>
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <ConfirmButton
                                message={`${child.last_name} ${child.first_name} の予定・実績を削除しますか？\nこの操作は取り消せません。`}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all text-red-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30"
                              >
                                <Trash2 className="w-3 h-3" /> 消去
                              </ConfirmButton>
                            </form>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {/* 新規追加フォーム */}
                  <div className="px-5 py-3 bg-black/5 dark:bg-black/20 flex flex-col sm:flex-row items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground mr-2 whitespace-nowrap">予定を追加:</span>
                    <form action={addSchedule} className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <input type="hidden" name="date" value={dateStr} />
                      <select name="childId" required className="bg-background border border-border/50 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none">
                        <option value="">児童を選択...</option>
                        {typedChildren.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.last_name} {c.first_name}</option>
                        ))}
                      </select>
                      <button type="submit" className="flex items-center gap-1 bg-primary/20 text-primary hover:bg-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm whitespace-nowrap">
                        <Plus className="w-3.5 h-3.5" /> 追加
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            )
          })
      )}
    </div>
  )
}
