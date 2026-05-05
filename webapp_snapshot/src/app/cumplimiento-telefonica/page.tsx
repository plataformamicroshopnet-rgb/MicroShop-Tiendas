'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { PhoneCall, MapPin, Eye, Filter, User, Calendar, CheckSquare, Printer, Mail, Share2, Target, TrendingUp, ChevronDown, ChevronRight, Activity, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import Link from 'next/link'
import { can } from '@/lib/permissions'
import { normalizeRole, getTiendasCode } from '@/lib/appConfig'

type ActionType = 'Teléfono' | 'Teams' | 'Presencial' | 'NoCliente';

interface ClientEntry {
    codigoTiendas: string;
    objetoVisita: string;
    cif: string;
    empresa: string;
    cp?: string;
    direccion?: string;
    tipo?: string;
    _lastAction?: string;
    _lastDate?: string;
}

interface Movement {
    cif: string;
    codigoTiendas?: string;
    action: ActionType;
    date: string;
    year: number;
    trimestre: number;
    mesInterno: number; // 1, 2, 3
}

interface DataStore {
    clients: ClientEntry[];
    movements: Movement[];
}

const NOMBRES_COMERCIALES: Record<string, string> = {
    'FV1WFNFG': 'Javier',
    'FV1WFN7D': 'Juan Carlos',
    'FV1WFK2Z': 'Belén',
    'FV1WFZF7': 'Maite',
    'FV1WF1SK': 'Elena',
    'FV1WFXCU': 'Luis'
};

export default function CumplimientoTelefonicaPage() {
    const currentDate = new Date();
    const [data, setData] = useState<DataStore>({ clients: [], movements: [] });
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
    const [selectedTrimestre, setSelectedTrimestre] = useState(Math.floor(currentDate.getMonth() / 3) + 1);
    const [loading, setLoading] = useState(false);
    const [selectedTiendas, setSelectedTiendas] = useState<string>('');
    const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
    const [selectedClientes, setSelectedClientes] = useState<string[]>([]);
    const [previewModalData, setPreviewModalData] = useState<ClientEntry[] | null>(null);
    const detailPanelRef = useRef<HTMLDivElement>(null);
    const [user, setUser] = useState<any>(null);
    const [fromParam, setFromParam] = useState<string | null>(null);
    const [isComercial, setIsComercial] = useState(false);
    const isComercialRef = useRef(false);
    const [rules, setRules] = useState({
        m1Contactos: 0.25, m1Visitas: 0.10,
        m2Contactos: 0.55, m2Visitas: 0.30,
        m3Contactos: 0.90, m3Visitas: 0.50
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            setFromParam(urlParams.get('from'));
        }

        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => { 
                if (d.authenticated) {
                    setUser(d.user);
                    const roleNorm = normalizeRole(d.user.role);
                    setIsComercial(roleNorm === 'COMERCIAL');
                    isComercialRef.current = roleNorm === 'COMERCIAL';
                    if (roleNorm === 'COMERCIAL') {
                        // Aquí lo fijamos asíncronamente con el traductor (sin `validCodes` aún porque el motor de datos quizás no ha terminado)
                        setSelectedTiendas(getTiendasCode(d.user.codigoComercial));
                    }
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (expandedBlock && detailPanelRef.current) {
            detailPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [expandedBlock]);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/visitas-tiendas?year=${selectedYear}&trimestre=${selectedTrimestre}`)
            .then(r => r.json())
            .then(d => {
                if (d.clients) setData(d);
                else setData({ clients: [], movements: [] });
                if (!isComercialRef.current) {
                    setSelectedTiendas('');
                }
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
            
        fetch('/api/admin/periodos')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.periods) {
                    const applicablePeriod = d.periods.find((p: any) => 
                        p.year === selectedYear && Math.ceil(p.month / 3) === selectedTrimestre
                    ) || d.periods.find((p: any) => p.status === 'ACTIVE');
                    
                    if (applicablePeriod) {
                        setRules({
                            m1Contactos: (applicablePeriod.visitasM1Contactos ?? 25) / 100,
                            m1Visitas: (applicablePeriod.visitasM1Visitas ?? 10) / 100,
                            m2Contactos: (applicablePeriod.visitasM2Contactos ?? 55) / 100,
                            m2Visitas: (applicablePeriod.visitasM2Visitas ?? 30) / 100,
                            m3Contactos: (applicablePeriod.visitasM3Contactos ?? 90) / 100,
                            m3Visitas: (applicablePeriod.visitasM3Visitas ?? 50) / 100
                        });
                    }
                }
            })
            .catch(e => console.error(e));
    }, [selectedYear, selectedTrimestre]);

    const uniqueCodes = Array.from(new Set(data.clients.map(c => c.codigoTiendas).filter(Boolean))).sort();

    // VALIDADOR DINÁMICO: Ejecuta la traducción de nuevo en cuanto cargan los datos para registrar el log de consola si falla el fallback
    useEffect(() => {
        if (isComercial && user?.codigoComercial && uniqueCodes.length > 0) {
            getTiendasCode(user.codigoComercial, uniqueCodes);
        }
    }, [isComercial, user?.codigoComercial, uniqueCodes]);

    // 1. Filtrado Base (Motor)
    const activeClients = selectedTiendas ? data.clients.filter(c => c.codigoTiendas === selectedTiendas) : data.clients;
    const activeMovements = data.movements.filter(m => m.year === selectedYear && m.trimestre === selectedTrimestre);

    // 2. Poblaciones (A CUCHILLO)
    const isLuisActive = selectedTiendas === 'FV1WFXCU';
    const carteraClients = activeClients.filter(c =>
        c.objetoVisita?.toUpperCase() === 'S' || 
        c.objetoVisita?.toUpperCase() === 'N' ||
        (isLuisActive && c.codigoTiendas === 'FV1WFXCU') // EXCEPCIÓN LUIS
    );
    const fueraCarteraClients = activeClients.filter(c =>
        !c.objetoVisita || c.objetoVisita.trim() === ''
    ).filter(c => !(isLuisActive && c.codigoTiendas === 'FV1WFXCU'));

    // Helpers
    const getClientMoves = (cif: string) => activeMovements.filter(m => m.cif === cif);
    const hasVisit = (cif: string) => getClientMoves(cif).some(m =>
        ['Presencial', 'Teams', 'Teléfono', 'NoCliente'].includes(m.action)
    );
    const hasAction = (cif: string, act: ActionType) => getClientMoves(cif).some(m => m.action === act);

    const validCifs = new Set(activeClients.map(c => c.cif));
    const realMoves = activeMovements.filter(m => validCifs.has(m.cif));

    // ===============================================
    // BLOQUE A: TELEFÓNICA (Protegido - Sólo Cartera)
    // ===============================================
    const asignados = carteraClients.length;
    
    const gestionados = realMoves.filter(m => ['Presencial', 'Teams', 'Teléfono', 'NoCliente'].includes(m.action)).length;
    const pctCumplimiento = asignados > 0 ? (gestionados / asignados) * 100 : 0;

    const gestionadosVisita = realMoves.filter(m => ['Presencial', 'Teams'].includes(m.action)).length;
    const pctVisitas = asignados > 0 ? (gestionadosVisita / asignados) * 100 : 0;

    const m1Cartera = carteraClients.filter(c => getClientMoves(c.cif).some(m => m.mesInterno === 1)).length;
    const m2Cartera = carteraClients.filter(c => getClientMoves(c.cif).some(m => m.mesInterno === 2)).length;
    const m3Cartera = carteraClients.filter(c => getClientMoves(c.cif).some(m => m.mesInterno === 3)).length;

    // ===============================================
    // BLOQUE B: ACTIVIDAD REAL (Esfuerzo Bruto)
    // ===============================================

    // --- ACUMULADOS OBJETIVO TELEFÓNICA ---
    const realM1_Total = realMoves.filter(m => m.mesInterno <= 1 && ['Presencial', 'Teams', 'Teléfono', 'NoCliente'].includes(m.action)).length;
    const realM1_Visita = realMoves.filter(m => m.mesInterno <= 1 && ['Presencial', 'Teams'].includes(m.action)).length;
    const realM2_Total = realMoves.filter(m => m.mesInterno <= 2 && ['Presencial', 'Teams', 'Teléfono', 'NoCliente'].includes(m.action)).length;
    const realM2_Visita = realMoves.filter(m => m.mesInterno <= 2 && ['Presencial', 'Teams'].includes(m.action)).length;
    const realM3_Total = realMoves.filter(m => m.mesInterno <= 3 && ['Presencial', 'Teams', 'Teléfono', 'NoCliente'].includes(m.action)).length;
    const realM3_Visita = realMoves.filter(m => m.mesInterno <= 3 && ['Presencial', 'Teams'].includes(m.action)).length;

    const totalVisitas = realMoves.length;
    const presencialesTotales = realMoves.filter(m => m.action === 'Presencial').length;
    const teamsTotales = realMoves.filter(m => m.action === 'Teams').length;
    const llamadasTotales = realMoves.filter(m => m.action === 'Teléfono').length;
    const noClienteTotales = realMoves.filter(m => m.action === 'NoCliente').length;

    const fueraCarteraCifs = new Set(fueraCarteraClients.map(c => c.cif));
    const visitasFueraCartera = realMoves.filter(m => fueraCarteraCifs.has(m.cif)).length;

    // ===============================================
    // BLOQUE C: ALERTAS (Eficiencia Operativa)
    // ===============================================
    const carteraSinVisitar = carteraClients.filter(c => !hasVisit(c.cif));
    const siSinVisitar = carteraSinVisitar.filter(c => c.objetoVisita?.toUpperCase() === 'S');
    const fueraCarteraTrabajados = fueraCarteraClients.filter(c => hasVisit(c.cif));

    const trimesters = [1, 2, 3, 4];
    const tNames = ['(Ene-Mar)', '(Abr-Jun)', '(Jul-Sep)', '(Oct-Dic)'];

    const getClientsForAction = (action: ActionType) => {
        const cifs = Array.from(new Set(realMoves.filter(m => m.action === action).map(m => m.cif)));
        return cifs.map(cif => {
            const lastMove = realMoves.filter(m => m.cif === cif && m.action === action).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const found = activeClients.find(c => c.cif === cif);
            const base = found || {
                codigoTiendas: selectedTiendas || '',
                objetoVisita: '?',
                cif: cif,
                empresa: 'Cliente Desconocido (Fuera Base)',
                cp: '',
                direccion: '',
                tipo: '?'
            } as ClientEntry;
            return {
                ...base,
                _lastAction: action,
                _lastDate: lastMove ? new Date(lastMove.date).toLocaleDateString('es-ES') : ''
            };
        }).sort((a,b) => (a.cp||'').localeCompare(b.cp||''));
    };

    const clientesNoVisitados = [...carteraSinVisitar].sort((a, b) => (a.cp || '').localeCompare(b.cp || ''));

    const toggleSelection = (cif: string) => {
        setSelectedClientes(prev => prev.includes(cif) ? prev.filter(c => c !== cif) : [...prev, cif]);
    };

    const toggleAll = (cifs: string[]) => {
        if (selectedClientes.length === cifs.length) setSelectedClientes([]);
        else setSelectedClientes([...cifs]);
    };

    const getSelectedClientsData = (): ClientEntry[] => {
        const clients = selectedClientes
            .map(cif => activeClients.find(c => c.cif === cif))
            .filter(Boolean) as ClientEntry[];
        return clients.sort((a, b) => (a.cp || '').localeCompare(b.cp || ''));
    };

    const handlePreview = () => {
        const data = getSelectedClientsData();
        setPreviewModalData(data);
    };

    const handlePrint = () => {
        const dataToPrint = getSelectedClientsData();
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const isActivity = expandedBlock && expandedBlock !== 'no_visitados';

        const html = `
          <html>
            <head>
              <title>Imprimir Ruta</title>
              <style>
                body { font-family: sans-serif; padding: 20px; color: var(--text-main); }
                h1 { font-size: 18px; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
                th { text-align: left; background: #f1f5f9; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; color: #475569; text-transform: uppercase; }
                td { padding: 8px; border-bottom: 1px solid var(--border-light); vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              </style>
            </head>
            <body>
              <h1>Ruta Comercial Operativa (${dataToPrint.length} clientes)</h1>
              <table>
                <thead>
                  <tr>
                    <th style="width: 45px; text-align: center;">O.V.</th>
                    <th style="width: 85px;">CIF</th>
                    <th style="width: 25%;">EMPRESA</th>
                    <th style="width: auto;">DIRECCIÓN</th>
                    ${isActivity ? '<th style="width: 75px; text-align: center;">ACCIÓN</th>' : ''}
                    ${isActivity ? '<th style="width: 75px; text-align: center;">FECHA</th>' : ''}
                    <th style="width: 60px; text-align: center;">CP</th>
                    <th style="width: 75px; text-align: center;">TIPO</th>
                  </tr>
                </thead>
                <tbody>
                  ${dataToPrint.map(c => `
                    <tr>
                      <td style="text-align: center; font-weight: bold;">${c.objetoVisita || '-'}</td>
                      <td style="font-family: monospace;">${c.cif}</td>
                      <td><strong>${c.empresa}</strong></td>
                      <td>${c.direccion || '-'}</td>
                      ${isActivity ? `<td style="text-align: center; color: #3b82f6; font-weight: bold;">${c._lastAction || '-'}</td>` : ''}
                      ${isActivity ? `<td style="text-align: center; color: #64748b;">${c._lastDate || '-'}</td>` : ''}
                      <td style="text-align: center; font-weight: bold; background: var(--bg-app);">${c.cp || '—'}</td>
                      <td style="text-align: center;">${c.tipo || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <script>
                window.onload = () => { window.print(); window.close(); };
              </script>
            </body>
          </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleEmail = () => {
        const data = getSelectedClientsData();
        const isActivity = expandedBlock && expandedBlock !== 'no_visitados';
        const text = data.map(c => 
            `• ${c.empresa}\n  CIF: ${c.cif} | O.V: ${c.objetoVisita || '-'} | CP: ${c.cp || '-'}\n  Dirección: ${c.direccion || '-'}\n  Tipo: ${c.tipo || '-'}${isActivity ? `\n  Actividad: ${c._lastAction || '-'} el ${c._lastDate || '-'}` : ''}`
        ).join('\n\n');
        window.location.href = `mailto:?subject=Listado de Clientes&body=${encodeURIComponent(text)}`;
    };

    const renderTriggerBlock = (id: string, title: string, count: number, valueColor: string, isAlert: boolean = false) => {
        const isExpanded = expandedBlock === id;
        const toggleExpand = () => {
            if (count === 0) return;
            if (isExpanded) { setExpandedBlock(null); } 
            else { setExpandedBlock(id); setSelectedClientes([]); }
        };

        return (
            <div onClick={toggleExpand} style={{ background: isAlert ? (isExpanded ? '#fecdd3' : '#fff1f2') : (isExpanded ? '#e0f2fe' : 'var(--active-bg)'), borderRadius: 8, border: isAlert ? (isExpanded ? '1px solid #fb7185' : '1px solid #fecdd3') : (isExpanded ? '1px solid #bae6fd' : '1px solid transparent'), overflow: 'hidden', transition: 'all 0.2s', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }} className="hover-brightness">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ChevronRight size={16} color={isExpanded ? (isAlert ? '#be123c' : '#0284c7') : 'var(--text-muted)'} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: isAlert ? '#be123c' : (isExpanded ? '#0369a1' : '#374151') }}>{title}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: valueColor }}>{count}</span>
            </div>
        );
    };

    const renderClientTable = (list: ClientEntry[], isExportMode: boolean = false) => {
        const isActivity = expandedBlock && expandedBlock !== 'no_visitados';
        
        return (
            <div style={{ width: '100%', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', fontSize: isExportMode ? 11 : 11 }}>
                    <thead style={{ background: isExportMode ? 'var(--active-bg)' : 'var(--bg-app)', position: isExportMode ? 'static' : 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                        {!isExportMode && <th style={{ width: 40, padding: '12px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0' }}></th>}
                        <th style={{ width: 45, padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>O.V.</th>
                        <th style={{ width: 85, padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>CIF</th>
                        <th style={{ width: '25%', padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>EMPRESA</th>
                        <th style={{ width: 'auto', padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>DIRECCIÓN</th>
                        {isActivity && <th style={{ width: 80, padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>ACCIÓN</th>}
                        {isActivity && <th style={{ width: 80, padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>FECHA</th>}
                        <th style={{ width: 60, padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>CP</th>
                        <th style={{ width: 75, padding: '12px 10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: 10 }}>TIPO</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((c, i) => (
                        <tr key={c.cif} onClick={() => !isExportMode && toggleSelection(c.cif)} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-app)', cursor: isExportMode ? 'default' : 'pointer', transition: 'background 0.15s' }} className={!isExportMode ? "table-row-hover" : ""}>
                            {!isExportMode && (
                                <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }} onClick={e => e.stopPropagation()}>
                                    <input type="checkbox" checked={selectedClientes.includes(c.cif)} onChange={() => toggleSelection(c.cif)} style={{ margin: 0, width: 14, height: 14, accentColor: '#2563eb', cursor: 'pointer' }} />
                                </td>
                            )}
                            <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#374151' }}>{c.objetoVisita || '-'}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>{c.cif}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 }} title={c.empresa}>{c.empresa}</td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 }} title={c.direccion}>{c.direccion || 'Sin dirección'}</td>
                            {isActivity && <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#3b82f6' }}>{c._lastAction || '-'}</td>}
                            {isActivity && <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', color: 'var(--text-muted)' }}>{c._lastDate || '-'}</td>}
                            <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontWeight: 700, color: '#4b5563', backgroundColor: 'var(--border-light)', padding: '2px 6px', borderRadius: 4 }}>{c.cp || '—'}</span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--active-bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-light)' }}>{c.tipo || '-'}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        );
    };

    const renderDetailPanel = () => {
        let title = '';
        let clientsList: ClientEntry[] = [];
        
        switch (expandedBlock) {
            case 'presencial': title = 'Presenciales Totales'; clientsList = getClientsForAction('Presencial'); break;
            case 'teams': title = 'Teams Totales'; clientsList = getClientsForAction('Teams'); break;
            case 'llamadas': title = 'Llamadas Totales'; clientsList = getClientsForAction('Teléfono'); break;
            case 'nocliente': title = 'NoCliente Totales'; clientsList = getClientsForAction('NoCliente'); break;
            case 'no_visitados': title = 'Clientes GEVICO No Visitados'; clientsList = clientesNoVisitados; break;
            case 'visitas_si_objeto': title = 'Visitas de Sí Objeto'; clientsList = siSinVisitar; break;
            default: return null;
        }

        const cifs = clientsList.map(c => c.cif);
        const allSelected = cifs.length > 0 && selectedClientes.length === cifs.length;

        console.log('--- ACTION TRIGGERED ---');
        console.log('expandedBlock:', expandedBlock);
        console.log('clientsList.length:', clientsList.length);
        console.log('clientsList:', clientsList);
        console.log('selectedClientes after reset:', selectedClientes);
        console.log('allSelected:', allSelected);

        return (
            <div ref={detailPanelRef} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-strong)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ background: '#1e3a8a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpandedBlock(null)}>
                            <ChevronDown size={18} color="var(--bg-card)" />
                            <h3 style={{ margin: 0, color: 'var(--bg-card)', fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {title}
                            </h3>
                        </div>
                        <p style={{ margin: '4px 0 0 28px', color: '#93c5fd', fontSize: 12 }}>
                            Ordenados por CP · Selecciona y prepara ruta / envío
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--bg-card)', fontSize: 13, cursor: clientsList.length > 0 ? 'pointer' : 'default', fontWeight: 600, opacity: clientsList.length > 0 ? 1 : 0.5 }}>
                            <input type="checkbox" checked={allSelected} onChange={() => toggleAll(cifs)} style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: clientsList.length > 0 ? 'pointer' : 'default', margin: 0 }} disabled={clientsList.length === 0} />
                            <span>Todos</span>
                        </label>

                        <div style={{ color: '#93c5fd', fontSize: 12, fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 16, display: 'flex', alignItems: 'center' }}>
                            <CheckSquare size={14} style={{ marginRight: 6 }} />
                            Seleccionados: {selectedClientes.length} / {clientsList.length}
                        </div>

                        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.15)', padding: '6px 8px', borderRadius: 8, marginLeft: 8 }}>
                            <button disabled={selectedClientes.length === 0} onClick={e => {e.stopPropagation(); if (selectedClientes.length > 0) handlePreview();}} style={{ opacity: selectedClientes.length > 0 ? 1 : 0.4, cursor: selectedClientes.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#1e3a8a', transition: 'all 0.15s' }} className="hover-brightness"><Eye size={14}/> Ver</button>
                            {can(user, 'PRINT') && (
                                <button disabled={selectedClientes.length === 0} onClick={e => {e.stopPropagation(); if (selectedClientes.length > 0) handlePrint();}} style={{ opacity: selectedClientes.length > 0 ? 1 : 0.4, cursor: selectedClientes.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#1e3a8a', transition: 'all 0.15s' }} className="hover-brightness"><Printer size={14}/> Imprimir</button>
                            )}
                            <button disabled={selectedClientes.length === 0} onClick={e => {e.stopPropagation(); if (selectedClientes.length > 0) handleEmail();}} style={{ opacity: selectedClientes.length > 0 ? 1 : 0.4, cursor: selectedClientes.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, background: '#3b82f6', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--bg-card)', transition: 'all 0.15s' }} className="hover-brightness"><Mail size={14}/> Email</button>
                        </div>
                    </div>
                </div>

                <div className="detail-panel-body" style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto', background: 'var(--bg-card)', paddingBottom: 16 }}>
                    {renderClientTable(clientsList, false)}
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: 20, backgroundColor: 'var(--bg-card)', minHeight: '100vh', margin: '-20px', paddingBottom: 40 }}>
            <div style={{ padding: 20 }}>

            {previewModalData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ padding: 0, background: 'var(--bg-card)', width: 900, maxWidth: '95vw', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-strong)', background: 'var(--active-bg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Eye size={20} color="#2563eb" />
                                <h2 style={{ fontSize: 16, color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>Vista Previa de Ruta Comercial</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600, backgroundColor: 'var(--border-strong)', padding: '4px 10px', borderRadius: 20 }}>{previewModalData.length} Seleccionados</span>
                                <button onClick={() => setPreviewModalData(null)} style={{ background: 'var(--text-main)', color: 'var(--bg-card)', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>Cerrar Modal</button>
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', background: 'var(--bg-card)' }}>
                            {renderClientTable(previewModalData, true)}
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER CONTROL */}
            <PageHeader 
                title={<><PhoneCall className="text-cyan" size={28} /> Evolución Visitas Gevico</>}
                subtitle="Métricas y listado de actividad prioritaria."
                showBack={true}
                backFallback={fromParam === 'tiendas' ? '/tiendas' : (fromParam === 'backoffice' ? '/back-office' : (isComercial ? '/tiendas' : '/back-office'))}
                helpContent={
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Evolución Gevico</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>Dashboard de objetivos oficiales. Mide el grado de cumplimiento de las cuotas exigidas por Telefónica. Las barras y porcentajes indican si se alcanza el mínimo necesario para desbloquear los aceleradores de pago.</p>
                  </div>
                }
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: -8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isComercial ? (
                            <span style={{ color: 'var(--light-text)', fontSize: 13, fontWeight: 700 }}>Mi Cartera ({getTiendasCode(user?.codigoComercial)})</span>
                        ) : (
                            <>
                                <span style={{ color: 'var(--light-text)', fontSize: 13, fontWeight: 600 }}>C.Tiendas:</span>
                                <select 
                                    value={selectedTiendas} 
                                    onChange={e => setSelectedTiendas(e.target.value)} 
                                    className="form-select" 
                                    style={{ padding: '0 8px', height: 36, fontSize: 13 }}
                                >
                                    <option value="">Todos (Visión Global)</option>
                                    {uniqueCodes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </>
                        )}
                    </div>
                    
                    <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--light-text)', fontSize: 13, fontWeight: 600 }}>Periodo:</span>
                        <select 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(Number(e.target.value))} 
                            className="form-select" 
                            style={{ padding: '0 8px', height: 36, fontSize: 13 }}
                        >
                            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select 
                            value={selectedTrimestre} 
                            onChange={e => setSelectedTrimestre(Number(e.target.value))} 
                            className="form-select" 
                            style={{ padding: '0 8px', height: 36, fontSize: 13 }}
                        >
                            {trimesters.map(t => <option key={t} value={t}>T{t} {tNames[t - 1]}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando motor de cálculo...</div>
            ) : (
                <>
                    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>

                    {/* BLOQUE A: TELEFÓNICA */}
                    <div className="card" style={{ padding: 24, background: 'var(--section-bg)', color: 'var(--light-text)', display: 'flex', flexDirection: 'column', gap: 20, border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Target size={24} color="#38bdf8" />
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--light-text)' }}>Métrica Telefónica</h2>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--light-text)', opacity: 0.9, letterSpacing: 0.5 }}>
                                {selectedTiendas ? (NOMBRES_COMERCIALES[selectedTiendas] || '—') : ''}
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--medium-gray)', marginTop: -12 }}>
                            Sólo Clientes en Cartera (Objeto Visita = S ó N)
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--light-text)' }}>{asignados}</div>
                                <div style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Asignados</div>
                            </div>
                            <div style={{ width: 1, height: 40, background: 'var(--border-color)' }}></div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 32, fontWeight: 800, color: '#38bdf8' }}>{gestionados}</div>
                                <div style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Gestionados</div>
                            </div>
                            <div style={{ width: 1, height: 40, background: 'var(--border-color)' }}></div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 36, fontWeight: 900, color: pctCumplimiento >= 80 ? '#10b981' : '#f59e0b' }}>{pctCumplimiento.toFixed(1)}%</div>
                                <div style={{ fontSize: 12, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>% Cumplimiento</div>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-color)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>% Visita (Presencial + Teams)</span>
                                <strong style={{ color: 'var(--light-text)' }}>{pctVisitas.toFixed(1)}% ({gestionadosVisita} acc)</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 13, color: 'var(--medium-gray)' }}>Total Gestionados</span>
                                <strong style={{ color: 'var(--light-text)' }}>{gestionados} acciones</strong>
                            </div>
                        </div>

                        <div style={{ marginTop: 12, background: 'var(--bg-color)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#38bdf8', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                                OBJETIVOS ACUMULADOS T.
                            </h3>

                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12, fontSize: 12, color: 'var(--medium-gray)', textAlign: 'center' }}>

                                {/* Cabeceras */}
                                <div style={{ textAlign: 'left', fontWeight: 600, color: 'var(--medium-gray)' }}>Mes</div>
                                <div style={{ fontWeight: 600, lineHeight: 1.2 }}>Total Contactos<br /><span style={{ fontSize: 9, color: 'var(--medium-gray)' }}>(Real / Obj)</span></div>
                                <div style={{ fontWeight: 600, lineHeight: 1.2 }}>Total Visitas<br /><span style={{ fontSize: 9, color: 'var(--medium-gray)' }}>(Real / Obj)</span></div>

                                {/* --- MES 1 --- */}
                                <div style={{ textAlign: 'left', fontWeight: 700, color: 'var(--light-text)', alignSelf: 'center' }}>Mes 1</div>
                                <div style={{ background: realM1_Total >= Math.ceil(asignados * rules.m1Contactos) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${realM1_Total >= Math.ceil(asignados * rules.m1Contactos) ? '#10b981' : '#fecaca'}`, color: realM1_Total >= Math.ceil(asignados * rules.m1Contactos) ? '#059669' : '#dc2626', padding: '6px 0', borderRadius: 4, fontWeight: 700 }}>
                                    {realM1_Total} De {Math.ceil(asignados * rules.m1Contactos)}
                                </div>
                                <div style={{ background: realM1_Visita >= Math.ceil(asignados * rules.m1Visitas) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${realM1_Visita >= Math.ceil(asignados * rules.m1Visitas) ? '#10b981' : '#fecaca'}`, color: realM1_Visita >= Math.ceil(asignados * rules.m1Visitas) ? '#059669' : '#dc2626', padding: '6px 0', borderRadius: 4, fontWeight: 700 }}>
                                    {realM1_Visita} De {Math.ceil(asignados * rules.m1Visitas)}
                                </div>

                                {/* --- MES 2 --- */}
                                <div style={{ textAlign: 'left', fontWeight: 700, color: 'var(--light-text)', alignSelf: 'center' }}>Mes 2</div>
                                <div style={{ background: realM2_Total >= Math.ceil(asignados * rules.m2Contactos) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${realM2_Total >= Math.ceil(asignados * rules.m2Contactos) ? '#10b981' : '#fecaca'}`, color: realM2_Total >= Math.ceil(asignados * rules.m2Contactos) ? '#059669' : '#dc2626', padding: '6px 0', borderRadius: 4, fontWeight: 700 }}>
                                    {realM2_Total} De {Math.ceil(asignados * rules.m2Contactos)}
                                </div>
                                <div style={{ background: realM2_Visita >= Math.ceil(asignados * rules.m2Visitas) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${realM2_Visita >= Math.ceil(asignados * rules.m2Visitas) ? '#10b981' : '#fecaca'}`, color: realM2_Visita >= Math.ceil(asignados * rules.m2Visitas) ? '#059669' : '#dc2626', padding: '6px 0', borderRadius: 4, fontWeight: 700 }}>
                                    {realM2_Visita} De {Math.ceil(asignados * rules.m2Visitas)}
                                </div>

                                {/* --- MES 3 --- */}
                                <div style={{ textAlign: 'left', fontWeight: 700, color: 'var(--light-text)', alignSelf: 'center' }}>Mes 3 (Actual)</div>
                                <div style={{ background: realM3_Total >= Math.ceil(asignados * rules.m3Contactos) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${realM3_Total >= Math.ceil(asignados * rules.m3Contactos) ? '#10b981' : '#fecaca'}`, color: realM3_Total >= Math.ceil(asignados * rules.m3Contactos) ? '#059669' : '#dc2626', padding: '6px 0', borderRadius: 4, fontWeight: 700 }}>
                                    {realM3_Total} De {Math.ceil(asignados * rules.m3Contactos)}
                                </div>
                                <div style={{ background: realM3_Visita >= Math.ceil(asignados * rules.m3Visitas) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${realM3_Visita >= Math.ceil(asignados * rules.m3Visitas) ? '#10b981' : '#fecaca'}`, color: realM3_Visita >= Math.ceil(asignados * rules.m3Visitas) ? '#059669' : '#dc2626', padding: '6px 0', borderRadius: 4, fontWeight: 700 }}>
                                    {realM3_Visita} De {Math.ceil(asignados * rules.m3Visitas)}
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* BLOQUE B: ACTIVIDAD REAL */}
                    <div className="card" style={{ padding: 24, background: 'var(--bg-card)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-strong)', paddingBottom: 12 }}>
                            <Activity size={24} color="#10b981" />
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Actividad Real Comercial</h2>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12 }}>
                            Todas las acciones lanzadas sin filtro.
                        </div>

                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>{totalVisitas}</div>
                            <div style={{ fontSize: 13, color: '#4b5563', textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>Total Movimientos Registrados</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                            {renderTriggerBlock('presencial', 'Presenciales Totales', presencialesTotales, '#059669')}
                            {renderTriggerBlock('teams', 'Teams Totales', teamsTotales, '#2563eb')}
                            {renderTriggerBlock('llamadas', 'Llamadas Totales', llamadasTotales, '#ea580c')}
                            {renderTriggerBlock('nocliente', 'NoCliente Totales', noClienteTotales, '#4b5563')}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Alerta 2: Muerte Súbita (Integra UX triggerBlock) */}
                            {renderTriggerBlock('visitas_si_objeto', 'Visitas de Sí Objeto', siSinVisitar.length, '#b91c1c', true)}

                            {renderTriggerBlock('no_visitados', 'Clientes GEVICO No Visitados', clientesNoVisitados.length, '#e11d48', true)}
                        </div>
                    </div>

                    {/* BLOQUE C: GRÁFICAS VISITAS TRIMESTRE */}
                    <div className="card" style={{ padding: 24, background: 'var(--bg-card)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-strong)', paddingBottom: 8 }}>
                            <TrendingUp size={24} color="#3b82f6" />
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Gráficas Visitas Trimestre</h2>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8 }}>
                            Total de visitas respecto al objetivo acumulado.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            {[1, 2, 3].map(mesInterno => {
                                const absoluteMonth = (selectedTrimestre - 1) * 3 + mesInterno - 1;
                                const dateObj = new Date(selectedYear, absoluteMonth, 1);
                                const mesStr = dateObj.toLocaleDateString('es-ES', { month: 'long' });
                                const tituloMes = mesStr.charAt(0).toUpperCase() + mesStr.slice(1) + ' ' + selectedYear;
                                
                                // Dataset Official del Bloque 1
                                let visitasMes = 0; let pctMes = 0;
                                if(mesInterno === 1) { visitasMes = realM1_Visita; pctMes = rules.m1Visitas; }
                                else if(mesInterno === 2) { visitasMes = realM2_Visita; pctMes = rules.m2Visitas; }
                                else if(mesInterno === 3) { visitasMes = realM3_Visita; pctMes = rules.m3Visitas; }
                                const objVisitas = Math.ceil(asignados * pctMes);

                                const dataChart = [
                                    { name: 'Visitas', actual: visitasMes, objetivo: objVisitas }
                                ];

                                return (
                                    <div key={mesInterno} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{tituloMes}</span>
                                            <span>{visitasMes} / {objVisitas} obj.</span>
                                        </div>
                                        <div style={{ width: '100%', height: 24 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={dataChart} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                                    <XAxis type="number" hide domain={[0, Math.max(objVisitas, visitasMes, 1)]} />
                                                    <YAxis type="category" dataKey="name" hide />
                                                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 6, border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                                                    <Bar dataKey="actual" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} />
                                                    <ReferenceLine x={objVisitas} stroke="#ef4444" strokeDasharray="3 3" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* GRÁFICA ACUMULADA INTEGRADA */}
                        <div style={{ borderTop: '1px solid var(--border-strong)', paddingTop: 16, marginTop: 4, display: 'flex', flexDirection: 'column', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Activity size={18} color="#f59e0b" />
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>Trimestre Total Contactos</h3>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                                Evolución acumulativa de todas las interacciones.
                            </div>

                            <div style={{ flex: 1, minHeight: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[1, 2, 3].map(mInt => {
                                            const absMo = (selectedTrimestre - 1) * 3 + mInt - 1;
                                            const dateO = new Date(selectedYear, absMo, 1);
                                            const nameStr = dateO.toLocaleDateString('es-ES', { month: 'short' });
                                            const formattedName = nameStr.charAt(0).toUpperCase() + nameStr.slice(1);
                                            
                                            let cT = 0; let oT = 0;
                                            if(mInt === 1) { cT = realM1_Total; oT = Math.ceil(asignados * rules.m1Contactos); }
                                            else if(mInt === 2) { cT = realM2_Total; oT = Math.ceil(asignados * rules.m2Contactos); }
                                            else if(mInt === 3) { cT = realM3_Total; oT = Math.ceil(asignados * rules.m3Contactos); }
                                            return { name: formattedName, Actual: cT, Objetivo: oT };
                                        })}
                                        margin={{ top: 10, right: 30, left: -20, bottom: 0 }}
                                    >
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: 'rgba(0,0,0,0.03)'}} contentStyle={{ fontSize: 11, borderRadius: 6, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="Actual" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar dataKey="Objetivo" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    </div>
                
                    {expandedBlock && (
                        <div key={expandedBlock} style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', marginTop: 24 }}>
                            {renderDetailPanel()}
                        </div>
                    )}
                    </div>
                </>
            )}
        </div>
      </div>
    )
}
