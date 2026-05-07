const bulkText = `REACONDICIONADO	REACONDICIONADO	Lenovo ThinkPad L390 i5-8ª 8GB 256GB 13 RENT REAC.A	MEDIA	228,10 €	4,56 €	9,12 €	01/05/2026	31/05/2026
REACONDICIONADO	REACONDICIONADO	iPhone 12 128GB RENT REAC.A	MEDIA	298,30 €	5,97 €	11,93 €	01/05/2026	31/05/2026`;

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
    normalizedText += ' '; 
    continue;
  }
  normalizedText += cleanText[i];
}

normalizedText = normalizedText.replace(/""/g, '"');

console.log("Lines:");
const lines = normalizedText.split('\n');
console.log(lines.length);
console.log(lines);
