import fs from 'fs';

const p = 'src/app/catalogos/page.tsx';
let c = fs.readFileSync(p, 'utf8');

// 1. Add to CATEGORIES
c = c.replace(
  /const CATEGORIES = \['Fija y Móvil', 'Ti', 'Rent', 'Seguro', 'O2', 'miMovistar', 'Suscripciones TV', 'Prepago', 'Varios', 'Repos', 'Resto BAF'\]/,
  "const CATEGORIES = ['Fija y Móvil', 'Ti', 'Rent', 'Seguro', 'O2', 'miMovistar', 'Suscripciones TV', 'Prepago', 'Varios', 'Repos', 'Resto BAF', 'Traslado miMovistar']"
);

// 2. Add to empty catalogs initializers
c = c.replace(
  /"Repos": \[\], "Resto BAF": \[\]/g,
  '"Repos": [], "Resto BAF": [], "Traslado miMovistar": []'
);

// 3. Update conditions `cat === ...`
c = c.replace(
  /cat === 'miMovistar' \|\| cat === 'Resto BAF'/g,
  "cat === 'miMovistar' || cat === 'Resto BAF' || cat === 'Traslado miMovistar'"
);

// 4. Update conditions `activeTab === ...`
c = c.replace(
  /activeTab === 'miMovistar' \|\| activeTab === 'Resto BAF'/g,
  "activeTab === 'miMovistar' || activeTab === 'Resto BAF' || activeTab === 'Traslado miMovistar'"
);

// 5. Add tooltip definition
c = c.replace(
  /{ cat: 'Resto BAF', tip: 'Catálogo para Resto BAF. Estructura idéntica a miMovistar.' },/g,
  "{ cat: 'Resto BAF', tip: 'Catálogo para Resto BAF. Estructura idéntica a miMovistar.' },\n          { cat: 'Traslado miMovistar', tip: 'Catálogo para Traslado miMovistar. Estructura idéntica a miMovistar.' },"
);

// Update some missing places that might only check for miMovistar:
c = c.replace(
  /\(activeTab === 'miMovistar' && parts\[2\]\)/g,
  "((activeTab === 'miMovistar' || activeTab === 'Resto BAF' || activeTab === 'Traslado miMovistar') && parts[2])"
);

// Write back
fs.writeFileSync(p, c);
console.log('Patched catalogos!');
