# データベース設計 (Supabase)

Supabase（PostgreSQLベース）上に構築する、初期MVP向けのテーブル設計の案です。要件である「児童のスケジュール管理」「打刻機能」「スマホからの閲覧制限（権限管理）」を満たすミニマムな構成としています。

## テーブル定義

### 1. `staff_profiles` (スタッフ情報)
Supabaseの標準認証システム（`auth.users`）と紐づかせ、各スタッフの権限を管理します。
- `id`: UUID (Primary Key, `auth.users.id` への外部キー)
- `name`: テキスト (氏名)
- `role`: テキスト (権限: `admin` または `staff`)
  - `admin` (管理者): PCから児童のカルテ等の全データにアクセス可能、月次実績ファイルの出力が可能。
  - `staff` (一般): スマホから当日のスケジュール閲覧・打刻機能のみ可能。
- `created_at`: タイムスタンプ

### 2. `children` (児童基本情報・カルテ)
- `id`: UUID (Primary Key)
- `first_name`: テキスト (名)
- `last_name`: テキスト (姓)
- `medical_notes`: テキスト (アレルギー・配慮事項など、機密情報)
- `active`: ブール値 (現在利用中かどうか)
- `created_at`: タイムスタンプ

> [!IMPORTANT]
> **セキュリティ（RLS）設計**  
> `medical_notes` などの機密情報を含むこのテーブルは、データベースの「行レベルセキュリティ（RLS: Row Level Security）」により保護します。
> APIリクエストを送ってきたユーザーの `auth.users.id` をもとに `staff_profiles.role` を即座に判定し、`role = 'admin'` のユーザーからのみデータ取得を許可します（それ以外のユーザーがアクセスしても自動的に弾かれます）。

### 3. `daily_schedules` (日別スケジュールと打刻記録)
当日の来所予定と、実際の到着・退館時間を管理します。これを月次で集計して実績記録表を作成します。
- `id`: UUID (Primary Key)
- `child_id`: UUID (`children.id`への外部キー)
- `date`: 日付 (例: 2026-03-28)
- `status`: テキスト (`scheduled`=予定, `present`=出席, `cancelled`=キャンセル)
- `clock_in`: タイムスタンプ (実際の到着時間。NULLの場合は未到着)
- `clock_out`: タイムスタンプ (実際の退出時間。NULLの場合は未退出)
- `updated_by`: UUID (`staff_profiles.id`への外部キー、最終打刻スタッフ)
- `created_at`: タイムスタンプ

> [!NOTE]
> **段階的なアクセス制御（RLS設定）**
> - **staff（一般）**: 当日および翌日分の「スケジュールの閲覧（SELECT）」と「到着・退出時間の打刻（UPDATE）」**のみ**許可されます。スケジュールの新規作成や削除、キャンセル処理はできません。
> - **admin（管理者）**: スケジュールの新規作成（INSERT）、編集、削除（DELETE）、および長期的なデータの閲覧がすべて可能です。
