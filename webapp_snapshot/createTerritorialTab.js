const fs = require('fs');

let content = fs.readFileSync('src/app/liquidacion/territorial/page.tsx', 'utf8');

// Replace export default function
content = content.replace('export default function TerritorialPage() {', 'export default function TerritorialTab() {');

// Remove PageHeader
content = content.replace(/<PageHeader[\s\S]*?\/>/, '');

// Adjust top padding so it fits as a tab
content = content.replace('<div style={{ maxWidth: 1400, margin: \'0 auto\', padding: 24 }}>', '<div style={{ padding: 0 }}>');

fs.writeFileSync('src/components/TerritorialTab.tsx', content, 'utf8');
console.log("Created TerritorialTab component");
