const bulkText = `AV\tmiMovistar BASE\t"Movistar+
Ficción Total con netflix con anuncios
Futbol Total"\t143\t2\t01/05/2026\t31/05/2026`;

let cleanText = bulkText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
let inQuotes = false;
let normalizedText = '';
for (let i = 0; i < cleanText.length; i++) {
  if (cleanText[i] === '"') {
    const isStartOfCell = i === 0 || cleanText[i-1] === '\t' || cleanText[i-1] === '\n';
    const isEndOfCell = i === cleanText.length - 1 || cleanText[i+1] === '\t' || cleanText[i+1] === '\n';
    
    if (!inQuotes && isStartOfCell) {
       inQuotes = true;
       continue;
    } else if (inQuotes && isEndOfCell) {
       inQuotes = false;
       continue;
    }
  } else if (cleanText[i] === '\n' && inQuotes) {
    normalizedText += '___NEWLINE___'; 
    continue;
  }
  normalizedText += cleanText[i];
}

normalizedText = normalizedText.replace(/""/g, '"');

console.log("Lines:");
const lines = normalizedText.split('\n');
console.log(lines.length);
console.log(lines);

lines.forEach((line) => {
  const parts = line.split('\t').map(p => p.trim().replace(/___NEWLINE___/g, '\n'))
  console.log(parts);
})
