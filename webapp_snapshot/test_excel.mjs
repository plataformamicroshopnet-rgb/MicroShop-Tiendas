import * as XLSX from 'xlsx';
import fs from 'fs';

const workbook = XLSX.readFile('Ganancias 2014-2026.xlsx');
console.log('Sheets found:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

fs.writeFileSync('excel_dump.json', JSON.stringify(data, null, 2));
console.log(`Saved ${sheetName} to excel_dump.json`);
