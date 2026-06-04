'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Building2, RefreshCw, UploadCloud, X, ClipboardPaste } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'
import { calculateTramitacion } from '@/lib/tramitacionEngine'

const getWorkingDaysInMonth = (year: number, month: number) => {
    let days = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
        if (date.getDay() !== 0 && date.getDay() !== 6) days++; // Lunes a Viernes
        date.setDate(date.getDate() + 1);
    }
    return days;
};

const getWorkingDaysElapsed = (year: number, month: number) => {
    const today = new Date();
    // Si estamos en un mes futuro
    if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)) {
        return 0; // No han pasado días
    }
    // Si estamos en un mes pasado
    if (year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)) {
        return getWorkingDaysInMonth(year, month);
    }
    
    // Si estamos en el mes actual
    let days = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1 && date.getDate() <= today.getDate()) {
        if (date.getDay() !== 0 && date.getDay() !== 6) days++;
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export default function TramitacionPage() {
    const { activePeriodKey } = usePeriod();
    const [yearStr, monthStr] = (activePeriodKey || '').split('_');
    const selectedYear = parseInt(yearStr, 10) || new Date().getFullYear();
    const selectedMonth = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

    const workingDaysInMonth = getWorkingDaysInMonth(selectedYear, selectedMonth);
    const workingDaysElapsed = getWorkingDaysElapsed(selectedYear, selectedMonth);

    const [loading, setLoading] = useState(false);
    const [dataRows, setDataRows] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteContent, setPasteContent] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = async () => {
        if (!activePeriodKey) return;
        setLoading(true);
        try {
            const [sRes, tRes, objRes, o2Res] = await Promise.all([
                fetch(`/api/sales?periodKey=${activePeriodKey}`),
                fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`),
                fetch(`/api/tramitacion-objetivos?periodKey=${activePeriodKey}`),
                fetch(`/api/settings?key=o2_rules_v2_${activePeriodKey}`).catch(() => null)
            ]);
            
            const sData = await sRes.json();
            const tData = await tRes.json();
            const objData = await objRes.json();

            let o2Rules: any[] = [];
            let o2Hours: any[] = [];
            if (o2Res) {
                const o2Data = await o2Res.json();
                if (o2Data && o2Data.value) {
                    try {
                        const parsed = JSON.parse(o2Data.value);
                        o2Rules = parsed.rules || [];
                        o2Hours = parsed.hours || [];
                    } catch(e) {
                        console.error("Error parsing O2 rules in page.tsx", e);
                    }
                }
            }

            const calculated = calculateTramitacion(
                sData.logs || [],
                tData.rules || [],
                tData.hours || [],
                objData.objectives || [],
                workingDaysElapsed,
                workingDaysInMonth,
                o2Rules,
                o2Hours
            );
            
            setDataRows(calculated);
        } catch(e) {
            console.error("Error loading tramitacion data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activePeriodKey]);

    const formatPct = (val: number) => {
        if (!val || isNaN(val) || !isFinite(val)) return '0%';
        return Math.round(val * 100) + '%';
    };

    const formatNum = (val: number, isCurrency = false) => {
        if (!val) return isCurrency ? '0 €' : '0';
        return isCurrency 
            ? Math.round(val).toLocaleString('es-ES') + ' €' 
            : Math.round(val).toString();
    };

    // Calculate totals row
    const totals: any = {
        store: 'Operaciones',
        pers: 0, altasTotales: 0,
        bafNoTrasl_obj: 0, bafNoTrasl_vent: 0, bafNoTrasl_tram: 0, bafNoTrasl_proj: 0,
        bafConvMS_obj: 0, bafConvMS_vent: 0, bafConvMS_tram: 0, bafConvMS_proj: 0,
        bafNoFusionO2_obj: 0, bafNoFusionO2_vent: 0, bafNoFusionO2_tram: 0, bafNoFusionO2_proj: 0,
        restoBaf_obj: 0, restoBaf_vent: 0, restoBaf_tram: 0, restoBaf_proj: 0,
        tvFutbol_obj: 0, tvFutbol_vent: 0, tvFutbol_proj: 0,
        alarmas_obj: 0, alarmas_vent: 0, alarmas_proj: 0,
        dispSegEuros_obj: 0, dispSegEuros_vent: 0, dispSegEuros_proj: 0,
        dispUnidades_obj: 0, dispUnidades_vent: 0, dispUnidades_proj: 0,
        seguros_obj: 0, seguros_vent: 0, seguros_proj: 0,
        movil_obj: 0, movil_vent: 0, movil_proj: 0,
        repos_obj: 0, repos_vent: 0, repos_proj: 0,
        fttr_obj: 0, fttr_vent: 0, fttr_proj: 0,
    };

    const o2Totals: any = {
        store: 'Operaciones O2',
        pers: 0, altasTotales: 0,
        bafNoTrasl_obj: 0, bafNoTrasl_vent: 0, bafNoTrasl_tram: 0, bafNoTrasl_proj: 0,
        bafConvMS_obj: 0, bafConvMS_vent: 0, bafConvMS_tram: 0, bafConvMS_proj: 0,
        bafNoFusionO2_obj: 0, bafNoFusionO2_vent: 0, bafNoFusionO2_tram: 0, bafNoFusionO2_proj: 0,
        restoBaf_obj: 0, restoBaf_vent: 0, restoBaf_tram: 0, restoBaf_proj: 0,
        tvFutbol_obj: 0, tvFutbol_vent: 0, tvFutbol_proj: 0,
        alarmas_obj: 0, alarmas_vent: 0, alarmas_proj: 0,
        dispSegEuros_obj: 0, dispSegEuros_vent: 0, dispSegEuros_proj: 0,
        dispUnidades_obj: 0, dispUnidades_vent: 0, dispUnidades_proj: 0,
        seguros_obj: 0, seguros_vent: 0, seguros_proj: 0,
        movil_obj: 0, movil_vent: 0, movil_proj: 0,
        repos_obj: 0, repos_vent: 0, repos_proj: 0,
        fttr_obj: 0, fttr_vent: 0, fttr_proj: 0,
    };

    const movistarRows = dataRows.filter(r => r.store !== 'O2');
    const o2Rows = dataRows.filter(r => r.store === 'O2');

    movistarRows.forEach(row => {
        totals.pers += row.pers;
        totals.altasTotales += row.altasTotales;

        totals.bafNoTrasl_obj += row.bafNoTrasl_obj;
        totals.bafNoTrasl_vent += row.bafNoTrasl_vent;
        totals.bafNoTrasl_tram += row.bafNoTrasl_tram;
        totals.bafNoTrasl_proj += row.bafNoTrasl_proj;

        totals.bafConvMS_obj += row.bafConvMS_obj;
        totals.bafConvMS_vent += row.bafConvMS_vent;
        totals.bafConvMS_tram += row.bafConvMS_tram;
        totals.bafConvMS_proj += row.bafConvMS_proj;

        totals.bafNoFusionO2_obj += row.bafNoFusionO2_obj;
        totals.bafNoFusionO2_vent += row.bafNoFusionO2_vent;
        totals.bafNoFusionO2_tram += row.bafNoFusionO2_tram;
        totals.bafNoFusionO2_proj += row.bafNoFusionO2_proj;

        totals.restoBaf_obj += row.restoBaf_obj;
        totals.restoBaf_vent += row.restoBaf_vent;
        totals.restoBaf_tram += row.restoBaf_tram;
        totals.restoBaf_proj += row.restoBaf_proj;

        totals.tvFutbol_obj += row.tvFutbol_obj;
        totals.tvFutbol_vent += row.tvFutbol_vent;
        totals.tvFutbol_proj += row.tvFutbol_proj;

        totals.alarmas_obj += row.alarmas_obj;
        totals.alarmas_vent += row.alarmas_vent;
        totals.alarmas_proj += row.alarmas_proj;

        totals.dispSegEuros_obj += row.dispSegEuros_obj;
        totals.dispSegEuros_vent += row.dispSegEuros_vent;
        totals.dispSegEuros_proj += row.dispSegEuros_proj;

        totals.dispUnidades_obj += row.dispUnidades_obj;
        totals.dispUnidades_vent += row.dispUnidades_vent;
        totals.dispUnidades_proj += row.dispUnidades_proj;

        totals.seguros_obj += row.seguros_obj;
        totals.seguros_vent += row.seguros_vent;
        totals.seguros_proj += row.seguros_proj;

        totals.movil_obj += row.movil_obj;
        totals.movil_vent += row.movil_vent;
        totals.movil_proj += row.movil_proj;

        totals.repos_obj += row.repos_obj;
        totals.repos_vent += row.repos_vent;
        totals.repos_proj += row.repos_proj;

        totals.fttr_obj += row.fttr_obj;
        totals.fttr_vent += row.fttr_vent;
        totals.fttr_proj += row.fttr_proj;
    });

    o2Rows.forEach(row => {
        o2Totals.pers += row.pers;
        o2Totals.altasTotales += row.altasTotales;

        o2Totals.bafNoTrasl_obj += row.bafNoTrasl_obj;
        o2Totals.bafNoTrasl_vent += row.bafNoTrasl_vent;
        o2Totals.bafNoTrasl_tram += row.bafNoTrasl_tram;
        o2Totals.bafNoTrasl_proj += row.bafNoTrasl_proj;

        o2Totals.bafConvMS_obj += row.bafConvMS_obj;
        o2Totals.bafConvMS_vent += row.bafConvMS_vent;
        o2Totals.bafConvMS_tram += row.bafConvMS_tram;
        o2Totals.bafConvMS_proj += row.bafConvMS_proj;
    });

    const DeficitRow = ({ obj, vent = 0, tram = 0, isEuro = false }: { obj: number, vent?: number, tram?: number, isEuro?: boolean }) => {
        const dailyTarget = workingDaysInMonth > 0 ? obj / workingDaysInMonth : 0;
        const expectedToday = dailyTarget * workingDaysElapsed;
        const diff = expectedToday - (vent + tram);
        const isGreen = diff <= 0;
        return (
            <div style={{ 
                backgroundColor: 'transparent',
                color: isGreen ? '#10b981' : '#ef4444',
                padding: '4px',
                textAlign: 'center',
                fontWeight: 700,
                width: '100%',
                height: '100%'
            }}>
                {formatNum(diff, isEuro)}
            </div>
        );
    };

    const PctRow = ({ obj, proj }: { obj: number, proj: number }) => {
        const pct = obj > 0 ? (proj / obj) : 0;
        const isGreen = pct >= 1;
        return (
            <div style={{ 
                backgroundColor: 'transparent',
                color: isGreen ? '#10b981' : '#ef4444',
                padding: '4px',
                textAlign: 'center',
                fontWeight: 700,
                width: '100%',
                height: '100%'
            }}>
                {formatPct(pct)}
            </div>
        );
    };

    const MediaRow = ({ proj, isEuro = false }: { proj: number, isEuro?: boolean }) => {
        // Fórmula requerida: =(Vent+Tram)/dias trabajados * Dias totales del mes
        // proj = (Vent+Tram) * workingDaysInMonth / workingDaysElapsed
        // Lo que es exactamente igual a la variable `proj` calculada por el motor.
        
        return (
            <div style={{ 
                backgroundColor: 'var(--bg-app)',
                color: 'var(--light-text)',
                padding: '4px',
                textAlign: 'center',
                fontWeight: 600,
                width: '100%',
                height: '100%'
            }}>
                {formatNum(proj, isEuro)}
            </div>
        );
    };

    const CellProjPct = ({ obj, proj }: { obj: number, proj: number }) => {
        const pct = obj > 0 ? (proj / obj) : 0;
        const isGreen = pct >= 1;
        return (
            <td style={{ 
                padding: '4px 2px', 
                textAlign: 'center', 
                backgroundColor: 'transparent',
                color: isGreen ? '#10b981' : '#ef4444',
                fontWeight: 700
            }}>
                {formatPct(pct)}
            </td>
        );
    };

    const EditableObjectiveCell = ({ 
        storeName, field, value, periodKey, rowData 
    }: { 
        storeName: string, field: string, value: number, periodKey: string, rowData: any 
    }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [val, setVal] = useState(value.toString());
        const [isSaving, setIsSaving] = useState(false);

        const handleBlur = async () => {
            setIsEditing(false);
            const numVal = parseInt(val) || 0;
            if (numVal !== value) {
                setIsSaving(true);
                const updatedObj = {
                    storeName,
                    bafNoTrasl: field === 'bafNoTrasl' ? numVal : rowData.bafNoTrasl_obj,
                    bafConvMS: field === 'bafConvMS' ? numVal : rowData.bafConvMS_obj,
                    tvFutbol: rowData.tvFutbol_obj,
                    dispSegEuros: rowData.dispSegEuros_obj,
                    repos: rowData.repos_obj,
                    fttr: rowData.fttr_obj,
                    alarmas: rowData.alarmas_obj
                };

                await fetch('/api/tramitacion-objetivos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        periodKey,
                        objectives: [updatedObj]
                    })
                });
                window.location.reload();
            }
        };

        if (isEditing || isSaving) {
            return (
                <td style={{ padding: '2px', textAlign: 'center', backgroundColor: '#e0f2fe' }}>
                    <input 
                        type="number"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={e => e.key === 'Enter' && handleBlur()}
                        disabled={isSaving}
                        autoFocus
                        style={{ width: '40px', textAlign: 'center', padding: '2px', borderRadius: '4px', border: '1px solid #0ea5e9', outline: 'none', background: 'transparent' }}
                    />
                </td>
            );
        }

        return (
            <td 
                onClick={() => setIsEditing(true)}
                style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f0f9ff', cursor: 'pointer', border: '1px dashed #0ea5e9', fontWeight: 700, color: '#0284c7' }}
                title="Haz clic para editar objetivo"
            >
                {value}
            </td>
        );
    };

    const handleProcessPaste = async () => {
        if (!pasteContent.trim()) return;
        setUploading(true);
        try {
            const rows = pasteContent.trim().split('\n').filter(r => r.trim() !== '');
            if (rows.length < 4) {
                alert('Debes pegar al menos 4 filas (Auxiliadora, Correhuela, Villamayor, Béjar)');
                setUploading(false);
                return;
            }

            const cleanNum = (val: string) => {
                if (!val) return 0;
                let s = val.replace(/€/g, '').trim();
                s = s.replace(/\./g, '');
                s = s.replace(/,/g, '.');
                return parseFloat(s) || 0;
            };

            const stores = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar'];
            const objectives = stores.map((storeName, i) => {
                const cols = rows[i].split('\t');
                return {
                    storeName,
                    bafNoTrasl: cleanNum(cols[0]),
                    bafConvMS: cleanNum(cols[1]),
                    tvFutbol: cleanNum(cols[2]),
                    dispSegEuros: cleanNum(cols[3]),
                    repos: cleanNum(cols[4]),
                    fttr: cleanNum(cols[5]),
                    alarmas: cleanNum(cols[6])
                };
            });

            const res = await fetch('/api/tramitacion-objetivos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ periodKey: activePeriodKey, objectives })
            });
            const result = await res.json();
            if (result.success) {
                alert(`Importados objetivos para ${result.count} tiendas.`);
                setShowPasteModal(false);
                setPasteContent('');
                loadData();
            } else {
                alert('Error al guardar objetivos: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            alert('Error procesando los datos pegados.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-app)', minHeight: '100vh', paddingBottom: 80 }}>
            <PageHeader 
                title={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Building2 size={24} color="var(--mercedes-cyan)" /> Seguimiento de Tramitación</div>}
                subtitle="Monitorización y analítica de los productos vendidos y pendientes"
                showBack={true}
                backFallback="/seguimiento-ventas"
                headerActions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={() => setShowPasteModal(true)}
                            style={{
                                background: 'var(--mercedes-cyan)', border: 'none', borderRadius: 8,
                                padding: '6px 12px', color: '#fff', display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(0, 173, 239, 0.3)'
                            }}
                        >
                            <ClipboardPaste size={16} />
                            Pegar Objetivos
                        </button>
                    </div>
                }
            />

            <div style={{
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '1px solid var(--border-color)',
                marginTop: 16,
                overflowX: 'auto',
                boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, whiteSpace: 'nowrap' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#0ea5e9', color: 'white', fontSize: 9.5 }}>
                            <th colSpan={3} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white' }}>
                                {String(new Date().getDate()).padStart(2, '0')}/{String(selectedMonth).padStart(2, '0')}/{selectedYear}
                            </th>
                            <th colSpan={5} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>Total Altas BAF (No trasl.)</th>
                            <th colSpan={5} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>Altas BAF Movistar Conv.</th>
                            <th colSpan={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>TV + Altas Futbol</th>
                            <th colSpan={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>Disp. + Seguro Móvil</th>
                            <th colSpan={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>REPOS BAF ARPU&gt;0</th>
                            <th colSpan={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>FTTR</th>
                            <th colSpan={4} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600, color: 'white', whiteSpace: 'normal', lineHeight: 1.1 }}>ALARMAS MPA</th>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-app)', fontSize: 9, color: 'var(--medium-gray)' }}>
                                <th style={{ padding: '4px 4px', textAlign: 'left', borderRight: '1px solid var(--border-color)' }}>Tiendas</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Pers.</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>Altas</th>
                            
                            {/* BAF */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', color: '#ec4899' }}>Tram</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                            {/* BAF Conv MS */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', color: '#ec4899' }}>Tram</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                            {/* TV Futbol */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                            {/* Dispositivos € */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                            {/* Repos */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                            {/* FTTR */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                            {/* Alarmas */}
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                            <th style={{ padding: '4px 2px', textAlign: 'center' }}>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movistarRows.map((r, i) => (
                            <tr key={r.store} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.01)' }}>
                                <td style={{ padding: '4px 4px', fontWeight: 600, color: 'var(--light-text)', borderRight: '1px solid var(--border-color)' }}>{r.store}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', color: 'var(--medium-gray)', borderRight: '1px solid var(--border-color)' }}>{r.pers}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>{r.altasTotales}</td>

                                {/* BAF */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.bafNoTrasl_obj)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.bafNoTrasl_vent)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>{formatNum(r.bafNoTrasl_tram)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.bafNoTrasl_proj)}</td>
                                <CellProjPct obj={r.bafNoTrasl_obj} proj={r.bafNoTrasl_proj} />

                                {/* BAF Conv MS */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.bafConvMS_obj)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.bafConvMS_vent)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>{formatNum(r.bafConvMS_tram)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.bafConvMS_proj)}</td>
                                <CellProjPct obj={r.bafConvMS_obj} proj={r.bafConvMS_proj} />

                                {/* TV */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.tvFutbol_obj)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.tvFutbol_vent)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.tvFutbol_proj)}</td>
                                <CellProjPct obj={r.tvFutbol_obj} proj={r.tvFutbol_proj} />

                                {/* Disp € */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.dispSegEuros_obj, true)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.dispSegEuros_vent, true)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.dispSegEuros_proj, true)}</td>
                                <CellProjPct obj={r.dispSegEuros_obj} proj={r.dispSegEuros_proj} />

                                {/* Repos */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.repos_obj)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.repos_vent)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.repos_proj)}</td>
                                <CellProjPct obj={r.repos_obj} proj={r.repos_proj} />

                                {/* FTTR */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.fttr_obj)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.fttr_vent)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.fttr_proj)}</td>
                                <CellProjPct obj={r.fttr_obj} proj={r.fttr_proj} />

                                {/* Alarmas */}
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#f3f4f6' }}>{formatNum(r.alarmas_obj)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.alarmas_vent)}</td>
                                <td style={{ padding: '4px 2px', textAlign: 'center', backgroundColor: '#e5e7eb', color: '#374151' }}>{formatNum(r.alarmas_proj)}</td>
                                <CellProjPct obj={r.alarmas_obj} proj={r.alarmas_proj} />
                            </tr>
                        ))}

                        {/* TOTALS ROW */}
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid var(--border-color)', borderBottom: '2px solid var(--border-color)' }}>
                            <td style={{ padding: '4px 4px', fontWeight: 700, color: '#0f172a', borderRight: '1px solid var(--border-color)' }}>{totals.store}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, color: '#0f172a', borderRight: '1px solid var(--border-color)' }}>{totals.pers}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, color: '#0f172a', borderRight: '2px solid var(--border-color)' }}>{totals.altasTotales}</td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.bafNoTrasl_obj)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.bafNoTrasl_vent)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, color: '#ec4899' }}>{formatNum(totals.bafNoTrasl_tram)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.bafNoTrasl_proj)}</td>
                            <td style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}></td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.bafConvMS_obj)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.bafConvMS_vent)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, color: '#ec4899' }}>{formatNum(totals.bafConvMS_tram)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.bafConvMS_proj)}</td>
                            <td style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}></td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.tvFutbol_obj)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.tvFutbol_vent)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.tvFutbol_proj)}</td>
                            <td style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}></td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.dispSegEuros_obj, true)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.dispSegEuros_vent, true)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.dispSegEuros_proj, true)}</td>
                            <td style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}></td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.repos_obj)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.repos_vent)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.repos_proj)}</td>
                            <td style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}></td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.fttr_obj)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.fttr_vent)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.fttr_proj)}</td>
                            <td style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}></td>

                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.alarmas_obj)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.alarmas_vent)}</td>
                            <td style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700 }}>{formatNum(totals.alarmas_proj)}</td>
                            <td style={{ padding: '0' }}></td>
                        </tr>

                        {/* Deficit Row */}
                        <tr style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                            <td colSpan={3} style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--border-color)', color: '#0369a1' }}>Necesitamos Hoy Deficit</td>
                            <td colSpan={5} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={totals.bafNoTrasl_obj} vent={totals.bafNoTrasl_vent} tram={totals.bafNoTrasl_tram} /></td>
                            <td colSpan={5} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={totals.bafConvMS_obj} vent={totals.bafConvMS_vent} tram={totals.bafConvMS_tram} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={totals.tvFutbol_obj} vent={totals.tvFutbol_vent} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={totals.dispSegEuros_obj} vent={totals.dispSegEuros_vent} isEuro /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={totals.repos_obj} vent={totals.repos_vent} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={totals.fttr_obj} vent={totals.fttr_vent} /></td>
                            <td colSpan={4} style={{ padding: '0' }}><DeficitRow obj={totals.alarmas_obj} vent={totals.alarmas_vent} /></td>
                        </tr>

                        {/* Pct Row */}
                        <tr style={{ backgroundColor: '#f8fafc', color: '#0f172a' }}>
                            <td colSpan={3} style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>Proyect Porcentaje</td>
                            <td colSpan={5} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={totals.bafNoTrasl_obj} proj={totals.bafNoTrasl_proj} /></td>
                            <td colSpan={5} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={totals.bafConvMS_obj} proj={totals.bafConvMS_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={totals.tvFutbol_obj} proj={totals.tvFutbol_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={totals.dispSegEuros_obj} proj={totals.dispSegEuros_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={totals.repos_obj} proj={totals.repos_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={totals.fttr_obj} proj={totals.fttr_proj} /></td>
                            <td colSpan={4} style={{ padding: '0' }}><PctRow obj={totals.alarmas_obj} proj={totals.alarmas_proj} /></td>
                        </tr>

                        {/* Media Row */}
                        <tr style={{ backgroundColor: 'var(--bg-app)', color: 'var(--light-text)' }}>
                            <td colSpan={3} style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>Proyect una Media de</td>
                            <td colSpan={5} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={totals.bafNoTrasl_proj} /></td>
                            <td colSpan={5} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={totals.bafConvMS_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={totals.tvFutbol_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={totals.dispSegEuros_proj} isEuro /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={totals.repos_proj} /></td>
                            <td colSpan={4} style={{ padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={totals.fttr_proj} /></td>
                            <td colSpan={4} style={{ padding: '0' }}><MediaRow proj={totals.alarmas_proj} /></td>
                        </tr>

                        {/* O2 Separated Row */}
                        {o2Rows.length > 0 && (
                            <>
                                <tr>
                                    <td colSpan={50} style={{ height: '16px' }}></td>
                                </tr>
                                <tr>
                                    <th colSpan={3} style={{ backgroundColor: '#0ea5e9', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>Tiendas O2</th>
                                    <th colSpan={5} style={{ backgroundColor: '#0ea5e9', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>Altas/Portas Fibra</th>
                                    <th colSpan={5} style={{ backgroundColor: '#0ea5e9', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.2)', padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>Internas Fibra</th>
                                </tr>
                                <tr style={{ fontSize: 9, color: 'var(--medium-gray)' }}>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 4px', textAlign: 'left', borderRight: '1px solid var(--border-color)' }}>Nombre Comercial PdV</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>Pers</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>Total Altas</th>
                                    
                                    {/* BAF -> Altas/Portas Fibra */}
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', color: '#ec4899', padding: '4px 2px', textAlign: 'center' }}>Tram</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>

                                    {/* BAF Conv MS -> Internas Fibra */}
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center' }}>Obj</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center' }}>Vent</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', color: '#ec4899', padding: '4px 2px', textAlign: 'center' }}>Tram</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center' }}>Proy</th>
                                    <th style={{ backgroundColor: 'var(--bg-app)', padding: '4px 2px', textAlign: 'center', borderRight: '2px solid var(--border-color)' }}>%</th>
                                </tr>
                                {o2Rows.map((r, i) => (
                                    <tr key={r.store}>
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 4px', fontWeight: 600, color: 'var(--light-text)', borderRight: '1px solid var(--border-color)' }}>{r.store}</td>
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', color: 'var(--medium-gray)', borderRight: '1px solid var(--border-color)' }}>{r.pers}</td>
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>{r.altasTotales}</td>

                                        {/* BAF */}
                                        <EditableObjectiveCell storeName={r.store} field="bafNoTrasl" value={r.bafNoTrasl_obj} periodKey={activePeriodKey} rowData={r} />
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.bafNoTrasl_vent)}</td>
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>{formatNum(r.bafNoTrasl_tram)}</td>
                                        <td style={{ backgroundColor: '#e5e7eb', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', color: '#374151' }}>{formatNum(r.bafNoTrasl_proj)}</td>
                                        <CellProjPct obj={r.bafNoTrasl_obj} proj={r.bafNoTrasl_proj} />

                                        {/* BAF Conv MS */}
                                        <EditableObjectiveCell storeName={r.store} field="bafConvMS" value={r.bafConvMS_obj} periodKey={activePeriodKey} rowData={r} />
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', fontWeight: 600 }}>{formatNum(r.bafConvMS_vent)}</td>
                                        <td style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', color: '#ec4899', fontWeight: 600 }}>{formatNum(r.bafConvMS_tram)}</td>
                                        <td style={{ backgroundColor: '#e5e7eb', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center', color: '#374151' }}>{formatNum(r.bafConvMS_proj)}</td>
                                        <CellProjPct obj={r.bafConvMS_obj} proj={r.bafConvMS_proj} />
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={13} style={{ borderTop: '2px solid var(--border-color)', height: '6px' }}></td>
                                </tr>
                                <tr>
                                    <td colSpan={3} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 4px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>Necesitamos Hoy Deficit</td>
                                    <td colSpan={5} style={{ backgroundColor: '#e0f2fe', padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={o2Totals.bafNoTrasl_obj} vent={o2Totals.bafNoTrasl_vent} tram={o2Totals.bafNoTrasl_tram} /></td>
                                    <td colSpan={5} style={{ backgroundColor: '#e0f2fe', padding: '0', borderRight: '2px solid var(--border-color)' }}><DeficitRow obj={o2Totals.bafConvMS_obj} vent={o2Totals.bafConvMS_vent} tram={o2Totals.bafConvMS_tram} /></td>
                                </tr>
                                <tr>
                                    <td colSpan={3} style={{ backgroundColor: '#f8fafc', color: '#0f172a', padding: '4px 4px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>Proyect Porcentaje</td>
                                    <td colSpan={5} style={{ backgroundColor: '#f8fafc', padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={o2Totals.bafNoTrasl_obj} proj={o2Totals.bafNoTrasl_proj} /></td>
                                    <td colSpan={5} style={{ backgroundColor: '#f8fafc', padding: '0', borderRight: '2px solid var(--border-color)' }}><PctRow obj={o2Totals.bafConvMS_obj} proj={o2Totals.bafConvMS_proj} /></td>
                                </tr>
                                <tr>
                                    <td colSpan={3} style={{ backgroundColor: 'var(--bg-app)', color: 'var(--light-text)', padding: '4px 4px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--border-color)' }}>Proyect una Media de</td>
                                    <td colSpan={5} style={{ backgroundColor: 'var(--bg-app)', padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={o2Totals.bafNoTrasl_proj} /></td>
                                    <td colSpan={5} style={{ backgroundColor: 'var(--bg-app)', padding: '0', borderRight: '2px solid var(--border-color)' }}><MediaRow proj={o2Totals.bafConvMS_proj} /></td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* PASTE MODAL */}
            {showPasteModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        background: 'var(--bg-card)', width: 600, borderRadius: 16,
                        boxShadow: '0 24px 48px rgba(0,0,0,0.2)', overflow: 'hidden',
                        border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'rgba(0,153,204,0.05)'
                        }}>
                            <h3 style={{ margin: 0, color: 'var(--light-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <ClipboardPaste size={20} color="var(--mercedes-cyan)" />
                                Pegar Objetivos desde Excel
                            </h3>
                            <button 
                                onClick={() => setShowPasteModal(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: 24, flex: 1 }}>
                            <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--medium-gray)' }}>
                                Copia en tu Excel el bloque de números (4 filas y 7 columnas, sin las cabeceras ni el nombre de la tienda) y pégalo aquí abajo:
                            </p>
                            <textarea 
                                value={pasteContent}
                                onChange={e => setPasteContent(e.target.value)}
                                placeholder="28&#9;17&#9;11&#9;28.795,00 €&#9;19&#9;2&#9;2&#10;14&#9;9&#9;7&#9;17.838,00 €&#9;13&#9;1&#9;2..."
                                style={{
                                    width: '100%', height: 160, padding: 12, borderRadius: 8,
                                    border: '1px solid var(--border-color)', background: 'var(--bg-app)',
                                    color: 'var(--light-text)', fontFamily: 'monospace', fontSize: 12, resize: 'none'
                                }}
                            />
                        </div>
                        <div style={{
                            padding: '16px 24px', borderTop: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-app)'
                        }}>
                            <button 
                                onClick={() => setShowPasteModal(false)}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color)',
                                    background: 'transparent', color: 'var(--light-text)', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleProcessPaste}
                                disabled={uploading || !pasteContent.trim()}
                                style={{
                                    padding: '8px 20px', borderRadius: 8, border: 'none',
                                    background: 'var(--mercedes-cyan)', color: '#fff', fontWeight: 600, cursor: 'pointer',
                                    opacity: (!pasteContent.trim() || uploading) ? 0.5 : 1
                                }}
                            >
                                {uploading ? 'Procesando...' : 'Guardar Objetivos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
