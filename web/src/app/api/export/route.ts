import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'

const DAY_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// ISO文字列を日本時間の HH:mm に変換
function formatJST(isoString: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(isoString))
}

// (実動時間 - 30分) を基準に1時間単位で切り上げ算定する
function calcBilledHours(clockInIso: string, clockOutIso: string): number {
  const inDate = new Date(clockInIso)
  const outDate = new Date(clockOutIso)
  const diffMs = outDate.getTime() - inDate.getTime()
  if (diffMs <= 0) return 0
  
  const diffMins = Math.floor(diffMs / 60000)
  const h = Math.floor(diffMins / 60)
  const m = diffMins % 60
  
  // 30分未満は切り捨て、30分以上は1時間に切り上げ
  return m >= 30 ? h + 1 : h
}

// 支援区分に応じた算定（基本報酬の例）
// 実際には細かい単位数計算があるが、ここでは時間のみを出力するか、特定列に単価を入れる。
// 今回のExcelテンプレートは時間（V列）を入れると数式で金額計算される仕組みと推測される。

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParams = searchParams.get('month') // "YYYY-MM"
    if (!monthParams) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // テンプレートの読み込み
    // App Routerからの相対パスとしてプロジェクトルートを探す
    const rootDir = process.cwd()
    const templatePath = path.join(rootDir, '..', 'docs', 'template.xlsx')
    
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: 'Template file not found at: ' + templatePath }, { status: 500 })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(templatePath)

    // 対象月のデータを取得
    const startDate = `${monthParams}-01`
    const year = parseInt(monthParams.split('-')[0])
    const month = parseInt(monthParams.split('-')[1])
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${monthParams}-${lastDay}`

    const { data: schedules, error } = await supabase
      .from('daily_schedules')
      .select(`
        id, date, clock_in, clock_out, pickup, dropoff, status,
        children ( id, first_name, last_name, sei, mei, gender, recipient_number, disability_level )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'present')
      .order('date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 子供ごとにデータをまとめる
    const childrenMap = new Map()
    for (const s of schedules || []) {
      const child = s.children as any
      if (!child) continue
      if (!childrenMap.has(child.id)) {
        childrenMap.set(child.id, { info: child, records: [] })
      }
      childrenMap.get(child.id).records.push(s)
    }

    const templateSheet = workbook.getWorksheet('テンプレート')
    if (!templateSheet) {
      return NextResponse.json({ error: 'Sheet "テンプレート" not found in workbook' }, { status: 500 })
    }

    // 令和表記の作成
    const reiwaYear = year - 2018;
    const monthLabel = `令和${reiwaYear}年${month}月`;

    // 児童ごとに別シートを作成
    for (const [childId, childData] of Array.from(childrenMap.entries())) {
      const info = childData.info
      const sheetName = `${info.last_name}${info.first_name}`.substring(0, 31)

      // シートをディープコピー的に作成する手法
      // 既存の「一戸」などのシートがあれば削除するか上書き（今回は都度新規）
      let targetSheet = workbook.getWorksheet(sheetName)
      if (!targetSheet) {
        targetSheet = workbook.addWorksheet(sheetName)
        // copy from template
        targetSheet.model = JSON.parse(JSON.stringify(templateSheet.model))
        targetSheet.name = sheetName
      }

      // 共通情報の埋め込み
      // Page 1
      targetSheet.getCell('H2').value = info.recipient_number || ''
      targetSheet.getCell('H4').value = `${info.last_name} ${info.first_name}`
      targetSheet.getCell('D1').value = monthLabel

      // Page 2 (Offset by 31 rows approx, based on dump)
      targetSheet.getCell('H33').value = info.recipient_number || ''
      targetSheet.getCell('H35').value = `${info.last_name} ${info.first_name}`
      targetSheet.getCell('D32').value = monthLabel

      // Page 3 (Offset by 30 rows)
      targetSheet.getCell('H63').value = info.recipient_number || ''
      targetSheet.getCell('H65').value = `${info.last_name} ${info.first_name}`
      targetSheet.getCell('D62').value = monthLabel

      // 記入先スロット（行番号）のリスト
      // 11~28 (18), 40~58 (19), 70~88 (19) 全56スロット
      const slotRows = [
        ...Array.from({length: 18}, (_, i) => 11 + i),
        ...Array.from({length: 19}, (_, i) => 40 + i),
        ...Array.from({length: 19}, (_, i) => 70 + i),
      ]

      let slotIdx = 0;

      for (const rec of childData.records) {
        if (slotIdx >= slotRows.length) break // スロットが足りない場合は無視（実際は警告が必要）

        const rDate = new Date(rec.date)
        const dayNum = rDate.getDate()
        const dow = DAY_OF_WEEK[rDate.getDay()]

        // ① メイン行（打刻データ）
        const mainRowIdx = slotRows[slotIdx++]
        const mainRow = targetSheet.getRow(mainRowIdx)
        mainRow.getCell('B').value = dayNum
        mainRow.getCell('F').value = dow
        
        if (rec.clock_in && rec.clock_out) {
          mainRow.getCell('J').value = formatJST(rec.clock_in)
          mainRow.getCell('P').value = formatJST(rec.clock_out)
          mainRow.getCell('V').value = calcBilledHours(rec.clock_in, rec.clock_out)
        } else {
          // 打刻漏れ
          mainRow.getCell('V').value = 0
        }
        mainRow.commit()

        // ② 送迎行（送迎がある場合）
        if (rec.pickup || rec.dropoff) {
          if (slotIdx >= slotRows.length) break
          const trspRowIdx = slotRows[slotIdx++]
          const trspRow = targetSheet.getRow(trspRowIdx)
          
          trspRow.getCell('B').value = '〃'
          trspRow.getCell('V').value = 0
          
          // 備考列(AZ)に「送迎」を記載
          let trspLabel = '送迎'
          if (rec.pickup && !rec.dropoff) trspLabel = '迎えのみ'
          if (!rec.pickup && rec.dropoff) trspLabel = '送りのみ'
          trspRow.getCell('AZ').value = trspLabel
          
          // ※必要なら支援区分ごとの送迎加算額を給付額の列に直接入れる等の処理も可能
          // ここではテンプレートの数式にお任せする前提
          trspRow.commit()
        }
      }
    }

    // テンプレートシート等は削除しない（今後のため）
    // workbook.removeWorksheet('テンプレート')
    
    // スケジュール表（もし存在すれば名前だけ列挙）
    // 個別シードが主目的なので、今回はスケジュール表は割愛するか簡易埋め込みのみ

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="nicoberi_export_${monthParams}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    })

  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
