'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X, Save, Plus, Trash2, Settings, Building2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { usePeriod } from '@/components/PeriodProvider'
import { TIENDAS_COMERCIALES } from '@/lib/constants'
import ProductTreeSelector from '@/components/ProductTreeSelector'
import { matchTipoVenta } from '@/hooks/useComisionesData'

// Tramos para O2 MovilFree
const TRAMOS_MES = [
  { key: '4_10', label: 'Mes de 4 a 10', min: 4, max: 10 },
  { key: '11_14', label: 'Mes de 11 a 14', min: 11, max: 14 },
  { key: '15_20', label: 'Mes de 15 a 20', min: 15, max: 20 },
  { key: '21_30', label: 'Mes de 21 a 30', min: 21, max: 30 },
  { key: '31_40', label: 'Mes de 31 a 40', min: 31, max: 40 },
  { key: '41_plus', label: 'Mes de >=41', min: 41, max: 99999 }
];

const TRAMOS_TRIM = [
  { key: '5_9', label: 'Trim de 5 a 9', min: 5, max: 9 },
  { key: '10_plus', label: 'Trim >=10', min: 10, max: 99999 }
];



const TIENDAS_FISICAS = ["Auxiliadora 45", "Correhuela", "Villamayor", "Béjar"];

export default function TerritorialTab() {
  const router = useRouter()
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sales, setSales] = useState<any[]>([])

  const [tiendasRules, setTiendasRules] = useState<any[]>([])
  const [o2Rules, setO2Rules] = useState<any[]>([])
  const [fttrDiscount, setFttrDiscount] = useState<string>('910')

  // Modal para configurar "Por Tienda"
  const [modalStoreTargets, setModalStoreTargets] = useState<{ ruleId: string, tramo: 1 | 2 } | null>(null)
  const [modalSalesList, setModalSalesList] = useState<{ store: string, ruleName: string, logs: any[], isMoneyType: boolean } | null>(null)

  useEffect(() => {
    if (!activePeriodKey) return;
    setLoading(true)
    
    Promise.all([
      fetch(`/api/sales?periodKey=${activePeriodKey}`).then(r => r.json()),
      fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(r => r.json()),
      fetch(`/api/settings?key=fttr_discount_${activePeriodKey}`).then(r => r.json()).catch(() => ({ value: null }))
    ])
    .then(([salesRes, rulesRes, settingRes]) => {
      if (salesRes.success) setSales(salesRes.logs || [])
      if (rulesRes.success) {
        setTiendasRules(rulesRes.tiendas || [])
        setO2Rules(rulesRes.o2 || [])
      }
      if (settingRes && settingRes.success && settingRes.value !== null) {
        setFttrDiscount(settingRes.value)
      } else {
        setFttrDiscount('910')
      }
      setLoading(false)
    })
    .catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [activePeriodKey])

  const handleSave = async () => {
    setSaving(true)
    try {
      const [res1, res2] = await Promise.all([
        fetch('/api/territorial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periodKey: activePeriodKey, tiendas: tiendasRules, o2: o2Rules })
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: `fttr_discount_${activePeriodKey}`, value: String(fttrDiscount || '910') })
        })
      ]);
      
      const data1 = await res1.json()
      const data2 = await res2.json()
      
      if (data1.success && data2.success) {
        alert('Configuración guardada correctamente.')
      } else {
        alert('Error al guardar: ' + (data1.error || data2.error || 'error desconocido'))
      }
    } catch (e) {
      alert('Error de conexión.')
    }
    setSaving(false)
  }

  // --- Helpers Ventas ---
  const getSalesDataForStoreAndType = (storeName: string, tipoVenta: string) => {
    if (!tipoVenta) return { value: 0, logs: [] };
    
    const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta);

    // Obtener los comerciales de la tienda
    let storeSellers: string[] = [];
    if (storeName === 'O2') {
      storeSellers = TIENDAS_COMERCIALES['O2'] || ['Marta'];
    } else {
      // Intentar encontrar la tienda exacta, manejando tildes
      const key = Object.keys(TIENDAS_COMERCIALES).find(k => k.toLowerCase().replace('é','e') === storeName.toLowerCase().replace('é','e'));
      if (key) storeSellers = TIENDAS_COMERCIALES[key];
    }

    const filtered = sales.filter(s => {
      if (s.anulado === 'Si' || s.pendiente === 'Anulado') return false;
      if (!storeSellers.some(seller => (s.vendedor || '').toLowerCase() === seller.toLowerCase())) return false;
      return isProductMatch(s);
    });

    const isMoneyType = tipoVenta.toLowerCase().includes('dispositivos') || tipoVenta.toLowerCase().includes('importe');

    if (isMoneyType) {
      return { value: filtered.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0), logs: filtered };
    }
    
    return { value: filtered.length, logs: filtered };
  }

  const renderSalesCell = (value: number, logs: any[], storeName: string, rule: any) => {
    const isMoney = String(rule.tipoVenta).toLowerCase().includes('dispositivos');
    const displayVal = isMoney ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value) : value;
    if (value === 0) return <span>{displayVal}</span>;
    return (
      <span 
        onClick={() => setModalSalesList({ store: storeName, ruleName: rule.nombre || rule.tipoVenta, logs, isMoneyType: isMoney })}
        style={{ cursor: 'pointer', color: '#0284c7', textDecoration: 'underline' }}
      >
        {displayVal}
      </span>
    );
  }

  // --- Handlers Tiendas ---
  const addTiendaRule = () => {
    setTiendasRules([...tiendasRules, {
      id: Date.now().toString(),
      nombre: '',
      tipoVenta: '',
      obj1Type: 'global',
      obj1Global: '',
      obj1Stores: {},
      importe1: '',
      obj2Type: 'global',
      obj2Global: '',
      obj2Stores: {},
      importe2: ''
    }])
  }

  const parseNumber = (val: string) => {
    let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim();
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }

  const calculateTiendaImporte = (rule: any, storeName: string, salesCount: number, salesTot: number) => {
    let earned = 0;
    
    // Eval 1er Tramo
    let target1 = 0;
    let isReached1 = false;
    if (rule.obj1Type === 'per_store') {
      target1 = parseNumber(rule.obj1Stores?.[storeName] || '0');
      isReached1 = target1 > 0 && salesCount >= target1;
    } else {
      target1 = parseNumber(rule.obj1Global);
      isReached1 = target1 > 0 && salesTot >= target1;
    }

    // Eval 2do Tramo
    let target2 = 0;
    let isReached2 = false;
    if (rule.obj2Type === 'per_store') {
      target2 = parseNumber(rule.obj2Stores?.[storeName] || '0');
      isReached2 = target2 > 0 && salesCount >= target2;
    } else {
      target2 = parseNumber(rule.obj2Global);
      isReached2 = target2 > 0 && salesTot >= target2;
    }

    const import1Num = parseNumber(rule.importe1);
    const import2Num = parseNumber(rule.importe2);

    const isPct1 = String(rule.importe1).includes('%');
    const isPct2 = String(rule.importe2).includes('%');

    // Si supera Tramo 2
    if (isReached2) {
      if (isPct2) earned = salesCount * (import2Num / 100);
      else earned = import2Num;
    } 
    // Si no supera Tramo 2 pero supera Tramo 1
    else if (isReached1) {
      if (isPct1) earned = salesCount * (import1Num / 100);
      else earned = import1Num;
    }

    return earned;
  }

  // --- Handlers O2 ---
  const addO2Rule = () => {
    setO2Rules([...o2Rules, {
      id: Date.now().toString(),
      nombre: '',
      tipoVenta: '',
      tramosMes: {},
      tramosTrim: {},
      conectividad: ''
    }])
  }

  const calculateO2Importe = (rule: any, totalSales: number) => {
    let bonus = 0;
    
    for (const tramo of [...TRAMOS_MES].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseNumber(rule.tramosMes?.[tramo.key] || '0');
        break;
      }
    }

    for (const tramo of [...TRAMOS_TRIM].reverse()) {
      if (totalSales >= tramo.min) {
        bonus += parseNumber(rule.tramosTrim?.[tramo.key] || '0');
        break;
      }
    }

    if (totalSales > 0) {
      bonus += parseNumber(rule.conectividad || '0');
    }

    return bonus;
  }

  // Pre-calcular totales
  // Pre-calcular totales
  const grandTotalTiendas = tiendasRules.reduce((acc, rule) => {
    const dataAux = getSalesDataForStoreAndType('Auxiliadora 45', rule.tipoVenta);
    const dataCor = getSalesDataForStoreAndType('Correhuela', rule.tipoVenta);
    const dataVil = getSalesDataForStoreAndType('Villamayor', rule.tipoVenta);
    const dataBej = getSalesDataForStoreAndType('Béjar', rule.tipoVenta);
    const salesTot = dataAux.value + dataCor.value + dataVil.value + dataBej.value;

    const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', dataAux.value, salesTot);
    const impCor = calculateTiendaImporte(rule, 'Correhuela', dataCor.value, salesTot);
    const impVil = calculateTiendaImporte(rule, 'Villamayor', dataVil.value, salesTot);
    const impBej = calculateTiendaImporte(rule, 'Béjar', dataBej.value, salesTot);
    
    return acc + impAux + impCor + impVil + impBej;
  }, 0);

  const grandTotalO2 = o2Rules.reduce((acc, rule) => {
    const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
    return acc + calculateO2Importe(rule, dataO2.value);
  }, 0);

  if (isLoadingPeriods || loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando datos...</div>

  return (
    <div style={{ padding: 0 }}>
      

      <div style={{ background: 'var(--bg-card)', padding: '16px 24px', borderRadius: 12, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--mercedes-cyan)' }}>Modo Edición</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--medium-gray)' }}>
              Periodo Activo: <strong>{activePeriodKey}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid var(--border-color)', paddingLeft: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--medium-gray)' }}>Descuento por FTTR:</label>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ width: 80, paddingRight: 20, textAlign: 'center' }} 
                  value={fttrDiscount} 
                  onChange={e => setFttrDiscount(e.target.value)} 
                  placeholder="910"
                />
                <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 12 }}>€</span>
              </div>
            </div>
          </div>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', gap: 24, borderRight: '1px solid var(--border-color)', paddingRight: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Tiendas</div>
                <div style={{ fontSize: 18, color: '#10b981', fontWeight: 'bold' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalTiendas)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total O2</div>
                <div style={{ fontSize: 18, color: '#10b981', fontWeight: 'bold' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalO2)}</div>
              </div>
            </div>
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

      {/* TABLA 1: TERRITORIAL TIENDAS */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'visible', position: 'relative', zIndex: 20 }}>
        <div style={{ background: '#38bdf8', color: '#fff', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
          TERRITORIAL TIENDAS
        </div>
        <div style={{ overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1200 }}>
            <thead>
              <tr style={{ background: '#0284c7', color: '#ffffff' }}>
                <th style={{ padding: '6px 4px' }} title="Nombre descriptivo de la comisión">Nombre Comisión ℹ️</th>
                <th style={{ padding: '6px 4px' }} title="El producto o grupo de ventas que se va a contar y a pagar.">Tipo de Venta ℹ️</th>
                <th style={{ padding: '6px 4px' }} title="Objetivo mínimo a alcanzar. Puede ser 'Unif.' (la suma de todas las tiendas juntas debe llegar a este número) o 'Por T.' (cada tienda debe llegar a su propio número individual).">Obj. Primer Tramo ℹ️</th>
                <th style={{ padding: '6px 4px' }} title="Lo que se paga si se llega al Primer Tramo. (Ej: '10' paga 10€ por venta, '10%' paga el 10% de lo recaudado).">Importe 1º ℹ️</th>
                <th style={{ padding: '6px 4px' }} title="Objetivo más alto. Si se alcanza, anula el 1º y se paga este.">Obj. Segundo Tramo ℹ️</th>
                <th style={{ padding: '6px 4px' }} title="Lo que se paga si se llega al Segundo Tramo.">Importe 2º ℹ️</th>
                <th style={{ padding: '6px 4px' }}>VENTAS AUXILIADORA 45</th>
                <th style={{ padding: '6px 4px' }}>VENTAS CORREHUELA</th>
                <th style={{ padding: '6px 4px' }}>VENTAS VILLAMAYOR</th>
                <th style={{ padding: '6px 4px' }}>VENTAS BEJAR</th>
                <th style={{ padding: '6px 4px' }}>VENTAS TOTAL</th>
                <th style={{ padding: '6px 4px' }}>IMPORTE</th>
                <th style={{ padding: '6px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tiendasRules.map((rule, idx) => {
                const dataAux = getSalesDataForStoreAndType('Auxiliadora 45', rule.tipoVenta);
                const dataCor = getSalesDataForStoreAndType('Correhuela', rule.tipoVenta);
                const dataVil = getSalesDataForStoreAndType('Villamayor', rule.tipoVenta);
                const dataBej = getSalesDataForStoreAndType('Béjar', rule.tipoVenta);
                const salesAux = dataAux.value;
                const salesCor = dataCor.value;
                const salesVil = dataVil.value;
                const salesBej = dataBej.value;
                const salesTot = salesAux + salesCor + salesVil + salesBej;
                
                const obj1Target = rule.obj1Type === 'global' ? parseNumber(rule.obj1Global) : 0;
                const obj2Target = rule.obj2Type === 'global' ? parseNumber(rule.obj2Global) : 0;
                let activeTramo = 0;
                if (obj2Target > 0 && salesTot >= obj2Target) activeTramo = 2;
                else if (obj1Target > 0 && salesTot >= obj1Target) activeTramo = 1;

                const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', salesAux, salesTot);
                const impCor = calculateTiendaImporte(rule, 'Correhuela', salesCor, salesTot);
                const impVil = calculateTiendaImporte(rule, 'Villamayor', salesVil, salesTot);
                const impBej = calculateTiendaImporte(rule, 'Béjar', salesBej, salesTot);
                const totalImporte = impAux + impCor + impVil + impBej;

                return (
                  <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--section-bg)', position: 'relative', zIndex: 1000 - idx }}>
                    <td style={{ padding: 4 }}><input value={rule.nombre} onChange={e => { const r = [...tiendasRules]; r[idx].nombre = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: '100%', minWidth: 120 }} placeholder="Ej: Altas BAF" /></td>
                    <td style={{ padding: 4 }}>
                      <ProductTreeSelector 
                        value={rule.tipoVenta || ''} 
                        onChange={val => { const r = [...tiendasRules]; r[idx].tipoVenta = val; setTiendasRules(r); }} 
                        placeholder="Tipo de Venta..." 
                      />
                    </td>
                    
                    {/* Obj 1 */}
                    <td style={{ padding: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <select value={rule.obj1Type} onChange={e => { const r = [...tiendasRules]; r[idx].obj1Type = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60, padding: 4 }}>
                          <option value="global">Unif.</option>
                          <option value="per_store">Por T.</option>
                        </select>
                        {rule.obj1Type === 'global' ? (
                          <input value={rule.obj1Global} onChange={e => { const r = [...tiendasRules]; r[idx].obj1Global = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60 }} />
                        ) : (
                          <button onClick={() => setModalStoreTargets({ ruleId: rule.id, tramo: 1 })} style={{ background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>Editar</button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 4 }}><input value={rule.importe1} onChange={e => { const r = [...tiendasRules]; r[idx].importe1 = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60, backgroundColor: activeTramo === 1 ? '#dcfce7' : '', color: activeTramo === 1 ? '#166534' : '', fontWeight: activeTramo === 1 ? 'bold' : 'normal', borderColor: activeTramo === 1 ? '#22c55e' : '' }} placeholder="Ej: 20%" /></td>

                    {/* Obj 2 */}
                    <td style={{ padding: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <select value={rule.obj2Type} onChange={e => { const r = [...tiendasRules]; r[idx].obj2Type = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60, padding: 4 }}>
                          <option value="global">Unif.</option>
                          <option value="per_store">Por T.</option>
                        </select>
                        {rule.obj2Type === 'global' ? (
                          <input value={rule.obj2Global} onChange={e => { const r = [...tiendasRules]; r[idx].obj2Global = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60 }} />
                        ) : (
                          <button onClick={() => setModalStoreTargets({ ruleId: rule.id, tramo: 2 })} style={{ background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>Editar</button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 4 }}><input value={rule.importe2} onChange={e => { const r = [...tiendasRules]; r[idx].importe2 = e.target.value; setTiendasRules(r); }} className="form-input" style={{ width: 60, backgroundColor: activeTramo === 2 ? '#dcfce7' : '', color: activeTramo === 2 ? '#166534' : '', fontWeight: activeTramo === 2 ? 'bold' : 'normal', borderColor: activeTramo === 2 ? '#22c55e' : '' }} placeholder="Ej: 30%" /></td>

                    {/* Resultados */}
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesAux, dataAux.logs, 'Auxiliadora 45', rule)}</td>
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesCor, dataCor.logs, 'Correhuela', rule)}</td>
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesVil, dataVil.logs, 'Villamayor', rule)}</td>
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesBej, dataBej.logs, 'Béjar', rule)}</td>
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold', color: 'var(--mercedes-cyan)' }}>{String(rule.tipoVenta).toLowerCase().includes('dispositivos') ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesTot)}` : salesTot}</td>
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold', color: '#10b981', fontSize: 14 }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalImporte)}</td>
                    
                    <td style={{ padding: 4, textAlign: 'center' }}>
                      <button onClick={() => { const r = [...tiendasRules]; r.splice(idx, 1); setTiendasRules(r); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
          <button onClick={addTiendaRule} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--section-bg)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', color: 'var(--light-text)', fontSize: 13, fontWeight: 'bold' }}>
            <Plus size={16} /> Añadir Fila Tiendas
          </button>
        </div>
      </div>

      {/* TABLA 2: O2 MOVILFREE */}
      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'visible', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#38bdf8', color: '#fff', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
          TERRITORIAL O2 MOVILFREE
        </div>
        <div style={{ overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1200 }}>
            <thead>
              <tr style={{ background: '#0284c7', color: '#ffffff' }}>
                <th style={{ padding: '6px 4px' }} title="Nombre descriptivo de la comisión">Nombre Comisión ℹ️</th>
                <th style={{ padding: '6px 4px' }} title="El producto o grupo de ventas que se va a contar para la tienda O2.">Tipo de Venta ℹ️</th>
                {TRAMOS_MES.map(t => <th key={t.key} style={{ padding: '6px 4px', fontSize: 11 }}>{t.label}</th>)}
                {TRAMOS_TRIM.map(t => <th key={t.key} style={{ padding: '6px 4px', fontSize: 11 }}>{t.label}</th>)}
                <th style={{ padding: '6px 4px' }}>Conect.</th>
                <th style={{ padding: '6px 4px' }}>VENTAS TOTAL O2</th>
                <th style={{ padding: '6px 4px' }}>IMPORTE</th>
                <th style={{ padding: '6px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {o2Rules.map((rule, idx) => {
                const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
                const totalSales = dataO2.value;
                const totalImporte = calculateO2Importe(rule, totalSales);
                let highestTramoMesKey = '';
                for (const tramo of [...TRAMOS_MES].reverse()) {
                  if (totalSales >= tramo.min) {
                    highestTramoMesKey = tramo.key;
                    break;
                  }
                }
                let highestTramoTrimKey = '';
                for (const tramo of [...TRAMOS_TRIM].reverse()) {
                  if (totalSales >= tramo.min) {
                    highestTramoTrimKey = tramo.key;
                    break;
                  }
                }

                return (
                  <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--section-bg)', position: 'relative', zIndex: 1000 - idx }}>
                    <td style={{ padding: 4 }}><input value={rule.nombre} onChange={e => { const r = [...o2Rules]; r[idx].nombre = e.target.value; setO2Rules(r); }} className="form-input" style={{ width: '100%', minWidth: 100 }} /></td>
                    <td style={{ padding: 4 }}>
                      <ProductTreeSelector 
                        value={rule.tipoVenta || ''} 
                        onChange={val => { const r = [...o2Rules]; r[idx].tipoVenta = val; setO2Rules(r); }} 
                        placeholder="Tipo de Venta..." 
                      />
                    </td>
                    
                    {TRAMOS_MES.map(t => (
                      <td key={t.key} style={{ padding: 4 }}>
                        <input value={rule.tramosMes?.[t.key] || ''} onChange={e => { const r = [...o2Rules]; r[idx].tramosMes = { ...(r[idx].tramosMes || {}), [t.key]: e.target.value }; setO2Rules(r); }} className="form-input" style={{ width: 60, backgroundColor: highestTramoMesKey === t.key ? '#dcfce7' : '', color: highestTramoMesKey === t.key ? '#166534' : '', fontWeight: highestTramoMesKey === t.key ? 'bold' : 'normal', borderColor: highestTramoMesKey === t.key ? '#22c55e' : '' }} placeholder="€" />
                      </td>
                    ))}

                    {TRAMOS_TRIM.map(t => (
                      <td key={t.key} style={{ padding: 4 }}>
                        <input value={rule.tramosTrim?.[t.key] || ''} onChange={e => { const r = [...o2Rules]; r[idx].tramosTrim = { ...(r[idx].tramosTrim || {}), [t.key]: e.target.value }; setO2Rules(r); }} className="form-input" style={{ width: 60, backgroundColor: highestTramoTrimKey === t.key ? '#dcfce7' : '', color: highestTramoTrimKey === t.key ? '#166534' : '', fontWeight: highestTramoTrimKey === t.key ? 'bold' : 'normal', borderColor: highestTramoTrimKey === t.key ? '#22c55e' : '' }} placeholder="€" />
                      </td>
                    ))}

                    <td style={{ padding: 4 }}>
                       <input value={rule.conectividad || ''} onChange={e => { const r = [...o2Rules]; r[idx].conectividad = e.target.value; setO2Rules(r); }} className="form-input" style={{ width: 50, backgroundColor: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? '#dcfce7' : '', color: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? '#166534' : '', fontWeight: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? 'bold' : 'normal', borderColor: totalSales > 0 && parseNumber(rule.conectividad) > 0 ? '#22c55e' : '' }} placeholder="€" />
                    </td>

                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold', color: 'var(--mercedes-cyan)' }}>{renderSalesCell(totalSales, dataO2.logs, 'O2', rule)}</td>
                    <td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold', color: '#10b981', fontSize: 14 }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalImporte)}</td>
                    
                    <td style={{ padding: 4, textAlign: 'center' }}>
                      <button onClick={() => { const r = [...o2Rules]; r.splice(idx, 1); setO2Rules(r); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
          <button onClick={addO2Rule} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--section-bg)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', color: 'var(--light-text)', fontSize: 13, fontWeight: 'bold' }}>
            <Plus size={16} /> Añadir Fila O2 MovilFree
          </button>
        </div>
      </div>

      {/* MODAL OBJETIVOS POR TIENDA */}
      {modalStoreTargets && (() => {
        const ruleIdx = tiendasRules.findIndex(r => r.id === modalStoreTargets.ruleId);
        if (ruleIdx === -1) return null;
        const rule = tiendasRules[ruleIdx];
        const storeKey = modalStoreTargets.tramo === 1 ? 'obj1Stores' : 'obj2Stores';
        const objStores = rule[storeKey] || {};

        const handleModalChange = (store: string, val: string) => {
          const newRules = [...tiendasRules];
          newRules[ruleIdx] = {
            ...newRules[ruleIdx],
            [storeKey]: { ...(newRules[ruleIdx][storeKey] || {}), [store]: val }
          };
          setTiendasRules(newRules);
        }

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card" style={{ width: 400, maxWidth: '90%', padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', color: 'var(--mercedes-cyan)' }}>Objetivos por Tienda (Tramo {modalStoreTargets.tramo})</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--medium-gray)' }}>Define las unidades objetivo para {rule.nombre || 'esta regla'}.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {TIENDAS_FISICAS.map(tienda => (
                  <div key={tienda} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 'bold' }}>MICROSHOP {tienda.toUpperCase()}</span>
                    <input 
                      type="number"
                      className="form-input" 
                      style={{ width: 80, textAlign: 'center' }}
                      value={objStores[tienda] || ''}
                      onChange={e => handleModalChange(tienda, e.target.value)}
                      placeholder="Obj."
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setModalStoreTargets(null)}
                  style={{ background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL LISTA DE VENTAS */}
      {modalSalesList && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: 800, maxWidth: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--mercedes-cyan)' }}>Ventas {modalSalesList.store} - {modalSalesList.ruleName}</h3>
              <button onClick={() => setModalSalesList(null)} style={{ background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--section-bg)', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Vendedor</th>
                    <th style={{ padding: 8 }}>Cliente</th>
                    <th style={{ padding: 8 }}>NIF/Tel</th>
                    <th style={{ padding: 8 }}>Producto</th>
                    <th style={{ padding: 8 }}>Fecha</th>
                    {modalSalesList.isMoneyType && <th style={{ padding: 8 }}>Importe</th>}
                  </tr>
                </thead>
                <tbody>
                  {modalSalesList.logs.map((log: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 8 }}>{log.vendedor}</td>
                      <td style={{ padding: 8 }}>{log.nombreCliente || '-'}</td>
                      <td style={{ padding: 8 }}>{log.nif || log.linea || '-'}</td>
                      <td style={{ padding: 8 }}>{log.producto} {log.detalle && log.detalle.toLowerCase() !== 'varios' ? `(${log.detalle})` : ''}</td>
                      <td style={{ padding: 8 }}>{new Date(log.timestamp).toLocaleDateString('es-ES')}</td>
                      {modalSalesList.isMoneyType && <td style={{ padding: 8 }}>{log.importe || log.cuota} €</td>}
                    </tr>
                  ))}
                  {modalSalesList.logs.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center' }}>No hay ventas registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
