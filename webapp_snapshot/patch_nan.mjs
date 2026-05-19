import fs from 'fs';
const p = 'src/app/nueva-venta/page.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /if \(selectedItem\) \{\s+const cat = newProducts\[index\]\.categoria/,
  `if (selectedItem) {
             const parseSafeNum = (val) => {
               if (!val) return 0;
               if (typeof val === 'number') return val;
               return Number(String(val).replace(',', '.')) || 0;
             };
             const cat = newProducts[index].categoria`
);

c = c.replace(
  /const baseCom = Number\(selectedItem\.comision\) \|\| 0;\s+const mult = Number\(selectedItem\.comisionConCoste\) \|\| 0;/,
  `const baseCom = parseSafeNum(selectedItem.comision);
              const mult = parseSafeNum(selectedItem.comisionConCoste);`
);

fs.writeFileSync(p, c);
console.log('Patched NaN issue.');
