const fs = require('fs');
const lines = fs.readFileSync('c:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\src\\app\\comisiones\\page.tsx', 'utf-8').split('\n');
lines.forEach((line, i) => {
    if (line.toLowerCase().includes('obj. 1') || line.toLowerCase().includes('falta 1')) {
        console.log(`${i+1}: ${line}`);
    }
});
