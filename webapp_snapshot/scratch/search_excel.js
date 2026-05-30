const XLSX = require('xlsx');

function main() {
  const workbook = XLSX.readFile('Comisiones Tiendas y FFVV v2.xlsx');
  console.log('Sheet names:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    data.forEach((row, i) => {
      const text = JSON.stringify(row).toLowerCase();
      if (text.includes('deportes') || text.includes('suscrip') || text.includes('elena')) {
        console.log(`Match in sheet [${sheetName}] row ${i + 2}:`, row);
      }
    });
  });
}

main();
