const fs = require('fs');
const content = fs.readFileSync('src/lib/appConfig.ts', 'utf8');
const match = content.match(/export function normalizeRole[\s\S]*?\n}/);
console.log(match[0]);
