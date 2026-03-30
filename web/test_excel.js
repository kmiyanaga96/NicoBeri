const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
  const filePath = path.join(__dirname, '../docs/template.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  for (const sheetName of ['テンプレート', '一戸竜太郎']) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;
    
    console.log(`\n=== Sheet: ${sheetName} ===`);
    let rowCount = sheet.rowCount;
    if (rowCount > 80) rowCount = 80;
    
    for (let i = 1; i <= rowCount; i++) {
        const row = sheet.getRow(i);
        let rowData = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            rowData.push(`${cell.address}: ${cell.value}`);
        });
        if (rowData.length > 0) {
            console.log(`Row ${i}: ${rowData.join(', ')}`);
        }
    }
  }
}

main().catch(console.error);
