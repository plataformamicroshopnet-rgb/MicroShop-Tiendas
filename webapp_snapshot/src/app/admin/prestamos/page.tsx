'use client'

import React, { useState, useEffect, Fragment } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Landmark, Save, RefreshCw, Settings2, EyeOff, BarChart3, Table2, Droplets } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, BarChart, Bar } from 'recharts'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

const formatCompactCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(value || 0);
}

const ROWS_CONFIG = [
  // PASIVOS Y CREDITOS
  { id: 'lineaCredito', label: 'Línea de Credito + Cta Empresa Santander', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'cuentaCorriente', label: 'Cuenta Corriente Empresa Unicaja', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'icoUnicaja1', label: '1º ICO de Unicaja', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'depositoIberabal', label: 'Deposito Iberabal', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'icoUnicaja2', label: '2º ICO de Unicaja', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'impuestosHacienda', label: 'Impuestos Hacienda IVA, etc', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'aplazamientoHacienda', label: 'Aplazamiento Hacienda AHORA', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'prestamoPadres', label: 'Prestamo de mis Padres', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'pagoMultaHacienda', label: 'Pago Multa Hacienda', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'despidos', label: 'Despidos', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'inversionOficinas', label: 'Inversión Oficinas FFVV + Tiendas', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'creditoTitoVergara', label: 'Credito Tito Piso C/ Vergara', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'creditoMicroInfor', label: 'Crédito a Micro Infor (Tito)', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'creditoEmpresaPiso', label: 'Credito Empresa Piso C/ Vergara (Tito)', group: 'Creditos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'totalCreditos', label: 'TOTAL CREDITOS + IMPUESTOS', group: 'Totales', color: '#ffffff', bg: '#ef4444', isEditable: false, isBold: true },

  // ACTIVOS A FAVOR
  { id: 'stockMovistar', label: 'Stock MoviStar + Accesorios', group: 'Activos', color: '#0ea5e9', bg: '#f0f9ff', isEditable: true },
  { id: 'deudaZeleris', label: 'Deuda a Zeleris', group: 'Activos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
  { id: 'stockMovilfree', label: 'Stock MovilFree + Accesorios', group: 'Activos', color: '#0ea5e9', bg: '#f0f9ff', isEditable: true },
  { id: 'deudaMovistar', label: 'Debe MoviStar', group: 'Activos', color: '#0ea5e9', bg: '#f0f9ff', isEditable: true },
  { id: 'aFavor', label: 'A FAVOR', group: 'Totales', color: '#ffffff', bg: '#0ea5e9', isEditable: false, isBold: true },
  
  { id: 'totalGlobal1', label: 'TOTAL DEBE + CREDITOS + STOCK', group: 'Totales', color: '#ffffff', bg: '#1e293b', isEditable: false, isBold: true, fontSize: 13 },

  // VALOR EMPRESA
  { id: 'valorEmpresa', label: 'Valor EMPRESA', group: 'Empresa', color: '#84cc16', bg: '#f7fee7', isEditable: true },
  { id: 'valorEmpresaBalance', label: 'VALOR EMPRESA CON BALANCE', group: 'Totales', color: '#ffffff', bg: '#65a30d', isEditable: false, isBold: true, fontSize: 13 },

  // PATRIMONIO PERSONAL
  { id: 'planPensiones', label: 'Plan de Pensiones', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: true },
  { id: 'cuentasYCaja', label: 'En Cuentas y Caja (Automático)', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: false },
  { id: 'prestamosEmpresa', label: 'En prestamos a la Empresa (Automático)', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: false },
  { id: 'prestamosHipotecaCampoamor', label: 'En Prestamos (Hipoteca Campoamor)', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: true },
  { id: 'pisosCampoamorRecreo', label: 'Pisos Campoamor, Recreo...', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: true },
  { id: 'pisosPrincipeVergara', label: 'Pisos Principe Vergara + Independencia', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: true },
  { id: 'valorCoche', label: 'Valor Coche', group: 'Patrimonio', color: '#6366f1', bg: '#eef2ff', isEditable: true },
  { id: 'patrimonioPersonal', label: 'PATRIMONIO PERSONAL', group: 'Totales', color: '#ffffff', bg: '#4f46e5', isEditable: false, isBold: true },

  // RESUMEN FINAL
  { id: 'patrimonioTotal', label: 'PATRIMONIO + VALOR EMPRESA', group: 'Resumen', color: '#000000', bg: '#fef08a', isEditable: false, isBold: true, fontSize: 14 },
  { id: 'gananciasPorAno', label: 'Ganancias por Año (Crecimiento)', group: 'Resumen', color: '#ffffff', bg: '#059669', isEditable: false, isBold: true, fontSize: 14 },
];

const LIQUIDEZ_ROWS_CONFIG = [
    { id: 'liqSantander', label: 'Banco Santander Cuenta Personal', group: 'Cuentas', color: '#0369a1', bg: '#e0f2fe', isEditable: true },
    { id: 'liqUnicaja', label: 'Unicaja Cuenta Personal', group: 'Cuentas', color: '#0369a1', bg: '#e0f2fe', isEditable: true },
    { id: 'liqCajaMetalico', label: 'Caja Metálico', group: 'Cuentas', color: '#0369a1', bg: '#e0f2fe', isEditable: true },
    
    { id: 'liqRentaCampoamor', label: 'Renta Piso Avenida de Campoamor', group: 'Rentas', color: '#16a34a', bg: '#dcfce7', isEditable: true },
    { id: 'liqRentaRecreo', label: 'Renta Piso Calle Recreo', group: 'Rentas', color: '#16a34a', bg: '#dcfce7', isEditable: true },
    { id: 'liqRentaVillaviciosa', label: 'Renta Piso Calle Villaviciosa', group: 'Rentas', color: '#16a34a', bg: '#dcfce7', isEditable: true },
    
    // Compartido
    { id: 'planPensiones', label: 'Plan de Pensiones', group: 'Inversiones', color: '#6366f1', bg: '#eef2ff', isEditable: true },
    
    { id: 'liqPrestamoEmpresaPiso', label: 'Prestamo mio a la Empresa del Piso', group: 'PrestamosEmpresa', color: '#d97706', bg: '#fef3c7', isEditable: true },
    { id: 'liqPrestamoEmpresa', label: 'Prestamo mio a la Empresa', group: 'PrestamosEmpresa', color: '#d97706', bg: '#fef3c7', isEditable: true },
    { id: 'liqPrestamoEmpresaImpuestos', label: 'Prestamo mio a la Empresa Impuestos', group: 'PrestamosEmpresa', color: '#d97706', bg: '#fef3c7', isEditable: true },
    { id: 'liqPrestamoEmpresaFinMes', label: 'Prestamo mio a la Empresa Fin de Mes', group: 'PrestamosEmpresa', color: '#d97706', bg: '#fef3c7', isEditable: true },
    { id: 'liqInteresesPrestamo', label: 'Intereses Prestamo a la Empresa', group: 'PrestamosEmpresa', color: '#d97706', bg: '#fef3c7', isEditable: true },
    
    { id: 'liqSueldos', label: 'Sueldos', group: 'Ingresos', color: '#16a34a', bg: '#dcfce7', isEditable: true },
    
    { id: 'liqPisoCampoamor', label: 'Piso Avenida de Campoamor Nº30, 4ºC', group: 'Inmuebles', color: '#6366f1', bg: '#eef2ff', isEditable: true },
    { id: 'liqPisoRecreo', label: 'Piso Calle Recreo Nº13, 2º', group: 'Inmuebles', color: '#6366f1', bg: '#eef2ff', isEditable: true },
    { id: 'liqPisoVillaviciosa', label: 'Piso Calle Villaviciosa Nº28-32, 2A', group: 'Inmuebles', color: '#6366f1', bg: '#eef2ff', isEditable: true },
    
    { id: 'liqHipotecaCampoamor1', label: 'Unicaja Hipoteca Campoamor', group: 'Hipotecas', color: '#dc2626', bg: '#fef2f2', isEditable: true },
    { id: 'liqHipotecaCampoamor2', label: 'Unicaja Hipoteca Campoamor (2)', group: 'Hipotecas', color: '#dc2626', bg: '#fef2f2', isEditable: true },
    { id: 'liqHacienda', label: 'Hacienda', group: 'Impuestos', color: '#dc2626', bg: '#fef2f2', isEditable: true },
    
    { id: 'totalLiquidez', label: 'TOTAL IMPORTES', group: 'Totales', color: '#000000', bg: '#fef08a', isEditable: false, isBold: true, fontSize: 14 },
];

export default function PrestamosPage() {
  const [activeTab, setActiveTab] = useState<'retrospectiva' | 'graficas' | 'liquidez'>('retrospectiva');

  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);

  const [hiddenYears, setHiddenYears] = useState<number[]>([]);
  const [hiddenRows, setHiddenRows] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const [hiddenLiquidezYears, setHiddenLiquidezYears] = useState<number[]>([]);
  const [hiddenLiquidezRows, setHiddenLiquidezRows] = useState<string[]>([]);
  const [showLiquidezSettings, setShowLiquidezSettings] = useState(false);

  // Array de años disponibles (Global 2008-2026)
  const availableYears = Array.from({length: 19}, (_, i) => 2008 + i);
  const visibleYears = availableYears.filter(y => !hiddenYears.includes(y));
  const visibleRows = ROWS_CONFIG.filter(r => !hiddenRows.includes(r.id));
  
  // Años para Liquidez (2018-2026)
  const liquidezYears = Array.from({length: 9}, (_, i) => 2018 + i);
  const visibleLiquidezYears = liquidezYears.filter(y => !hiddenLiquidezYears.includes(y));
  const visibleLiquidezRows = LIQUIDEZ_ROWS_CONFIG.filter(r => !hiddenLiquidezRows.includes(r.id));

  useEffect(() => {
    fetchData();
    try {
        const savedHiddenYears = localStorage.getItem('prestamos_hidden_years');
        const savedHiddenRows = localStorage.getItem('prestamos_hidden_rows');
        const savedHiddenLiqYears = localStorage.getItem('liquidez_hidden_years');
        const savedHiddenLiqRows = localStorage.getItem('liquidez_hidden_rows');

        if (savedHiddenYears) setHiddenYears(JSON.parse(savedHiddenYears));
        if (savedHiddenRows) setHiddenRows(JSON.parse(savedHiddenRows));
        if (savedHiddenLiqYears) setHiddenLiquidezYears(JSON.parse(savedHiddenLiqYears));
        if (savedHiddenLiqRows) setHiddenLiquidezRows(JSON.parse(savedHiddenLiqRows));
    } catch(e) {}
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/prestamos`);
      if (res.ok) {
        const data = await res.json();
        const fullData = availableYears.map(y => {
            const found = data.find((d: any) => d.year === y);
            return found || { year: y };
        });
        setRecords(fullData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleYear = (y: number) => {
      const updated = hiddenYears.includes(y) ? hiddenYears.filter(h => h !== y) : [...hiddenYears, y];
      setHiddenYears(updated);
      localStorage.setItem('prestamos_hidden_years', JSON.stringify(updated));
  }

  const toggleRow = (id: string) => {
      const updated = hiddenRows.includes(id) ? hiddenRows.filter(h => h !== id) : [...hiddenRows, id];
      setHiddenRows(updated);
      localStorage.setItem('prestamos_hidden_rows', JSON.stringify(updated));
  }

  const toggleLiquidezYear = (y: number) => {
      const updated = hiddenLiquidezYears.includes(y) ? hiddenLiquidezYears.filter(h => h !== y) : [...hiddenLiquidezYears, y];
      setHiddenLiquidezYears(updated);
      localStorage.setItem('liquidez_hidden_years', JSON.stringify(updated));
  }

  const toggleLiquidezRow = (id: string) => {
      const updated = hiddenLiquidezRows.includes(id) ? hiddenLiquidezRows.filter(h => h !== id) : [...hiddenLiquidezRows, id];
      setHiddenLiquidezRows(updated);
      localStorage.setItem('liquidez_hidden_rows', JSON.stringify(updated));
  }

  const safeNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let clean = String(val).replace(/[^\d.,-]/g, '');
    if (clean.includes('.') && clean.includes(',')) {
        if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    return Number(clean) || 0;
  };

  const getCalculatedRecord = (record: any, index: number, allRecords: any[]) => {
    // Fase 2: Enlace de Liquidez a Retrospectiva
    // Si hay datos en liquidez o si es 2018 en adelante, sobreescribimos los campos de Retrospectiva
    const isLiquidezPeriod = record.year >= 2018;
    
    let calcCuentasYCaja = safeNum(record.cuentasYCaja);
    let calcPrestamosEmpresa = safeNum(record.prestamosEmpresa);

    if (isLiquidezPeriod || safeNum(record.liqUnicaja) || safeNum(record.liqCajaMetalico) || safeNum(record.liqPrestamoEmpresaImpuestos)) {
        calcCuentasYCaja = safeNum(record.liqUnicaja) + safeNum(record.liqCajaMetalico);
        calcPrestamosEmpresa = safeNum(record.liqPrestamoEmpresaImpuestos);
    }

    const totalCreditos = 
        safeNum(record.lineaCredito) + safeNum(record.cuentaCorriente) + safeNum(record.icoUnicaja1) +
        safeNum(record.depositoIberabal) + safeNum(record.icoUnicaja2) + safeNum(record.impuestosHacienda) +
        safeNum(record.aplazamientoHacienda) + safeNum(record.prestamoPadres) + safeNum(record.pagoMultaHacienda) +
        safeNum(record.despidos) + safeNum(record.inversionOficinas) + safeNum(record.creditoTitoVergara) +
        safeNum(record.creditoMicroInfor) + safeNum(record.creditoEmpresaPiso);

    const aFavor = 
        safeNum(record.stockMovistar) + safeNum(record.deudaZeleris) + 
        safeNum(record.stockMovilfree) + safeNum(record.deudaMovistar);

    const totalGlobal1 = totalCreditos + aFavor;

    const valorEmpresaBalance = totalGlobal1 + safeNum(record.valorEmpresa);

    const patrimonioPersonal = 
        safeNum(record.planPensiones) + calcCuentasYCaja + calcPrestamosEmpresa +
        safeNum(record.prestamosHipotecaCampoamor) + safeNum(record.pisosCampoamorRecreo) +
        safeNum(record.pisosPrincipeVergara) + safeNum(record.valorCoche);

    const patrimonioTotal = patrimonioPersonal + valorEmpresaBalance;

    let gananciasPorAno = 0;
    if (index > 0) {
        const prevRecord = getCalculatedRecord(allRecords[index - 1], index - 1, allRecords);
        gananciasPorAno = patrimonioTotal - prevRecord.patrimonioTotal;
    } else if (patrimonioTotal !== 0) {
        gananciasPorAno = 0;
    }

    // Calcular Total Liquidez
    const totalLiquidez = LIQUIDEZ_ROWS_CONFIG
        .filter(r => r.id !== 'totalLiquidez' && r.id !== 'planPensiones')
        .reduce((acc, curr) => acc + safeNum(record[curr.id]), 0) + safeNum(record.planPensiones);

    return {
      ...record,
      cuentasYCaja: calcCuentasYCaja, // Reemplazamos en el computed
      prestamosEmpresa: calcPrestamosEmpresa,
      totalCreditos,
      aFavor,
      totalGlobal1,
      valorEmpresaBalance,
      patrimonioPersonal,
      patrimonioTotal,
      gananciasPorAno,
      totalLiquidez
    };
  };

  const computedRecords = records.map((r, i, arr) => getCalculatedRecord(r, i, arr));

  const handleCellChange = async (yearIndex: number, field: string, value: string) => {
    const newRecords = [...records];
    newRecords[yearIndex] = { ...newRecords[yearIndex], [field]: value };
    setRecords(newRecords);
  };

  const handleCellBlur = async (yearIndex: number, field: string, value: string) => {
    const numericValue = safeNum(value);
    const year = availableYears[yearIndex];
    
    const newRecords = [...records];
    newRecords[yearIndex] = { ...newRecords[yearIndex], [field]: numericValue };
    setRecords(newRecords);

    setSavingField(`${year}-${field}`);
    try {
      await fetch('/api/admin/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, field, value: numericValue })
      });
    } catch (e) {
      console.error(e);
      alert('Error al guardar el dato');
    } finally {
      setSavingField(null);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: '100%', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <PageHeader 
        title={<><Landmark color="var(--mercedes-cyan)" size={28} /> Préstamos, Créditos e Hipotecas</>}
        subtitle="Control de Patrimonio y Liquidez"
        showBack={true}
        backFallback="/admin"
        headerActions={
            <div style={{ display: 'flex', gap: 8 }}>
                {activeTab === 'retrospectiva' && (
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, 
                            background: showSettings ? '#e2e8f0' : '#fff', border: '1px solid #cbd5e1', 
                            color: '#334155', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        <Settings2 size={18} /> Personalizar Vista
                    </button>
                )}
                {activeTab === 'liquidez' && (
                    <button 
                        onClick={() => setShowLiquidezSettings(!showLiquidezSettings)}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, 
                            background: showLiquidezSettings ? '#e2e8f0' : '#fff', border: '1px solid #cbd5e1', 
                            color: '#334155', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        <Settings2 size={18} /> Personalizar Vista
                    </button>
                )}
            </div>
        }
      />

      {/* TABS NAVEGACIÓN */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid #cbd5e1', paddingBottom: 16 }}>
          <button 
              onClick={() => setActiveTab('retrospectiva')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: activeTab === 'retrospectiva' ? '#1e293b' : '#fff', color: activeTab === 'retrospectiva' ? '#fff' : '#64748b', fontWeight: 600, border: '1px solid', borderColor: activeTab === 'retrospectiva' ? '#1e293b' : '#cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'retrospectiva' ? '0 4px 10px rgba(30, 41, 59, 0.2)' : 'none' }}
          >
              <Table2 size={18} /> Retrospectiva
          </button>
          <button 
              onClick={() => setActiveTab('graficas')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: activeTab === 'graficas' ? '#1e293b' : '#fff', color: activeTab === 'graficas' ? '#fff' : '#64748b', fontWeight: 600, border: '1px solid', borderColor: activeTab === 'graficas' ? '#1e293b' : '#cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'graficas' ? '0 4px 10px rgba(30, 41, 59, 0.2)' : 'none' }}
          >
              <BarChart3 size={18} /> Gráficas Evolutivas
          </button>
          <button 
              onClick={() => setActiveTab('liquidez')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: activeTab === 'liquidez' ? '#1e293b' : '#fff', color: activeTab === 'liquidez' ? '#fff' : '#64748b', fontWeight: 600, border: '1px solid', borderColor: activeTab === 'liquidez' ? '#1e293b' : '#cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'liquidez' ? '0 4px 10px rgba(30, 41, 59, 0.2)' : 'none' }}
          >
              <Droplets size={18} /> Liquidez Ángel Luis
          </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
            Cargando datos patrimoniales...
        </div>
      ) : (
          <>
            {activeTab === 'retrospectiva' && (
                <>
                    {showSettings && (
                        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #cbd5e1', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', animation: 'fadeIn 0.2s ease-out' }}>
                            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 250 }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}><EyeOff size={16} color="#64748b"/> Años Visibles</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {availableYears.map(y => (
                                            <button 
                                                key={y} 
                                                onClick={() => toggleYear(y)}
                                                style={{ 
                                                    padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                                                    background: hiddenYears.includes(y) ? '#fef2f2' : '#f0fdf4',
                                                    borderColor: hiddenYears.includes(y) ? '#fca5a5' : '#86efac',
                                                    color: hiddenYears.includes(y) ? '#ef4444' : '#16a34a',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {y}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>Clic para mostrar/ocultar columnas.</div>
                                </div>
                                
                                <div style={{ flex: 2, minWidth: 300 }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}><EyeOff size={16} color="#64748b"/> Conceptos Visibles</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                        {ROWS_CONFIG.filter(r => r.group !== 'Totales' && r.group !== 'Resumen').map(r => (
                                            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: hiddenRows.includes(r.id) ? '#9ca3af' : '#334155' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!hiddenRows.includes(r.id)} 
                                                    onChange={() => toggleRow(r.id)} 
                                                    style={{ accentColor: '#16a34a' }}
                                                />
                                                <span style={{ textDecoration: hiddenRows.includes(r.id) ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {r.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap' }}>
                            <thead>
                                <tr>
                                    <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#1e293b', color: '#fff', padding: '10px 12px', textAlign: 'left', minWidth: 280, borderRight: '1px solid #475569' }}>
                                        Conceptos
                                    </th>
                                    {visibleYears.map(y => (
                                        <th key={y} style={{ background: '#334155', color: '#fff', padding: '10px 12px', textAlign: 'center', minWidth: 100, borderRight: '1px solid #475569' }}>{y}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((rowConfig, idx) => (
                                    <tr key={rowConfig.id} style={{ borderBottom: '1px solid #e5e7eb', ...(rowConfig.group === 'Totales' || rowConfig.group === 'Resumen' ? { borderBottom: '2px solid #cbd5e1' } : {}) }}>
                                        <td style={{ 
                                            position: 'sticky', left: 0, zIndex: 10, 
                                            background: rowConfig.bg, color: rowConfig.color, 
                                            fontWeight: rowConfig.isBold ? 700 : 500, fontSize: rowConfig.fontSize ? rowConfig.fontSize : 11,
                                            padding: '6px 12px', borderRight: '1px solid #d1d5db',
                                        }}>
                                            {rowConfig.label}
                                        </td>
                                        {computedRecords.map((yearData, yIdx) => {
                                            const currentYear = availableYears[yIdx];
                                            if (hiddenYears.includes(currentYear)) return null;

                                            const isSaving = savingField === `${currentYear}-${rowConfig.id}`;
                                            const isEditing = editingCell === `${yIdx}-${rowConfig.id}`;
                                            const rawVal = yearData[rowConfig.id] || 0;
                                            const isFakeZero = rawVal === 0 && !yearData.hasOwnProperty(rowConfig.id) && rowConfig.isEditable;
                                            const displayValue = isEditing ? (isFakeZero ? '' : rawVal) : (isFakeZero ? '' : formatCurrency(rawVal));
                                            
                                            return (
                                            <td key={yIdx} style={{ background: rowConfig.isEditable ? '#fff' : rowConfig.bg, borderRight: '1px solid #e5e7eb', position: 'relative', padding: 0 }}>
                                                {rowConfig.isEditable ? (
                                                    <input 
                                                        title={rowConfig.id === 'planPensiones' ? 'Sincronizado con Liquidez' : ''}
                                                        type="text" value={displayValue}
                                                        onFocus={() => setEditingCell(`${yIdx}-${rowConfig.id}`)}
                                                        onChange={(e) => handleCellChange(yIdx, rowConfig.id, e.target.value)}
                                                        onBlur={(e) => { setEditingCell(null); handleCellBlur(yIdx, rowConfig.id, e.target.value); }}
                                                        style={{
                                                            width: '100%', height: '100%', padding: '6px 8px', border: 'none', outline: 'none', textAlign: 'right', background: 'transparent',
                                                            color: rawVal < 0 ? '#ef4444' : rowConfig.color, fontWeight: 500, fontSize: 11, opacity: isSaving ? 0.5 : 1
                                                        }}
                                                        placeholder="-"
                                                    />
                                                ) : (
                                                    <div title={rowConfig.id === 'cuentasYCaja' || rowConfig.id === 'prestamosEmpresa' ? 'Valor automático desde Liquidez' : ''} style={{ padding: '6px 8px', textAlign: 'right', color: rawVal < 0 && !rowConfig.isBold ? '#ef4444' : rowConfig.color, fontWeight: rowConfig.isBold ? 700 : 500, fontSize: rowConfig.fontSize ? rowConfig.fontSize : 11 }}>
                                                        {formatCurrency(yearData[rowConfig.id] || 0)}
                                                    </div>
                                                )}
                                                {isSaving && <Save size={12} style={{ position: 'absolute', left: 4, top: 8, color: '#9ca3af', animation: 'pulse 1s infinite' }}/>}
                                            </td>
                                        )})}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'liquidez' && (
                <>
                    {showLiquidezSettings && (
                        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #cbd5e1', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', animation: 'fadeIn 0.2s ease-out' }}>
                            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 250 }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}><EyeOff size={16} color="#64748b"/> Años Visibles</h4>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {liquidezYears.map(y => (
                                            <button 
                                                key={y} 
                                                onClick={() => toggleLiquidezYear(y)}
                                                style={{ 
                                                    padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                                                    background: hiddenLiquidezYears.includes(y) ? '#fef2f2' : '#f0fdf4',
                                                    borderColor: hiddenLiquidezYears.includes(y) ? '#fca5a5' : '#86efac',
                                                    color: hiddenLiquidezYears.includes(y) ? '#ef4444' : '#16a34a',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {y}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>Clic para mostrar/ocultar columnas.</div>
                                </div>
                                
                                <div style={{ flex: 2, minWidth: 300 }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}><EyeOff size={16} color="#64748b"/> Conceptos Visibles</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                        {LIQUIDEZ_ROWS_CONFIG.filter(r => r.group !== 'Totales').map(r => (
                                            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: hiddenLiquidezRows.includes(r.id) ? '#9ca3af' : '#334155' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!hiddenLiquidezRows.includes(r.id)} 
                                                    onChange={() => toggleLiquidezRow(r.id)} 
                                                    style={{ accentColor: '#16a34a' }}
                                                />
                                                <span style={{ textDecoration: hiddenLiquidezRows.includes(r.id) ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {r.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
                        <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Droplets size={20} color="#0284c7" /> Panel de Liquidez (2018 - 2026)
                        </h3>
                    </div>
                    <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#1e293b', color: '#fff', padding: '10px 12px', textAlign: 'left', minWidth: 280, borderRight: '1px solid #475569' }}>
                                    Conceptos de Liquidez
                                </th>
                                {visibleLiquidezYears.map(y => (
                                    <th key={y} style={{ background: '#334155', color: '#fff', padding: '10px 12px', textAlign: 'center', minWidth: 100, borderRight: '1px solid #475569' }}>{y}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleLiquidezRows.map((rowConfig, idx) => (
                                <tr key={rowConfig.id} style={{ borderBottom: '1px solid #e5e7eb', ...(rowConfig.group === 'Totales' ? { borderBottom: '2px solid #cbd5e1' } : {}) }}>
                                    <td style={{ 
                                        position: 'sticky', left: 0, zIndex: 10, 
                                        background: rowConfig.bg, color: rowConfig.color, 
                                        fontWeight: rowConfig.isBold ? 700 : 500, fontSize: rowConfig.fontSize ? rowConfig.fontSize : 11,
                                        padding: '6px 12px', borderRight: '1px solid #d1d5db',
                                    }}>
                                        {rowConfig.label}
                                    </td>
                                    {visibleLiquidezYears.map((currentYear, yIdx) => {
                                        // Buscar el index real en computedRecords
                                        const globalIndex = availableYears.indexOf(currentYear);
                                        const yearData = computedRecords[globalIndex] || {};
                                        
                                        const isSaving = savingField === `${currentYear}-${rowConfig.id}`;
                                        const isEditing = editingCell === `liq-${yIdx}-${rowConfig.id}`;
                                        const rawVal = yearData[rowConfig.id] || 0;
                                        const isFakeZero = rawVal === 0 && !yearData.hasOwnProperty(rowConfig.id) && rowConfig.isEditable;
                                        const displayValue = isEditing ? (isFakeZero ? '' : rawVal) : (isFakeZero ? '' : formatCurrency(rawVal));
                                        
                                        return (
                                            <td key={yIdx} style={{ background: rowConfig.isEditable ? '#fff' : rowConfig.bg, borderRight: '1px solid #e5e7eb', position: 'relative', padding: 0 }}>
                                                {rowConfig.isEditable ? (
                                                    <input 
                                                        title={rowConfig.id === 'planPensiones' ? 'Sincronizado con Retrospectiva' : ''}
                                                        type="text" value={displayValue}
                                                        onFocus={() => setEditingCell(`liq-${yIdx}-${rowConfig.id}`)}
                                                        onChange={(e) => handleCellChange(globalIndex, rowConfig.id, e.target.value)}
                                                        onBlur={(e) => { setEditingCell(null); handleCellBlur(globalIndex, rowConfig.id, e.target.value); }}
                                                        style={{
                                                            width: '100%', height: '100%', padding: '6px 8px', border: 'none', outline: 'none', textAlign: 'right', background: 'transparent',
                                                            color: rawVal < 0 ? '#ef4444' : rowConfig.color, fontWeight: 500, fontSize: 11, opacity: isSaving ? 0.5 : 1
                                                        }}
                                                        placeholder="-"
                                                    />
                                                ) : (
                                                    <div style={{ padding: '6px 8px', textAlign: 'right', color: rawVal < 0 && !rowConfig.isBold ? '#ef4444' : rowConfig.color, fontWeight: rowConfig.isBold ? 700 : 500, fontSize: rowConfig.fontSize ? rowConfig.fontSize : 11 }}>
                                                        {formatCurrency(yearData[rowConfig.id] || 0)}
                                                    </div>
                                                )}
                                                {isSaving && <Save size={12} style={{ position: 'absolute', left: 4, top: 8, color: '#9ca3af', animation: 'pulse 1s infinite' }}/>}
                                            </td>
                                        )})}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {visibleLiquidezYears.length > 0 && (
                    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', animation: 'fadeIn 0.2s ease-out', marginTop: 24 }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#0ea5e9', color: '#fff', padding: '10px 12px', textAlign: 'left', minWidth: 280, borderRight: '1px solid #38bdf8' }}>
                                        
                                    </th>
                                    {visibleLiquidezYears.map((y, yIdx) => {
                                        const prevYear = yIdx > 0 ? visibleLiquidezYears[yIdx - 1] : null;
                                        return (
                                            <th key={y} style={{ background: '#0ea5e9', color: '#fff', padding: '10px 12px', textAlign: 'center', minWidth: 100, borderRight: '1px solid #38bdf8', fontSize: 11, fontWeight: 600 }}>
                                                {yIdx === 0 ? y : `Diferencia del ${prevYear} al ${y}`}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ 
                                        position: 'sticky', left: 0, zIndex: 10, 
                                        background: '#0ea5e9', color: '#fff', 
                                        fontWeight: 700, fontSize: 14,
                                        padding: '10px 12px', borderRight: '1px solid #38bdf8'
                                    }}>
                                        TOTAL
                                    </td>
                                    {visibleLiquidezYears.map((currentYear, yIdx) => {
                                        const globalIndex = availableYears.indexOf(currentYear);
                                        const yearData = computedRecords[globalIndex] || {};
                                        let diff = 0;
                                        if (yIdx > 0) {
                                            const prevGlobalIndex = availableYears.indexOf(visibleLiquidezYears[yIdx - 1]);
                                            const prevYearData = computedRecords[prevGlobalIndex] || {};
                                            diff = (yearData.totalLiquidez || 0) - (prevYearData.totalLiquidez || 0);
                                        }
                                        return (
                                            <td key={currentYear} style={{ background: '#0ea5e9', borderRight: '1px solid #38bdf8', padding: '10px 12px', textAlign: 'right', color: '#fff', fontWeight: 600, fontSize: 13 }}>
                                                {formatCurrency(diff)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
                </>
            )}

            {activeTab === 'graficas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 18 }}>Evolución del Patrimonio Total (Con Empresa)</h3>
                        <div style={{ height: 400, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={computedRecords} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                    <YAxis tickFormatter={formatCompactCurrency} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={80} />
                                    <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val))} labelStyle={{color: '#1e293b', fontWeight: 600}} />
                                    <Area type="monotone" dataKey="patrimonioTotal" name="Patrimonio Total" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPatrimonio)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 400, background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 16 }}>Activos (A Favor) vs Pasivos (Créditos)</h3>
                            <div style={{ height: 300, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={computedRecords} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                                        <YAxis tickFormatter={formatCompactCurrency} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} width={70} />
                                        <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val))} />
                                        <Legend />
                                        <Line type="monotone" dataKey="aFavor" name="A Favor (Positivo)" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                                        <Line type="monotone" dataKey="totalCreditos" name="Créditos (Negativo)" stroke="#ef4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 400, background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: 16 }}>Evolución del Valor de Empresa</h3>
                            <div style={{ height: 300, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={computedRecords} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                                        <YAxis tickFormatter={formatCompactCurrency} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} width={70} />
                                        <RechartsTooltip formatter={(val: any) => formatCurrency(Number(val))} cursor={{fill: 'rgba(132, 204, 22, 0.1)'}} />
                                        <Bar dataKey="valorEmpresa" name="Valor Empresa" fill="#84cc16" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </>
      )}
    </div>
  )
}
