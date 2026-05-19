import fs from 'fs';

const nvPath = 'src/app/nueva-venta/page.tsx';
let nv = fs.readFileSync(nvPath, 'utf8');

// Replace in handleProductChange
nv = nv.replace(/const catList = catalogs\[newProducts\[index\]\.categoria\] \|\| \[\]/g, 
  "const actualCat = newProducts[index].categoria === 'Traslado miMovistar' ? 'miMovistar' : newProducts[index].categoria;\n         const catList = catalogs[actualCat] || []");

// Replace in JSX rendering
nv = nv.replace(/catalogs\[prod\.categoria\]/g, "catalogs[prod.categoria === 'Traslado miMovistar' ? 'miMovistar' : prod.categoria]");

fs.writeFileSync(nvPath, nv);

const catPath = 'src/app/catalogos/page.tsx';
let cp = fs.readFileSync(catPath, 'utf8');

// Remove from CATEGORIES
cp = cp.replace(/, 'Traslado miMovistar'\]/g, "]");
// Remove from tooltip definitions
cp = cp.replace(/,\n          { cat: 'Traslado miMovistar', tip: 'Catálogo para Traslado miMovistar. Estructura idéntica a miMovistar.' },/g, ",");

fs.writeFileSync(catPath, cp);
console.log('Aliased Traslado to miMovistar in Nueva Venta, removed from Catálogos manager tabs.');
