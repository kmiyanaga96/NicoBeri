import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, ArrowLeft, ShieldCheck, Power, AlertTriangle, UserPlus, KeyRound, Trash2, CalendarClock } from 'lucide-react'
import { toggleStaffActive, createNewStaffAccount, updateStaffAccount, deleteStaffAccount } from './actions'
import { AutoCloseDetails } from '@/app/components/AutoCloseDetails'
import { ConfirmButton } from '@/app/components/ConfirmButton'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<any>
}) {
  const resolvedParams = await searchParams
  const activeTab = resolvedParams?.tab || 'staff' // 'staff' | 'accounting'
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

  const typedStaffList = (staffList as any[]) || []

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
            <p className="text-slate-400 text-sm">スタッフ管理と事務を行います。</p>
          </div>
          <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            ダッシュボードに戻る
          </Link>
        </header>

        {/* Tabs */}
        <div className="flex bg-black/20 p-1.5 rounded-2xl w-fit mb-8 shadow-inner border border-white/5">
          <Link
            href="/admin?tab=staff"
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-1.5 ${activeTab === 'staff' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm scale-105 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Users className="w-4 h-4" />
            スタッフ管理
          </Link>
          <Link
            href="/admin?tab=accounting"
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-1.5 ${activeTab === 'accounting' ? 'bg-cyan-500/20 text-cyan-300 shadow-sm scale-105 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <span className="font-serif">¥</span>
            会計
          </Link>
        </div>

        {/* Unified Content */}
        <div className="w-full space-y-12">
          {activeTab === 'staff' && (
            <>
              {/* スタッフ管理パネル */}
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
                <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                  <Users className="w-5 h-5 text-cyan-400" />
                  スタッフ管理
                </h2>

            <div className="space-y-3">
              {typedStaffList.map((staff) => (
                <AutoCloseDetails
                  key={staff.id}
                  className={`group rounded-2xl border transition-all ${staff.is_active ? 'bg-white/5 border-white/10' : 'bg-red-950/30 border-red-500/30 opacity-80'} overflow-hidden [&_summary::-webkit-details-marker]:hidden`}
                  summaryClassName={`flex justify-between items-center p-4 cursor-pointer hover:bg-white/5 transition-colors`}
                  summaryContent={
                    <div className="flex-1 flex justify-between items-center pr-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{staff.name || '名称未設定'}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${staff.role === 'admin' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700 text-slate-300'}`}>
                            {staff.role}
                          </span>
                        </div>
                        {staff.is_active ? null : (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />凍結済み
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 bg-black/40 px-2 py-1 rounded">詳細・編集 v</span>
                    </div>
                  }
                >
                  <div className="p-4 pt-2 border-t border-white/10 bg-black/20">
                    <form action={updateStaffAccount} className="space-y-4">
                      <input type="hidden" name="user_id" value={staff.id} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">氏名</label>
                          <input type="text" name="name" defaultValue={staff.name} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            新しいスタッフID <span className="opacity-70 text-[10px]">(※変更する場合のみ)</span>
                          </label>
                          <input type="text" name="staff_id" placeholder="新しいID" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">新しいパスワード (変更する場合のみ)</label>
                          <input type="password" name="password" placeholder="••••••••" minLength={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">権限</label>
                          <select name="role" defaultValue={staff.role} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                            <option value="staff">一般スタッフ (staff)</option>
                            <option value="admin">管理者 (admin)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-1.5 px-6 rounded-lg transition-colors text-sm shadow-md">
                          変更を保存
                        </button>
                      </div>
                    </form>

                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                      {/* 自分自身は凍結・削除不可 */}
                      {staff.id !== user.id && staff.role !== 'admin' && (
                        <form action={toggleStaffActive.bind(null, staff.id, staff.is_active)}>
                          <button type="submit" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-md text-xs font-bold ${staff.is_active ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'}`}>
                            <Power className="w-3.5 h-3.5" />
                            {staff.is_active ? "アカウントを凍結" : "凍結を解除"}
                          </button>
                        </form>
                      )}
                      {staff.id !== user.id && (
                        <form action={deleteStaffAccount}>
                          <input type="hidden" name="user_id" value={staff.id} />
                          <ConfirmButton
                            message={`${staff.name} のアカウントを完全に削除しますか？\nこの操作は取り消せません。`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shadow-md text-xs font-bold bg-transparent border border-red-500/30 text-red-500 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            アカウントの削除
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                </AutoCloseDetails>
              ))}
            </div>

            {/* 追加: アカウント作成UI */}
            <div className="mt-8 pt-8">
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
                      <input type="text" name="staff_id" required placeholder="例: amasuda" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
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
            </div>
          </section>

          {/* Excel出力 */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mt-12 border-t border-white/10 pt-10">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-white/10 pb-3 text-emerald-400">
                <CalendarClock className="w-5 h-5 text-emerald-400" />
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
          </section>
            </>
          )}

          {activeTab === 'accounting' && (
            <div className="bg-white/5 border border-white/10 p-12 rounded-3xl text-center flex flex-col items-center justify-center text-slate-400">
              <div className="text-4xl mb-4 font-bold font-serif opacity-50">¥</div>
              <p>将来的にここで帳簿管理などの会計機能が利用可能になります。</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
