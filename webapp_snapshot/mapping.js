const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, 'src');

const map = {
    // Backgrounds / Cards
    "'white'": "'var(--bg-card)'",
    '"white"': '"var(--bg-card)"',
    "'#fff'": "'var(--bg-card)'",
    '"#fff"': '"var(--bg-card)"',
    "'#ffffff'": "'var(--bg-card)'",
    "'#f8fafc'": "'var(--bg-app)'",
    
    // Grays and table headers
    "'#f9fafb'": "'var(--active-bg)'",
    "'#f1f5f9'": "'var(--active-bg)'",
    "'#f3f4f6'": "'var(--active-bg)'",
    
    // Texts (Dark / Slate)
    "'#0f172a'": "'var(--text-main)'",
    "'#111827'": "'var(--text-main)'",
    "'#334155'": "'var(--text-main)'", // Sometimes used for text, sometimes border, but mostly text if slate 700
    "'#475569'": "'var(--text-muted)'",
    "'#64748b'": "'var(--text-muted)'",
    "'#6b7280'": "'var(--text-muted)'",
    "'#9ca3af'": "'var(--text-muted)'",

    // Borders
    "'#e2e8f0'": "'var(--border-light)'",
    "'#cbd5e1'": "'var(--border-strong)'",
    "'#d1d5db'": "'var(--border-strong)'",
    "'#e5e7eb'": "'var(--border-strong)'"
};

function processDirectory(directory) {
    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Replacing direct string properties
            for (const [key, value] of Object.entries(map)) {
                if (content.includes(key)) {
                    // Do not replace if it's inside exceljs args in visitas-ffvv (ExcelJS uses literal hex like 'FF111827')
                    content = content.split(key).join(value);
                    modified = true;
                }
            }
            
            // Replaces nested borders like '1px solid #d1d5db'
            content = content.replace(/1px solid #e2e8f0/g, '1px solid var(--border-light)');
            content = content.replace(/1px solid #cbd5e1/g, '1px solid var(--border-strong)');
            content = content.replace(/1px solid #d1d5db/g, '1px solid var(--border-strong)');
            content = content.replace(/1px solid #e5e7eb/g, '1px solid var(--border-strong)');
            content = content.replace(/1px solid #f3f4f6/g, '1px solid var(--active-bg)');
            content = content.replace(/1px solid #f8fafc/g, '1px solid var(--bg-app)');
            content = content.replace(/1px solid #ffffff/g, '1px solid var(--bg-card)');
            content = content.replace(/1px solid #fff/g, '1px solid var(--bg-card)');
            
            // Replaces border bottom and dashed
            content = content.replace(/borderBottom:\s*['"]1px solid #f3f4f6['"]/g, "borderBottom: '1px solid var(--active-bg)'");
            content = content.replace(/borderLeft:\s*['"]1px solid #f3f4f6['"]/g, "borderLeft: '1px solid var(--active-bg)'");

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated', fullPath);
            }
        }
    });
}

processDirectory(dirPath);
console.log('Color mapping completed successfully.');
