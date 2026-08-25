import { useState, useEffect } from 'react';
import { usePeriod } from '@/components/PeriodProvider';
import { isSolar360 } from '@/lib/salesUtils';
// ── Panel Comisiones: parte React (fetch + estado). El CÁLCULO vive en
// src/lib/panelComisionesTiendas.ts (computePanelComisionesTiendas), la MISMA
// lib que usa /api/comisiones-liquidacion server-side: fuente única del motor.
import { computePanelComisionesTiendas } from '@/lib/panelComisionesTiendas';
import { loadTorneosConfigMes, torneoExtrasPorVendedor, TorneosConfig } from '@/lib/torneosConfig';
// matchProductFormula/matchTipoVenta viven en lib/ventaMatching y los helpers del
// panel (parseSafeFloat, matchesRule, getValueForRule…) en lib/panelComisionesTiendas
// (módulos PUROS usables en endpoints de servidor); se re-exportan aquí para no
// romper los muchos imports existentes `from '@/hooks/useComisionesData'`.
import { matchProductFormula, matchTipoVenta } from '@/lib/ventaMatching';
import { parseSafeFloat, isSuscripcionesTV, isExtraRepoUpFutbol, matchesRule, getValueForRule } from '@/lib/panelComisionesTiendas';
export { matchProductFormula, matchTipoVenta, parseSafeFloat, isSuscripcionesTV, isExtraRepoUpFutbol, matchesRule, getValueForRule };

export function useComisionesData(user?: any) {
    const { activePeriodKey } = usePeriod();
    const [loading, setLoading] = useState(true);
    const [allSales, setAllSales] = useState<any[]>([]);
    const [condiciones, setCondiciones] = useState<any[]>([]);
    const [extraAssignments, setExtraAssignments] = useState<any[]>([]);
    const [activeRules, setActiveRules] = useState<any[]>([]); // KPI Rules fetch
    const [tiendaRules, setTiendaRules] = useState<any[]>([]);
    const [tiendaHours, setTiendaHours] = useState<any[]>([]);
    const [o2Rules, setO2Rules] = useState<any[]>([]);
    const [o2Hours, setO2Hours] = useState<any[]>([]);
    const [territorialO2Rules, setTerritorialO2Rules] = useState<any[]>([]);
    const [catalogs, setCatalogs] = useState<Record<string, any[]>>({});

    const [selectedSellerFilter, setSelectedSellerFilter] = useState<string | null>(null);
    const [fttrDiscount, setFttrDiscount] = useState<number>(910);
    const [torneosCfg, setTorneosCfg] = useState<TorneosConfig>({ concursos: [] });

    useEffect(() => {
        if (!activePeriodKey) return;
        setLoading(true);
        Promise.all([
            fetch(`/api/sales?periodKey=${activePeriodKey}&dashboard=true`).then(res => res.json()),
            fetch(`/api/condiciones-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({ rows: [] })),
            fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ data: [] })),
            fetch('/api/extras/rules').then(res => res.json()).catch(() => ({ rules: [] })),
            fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, rules: [], hours: [] })),
            fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`).then(res => res.json()).catch(() => ({ value: null })),
            fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: false, tiendas: [], o2: [] })),
            fetch('/api/catalogs').then(res => res.json()).catch(() => ({ success: false, catalogs: {} })),
            fetch(`/api/settings?key=fttr_discount_${activePeriodKey}`).then(res => res.json()).catch(() => ({ value: null })),
            // Torneos POR MES: para el EXTRA «X € por venta», que entra en la
            // nómina — cada mes paga los torneos de SU mes.
            loadTorneosConfigMes(activePeriodKey).catch(() => ({ config: { concursos: [] } as TorneosConfig, origen: 'vacio' as const }))
        ])
        .then(([data, condData, extrasData, rulesData, tiendasData, o2Data, territorialData, catalogsData, fttrDiscountData, torneosData]) => {
            if (data.success && data.logs) {
                // Solar 360 fuera por completo (ni se cobra ni se paga): se excluye de ventas.
                setAllSales((data.logs || []).filter((s: any) => !isSolar360(s)));
            }
            if (condData && condData.rows) {
                setCondiciones(condData.rows);
            }
            if (extrasData && extrasData.assignments) {
                setExtraAssignments(extrasData.assignments);
            }
            if (rulesData && rulesData.rules) {
                // Filtramos solo las reglas KPI activas
                setActiveRules(rulesData.rules.filter((r: any) => r.isActive && r.combinationLabel?.startsWith('[KPI]')));
            }
            if (tiendasData && tiendasData.success) {
                // "Señalización Solar 360" eliminada como palanca de comisión (no se paga).
                setTiendaRules((tiendasData.rules || []).filter((r: any) => !String(r.nombre || '').toLowerCase().includes('solar')));
                setTiendaHours(tiendasData.hours || []);
            }
            if (o2Data && o2Data.value) {
                try {
                    const parsed = JSON.parse(o2Data.value);
                    setO2Rules(parsed.rules || []);
                    setO2Hours(parsed.hours || []);
                } catch(e) {}
            } else {
                setO2Rules([]);
                setO2Hours([]);
            }
            if (territorialData && territorialData.success) {
                setTerritorialO2Rules(territorialData.o2 || []);
            }
            if (catalogsData && catalogsData.success) {
                setCatalogs(catalogsData.catalogs || {});
            }
            if (fttrDiscountData && fttrDiscountData.value !== null) {
                const parsedVal = parseFloat(fttrDiscountData.value);
                if (!isNaN(parsedVal)) {
                    setFttrDiscount(parsedVal);
                } else {
                    setFttrDiscount(910);
                }
            } else {
                setFttrDiscount(910);
            }
            setTorneosCfg((torneosData && (torneosData as any).config) || { concursos: [] });
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [activePeriodKey]);

    const monthSales = allSales;

    // ── MOTOR (lib pura compartida con /api/comisiones-liquidacion) ──────────
    // Los filtros que antes hacía el hook (Solar360, reglas 'solar', KPI [KPI])
    // los re-aplica el motor de forma idempotente: mismo resultado que siempre.
    const {
        sellerStats,
        adjustedTiendaRules,
    } = computePanelComisionesTiendas({
        periodKey: activePeriodKey || '',
        sales: allSales,
        tiendaRules,
        tiendaHours,
        o2Rules,
        o2Hours,
        territorialO2Rules,
        extraAssignments,
        kpiRules: activeRules,
        catalogs,
        fttrDiscount,
        // El EXTRA de los torneos «X € por venta», a la nómina como un bono más
        torneoExtras: torneoExtrasPorVendedor(allSales, torneosCfg, catalogs, tiendaRules),
    });

    // EFFECT: Envío subrepticio de extras KPI a base de datos para grabarlos eternamente
    useEffect(() => {
          if (loading || sellerStats.length === 0 || !activePeriodKey) return;
          const allVirtual = sellerStats.flatMap(s => s.virtualKpiExtras || []);

          console.log('[Auto-Piloto] Sincronizando bonos KPI globales con servidor:', allVirtual.length);
          fetch('/api/extras/kpi-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ periodKey: activePeriodKey, assignments: allVirtual })
          }).catch(console.error);
      }, [loading, sellerStats, activePeriodKey]);

    const displayedSellerStats = sellerStats;
    const teamTotalComisiones = displayedSellerStats.reduce((acc, s) => acc + s.totalComision, 0);
    const teamTotalSales = displayedSellerStats.reduce((acc, s) => acc + s.totalSales, 0);

    const orderedDesc = [...displayedSellerStats].sort((a, b) => b.totalComision - a.totalComision);
    const top3 = orderedDesc.slice(0, 3);
    const maxComisionSeller = orderedDesc.length > 0 ? orderedDesc[0] : null;

    const orderedBySales = [...displayedSellerStats].sort((a, b) => b.totalSales - a.totalSales);
    const maxSalesSeller = orderedBySales.length > 0 ? orderedBySales[0] : null;

    return {
        loading,
        selectedSellerFilter,
        setSelectedSellerFilter,
        sellerStats: displayedSellerStats,
        teamTotalComisiones,
        teamTotalSales,
        top3,
        maxComisionSeller,
        maxSalesSeller,
        monthSales,
        extraAssignments,
        // La plantilla del mes: la necesita el motor del Jefe para el
        // condicionante de mínimo POR TIENDA.
        tiendaHours,
        tiendaRules: adjustedTiendaRules,
        setTiendaRules,
        o2Rules,
        territorialO2Rules,
        activePeriodKey,
        catalogs,
        fttrDiscount
    };
}
