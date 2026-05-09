const fs = require('fs');
const path = require('path');

function search(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            search(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf-8').toLowerCase();
            if (content.includes('falta 1') || content.includes('obj. 1')) {
                console.log(fullPath);
            }
        }
    }
}
search('c:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\src');
