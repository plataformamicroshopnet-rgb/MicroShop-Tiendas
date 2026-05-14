const fs = require('fs');

let content = fs.readFileSync('src/app/liquidacion/page.tsx', 'utf8');

// Find start of renderObjetivosTab
const startStr = "const renderObjetivosTab = () => {";
const startIdx = content.indexOf(startStr);

if (startIdx !== -1) {
    // Find the next function to know where renderObjetivosTab ends
    const endStr = "const renderDashboardBlock = (profile: 'Pyme' | 'Captador', calcData: any) => {";
    const endIdx = content.indexOf(endStr);
    
    if (endIdx !== -1) {
        // Remove the block
        content = content.slice(0, startIdx) + content.slice(endIdx);
        console.log("Removed renderObjetivosTab.");
    }
}

// Remove {currentView === 'objetivos' && renderObjetivosTab()}
content = content.replace(/ *\{currentView === 'objetivos' && renderObjetivosTab\(\)\}\n/g, '');

fs.writeFileSync('src/app/liquidacion/page.tsx', content, 'utf8');
console.log("Cleanup liquidacion/page.tsx done.");
