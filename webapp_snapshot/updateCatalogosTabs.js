const fs = require('fs');

let content = fs.readFileSync('src/app/catalogos/page.tsx', 'utf8');

// 1. Add import
if (!content.includes('TerritorialTab')) {
    content = content.replace("import ComisionesO2Tab from './ComisionesO2Tab'", "import ComisionesO2Tab from './ComisionesO2Tab'\nimport TerritorialTab from '@/components/TerritorialTab'");
}

// 2. Update isProductTab definition
const isProductTabRegex = /const isProductTab = CATEGORIES\.includes\(activeTab\)([^;]+);/g;
content = content.replace(isProductTabRegex, "const isProductTab = CATEGORIES.includes(activeTab)$1 && activeTab !== 'Territorial Tiendas / O2';");

// 3. Add to Navigation menu items
// Let's find where 'Comisiones O2 y MovilFree' is defined in the array of tabs.
// Looking at earlier search: { cat: 'Comisiones O2 y MovilFree', tip: ... }
const tabDefinition = "{ cat: 'Comisiones O2 y MovilFree', tip: 'Configuración del motor matemático de comisiones y bonos específicos para O2 y MovilFree.' },";
const newTabDefinition = "{ cat: 'Comisiones O2 y MovilFree', tip: 'Configuración del motor matemático de comisiones y bonos específicos para O2 y MovilFree.' },\n          { cat: 'Territorial Tiendas / O2', tip: 'Configuración y cálculo automático de tramos y comisiones territoriales.' },";
content = content.replace(tabDefinition, newTabDefinition);

// 4. Render the component
const renderComisiones = "{!isProductTab && activeTab === 'Comisiones O2 y MovilFree' && <ComisionesO2Tab />}";
const renderTerritorial = "{!isProductTab && activeTab === 'Comisiones O2 y MovilFree' && <ComisionesO2Tab />}\n      {!isProductTab && activeTab === 'Territorial Tiendas / O2' && <TerritorialTab />}";
content = content.replace(renderComisiones, renderTerritorial);

// Also need to fix the ObjetivosTab fallback which checks activeTab !== ...
const objFallbackRegex = /{!isProductTab && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree' &&/g;
content = content.replace(objFallbackRegex, "{!isProductTab && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree' && activeTab !== 'Territorial Tiendas / O2' &&");

fs.writeFileSync('src/app/catalogos/page.tsx', content, 'utf8');
console.log("Updated catalogos/page.tsx to include TerritorialTab");
