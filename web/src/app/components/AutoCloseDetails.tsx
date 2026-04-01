'use client'

import { useRef } from 'react'

/**
 * フォーム送信後に自動で <details> を閉じるラッパーコンポーネント。
 * サーバーアクション完了後の revalidatePath でページが再描画されても、
 * ブラウザが <details> の open 状態を保持する問題を回避する。
 */
export function AutoCloseDetails({
  children,
  className,
  summaryContent,
  summaryClassName,
}: {
  children: React.ReactNode
  className?: string
  summaryContent: React.ReactNode
  summaryClassName?: string
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  const handleSubmit = () => {
    // フォーム送信後の再レンダリングで閉じるように、少し遅延させてから閉じる
    setTimeout(() => {
      if (detailsRef.current) {
        detailsRef.current.open = false
      }
    }, 100)
  }

  return (
    <details
      ref={detailsRef}
      className={className}
      onSubmit={handleSubmit}
    >
      <summary className={summaryClassName}>
        {summaryContent}
      </summary>
      {children}
    </details>
  )
}
