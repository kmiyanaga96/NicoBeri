-- ==========================================
-- 05_add_children_details.sql
-- 実績記録表・スケジュール表の自動生成、および
-- 管理者・スタッフからの備考（アレルギー等）の編集用に
-- カラムとポリシーを追加します。
-- ==========================================

-- 1. `children` テーブルへの詳細情報の追加
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS notes TEXT, -- 備考欄（アレルギー、服薬、注意点など。全スタッフ閲覧・編集可）
ADD COLUMN IF NOT EXISTS sei TEXT, -- セイ（フリガナ）
ADD COLUMN IF NOT EXISTS mei TEXT, -- メイ（フリガナ）
ADD COLUMN IF NOT EXISTS gender TEXT, -- 性別
ADD COLUMN IF NOT EXISTS recipient_number TEXT, -- 受給者証番号
ADD COLUMN IF NOT EXISTS disability_level INTEGER; -- 障がい児/者支援区分 (1~3など)

-- 2. `daily_schedules` テーブルへの送迎記録フラグの追加
ALTER TABLE public.daily_schedules
ADD COLUMN IF NOT EXISTS pickup BOOLEAN DEFAULT false, -- 迎えを利用したか
ADD COLUMN IF NOT EXISTS dropoff BOOLEAN DEFAULT false; -- 送りを利用したか

-- 3. RLS（行レベルセキュリティ）のポリシー追加・更新
-- 備考欄を含め、adminとstaffのどちらも「参照」「更新」が可能である必要がある
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.children;

CREATE POLICY "Enable update for all authenticated users" ON public.children
FOR UPDATE TO authenticated
USING (true);

-- （※daily_schedulesのUPDATE権限は既存のポリシーで既に許可されている想定です）
