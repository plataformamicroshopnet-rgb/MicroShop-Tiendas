'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { TrendingUp, Users, Calendar, Save, RefreshCw } from 'lucide-react'

// Utilidad para formatear moneda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Definición de las filas base
const ROWS_CONFIG = [
  { id: 'totalCobradoIva', label: 'TOTAL COBRADO IVA Inc', group: 'Generales', color: '#0ea5e9', bg: '#e0f2fe', isEditable: true },
  { id: 'totalCobradoSinIva', label: 'TOTAL COBRADO sin IVA', group: 'Generales', color: '#0284c7', bg: '#bae6fd', isEditable: true },
  
  { id: 'totalIngresosTiendas', label: 'Total Ingresos Tiendas', group: 'Tiendas', color: '#ffffff', bg: '#4d7c0f', isEditable: false, isBold: true },
  { id: 'cajaTiendas', label: 'Caja Tiendas', group: 'Tiendas', color: '#2563eb', bg: '#ffffff', isEditable: true },
  { id: 'comisionesTiendasLocales', label: 'Comisiones Tiendas Locales', group: 'Tiendas', color: '#2563eb', bg: '#ffffff', isEditable: true },
  { id: 'prvTiendas', label: 'PRV', group: 'Tiendas', color: '#8b5cf6', bg: '#ffffff', isEditable: true },
  { id: 'gastosTiendas', label: 'Gastos Tiendas', group: 'Tiendas', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'comisionesTiendas', label: 'Comisiones Tiendas', group: 'Tiendas', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'realGananciasTiendas', label: 'Real Ganancias Tiendas', group: 'Tiendas', color: '#ffffff', bg: '#84cc16', isEditable: false, isBold: true },
  
  { id: 'totalIngresosFfvv', label: 'Total Ingresos FFVV', group: 'FFVV', color: '#ffffff', bg: '#4d7c0f', isEditable: false, isBold: true },
  { id: 'cajaFfvv', label: 'Caja FFVV', group: 'FFVV', color: '#2563eb', bg: '#ffffff', isEditable: true },
  { id: 'produccionPlus', label: 'Producción Plus', group: 'FFVV', color: '#2563eb', bg: '#ffffff', isEditable: true },
  { id: 'produccionBasico', label: 'Producción Básico', group: 'FFVV', color: '#2563eb', bg: '#ffffff', isEditable: true },
  { id: 'prvFfvv', label: 'PRV', group: 'FFVV', color: '#8b5cf6', bg: '#ffffff', isEditable: true },
  { id: 'gastosFfvv', label: 'Gastos FFVV', group: 'FFVV', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'realGananciasFfvv', label: 'Real Ganancias FFVV', group: 'FFVV', color: '#ffffff', bg: '#84cc16', isEditable: false, isBold: true },

  { id: 'totalGanancias', label: 'Total Ganancias', group: 'Totales', color: '#ffffff', bg: '#0ea5e9', isEditable: false, isBold: true, fontSize: 16 },
  
  { id: 'numComercialesFfvv', label: 'Nº Comerciales FFVV', group: 'Media', color: '#000000', bg: '#fef08a', isEditable: true, isNumber: true },
];

export default function GananciasPage() {
  const [activeTab, setActiveTab] = useState<'balance' | 'media'>('balance');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  
  // Datos crudos del servidor
  const [records, setRecords] = useState<any[]>([]);
  const [allYearsRecords, setAllYearsRecords] = useState<any[]>([]);

  // Array de años disponibles (2011 al 2026)
  const availableYears = Array.from({length: 16}, (_, i) => 2026 - i);

  useEffect(() => {
    fetchData(selectedYear);
    if (activeTab === 'media') {
      fetchAllYears();
    }
  }, [selectedYear, activeTab]);

  const fetchData = async (year: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ganancias?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        // Asegurar que tenemos 12 meses
        const fullYearData = Array.from({length: 12}, (_, i) => {
          const monthData = data.find((d: any) => d.month === i + 1);
          return monthData || { month: i + 1, year };
        });
        setRecords(fullYearData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllYears = async () => {
    // Para simplificar, hacemos promesas en paralelo para algunos años recientes, o habría que hacer un endpoint de todos.
    // Como es para la pestaña 2, lo ideal sería tener un endpoint. Vamos a iterar.
    try {
      let allData: any[] = [];
      for(let y = 2018; y <= 2026; y++) {
         const res = await fetch(`/api/admin/ganancias?year=${y}`);
         if(res.ok) {
             const data = await res.json();
             allData = [...allData, ...data];
         }
      }
      setAllYearsRecords(allData);
    } catch (e) {}
  };

  // Cálculos dinámicos para un mes específico
  const getCalculatedMonth = (monthRecord: any) => {
    const data = monthRecord || {};
    const safeNum = (val: any) => Number(val) || 0;

    const totalIngresosTiendas = safeNum(data.cajaTiendas) + safeNum(data.comisionesTiendasLocales) + safeNum(data.prvTiendas);
    const realGananciasTiendas = totalIngresosTiendas - safeNum(data.gastosTiendas) - safeNum(data.comisionesTiendas);
    
    const totalIngresosFfvv = safeNum(data.cajaFfvv) + safeNum(data.produccionPlus) + safeNum(data.produccionBasico) + safeNum(data.prvFfvv);
    const realGananciasFfvv = totalIngresosFfvv - safeNum(data.gastosFfvv);
    
    const totalGanancias = realGananciasTiendas + realGananciasFfvv;

    return {
      ...data,
      totalIngresosTiendas,
      realGananciasTiendas,
      totalIngresosFfvv,
      realGananciasFfvv,
      totalGanancias
    };
  };

  // Datos calculados para la tabla
  const computedRecords = records.map(getCalculatedMonth);

  // Totales anuales
  const getYearTotals = (fieldId: string) => {
    return computedRecords.reduce((acc, curr) => acc + (Number(curr[fieldId]) || 0), 0);
  };

  const getMonthlyAverage = (fieldId: string) => {
    return getYearTotals(fieldId) / 12;
  };

  const handleCellChange = async (monthIndex: number, field: string, value: string) => {
    const numericValue = value.replace(/[^0-9.-]+/g, ""); // Permitir negativo y decimales
    if (isNaN(Number(numericValue))) return;

    // Optimistic update
    const newRecords = [...records];
    newRecords[monthIndex] = { ...newRecords[monthIndex], [field]: Number(numericValue) };
    setRecords(newRecords);
  };

  const handleCellBlur = async (monthIndex: number, field: string, value: string) => {
    const numericValue = Number(value.replace(/[^0-9.-]+/g, ""));
    const month = monthIndex + 1;
    
    setSavingField(`${month}-${field}`);
    try {
      await fetch('/api/admin/ganancias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month, field, value: numericValue })
      });
    } catch (e) {
      console.error(e);
      alert('Error al guardar el dato');
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <PageHeader 
        title={<><TrendingUp color="var(--mercedes-cyan)" size={28} /> Ganancias MicroShop</>}
        subtitle="Dashboard Financiero Macro e Histórico (2011 - 2026)"
        showBack={true}
        backFallback="/admin"
      />

      {/* Controles: Pestañas y Año */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: '#fff', padding: '12px 24px', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
            <button 
                onClick={() => setActiveTab('balance')}
                style={{ padding: '10px 20px', borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s', background: activeTab === 'balance' ? 'var(--mercedes-cyan)' : '#f3f4f6', color: activeTab === 'balance' ? '#fff' : '#4b5563', display: 'flex', alignItems: 'center', gap: 8 }}
            >
                <TrendingUp size={18} /> Balance Anual
            </button>
            <button 
                onClick={() => setActiveTab('media')}
                style={{ padding: '10px 20px', borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s', background: activeTab === 'media' ? 'var(--mercedes-cyan)' : '#f3f4f6', color: activeTab === 'media' ? '#fff' : '#4b5563', display: 'flex', alignItems: 'center', gap: 8 }}
            >
                <Users size={18} /> Media por Comercial
            </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Calendar size={20} color="#6b7280" />
            <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 16, fontWeight: 600, outline: 'none' }}
            >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
            Cargando datos financieros de {selectedYear}...
        </div>
      ) : activeTab === 'balance' ? (
        /* PESTAÑA 1: BALANCE ANUAL (ESTILO EXCEL) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* TABLA PRINCIPAL: MESES */}
            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 10.5, whiteSpace: 'nowrap' }}>
                    <thead>
                        <tr>
                            <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#0ea5e9', color: '#fff', padding: '6px 8px', textAlign: 'left', minWidth: 160, borderRight: '1px solid #bae6fd' }}>
                                Ingresos y Gastos {selectedYear}
                            </th>
                            {MONTHS.map(m => (
                                <th key={m} style={{ background: '#0ea5e9', color: '#fff', padding: '6px 8px', textAlign: 'center', minWidth: 80, borderRight: '1px solid #bae6fd' }}>{m.slice(0, 3)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS_CONFIG.map((rowConfig, idx) => (
                            <tr key={rowConfig.id} style={{ borderBottom: '1px solid #e5e7eb', ...(rowConfig.id === 'totalIngresosFfvv' ? { borderTop: '6px solid #e5e7eb' } : {}) }}>
                                {/* Celda Etiqueta Fija */}
                                <td style={{ 
                                    position: 'sticky', left: 0, zIndex: 10, 
                                    background: rowConfig.bg, 
                                    color: rowConfig.color, 
                                    fontWeight: rowConfig.isBold ? 700 : 500,
                                    fontSize: rowConfig.fontSize ? rowConfig.fontSize - 3 : 10.5,
                                    padding: '4px 8px',
                                    borderRight: '1px solid #d1d5db',
                                    borderBottom: '1px solid #d1d5db'
                                }}>
                                    {rowConfig.label}
                                </td>

                                {/* Celdas de Meses */}
                                {computedRecords.map((monthData, mIdx) => {
                                    const isSaving = savingField === `${mIdx+1}-${rowConfig.id}`;
                                    const isEditing = editingCell === `${mIdx}-${rowConfig.id}`;
                                    const rawVal = monthData[rowConfig.id] || 0;
                                    const isFakeZero = rawVal === 0 && !monthData.hasOwnProperty(rowConfig.id);
                                    const displayValue = isEditing 
                                        ? (isFakeZero ? '' : rawVal) 
                                        : (isFakeZero ? '' : (rowConfig.isNumber ? rawVal : formatCurrency(rawVal)));
                                    
                                    return (
                                    <td key={mIdx} style={{ 
                                        background: rowConfig.isEditable ? '#fff' : rowConfig.bg,
                                        borderRight: '1px solid #e5e7eb',
                                        position: 'relative',
                                        padding: 0
                                    }}>
                                        {rowConfig.isEditable ? (
                                            <input 
                                                type="text"
                                                value={displayValue}
                                                onFocus={() => setEditingCell(`${mIdx}-${rowConfig.id}`)}
                                                onChange={(e) => handleCellChange(mIdx, rowConfig.id, e.target.value)}
                                                onBlur={(e) => {
                                                    setEditingCell(null);
                                                    handleCellBlur(mIdx, rowConfig.id, e.target.value);
                                                }}
                                                style={{
                                                    width: '100%', height: '100%', padding: '4px 8px',
                                                    border: 'none', outline: 'none', textAlign: 'right',
                                                    background: 'transparent',
                                                    color: rowConfig.color,
                                                    fontWeight: 500,
                                                    fontSize: 10.5,
                                                    opacity: isSaving ? 0.5 : 1
                                                }}
                                                placeholder="-"
                                            />
                                        ) : (
                                            <div style={{ 
                                                padding: '4px 8px', textAlign: 'right', 
                                                color: rowConfig.color, 
                                                fontWeight: rowConfig.isBold ? 700 : 500,
                                                fontSize: rowConfig.fontSize ? rowConfig.fontSize - 3 : 10.5
                                            }}>
                                                {formatCurrency(monthData[rowConfig.id] || 0)}
                                            </div>
                                        )}
                                        {isSaving && <Save size={12} style={{ position: 'absolute', left: 4, top: 12, color: '#9ca3af', animation: 'pulse 1s infinite' }}/>}
                                    </td>
                                )})}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* TABLAS DE RESUMEN (TOTALES Y MEDIAS DEBAJO, DIVIDIDAS EN DOS COLUMNAS) */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Tabla Izquierda: Tiendas */}
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', flex: '1 1 300px', maxWidth: 'max-content' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 10.5, whiteSpace: 'nowrap', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ background: '#0ea5e9', color: '#fff', padding: '6px 8px', textAlign: 'left', minWidth: 160, borderRight: '1px solid #bae6fd' }}>
                                    Resumen Tiendas {selectedYear}
                                </th>
                                <th style={{ background: '#0284c7', color: '#fff', padding: '6px 8px', textAlign: 'center', minWidth: 100, borderRight: '1px solid #bae6fd' }}>Totales</th>
                                <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'center', minWidth: 100 }}>Media Mensual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS_CONFIG.slice(0, 9).map((rowConfig, idx) => (
                                <tr key={rowConfig.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    {/* Celda Etiqueta */}
                                    <td style={{ 
                                        background: rowConfig.bg, 
                                        color: rowConfig.color, 
                                        fontWeight: rowConfig.isBold ? 700 : 500,
                                        fontSize: rowConfig.fontSize ? rowConfig.fontSize - 3 : 10.5,
                                        padding: '4px 8px',
                                        borderRight: '1px solid #d1d5db',
                                        borderBottom: '1px solid #d1d5db'
                                    }}>
                                        {rowConfig.label}
                                    </td>
                                    {/* Celda Total */}
                                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: rowConfig.color, background: '#f8fafc', borderRight: '1px solid #e5e7eb' }}>
                                        {rowConfig.isNumber ? getYearTotals(rowConfig.id) : formatCurrency(getYearTotals(rowConfig.id))}
                                    </td>
                                    {/* Celda Media Mensual */}
                                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: rowConfig.color, background: '#f0f9ff' }}>
                                        {rowConfig.isNumber ? getMonthlyAverage(rowConfig.id).toFixed(2) : formatCurrency(getMonthlyAverage(rowConfig.id))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Tabla Derecha: FFVV */}
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', flex: '1 1 300px', maxWidth: 'max-content' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 10.5, whiteSpace: 'nowrap', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ background: '#0ea5e9', color: '#fff', padding: '6px 8px', textAlign: 'left', minWidth: 160, borderRight: '1px solid #bae6fd' }}>
                                    Resumen FFVV {selectedYear}
                                </th>
                                <th style={{ background: '#0284c7', color: '#fff', padding: '6px 8px', textAlign: 'center', minWidth: 100, borderRight: '1px solid #bae6fd' }}>Totales</th>
                                <th style={{ background: '#0369a1', color: '#fff', padding: '6px 8px', textAlign: 'center', minWidth: 100 }}>Media Mensual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ROWS_CONFIG.slice(9).map((rowConfig, idx) => (
                                <tr key={rowConfig.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    {/* Celda Etiqueta */}
                                    <td style={{ 
                                        background: rowConfig.bg, 
                                        color: rowConfig.color, 
                                        fontWeight: rowConfig.isBold ? 700 : 500,
                                        fontSize: rowConfig.fontSize ? rowConfig.fontSize - 3 : 10.5,
                                        padding: '4px 8px',
                                        borderRight: '1px solid #d1d5db',
                                        borderBottom: '1px solid #d1d5db'
                                    }}>
                                        {rowConfig.label}
                                    </td>
                                    {/* Celda Total */}
                                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: rowConfig.color, background: '#f8fafc', borderRight: '1px solid #e5e7eb' }}>
                                        {rowConfig.isNumber ? getYearTotals(rowConfig.id) : formatCurrency(getYearTotals(rowConfig.id))}
                                    </td>
                                    {/* Celda Media Mensual */}
                                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: rowConfig.color, background: '#f0f9ff' }}>
                                        {rowConfig.isNumber ? getMonthlyAverage(rowConfig.id).toFixed(2) : formatCurrency(getMonthlyAverage(rowConfig.id))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      ) : (
        /* PESTAÑA 2: MEDIA POR COMERCIAL */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
             {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map(year => {
                 const yearRecords = allYearsRecords.filter(r => r.year === year);
                 if (yearRecords.length === 0) return null;

                 // Asegurar 12 meses
                 const fullYearData = Array.from({length: 12}, (_, i) => {
                    const monthData = yearRecords.find((d: any) => d.month === i + 1);
                    return monthData || { month: i + 1, year };
                 });

                 const totalPrv = fullYearData.reduce((acc, curr) => acc + (Number(curr.prvFfvv) || 0), 0);
                 const avgNumComerciales = fullYearData.reduce((acc, curr) => acc + (Number(curr.numComercialesFfvv) || 0), 0) / 12;
                 const avgPrvDividido = fullYearData.reduce((acc, curr) => {
                     const num = Number(curr.numComercialesFfvv) || 1; // evitar division por 0
                     return acc + ((Number(curr.prvFfvv) || 0) / num);
                 }, 0) / 12;

                 return (
                     <div key={year} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                         <div style={{ background: '#fef08a', padding: '8px 16px', textAlign: 'center', fontWeight: 800, fontSize: 16 }}>{year}</div>
                         <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
                             <tbody>
                                 <tr style={{ background: '#fef9c3', borderBottom: '1px solid #fde047' }}>
                                     <td style={{ padding: '12px', fontWeight: 700, width: 200, borderRight: '1px solid #fde047' }}>PRV FFVV</td>
                                     {fullYearData.map((d, i) => (
                                         <td key={i} style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(Number(d.prvFfvv) || 0)}</td>
                                     ))}
                                     <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, background: '#fff' }}>{formatCurrency(totalPrv / 12)} (Media)</td>
                                 </tr>
                                 <tr>
                                     <td style={{ padding: '12px', fontWeight: 700, borderRight: '1px solid #e5e7eb' }}>Dividido de {avgNumComerciales.toFixed(1)} FFVV</td>
                                     {fullYearData.map((d, i) => {
                                         const num = Number(d.numComercialesFfvv) || 1;
                                         const val = (Number(d.prvFfvv) || 0) / num;
                                         return <td key={i} style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(val)}</td>
                                     })}
                                     <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, background: '#f8fafc' }}>{formatCurrency(avgPrvDividido)} (Media)</td>
                                 </tr>
                             </tbody>
                         </table>
                     </div>
                 )
             })}
             {allYearsRecords.length === 0 && (
                 <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', background: '#fff', borderRadius: 12 }}>
                     No hay datos históricos cargados para generar la comparativa de comerciales.
                 </div>
             )}
        </div>
      )}

    </div>
  )
}
