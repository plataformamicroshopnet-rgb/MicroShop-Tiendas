const fs = require('fs');

let content = fs.readFileSync('src/app/catalogos/page.tsx', 'utf8');

const tabsStartIdx = content.indexOf('{/* TABS */}');
if (tabsStartIdx === -1) {
    console.log("Could not find {/* TABS */}!");
    process.exit(1);
}

const toolbarIdx = content.indexOf('{/* TOOLBAR */}');
const tabsEndIdx = content.lastIndexOf('</div>', toolbarIdx) + 6;

const tabsBlock = content.slice(tabsStartIdx, tabsEndIdx);

content = content.slice(0, tabsStartIdx) + content.slice(tabsEndIdx);

const insertTarget = '{isProductTab && (';
const firstInsertIdx = content.indexOf(insertTarget);

content = content.slice(0, firstInsertIdx) + tabsBlock + '\n\n      ' + content.slice(firstInsertIdx);

fs.writeFileSync('src/app/catalogos/page.tsx', content, 'utf8');
console.log("Moved TABS block outside of isProductTab conditional!");
