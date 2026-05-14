const fs = require('fs');
let content = fs.readFileSync('src/app/catalogos/page.tsx', 'utf8');

// 1. Remove ObjetivosTab import
content = content.replace(/import ObjetivosTab from '\.\/ObjetivosTab'\n/g, '');

// 2. Clean up isProductTab
const oldIsProductTab = "const isProductTab = CATEGORIES.includes(activeTab) && activeTab !== 'Objetivos Tiendas' && activeTab !== 'Comisiones O2 y MovilFree' && activeTab !== 'Objetivos Captador' && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree'";
const newIsProductTab = "const isProductTab = CATEGORIES.includes(activeTab) && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree' && activeTab !== 'Territorial Tiendas / O2'";
content = content.replace(oldIsProductTab, newIsProductTab);

// 3. Remove Objetivos Tiendas from tabs
const oldTabDef = "            { cat: 'Objetivos Tiendas', tip: 'Define los objetivos cuantitativos del mes para las tiendas. Son la base del cálculo de cumplimiento y comisiones.' },\n";
content = content.replace(oldTabDef, '');

// 4. Remove fallback render
const fallbackRenderRegex = / *\{!isProductTab && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree' && activeTab !== 'Territorial Tiendas \/ O2' && <ObjetivosTab activeSegment=\{activeTab === 'Objetivos Tiendas' \? 'Pyme' : 'Captador'\} \/>\}\n/g;
content = content.replace(fallbackRenderRegex, '');

fs.writeFileSync('src/app/catalogos/page.tsx', content, 'utf8');
console.log("Cleanup done.");
