const fs = require('fs');
const path = require('path');
const dirPath = path.join(__dirname, 'src');

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            const mapRegex = [
                { regex: /background-color:\s*#ffffff\b/gi, sub: 'background-color: var(--bg-card)' },
                { regex: /background-color:\s*#fff\b/gi, sub: 'background-color: var(--bg-card)' },
                { regex: /background:\s*#ffffff\b/gi, sub: 'background: var(--bg-card)' },
                { regex: /background:\s*#fff\b/gi, sub: 'background: var(--bg-card)' },
                { regex: /background:\s*#f8fafc\b/gi, sub: 'background: var(--bg-app)' },
                { regex: /background-color:\s*#f8fafc\b/gi, sub: 'background-color: var(--bg-app)' },
                { regex: /color:\s*#111827\b/gi, sub: 'color: var(--text-main)' },
                { regex: /color:\s*#334155\b/gi, sub: 'color: var(--text-main)' },
                { regex: /color:\s*#6b7280\b/gi, sub: 'color: var(--text-muted)' }
            ];

            mapRegex.forEach(({regex, sub}) => {
                const numMatches = (content.match(regex) || []).length;
                if (numMatches > 0) {
                    content = content.replace(regex, sub);
                    modified = true;
                }
            });

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed CSS hexes in', fullPath);
            }
        }
    });
}
processDirectory(dirPath);
