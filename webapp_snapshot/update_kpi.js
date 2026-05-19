const fs = require('fs');

let content = fs.readFileSync('src/hooks/useComisionesData.ts', 'utf8');

const targetEffect = `      // EFFECT: Envío subrepticio de extras KPI a base de datos para grabarlos eternamente
      useEffect(() => {
          if (loading || sellerStats.length === 0) return;
          const allVirtual = sellerStats.flatMap(s => s.virtualKpiExtras || []);
          if (allVirtual.length > 0) {
              console.log('[Auto-Piloto] Sincronizando bonos KPI globales con servidor:', allVirtual.length);
              fetch('/api/extras/kpi-sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ assignments: allVirtual })
              }).catch(console.error);
          }
      }, [loading, sellerStats]);`;

const replacementEffect = `      // EFFECT: Envío subrepticio de extras KPI a base de datos para grabarlos eternamente
      useEffect(() => {
          if (loading || sellerStats.length === 0 || !activePeriodKey) return;
          const allVirtual = sellerStats.flatMap(s => s.virtualKpiExtras || []);
          
          console.log('[Auto-Piloto] Sincronizando bonos KPI globales con servidor:', allVirtual.length);
          fetch('/api/extras/kpi-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ periodKey: activePeriodKey, assignments: allVirtual })
          }).catch(console.error);
      }, [loading, sellerStats, activePeriodKey]);`;

content = content.replace(targetEffect, replacementEffect);
fs.writeFileSync('src/hooks/useComisionesData.ts', content, 'utf8');

let contentApi = fs.readFileSync('src/app/api/extras/kpi-sync/route.ts', 'utf8');

const targetApi = `        const body = await request.json()
        const { assignments } = body
        
        if (!assignments || !Array.isArray(assignments)) {
            return NextResponse.json({ success: false, error: 'Lista de bonos inválida.' }, { status: 400 })
        }`;

const replacementApi = `        const body = await request.json()
        const { assignments, periodKey } = body
        
        if (!assignments || !Array.isArray(assignments)) {
            return NextResponse.json({ success: false, error: 'Lista de bonos inválida.' }, { status: 400 })
        }
        
        if (periodKey) {
            const period = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } });
            if (period) {
                // Find existing KPI automatic assignments for this period
                const existingKpis = await prisma.extraAssignment.findMany({
                    where: {
                        periodId: period.id,
                        sourceType: 'AUTOMATIC',
                        OR: [
                            { triggerKey: { contains: '-KPI_' } },
                            { triggerKey: { startsWith: 'TERRITORIAL_' } }
                        ]
                    }
                });
                
                const incomingKeys = assignments.map(a => a.triggerKey);
                const keysToDelete = existingKpis.filter(e => !incomingKeys.includes(e.triggerKey)).map(e => e.id);
                
                if (keysToDelete.length > 0) {
                    await prisma.extraAssignment.deleteMany({
                        where: { id: { in: keysToDelete } }
                    });
                    console.log(\`[API KPI-Sync] Limpiados \${keysToDelete.length} bonos KPI huérfanos.\`);
                }
            }
        }`;

contentApi = contentApi.replace(targetApi, replacementApi);
fs.writeFileSync('src/app/api/extras/kpi-sync/route.ts', contentApi, 'utf8');

console.log('Update applied');
