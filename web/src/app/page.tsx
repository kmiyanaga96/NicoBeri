'use client';

import { useActionState } from 'react';
import { login } from './login/actions';

export default function Home() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
      {/* Background Decorative Blob */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-slow pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse-slow pointer-events-none animation-delay-2000"></div>

      {/* Main Glassmorphic Card */}
      <div className="glass w-full max-w-md p-8 rounded-3xl relative z-10 animate-slide-up">
        {/* App Logo / Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4 transform hover:scale-105 transition-transform duration-300">
            <span className="text-white text-2xl font-bold">N</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">NicoBeri</h1>
          <p className="text-muted-foreground text-sm mt-1">ニコベリ基幹システム</p>
        </div>

        {/* Login Form */}
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-2 rounded-lg text-center animate-slide-up">
              {state.error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground ml-1">スタッフID</label>
            <input
              id="staff_id"
              name="staff_id"
              type="text"
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-border bg-white/50 dark:bg-black/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
              placeholder="ID"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground ml-1">パスワード</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl border border-border bg-white/50 dark:bg-black/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
              placeholder="••••••••"
              disabled={isPending}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-6 bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isPending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
