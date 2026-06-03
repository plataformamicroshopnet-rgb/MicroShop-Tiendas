'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { FilterX, Search, Save, X, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { can, canEdit as canEditMacro, canView } from '@/lib/permissions'
import { renderDashboardData, calculateDynamicCommission, sanitizeSale, getCurrentMonthString, normalizeString, isVentaWithinDates } from '@/lib/salesUtils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { normalizeRole } from '@/lib/appConfig'

const LEVER_MAPPING: Record<string, string[]> = {
  'FD': ['Alta FD Total', 'Alta FD Total NC', 'Migra FD Total', 'Alta FD Flex', 'Alta FD Flex NC', 'Migra FD Flex'],
  'PF': ['Puesto Fijo'],
  'FN': ['Alta FN Flex', 'Alta FN Flex NC'],
  'BAF': ['Alta BAF Total', 'Alta BAF Total NC', 'Respaldo 5G'],
  'REN': ['Renovación'],
  'MBAF': ['Migra BAF Total'],
  'ALTA': ['Alta Móvil AV', 'Alta Móvil MV', 'Alta Móvil BV'],
  'PORTA': ['Porta Móvil AV', 'Porta Móvil AV NC', 'Porta Móvil MV', 'Porta Móvil MV NC', 'Porta Móvil BV', 'Porta Móvil BV NC'],
  'TMA': ['TMAs'],
  'TI': ['Tis'],
  'MIC': ['Micro Informática'],
  'MPA': ['Alarma Directa']
}

const formatCurrency = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const strVal = String(val).trim();
  let cleanStr = strVal;
  if (strVal.includes(',') && strVal.includes('.')) {
    cleanStr = strVal.replace(/\./g, '').replace(',', '.');
  } else if (strVal.includes(',')) {
    cleanStr = strVal.replace(',', '.');
  }
  const num = Number(cleanStr);
  if (isNaN(num)) return `${val}€`; // fallback to literal text
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) + '€';
}

const getCuotaTotal = (sale: any): number => {
  const parse = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };
  const det = String(sale.detalle || '').toLowerCase();
  const cat = String(sale.categoria || sale.sheet || '').toLowerCase();
  const isRent = det === 'rent' || det === 'tma' || cat === 'rent';
  const isSeguro = det === 'seguro' || cat === 'seguro';
  
  if (isSeguro) {
    if (sale.seguroImporte) {
      const v = parse(sale.seguroImporte);
      if (v > 0) return v;
    }
    return parse(sale.cuota || sale.importe || 0);
  }
  if (isRent) {
    return parse(sale.cuota || sale.importe || 0);
  }
  return 0;
};

function CommercialDashboard({ data, activeExtras = [], isComercial, isAdmin }: { data: any[], activeExtras?: any[], isComercial?: boolean, isAdmin?: boolean }) {
  const totalVentas = data.length + activeExtras.length;
  const pendientes = data.filter((d: any) => d.pendiente === 'Si' && d.anulado !== 'Si' && d.pendiente !== 'Anulado').length + activeExtras.filter((ex: any) => ex.status === 'PENDING').length;
  const anuladas = data.filter((d: any) => d.anulado === 'Si' || d.pendiente === 'Anulado').length + activeExtras.filter((ex: any) => ex.status === 'CANCELLED').length;
  const finalizadas = totalVentas - pendientes - anuladas;

  const getTrend = (arr: any[]) => {
    const map = new Map<string, number>();
    arr.forEach(d => {
      if (d.fecha) {
        const key = d.fecha.substring(0, 5); // DD/MM
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, uv]) => ({ name, uv }));
  };

  const normalizedExtras = activeExtras.map(ex => {
    const d = new Date(ex.createdAt);
    return {
      fecha: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      pendiente: ex.status === 'PENDING' ? 'Si' : 'No',
      anulado: 'No',
      producto: `⚡ ${ex.rule?.name || 'Incentivo Manual'}`,
      detalle: 'EXTRA',
      sheet: 'EXTRA TELEFÓNICA'
    };
  });

  const combinedData = [...data, ...normalizedExtras];

  const trendTotal = getTrend(combinedData);
  const trendPendientes = getTrend(combinedData.filter((d: any) => d.pendiente === 'Si'));
  const trendAnuladas = getTrend(combinedData.filter((d: any) => d.anulado === 'Si'));
  const trendFinalizadas = getTrend(combinedData.filter((d: any) => d.pendiente !== 'Si' && d.anulado !== 'Si'));

  const productMap = new Map<string, number>();
  const productTypeMap = new Map<string, string>();
  
  combinedData.forEach(d => {
    const prod = d.producto || 'Otros';
    const type = d.detalle || d.sheet || 'Otro';
    productMap.set(prod, (productMap.get(prod) || 0) + 1);
    if (!productTypeMap.has(prod)) productTypeMap.set(prod, type);
  });

  const typeMap = new Map<string, number>();
  combinedData.forEach((d: any) => {
    const type = d.detalle || d.sheet || 'Otro';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });

  const COLORS = [
    '#00ADEF', '#009BD6', '#007AA8', '#005D82', // Cyans
    '#2C2C2E', '#48484A', '#636366', '#8E8E93', '#AEAEB2', // Grises oscuros/medios
    '#059669', '#10B981', '#34D399', // Verdes discretos
    '#F59E0B', '#D97706', '#B45309', // Naranjas apagados
    '#6366F1', '#4F46E5', '#4338CA'  // Indigos
  ];

  const productData = Array.from(productMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((entry, index) => ({
        ...entry,
        color: COLORS[index % COLORS.length]
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: '14px 24px 4px 24px', position: 'relative', overflow: 'hidden', minHeight: '100px', border: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ fontSize: 13, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Ventas Totales</h3>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#333333', lineHeight: 1 }}>{totalVentas}</div>
          </div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: 60, zIndex: 1, opacity: 0.2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendTotal}>
                <Line type="monotone" dataKey="uv" stroke="var(--mercedes-cyan)" strokeWidth={4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 24px 4px 24px', position: 'relative', overflow: 'hidden', minHeight: '100px', border: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ fontSize: 13, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Finalizadas</h3>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#333333', lineHeight: 1 }}>{finalizadas}</div>
          </div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: 60, zIndex: 1, opacity: 0.15 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendFinalizadas}>
                <Line type="monotone" dataKey="uv" stroke="#10B981" strokeWidth={4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 24px 4px 24px', position: 'relative', overflow: 'hidden', minHeight: '100px', border: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ fontSize: 13, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Pendientes</h3>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#333333', lineHeight: 1 }}>{pendientes}</div>
          </div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: 60, zIndex: 1, opacity: 0.15 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendPendientes}>
                <Line type="monotone" dataKey="uv" stroke="#F59E0B" strokeWidth={4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 24px 4px 24px', position: 'relative', overflow: 'hidden', minHeight: '100px', border: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h3 style={{ fontSize: 13, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Anuladas</h3>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#333333', lineHeight: 1 }}>{anuladas}</div>
          </div>
          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0, height: 60, zIndex: 1, opacity: 0.1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendAnuladas}>
                <Line type="monotone" dataKey="uv" stroke="#EF4444" strokeWidth={4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: '24px', minHeight: '340px' }}>
          <h3 style={{ fontSize: 16, color: '#333333', marginBottom: 24 }}>Top Ventas</h3>
          <ResponsiveContainer width="100%" height={Math.max(260, productData.length * 45)}>
            <BarChart data={productData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={180} tick={{ fill: 'var(--medium-gray)', fontSize: 11 }} />
              <Tooltip cursor={{ fill: 'var(--hover-bg)' }} contentStyle={{ backgroundColor: 'var(--dark-gray)', border: '1px solid var(--border-color)', borderRadius: 8, color: '#333333' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                {productData.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '24px', minHeight: '340px' }}>
          <h3 style={{ fontSize: 16, color: '#333333', marginBottom: 24 }}>Distribución</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={productData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                stroke="none"
              >
                {productData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--dark-gray)', border: '1px solid var(--border-color)', borderRadius: 8, color: '#333333' }} itemStyle={{ color: '#333333' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', margin: '16px auto 0' }}>
            {productData.map((entry, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555555' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }}></div>
                <span style={{ maxWidth: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={entry.name}>{entry.name}</span> ({entry.count})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Operations Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: 16, color: '#333333', margin: 0 }}>Desglose de Operaciones</h3>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '400px' }}>
          <table style={{ backgroundColor: '#FFFFFF', width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'auto' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#0078D4', boxShadow: '0 1px 0 rgba(0,0,0,0.1)' }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Fecha</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Comercial</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Tipo de Venta</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Producto</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Nombre del Cliente</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>NIF</th>

                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Teléfono</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Pte.</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Anul.</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', minWidth: 120, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Anotaciones</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Cuota Total</th>
                {isAdmin && <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Comisión</th>}
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sale: any, i: number) => (
                <tr key={i} style={{ color: '#333333', borderBottom: '1px solid #F0F0F0', verticalAlign: 'top' }}>
                  <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{sale.fecha}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{sale.vendedor}</td>
                  <td style={{ padding: '4px 6px', color: '#555555' }}>{sale.detalle === 'Ti' ? 'Contratos Móvil' : sale.detalle === 'O2' ? 'O2 MovilFree' : (sale.detalle || '-')}</td>
                  <td style={{ padding: '4px 6px' }}>{sale.producto}</td>
                  <td style={{ padding: '4px 6px' }}>{sale.nombreCliente || '-'}</td>
                  <td style={{ padding: '4px 6px' }}>{sale.nif}</td>

                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{sale.telf}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{sale.pendiente}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>{sale.anulado}</td>
                  <td style={{ padding: '4px 6px', color: '#555555', fontSize: 12 }}>{sale.anotaciones}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669', fontWeight: 800 }}>
                    {getCuotaTotal(sale) > 0 ? `${getCuotaTotal(sale).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '—'}
                  </td>
                  {isAdmin && <td style={{ padding: '4px 6px', textAlign: 'center', color: '#0078D4', fontWeight: 'bold' }}>{formatCurrency(sale.dynamicCommission !== undefined ? sale.dynamicCommission : (sale.importe || sale.cuota))}</td>}
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                    {(sale.anulado === 'Si' || sale.pendiente === 'Anulado') ? (
                        <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, fontSize: '11.5px', display: 'inline-block', minWidth: '46px' }}>ANUL</span>
                    ) : sale.pendiente === 'Si' ? (
                        <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, fontSize: '11.5px', display: 'inline-block', minWidth: '46px' }}>PED</span>
                    ) : (
                        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, fontSize: '11.5px', display: 'inline-block', minWidth: '46px' }}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {activeExtras.length > 0 && activeExtras.map((ex: any, i: number) => (
                <tr key={`extra-${ex.id || i}`} style={{ borderBottom: '1px solid #F0F0F0', backgroundColor: '#F0FDF4', verticalAlign: 'top' }}>
                  <td style={{ padding: '4px 6px', color: '#059669', whiteSpace: 'nowrap' }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 600, color: '#059669' }}>{ex.seller}</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>EXTRA</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}>
                      ⚡ {ex.rule?.name || 'Incentivo Manual'}
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>{ex.customerName}</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>{ex.customerNif || '-'}</td>

                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>-</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>No</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>No</td>
                  <td style={{ padding: '4px 6px', color: '#059669', fontSize: 12 }}>EXTRA SISTEMA ({ex.rule?.channelType || 'MANUAL'})</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>—</td>
                  {isAdmin && (
                    <td style={{ padding: '4px 6px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>
                      {formatCurrency(ex.telecomRewardAmount)}
                    </td>
                  )}
                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                    <span style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: '#0D9488', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, fontSize: '11.5px', display: 'inline-block', minWidth: '46px' }}>
                        {ex.rule?.channelType === 'MANUAL' ? 'MAN' : 'AUTO'}
                    </span>
                  </td>
                </tr>
              ))}
              {data.length === 0 && activeExtras.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 13 : 12} style={{ padding: '24px', textAlign: 'center', color: '#555555' }}>
                    No hay operaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OperationsContent() {
  const [user, setUser] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [exporting, setExporting] = useState(false)
  const [extraAssignments, setExtraAssignments] = useState<any[]>([])

  // Dashboard Config States for Retroactive Calculations
  const [objetivos, setObjetivos] = useState<Record<string, any>>({ Pyme: {}, Captador: {} })
  const [objGrupos, setObjGrupos] = useState<Record<string, any>>({ Pyme: {}, Captador: {} })
  const [importesPyme, setImportesPyme] = useState<any[]>([])
  const [importesPlus, setImportesPlus] = useState<any[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})

  const dashboardCache = useRef<Record<string, any>>({})
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const { activePeriodKey } = usePeriod()
  const vendorFilter = searchParams.get('vendedor')
  const grupoFilter = searchParams.get('grupo')

  const canEdit = canEditMacro(user, 'MODULE_TIENDAS') || can(user, 'EDIT_SALES') || can(user, 'MODULE_CRISTINA') || can(user, 'MODULE_BACK_OFFICE');
  const canCancel = canEditMacro(user, 'MODULE_TIENDAS') || can(user, 'CANCEL_SALES') || can(user, 'MODULE_CRISTINA') || can(user, 'MODULE_BACK_OFFICE');
  const isAdmin = user?.role === 'ADMIN';

  const fetchSales = () => {
    if (!activePeriodKey) return;
    setLoading(true)
    Promise.all([
      fetch('/api/auth/me').then(res => res.json()).catch(() => ({})),
      fetch(`/api/sales?periodKey=${activePeriodKey}`).then(res => res.json()),
      fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({ success: true, objetivos: { Pyme: {}, Captador: {} } })),
      fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
      fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
      fetch(`/api/catalogs?_t=${Date.now()}`).then(res => res.json()).catch(() => ({})),
      fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({}))
    ]).then(([authData, sData, objData, pymeData, plusData, catData, extrasData]) => {
      if (authData && authData.authenticated) {
        setUser(authData.user)
      }
      if (objData && objData.success && objData.objetivos) {
        setObjetivos(objData.objetivos)
        if (objData.grupos) setObjGrupos(objData.grupos)
      }
      if (pymeData && pymeData.success) {
        setImportesPyme(pymeData.importes || pymeData.data || [])
      }
      if (plusData && plusData.success) {
        setImportesPlus(plusData.importes || plusData.data || [])
      }
      if (catData && catData.success) {
        setCatalogs(catData.catalogs || {})
      }
      if (sData && sData.success) {
        let cleanedSales = (sData.logs || []).map(sanitizeSale)
        cleanedSales = cleanedSales.filter((s: any) => {
            const p = String(s.producto || '').toLowerCase()
            const c = String(s.categoria || '').toLowerCase()
            const d = String(s.detalle || '').toLowerCase()
            return !p.includes('solar360') && !p.includes('solar 360') && 
                   !c.includes('solar360') && !c.includes('solar 360') && 
                   !d.includes('solar360') && !d.includes('solar 360')
        })
        setSales(cleanedSales)
      }
      if (extrasData && extrasData.success) {
        setExtraAssignments(extrasData.assignments || [])
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchSales()
  }, [activePeriodKey])

  const startEdit = (sale: any) => {
    setEditingId(sale.id)
    setEditForm({ ...sale })
  }

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, updates: editForm })
      })
      const data = await res.json()
      if (data.success) {
        setEditingId(null)
        fetchSales() // Reload data to reflect changes
      } else {
        alert(data.error || 'Error al guardar')
      }
    } catch (error) {
       alert('Error de conexión')
    }
    setSaving(false)
  }

  const deleteSale = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta operación permanentemente?')) return;
    try {
      const res = await fetch(`/api/sales?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchSales() // Reload
      } else {
        alert(data.error || 'Error al eliminar. Puede que no tengas permisos.')
      }
    } catch (error) {
       alert('Error de conexión')
    }
  }

  const deleteExtra = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este extra permanentemente?')) return;
    try {
      const res = await fetch(`/api/extras/assignments?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchSales() // Reload
      } else {
        alert(data.error || 'Error al eliminar. Puede que no tengas permisos.')
      }
    } catch (error) {
       alert('Error de conexión')
    }
  }

  if (loading && sales.length === 0) return <div style={{ padding: 20 }}>Cargando operaciones...</div>

  // Candado de Seguridad: Si es comercial, sobreescribe cualquier filtro de URL
  const isComercial = user && normalizeRole(user.role) === 'COMERCIAL' && !canView(user, 'MODULE_BACK_OFFICE');
  const forceVendorName = (isComercial && user.username) ? user.username : null;
  const activeVendorFilter = forceVendorName || vendorFilter;

  // Apply filter locally
  const normName = (name: any) => String(name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  let displayedSales = activeVendorFilter 
    ? sales.filter(s => normName(s.vendedor || '') === normName(activeVendorFilter))
    : sales;

  if (grupoFilter && LEVER_MAPPING[grupoFilter]) {
    const validProds = LEVER_MAPPING[grupoFilter].map(p => p.toLowerCase());
    displayedSales = displayedSales.filter(s => {
      const prodName = String(s.producto || '').trim().toLowerCase();
      return validProds.includes(prodName);
    });
  }

  const isPendingView = searchParams.get('filter') === 'pendientes';
  if (isPendingView && !searchTerm) {
    displayedSales = displayedSales.filter(s => s.pendiente === 'Si');
  }

  if (searchTerm) {
    const lowerTerm = normName(searchTerm);
    displayedSales = displayedSales.filter(sale => 
      normName(sale.vendedor || '').includes(lowerTerm) ||
      normName(sale.fecha || '').includes(lowerTerm) ||
      normName(sale.codigo || '').includes(lowerTerm) ||
      normName(sale.producto || '').includes(lowerTerm) ||
      normName(sale.nombreCliente || '').includes(lowerTerm) ||
      normName(sale.nif || '').includes(lowerTerm) ||
      normName(sale.telf || '').includes(lowerTerm) ||
      normName(sale.anotaciones || '').includes(lowerTerm) ||
      normName(sale.detalle || '').includes(lowerTerm)
    )
  }

  // Calculate activeExtras using the same filter logic applied to displayedSales
  const activeExtras = extraAssignments.filter(ea => {
      if (ea.status === 'CANCELLED') return false;
      if (activeVendorFilter && normName(ea.seller) !== normName(activeVendorFilter)) return false;
      // We don't apply `grupoFilter` to extras as they are groups across many. Or maybe we only show them if no group filter is applied.
      if (grupoFilter) return false;
      if (isPendingView) return false; // Extras are never pending
      
      if (searchTerm) {
        const lowerTerm = normName(searchTerm);
        if (
          !normName(ea.seller || '').includes(lowerTerm) &&
          !normName(ea.customerName || '').includes(lowerTerm) &&
          !normName(ea.customerNif || '').includes(lowerTerm) &&
          !normName(ea.rule?.name || '').includes(lowerTerm)
        ) {
           return false;
        }
      }
      
      return true;
  });

  // Dynamic Commission Calculator (Selective Sync)
  const getCalculatedCommission = (sale: any) => {
      // If we don't have enough config data, just show the raw DB data until loaded
      if (Object.keys(importesPyme).length === 0 || Object.keys(importesPlus).length === 0) return sale.importe || sale.cuota || 0;

      if (sale.anulado === 'Si' || sale.pendiente === 'Anulado' || sale.pendiente === 'Si' || sale.estado === 'Pendiente') return 0;
      
      const tipoVenta = (String(sale.sheet || '')).trim().toLowerCase();
      const codigo = (String(sale.codigo || '')).trim().toLowerCase();

      const prod = (String(sale.producto || '')).trim().toLowerCase();
      const cat = (String(sale.categoria || '')).trim().toLowerCase();

      const codigoLower = String(sale.codigo || '').trim().toLowerCase();

      const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
      
      const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
      const isPlus = plusCodesExact.some(c => codigoLower.includes(c));

      if (!isPlus && !isBasico) return sale.importe || sale.cuota || 0;

      // Extract month "YYYYMM" from "DD/MM/YYYY" or "YYYY-MM"
      let saleMonth = ''
      if (sale.fecha) {
         const parts = sale.fecha.split('/')
         if (parts.length === 3) saleMonth = `${parts[2]}${parts[1]}`
         else if (sale.fecha.includes('-')) {
             const p = sale.fecha.split('-')
             if (p.length >= 2) saleMonth = `${p[0]}${p[1]}`
         }
      }
      if (!saleMonth) return sale.importe || sale.cuota || 0;

      const currentPeriod = getCurrentMonthString();
      if (saleMonth !== currentPeriod) return sale.importe || sale.cuota || 0;

      const profile = isPlus ? 'Pyme' : 'Captador';
      const cacheKey = `${profile}_${saleMonth}`

      if (!dashboardCache.current[cacheKey]) {
          // Filter allSales to ONLY this month to pass to renderDashboardData
          const monthSales = sales.filter(s => {
             if (!s.fecha) return false
             let m = ''
             const p = s.fecha.split('/')
             if (p.length === 3) m = `${p[2]}${p[1]}`
             else if (s.fecha.includes('-')) {
                 const p2 = s.fecha.split('-')
                 if (p2.length >= 2) m = `${p2[0]}${p2[1]}`
             }
             return m === saleMonth
          })

          const monthObj = objetivos[profile]?.[saleMonth] || {}
          const configRows = isPlus ? importesPlus : importesPyme
          
          if (configRows.length === 0) return 0; // Data not loaded yet

          const dashboardData = renderDashboardData(profile, configRows, monthObj, monthSales, objGrupos)
          dashboardCache.current[cacheKey] = dashboardData.rows
      }

      return calculateDynamicCommission(sale, dashboardCache.current[cacheKey]);
  }

  displayedSales = displayedSales.map(sale => {
      let finalImporte = sale.importe || sale.cuota || 0;
      let bypassCommissionCalc = false;
      
      // Override for Technical products: fetch exact value from Catalog based on active name
      const det = sale.detalle || '';
      
      if (det === 'O2' || det === 'Seguro' || det === 'miMovistar') {
         bypassCommissionCalc = true;
         finalImporte = Number(sale.importe || sale.cuota || 0);
      } else if (det === 'Ti' || det === 'TMA' || det === 'Micro' || det === 'Rent') {
         bypassCommissionCalc = true;
         const catalogKey = det === 'TMA' ? 'Rent' : det;
         const list = catalogs[catalogKey] || [];
         const foundList = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
         if (foundList.length > 0) {
            let found = foundList[0];
            if (foundList.length > 1) {
               const properlyDated = foundList.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
               if (properlyDated) found = properlyDated;
            }
            if (det === 'TMA' || det === 'Rent') {
                const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
                if (isConCoste) {
                    finalImporte = Number(String(found.comisionConCoste || 0).replace(',','.'));
                } else {
                    finalImporte = Number(String(found.comision || 0).replace(',','.'));
                }
            } else {
                finalImporte = Number(String(found.anual || 0).replace(',','.'));
            }
         }
      }

      return {
          ...sale,
          dynamicCommission: bypassCommissionCalc ? finalImporte : getCalculatedCommission(sale)
      };
  });

  const resolveRawCode = (ea: any): string => {
      let resolvedCode = ea.rule?.channelType || 'EXTRA';
      if (resolvedCode === 'AMBOS' && ea.sourceSaleIds) {
          try {
              const ids = JSON.parse(ea.sourceSaleIds);
              if (ids && ids.length > 0) {
                  const firstSale = displayedSales.find((s: any) => s.id === ids[0]);
                  if (firstSale && firstSale.codigo) {
                      resolvedCode = firstSale.codigo;
                  }
              }
          } catch(e) {}
      }
      return resolvedCode;
  }

  const handleExportExcel = async () => {
    setExporting(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Operaciones');

      const mData: any[] = [];
      displayedSales.forEach((s) => {
          let rawValor = 0;
          if (Object.keys(importesPyme).length > 0 && Object.keys(importesPlus).length > 0) {
              const dyn = getCalculatedCommission(s);
              rawValor = dyn;
          } else {
              rawValor = s.importe || s.cuota || 0;
          }
          mData.push({
              Vendedor: s.vendedor || '-',
              Fecha: s.fecha || '-',
              Código: s.codigo || '-',
              Grupo: s.imei || '-',
              TipoVenta: s.detalle === 'Ti' ? 'Contratos Móvil' : s.detalle === 'O2' ? 'O2 MovilFree' : (s.detalle || '-'),
              Producto: s.producto || '-',
              NombreCliente: s.nombreCliente || '-',
              NIF: s.nif || '-',

              Teléfono: s.telf || '-',
              Pte: s.pendiente === 'Si' && s.anulado !== 'Si' && s.pendiente !== 'Anulado' ? 'Si' : 'No',
              Anulado: (s.anulado === 'Si' || s.pendiente === 'Anulado') ? 'Si' : 'No',
              Anotaciones: s.anotaciones || '',
              Valor: Number(rawValor)
          });
      });

      activeExtras.forEach(ex => {
          mData.push({
              Vendedor: ex.seller || '-',
              Fecha: new Date(ex.createdAt).toLocaleDateString() || '-',
              Código: resolveRawCode(ex),
              Grupo: '-',
              TipoVenta: 'EXTRA',
              Producto: ex.rule?.name || 'Incentivo Manual',
              NombreCliente: ex.customerName || '-',
              NIF: ex.customerNif || '-',

              Teléfono: '-',
              Pte: 'No',
              Anulado: 'No',
              Anotaciones: 'Extra Automático',
              Valor: Number(ex.telecomRewardAmount || 0)
          });
      });

      sheet.columns = [
        { header: 'Vendedor', key: 'Vendedor', width: 15 },
        { header: 'Fecha', key: 'Fecha', width: 12 },
        { header: 'Tienda', key: 'Código', width: 15 },
        { header: 'IMEI', key: 'Grupo', width: 20 },
        { header: 'Tipo de Venta', key: 'TipoVenta', width: 20 },
        { header: 'Producto', key: 'Producto', width: 30 },
        { header: 'Nombre Cliente', key: 'NombreCliente', width: 30 },
        { header: 'NIF', key: 'NIF', width: 15 },

        { header: 'Teléfono', key: 'Teléfono', width: 15 },
        { header: 'Pte', key: 'Pte', width: 8 },
        { header: 'Anulado', key: 'Anulado', width: 10 },
        { header: 'Anotaciones', key: 'Anotaciones', width: 30 },
        { header: 'Comisión (€)', key: 'Valor', width: 15 }
      ];

      // Formatear cabeceras
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ADEF' } };
      sheet.getRow(1).alignment = { horizontal: 'center' };

      sheet.addRows(mData);

      // Aplicar formato de moneda a la columna Valor
      sheet.getColumn('Valor').numFmt = '#,##0.00 €';

      // Calcular dinámica del nombre
      const objDate = new Date();
      const mesName = objDate.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
      const agno = objDate.getFullYear();
      
      let fileName = `ventas_${mesName}_${agno}.xlsx`;
      if (activeVendorFilter) {
         fileName = `ventas_${activeVendorFilter.toLowerCase().replace(/ /g, '_')}_${mesName}_${agno}.xlsx`;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
       console.error("Error exporting to Excel:", error);
       alert("Error al intentar exportar el archivo Excel.");
    }
    setExporting(false);
  }

  return (
    <div className="print-container" style={{ padding: 20 }}>
      <PageHeader 
        title={isPendingView && !searchTerm ? 'Operaciones Pendientes' : (grupoFilter ? `Palanca ${grupoFilter}` : 'Ventas')}
        showBack={true}
        backFallback={grupoFilter ? "/seguimiento-ventas/productos" : "/back-office"}
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: '#0078D4', fontSize: 15 }}>Manual: Gestor de Operaciones</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Gestor de estado de ventas. Aquí los responsables pueden validar operaciones, marcarlas como 'Pendientes' de instalación o 'Anuladas', actualizando el proyeccionado económico en tiempo real.</p>
          </div>
        }
      />
      
      {(activeVendorFilter || grupoFilter) && (
        <h2 className="print-only-title" style={{ display: 'none', margin: '8px 0', fontSize: 24 }}>Informe de Ventas: {activeVendorFilter || grupoFilter}</h2>
      )}

      <div style={{ padding: 0, border: 'none', marginBottom: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        {(activeVendorFilter || grupoFilter || isPendingView) && (
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,173,239,0.1)', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--mercedes-cyan)' }}>
            <span style={{ color: '#333333', fontSize: 14 }}>
              Filtro activo: <strong style={{ color: '#0078D4' }}>{activeVendorFilter || (grupoFilter ? `Palanca ${grupoFilter}` : 'Solo Pendientes')}</strong>
            </span>
            {can(user, 'PRINT') && (
              <button 
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--mercedes-cyan)', border: 'none', color: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, padding: '6px 12px', borderRadius: 4, fontWeight: 'bold' }}
                onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={e => e.currentTarget.style.opacity = '1'}
              >
                🖨️ Imprimir Informe
              </button>
            )}
            <button 
              onClick={() => router.push('/operaciones')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#555555', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 4 }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FilterX size={16} /> Quitar Filtros
            </button>
          </div>
        )}
      </div>
      
      {/* SEARCH BAR & EXCEL EXPORT */}
      <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: '#555555' }} />
          <input 
            type="text" 
            placeholder="Buscar por comercial, producto, NIF, teléfono..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 40, width: '100%', backgroundColor: 'var(--section-bg)', border: '1px solid var(--border-color)' }}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 14, top: 12, background: 'none', border: 'none', color: '#555555', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>
        
        {(() => {
          const hasExportPermission = can(user, 'EXPORT_EXCEL');
          return (
            <button 
              onClick={handleExportExcel}
              disabled={exporting || displayedSales.length === 0 || !hasExportPermission}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#107c41', border: 'none', color: 'var(--bg-card)', cursor: hasExportPermission ? 'pointer' : 'not-allowed', fontSize: 13, padding: '0 16px', borderRadius: 8, fontWeight: 'bold', opacity: (exporting || displayedSales.length === 0 || !hasExportPermission) ? 0.5 : 1, transition: 'filter 0.2s' }}
              onMouseOver={e => { if (!exporting && hasExportPermission) e.currentTarget.style.filter = 'brightness(1.1)' }}
              onMouseOut={e => { e.currentTarget.style.filter = 'brightness(1)' }}
              title={!hasExportPermission ? "No tienes permisos para descargar el Excel nativo" : "Exportar a Excel"}
            >
              {exporting ? 'Generando Excel...' : '📊 Exportar a Excel'}
            </button>
          )
        })()}
      </div>
      

      {activeVendorFilter ? (
        <CommercialDashboard data={displayedSales} activeExtras={activeExtras} isComercial={isComercial} isAdmin={isAdmin} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
          <table style={{ backgroundColor: '#FFFFFF', width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'auto' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#0078D4', boxShadow: '0 1px 0 rgba(0,0,0,0.1)' }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Vendedor</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Fecha</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Tienda</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>IMEI</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Tipo de Venta</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Producto</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Nombre del Cliente</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>NIF</th>

                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Teléfono</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Pte.</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Anul.</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', minWidth: 120, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Anotaciones</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Cuota Total</th>
                <th style={{ padding: '4px 6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayedSales.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '24px', textAlign: 'center', color: '#555555' }}>
                    {activeVendorFilter ? `No hay datos disponibles para ${activeVendorFilter}.` : 'No hay datos disponibles para tu rol o todavía no hay ventas registradas.'}
                  </td>
                </tr>
              ) : (
                displayedSales.map((sale: any, i: number) => (
                  <tr key={i} style={{ color: '#333333', borderBottom: '1px solid #F0F0F0', verticalAlign: 'top', backgroundColor: editingId === sale.id ? 'rgba(8, 145, 178, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '4px 6px' }}><strong>
                      {sale.vendedor}
                    </strong></td>
                    <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                      {sale.fecha}
                    </td>
                    <td style={{ padding: '4px 6px', color: '#0078D4', fontWeight: 600 }}>
                      {sale.codigo}
                    </td>
                    <td style={{ padding: '4px 6px', color: '#555555', fontWeight: 600 }}>
                      {editingId === sale.id ? <input value={editForm.imei || ''} onChange={e => handleEditChange('imei', e.target.value)} style={{ width: 80, padding: 4 }} /> : (sale.imei || '-')}
                    </td>
                    <td style={{ padding: '4px 6px', color: '#555555' }}>
                      {sale.detalle === 'Ti' ? 'Contratos Móvil' : sale.detalle === 'O2' ? 'O2 MovilFree' : (sale.detalle || '-')}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      {sale.producto}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                       {editingId === sale.id ? <input value={editForm.nombreCliente} onChange={e => handleEditChange('nombreCliente', e.target.value)} style={{ width: 80, padding: 4 }} /> : (sale.nombreCliente || '-')}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                       {editingId === sale.id ? <input value={editForm.nif} onChange={e => handleEditChange('nif', e.target.value)} style={{ width: 90, padding: 4 }} /> : sale.nif}
                    </td>

                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                       {editingId === sale.id ? <input value={editForm.telf} onChange={e => handleEditChange('telf', e.target.value)} style={{ width: 90, padding: 4 }} /> : sale.telf}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {editingId === sale.id ? (
                        <select value={editForm.pendiente} onChange={e => handleEditChange('pendiente', e.target.value)} style={{ padding: 4 }}>
                          <option value="Si">Si</option>
                          <option value="No">No</option>
                          <option value="Anulado">Anulado</option>
                          <option value="">-</option>
                        </select>
                      ) : (sale.pendiente === 'Si' ? <span style={{ backgroundColor: '#FFF4E5', color: '#E59837', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' }}>Sí</span> : <span style={{ color: '#555555', fontSize: '11px' }}>No</span>)}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {editingId === sale.id ? (
                        <select value={editForm.anulado === 'Si' || editForm.pendiente === 'Anulado' ? 'Si' : editForm.anulado} onChange={e => {
                          handleEditChange('anulado', e.target.value);
                          if(e.target.value === 'Si') handleEditChange('pendiente', 'Anulado');
                        }} style={{ padding: 4 }}>
                          <option value="Si">Si</option>
                          <option value="No">No</option>
                          <option value="">-</option>
                        </select>
                      ) : (sale.anulado === 'Si' || sale.pendiente === 'Anulado' ? <span style={{ backgroundColor: '#FEE2E2', color: '#EF4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' }}>Sí</span> : <span style={{ color: '#555555', fontSize: '11px' }}>No</span>)}
                    </td>
                    <td style={{ padding: '4px 6px', color: '#555555', fontSize: 13, lineHeight: '1.4' }}>
                      {editingId === sale.id ? <textarea value={editForm.anotaciones} onChange={e => handleEditChange('anotaciones', e.target.value)} rows={2} style={{ width: '100%', minWidth: 120, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 4 }} /> : sale.anotaciones}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669', fontWeight: 800 }}>
                      {getCuotaTotal(sale) > 0 ? `${getCuotaTotal(sale).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '—'}
                    </td>

                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      {editingId === sale.id ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={saveEdit} disabled={saving} style={{ background: 'var(--mercedes-cyan)', border: 'none', color: 'var(--bg-card)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Guardar">
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingId(null)} disabled={saving} style={{ background: 'var(--medium-gray)', border: 'none', color: 'var(--bg-card)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Cancelar">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {canEdit && (
                            <button onClick={() => startEdit(sale)} style={{ background: '#FFFFFF', border: '1px solid #0078D4', color: '#0078D4', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar">
                              <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>EDIT</span>
                            </button>
                          )}
                          {canCancel && (
                            <button onClick={() => deleteSale(sale.id)} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {activeExtras.length > 0 && activeExtras.map((ex: any, i: number) => (
                <tr key={`extra-${ex.id || i}`} style={{ borderBottom: '1px solid #F0F0F0', backgroundColor: '#F0FDF4', verticalAlign: 'top' }}>
                  <td style={{ padding: '4px 6px', fontWeight: 600, color: '#059669' }}>{ex.seller}</td>
                  <td style={{ padding: '4px 6px', color: '#059669', whiteSpace: 'nowrap' }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>{resolveRawCode(ex)}</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>-</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>EXTRA</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 'bold' }}>
                      ⚡ {ex.rule?.name || 'Incentivo Manual'}
                    </div>
                  </td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>{ex.customerName}</td>
                  <td style={{ padding: '4px 6px', color: '#059669' }}>{ex.customerNif || '-'}</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>-</td>

                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>No</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>No</td>
                  <td style={{ padding: '4px 6px', color: '#059669', fontSize: 12 }}>EXTRA TELEFÓNICA ({resolveRawCode(ex)})</td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', color: '#059669' }}>—</td>

                  <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                     <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                       {canCancel && (
                         <button onClick={() => deleteExtra(ex.id)} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar Extra">
                           <Trash2 size={12} />
                         </button>
                       )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}

export default function OperationsPage() {
  const { authorized } = useGuard('VIEW_OPERACIONES')
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Cargando operaciones...</div>}>
      <OperationsContent />
    </Suspense>
  )
}
