const fs = require('fs');
let content = fs.readFileSync('src/hooks/useComisionesData.ts', 'utf8');

const targetEffect = /useEffect\(\(\) => \{\s*if \(loading \|\| sellerStats\.length === 0\) return;\s*const allVirtual = sellerStats\.flatMap\(s => s\.virtualKpiExtras \|\| \[\]\);\s*if \(allVirtual\.length > 0\) \{\s*console\.log\('\[Auto-Piloto\] Sincronizando bonos KPI globales con servidor:', allVirtual\.length\);\s*fetch\('\/api\/extras\/kpi-sync', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ assignments: allVirtual \}\)\s*\}\)\.catch\(console\.error\);\s*\}\s*\}, \[loading, sellerStats\]\);/g;

const replacementEffect = `useEffect(() => {
          if (loading || sellerStats.length === 0 || !activePeriodKey) return;
          const allVirtual = sellerStats.flatMap(s => s.virtualKpiExtras || []);
          
          console.log('[Auto-Piloto] Sincronizando bonos KPI globales con servidor:', allVirtual.length);
          fetch('/api/extras/kpi-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ periodKey: activePeriodKey, assignments: allVirtual })
          }).catch(console.error);
      }, [loading, sellerStats, activePeriodKey]);`;

if (content.match(targetEffect)) {
    content = content.replace(targetEffect, replacementEffect);
    fs.writeFileSync('src/hooks/useComisionesData.ts', content, 'utf8');
    console.log('Hook updated successfully');
} else {
    console.log('Target regex not found in useComisionesData.ts');
}
