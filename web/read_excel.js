const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '../docs/template.xlsx');
const workbook = XLSX.readFile(filePath);
let output = '';

workbook.SheetNames.forEach(sheetName => {
  output += '\n=======================================\n';
  output += 'Sheet Name: ' + sheetName + '\n';
  output += '=======================================\n';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;
  
  // Dump raw sheet to understand structure, especially with merged cells
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  
  // Print first 30 rows
  jsonData.slice(0, 30).forEach((row, i) => {
    // Only print non-empty rows
    if (row.some(cell => cell !== '')) {
      output += `Row ${i + 1}: ${JSON.stringify(row)}\n`;
    }
  });
});

fs.writeFileSync(path.join(__dirname, 'excel_dump_utf8.txt'), output, 'utf8');
