const fs = require('fs');
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

// The file got duplicated headers inserted at line 33 basically.
// Let's just fix it by string replacement.
file = file.replace(/const formatDisplayDate = \\(d: Date \\| undefined\\) => \\{\r?\n    if \\(!d\\) return ''\r?\n'use client'/, "const formatDisplayDate = (d: Date | undefined) => {\n    if (!d) return ''\n    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })\n}");

// Remove everything from 'use client' up to export default function AgendaCristinaPage()
// The original 'use client' is at the very top. The duplicated one is what caused the mess.
let lines = file.split('\n');
let firstClientIdx = lines.findIndex(l => l.includes("'use client'"));
let secondClientIdx = lines.findIndex((l, i) => i > firstClientIdx && l.includes("'use client'"));

if (secondClientIdx !== -1) {
    let funcIdx = lines.findIndex((l, i) => i > secondClientIdx && l.includes("export default function AgendaCristinaPage()"));
    if (funcIdx !== -1) {
        // Remove lines from secondClientIdx to just before funcIdx
        lines.splice(secondClientIdx - 2, funcIdx - secondClientIdx + 2); // Remove up to the function definition, wait we don't want to remove the function definition.
    }
}
file = lines.join('\n');

// Also need to restore editForm state because my last multi_replace failed to do it properly.
file = file.replace(/const \[editForm, setEditForm\] = useState\(\{ ventas: 0, visitas: 0, teams: 0, demos: 0, estado: 'ACTIVO', observaciones: '' \}\)/g, "const [editForm, setEditForm] = useState({ campanas: 0, clientesPropios: 0, dispositivos: 0, baf: 0, repos: 0, bdSalva: 0, competencia: 0, estado: 'ACTIVO', observaciones: '' })");

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
