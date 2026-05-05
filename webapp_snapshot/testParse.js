const text = `LENOVO ThinkBook 14 G8 IAL Ultra5 16GB 512GB\t 15,00 € 
LENOVO ThinkPad L13 G6 2n1 Ultra7 16/512\t 15,00 € 
LENOVO ThinkPad L14 G5 AMD R5 PRO 16/512GB\t 15,00 € 
LENOVO TP L16 G2 R5Pro/16/512 W11P\t 15,00 € 
HP EliteBook 6 G1a 16 R5/16/512 W11P\t 40,00 € 
HP ELITEBOOK ULTRA G1i 14 Ultra5 32GB/1TB\t 40,00 € 
LENOVO ThinkBook 14 G8 IAL Ultra5 16GB 512GB\t 15,00 € 
LENOVO ThinkPad L13 G6 2n1 Ultra7 16/512\t 15,00 € 
LENOVO ThinkPad L14 G5 AMD R5 PRO 16/512GB\t 15,00 € 
LENOVO TP L16 G2 R5Pro/16/512 W11P\t 15,00 € 
HP EliteBook 6 G1a 16 R5/16/512 W11P\t 40,00 € 
HP ELITEBOOK ULTRA G1i 14 Ultra5 32GB/1TB\t 40,00 € 
LENOVO Oferta 2023 Thinkpad L14 G5 AMD R5 PRO 16/512\t 15,00 € 
LENOVO Oferta Fusion 5.0 Thinkpad L14 G5 AMD R5 PRO 16/512\t 15,00 € 
LENOVO V15 G4 IRU i3 8GB 256GB\t -   € 
HP 250R G9 i3 8GB 512GB W11H\t 20,00 € 
LENOVO V15 G4 IRU i3 8GB 256GB\t -   € 
HP 250R G9 i3 8GB 512GB W11H\t 20,00 € 
LENOVO THINKVISION T24-40 MONITOR\t 15,00 € 
LENOVO THINKVISION T24-40 MONITOR\t 15,00 €`;

const lines = text.split('\n');
const priceMap = [];
for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split('\t').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 2) {
        const prodName = cols[0];
        const tStr = cols[1].replace(/[^\d,\.-]/g, '').replace(',', '.');
        const telecom = parseFloat(tStr) || 0;
        if (prodName && telecom > 0) {
            priceMap.push({ prod: prodName.trim().toLowerCase(), telecom });
        }
    } else {
        const strNoEuro = line.replace(/€/g, '').trim();
        const words = strNoEuro.split(/\s+/);
        const lastWord = words.pop() || '';
        const num = parseFloat(lastWord.replace(',', '.'));
        if (!isNaN(num)) {
            const prod = words.join(' ').toLowerCase();
            priceMap.push({ prod, telecom: num });
        }
    }
}
console.log('Parsed rules:', priceMap.length);
console.log(priceMap[0]);

const saleProd = 'LENOVO ThinkBook 14 G8 IAL Ultra5 16GB 512GB'.toLowerCase();
const match = priceMap.find(p => saleProd.includes(p.prod) || p.prod.includes(saleProd));
console.log('MATCH:', match);
