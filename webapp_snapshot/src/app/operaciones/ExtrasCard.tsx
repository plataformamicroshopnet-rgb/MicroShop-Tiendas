'use client'

import React, { useState } from 'react'
import { Plus, Play, X, Save } from 'lucide-react'
import { canEdit } from '@/lib/permissions'

export default function ExtrasCard({ user }: { user: any }) {
    const [rules, setRules] = useState<any[]>([])
    const [templates, setTemplates] = useState<any[]>([])
    const [loadingData, setLoadingData] = useState(true)

    const [showRuleModal, setShowRuleModal] = useState(false)
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [isApplying, setIsApplying] = useState(false)
    const [engineResult, setEngineResult] = useState<any>(null)

    // Formulario de Regla
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
    const [ruleForm, setRuleForm] = useState({
        name: '',
        description: '',
        channelType: 'PLUS',
        combinationLabel: '',
        telecomRewardAmount: '',
        sellerRewardAmount: '',
        maxPayoutUnits: '',
        validFrom: '',
        validTo: '',
        isActive: true
    })
    const [ruleSaving, setRuleSaving] = useState(false)
    const [ruleError, setRuleError] = useState('')

    // Estado de tramos para reglas KPI_QTY
    const defaultTiers = [
        { maxPct: 70,  telecom: 10, seller: 5  },
        { maxPct: 100, telecom: 20, seller: 8  },
        { maxPct: undefined, telecom: 25, seller: 10 }
    ]
    const [kpiTiers, setKpiTiers] = useState<Array<{maxPct?: number; telecom: number; seller: number}>>(defaultTiers)
    const [kpiProducts, setKpiProducts] = useState('tgt')

    // Cargar datos reales al montar
    React.useEffect(() => {
        setLoadingData(true)
        fetch('/api/extras/rules')
            .then(res => res.json())
            .then(data => {
                if(data.success && data.rules) setRules(data.rules)
            })
            .catch(console.error)
            .finally(() => setLoadingData(false))
    }, [])

    // Solo mostramos la tarjeta de configuración si el usuario tiene permiso
    if (!canEdit(user, 'MODULE_ADMIN') && user?.role !== 'ADMIN') return null;
    const handleAddRuleClick = () => {
        setEditingRuleId(null)
        setRuleForm({
            name: '', description: '', channelType: 'PLUS', combinationLabel: '', telecomRewardAmount: '', sellerRewardAmount: '', maxPayoutUnits: '', validFrom: '', validTo: '', isActive: true
        })
        setKpiTiers(defaultTiers)
        setKpiProducts('tgt')
        setRuleError('')
        setShowRuleModal(true)
    }

    const handleEditRuleClick = (r: any) => {
        setEditingRuleId(r.id)
        setRuleForm({
            name: r.name || '', 
            description: r.description || '',
            channelType: r.channelType || 'PLUS', 
            combinationLabel: r.combinationLabel || '', 
            telecomRewardAmount: r.telecomRewardAmount?.toString() || '', 
            sellerRewardAmount: r.sellerRewardAmount?.toString() || '', 
            maxPayoutUnits: r.maxPayoutUnits?.toString() || '', 
            validFrom: r.validFrom ? r.validFrom.substring(0, 10) : '', 
            validTo: r.validTo ? r.validTo.substring(0, 10) : '', 
            isActive: r.isActive !== false
        })
        // Populate KPI_QTY tier state when editing a tier rule
        if (r.combinationLabel?.startsWith('[KPI_QTY]')) {
            try {
                const parsed = JSON.parse(r.description || '{}')
                if (parsed.tiers && parsed.tiers.length > 0) setKpiTiers(parsed.tiers)
                else setKpiTiers(defaultTiers)
            } catch { setKpiTiers(defaultTiers) }
            try {
                const tokens: string[] = JSON.parse(r.requiredGroups || '[]')
                setKpiProducts(tokens.join(', '))
            } catch { setKpiProducts('tgt') }
        } else {
            setKpiTiers(defaultTiers)
            setKpiProducts('tgt')
        }
        setRuleError('')
        setShowRuleModal(true)
    }

    const handleDeleteRule = async (id: string) => {
        if (!window.confirm('¿Estás seguro de eliminar esta regla?')) return;
        
        try {
            const res = await fetch(`/api/extras/rules/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Error al eliminar');
            } else {
                alert(data.message);
                const rulesRes = await fetch('/api/extras/rules');
                const rulesData = await rulesRes.json();
                if (rulesData.success) setRules(rulesData.rules);
            }
        } catch (err: any) {
            alert(err.message || 'Error de red');
        }
    }

    const handleSaveRule = async () => {
        setRuleError('')
        if (!ruleForm.name.trim()) return setRuleError('La "Descripción" es obligatoria.')
        if (!ruleForm.combinationLabel.trim()) return setRuleError('La "Combinación" es obligatoria.')
        const isKpiQtyCheck = ruleForm.combinationLabel.startsWith('[KPI_QTY]')
        const isPriceListCheck = ruleForm.combinationLabel.startsWith('[PRICE_LIST]')
        if (!isKpiQtyCheck && !isPriceListCheck && ruleForm.telecomRewardAmount === '') return setRuleError('El "Importe Telefónica" es obligatorio.')
        if (!isKpiQtyCheck && !isPriceListCheck && ruleForm.sellerRewardAmount === '') return setRuleError('El "Importe Comercial" es obligatorio.')
        if (isPriceListCheck && (!ruleForm.description || !ruleForm.description.trim())) return setRuleError('Debes pegar la lista de precios en la descripción.')

        // For KPI_QTY: auto-fill importes from max tier so API validation passes
        if (isKpiQtyCheck) {
            const maxTier = kpiTiers[kpiTiers.length - 1]
            if (ruleForm.telecomRewardAmount === '' || ruleForm.telecomRewardAmount === '0') {
                setRuleForm(f => ({...f, telecomRewardAmount: String(maxTier.telecom), sellerRewardAmount: String(maxTier.seller)}))
            }
        }

        setRuleSaving(true)
        try {
            const endpoint = editingRuleId ? `/api/extras/rules/${editingRuleId}` : '/api/extras/rules'
            const method = editingRuleId ? 'PUT' : 'POST'

            const isKpiQty = ruleForm.combinationLabel.startsWith('[KPI_QTY]')

            // For KPI_QTY: serialize tiers into description and products into requiredGroups
            const descriptionPayload = isKpiQty
                ? JSON.stringify({ tiers: kpiTiers })
                : ruleForm.description

            const requiredGroupsPayload = isKpiQty
                ? kpiProducts.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
                : undefined

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: ruleForm.name,
                    description: descriptionPayload,
                    channelType: ruleForm.channelType,
                    combinationLabel: ruleForm.combinationLabel,
                    requiredGroups: requiredGroupsPayload,
                    telecomRewardAmount: isKpiQty ? kpiTiers[kpiTiers.length - 1].telecom : (isPriceListCheck ? 0 : Number(ruleForm.telecomRewardAmount)),
                    sellerRewardAmount: isKpiQty ? kpiTiers[kpiTiers.length - 1].seller : (isPriceListCheck ? 0 : Number(ruleForm.sellerRewardAmount)),
                    maxPayoutUnits: isKpiQty
                        ? (ruleForm.maxPayoutUnits ? Number(ruleForm.maxPayoutUnits) : null)
                        : (ruleForm.maxPayoutUnits ? Number(ruleForm.maxPayoutUnits) : null),
                    validFrom: ruleForm.validFrom || null,
                    validTo: ruleForm.validTo || null,
                    isActive: ruleForm.isActive
                })
            })
            const data = await res.json()
            if (!data.success) {
                setRuleError(data.error || 'Error al guardar la regla.')
            } else {
                setShowRuleModal(false)
                const rulesRes = await fetch('/api/extras/rules')
                const rulesData = await rulesRes.json()
                if (rulesData.success) setRules(rulesData.rules)
            }
        } catch (err: any) {
            setRuleError(err.message || 'Error de red')
        } finally {
            setRuleSaving(false)
        }
    }

    const handleDefineConceptClick = () => {
        console.log('[Extras] Botón "Definir Concepto" clickeado')
        setShowTemplateModal(true)
    }

    const handleApplyExtrasClick = async () => {
        console.log('[Extras] Botón "Aplicar Extras" clickeado. Ejecutando motor de cruces...')
        setEngineResult(null)
        setIsApplying(true)
        try {
            // Pasamos el periodKey desde el context si estuviera, pero para simplicidad del UI de Admin 
            // el endpoint calculará el activo o un default
            const res = await fetch('/api/extras/generate', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                if (data.debugLog) {
                    console.log('--- DEBUG LOG ---');
                    data.debugLog.forEach((log: string) => console.log(log));
                }
                setEngineResult(data)
            } else {
                alert(data.error || 'Error del motor')
            }
        } catch (error: any) {
            console.error('[Extras] Error ejecutando motor', error)
            alert(error.message)
        } finally {
            setIsApplying(false)
        }
    }

    return (
        <div style={{ marginTop: 24, marginBottom: 24, position: 'relative' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light-text)', marginBottom: 16 }}>
                Extras Plus y Básico
            </h2>

            {engineResult && (
                <div style={{ marginBottom: 24, padding: 20, backgroundColor: 'rgba(52, 199, 89, 0.1)', border: '1px solid #34C759', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#34C759', fontSize: 16 }}>Resumen de Ejecución del Motor</h3>
                        <button onClick={() => setEngineResult(null)} style={{ background: 'none', border: 'none', color: '#34C759', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
                        <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 8 }}>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--medium-gray)' }}>Reglas Evaluadas</p>
                            <h4 style={{ margin: '4px 0 0 0', fontSize: 20 }}>{engineResult.rulesEvaluated || 0}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 8 }}>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--medium-gray)' }}>Cruces Detectados</p>
                            <h4 style={{ margin: '4px 0 0 0', fontSize: 20, color: 'var(--mercedes-cyan)' }}>{engineResult.crossesDetected || 0}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 8 }}>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--medium-gray)' }}>Nuevos Extras Generados</p>
                            <h4 style={{ margin: '4px 0 0 0', fontSize: 20, color: '#34C759' }}>{engineResult.newAssignmentsInserted || 0}</h4>
                        </div>
                        <div style={{ background: 'var(--bg-app)', padding: 12, borderRadius: 8 }}>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--medium-gray)' }}>Omitidos (Duplicados)</p>
                            <h4 style={{ margin: '4px 0 0 0', fontSize: 20, color: '#F59E0B' }}>{engineResult.duplicatesSkipped || 0}</h4>
                        </div>
                    </div>
                </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* A. REGLAS AUTOMATICAS */}
                <div className="card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ fontSize: 18, color: 'var(--mercedes-cyan)', margin: 0, fontWeight: 600 }}>A. Reglas Automáticas</h3>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button 
                                className="primary-button" 
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px', opacity: isApplying ? 0.7 : 1 }}
                                onClick={handleApplyExtrasClick}
                                disabled={isApplying}
                            >
                                <Play size={16} /> {isApplying ? 'Procesando...' : 'Aplicar Extras'}
                            </button>
                            <button 
                                className="outline-button" 
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}
                                onClick={handleAddRuleClick}
                            >
                                <Plus size={16} /> Añadir Regla
                            </button>
                        </div>
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--medium-gray)', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 8px' }}>Operativa</th>
                                    <th style={{ padding: '12px 8px', width: '25%' }}>Desc. Objetivo</th>
                                    <th style={{ padding: '12px 8px' }}>Tipo</th>
                                    <th style={{ padding: '12px 8px' }}>Combinación</th>
                                    <th style={{ padding: '12px 8px' }}>Imp. Telefónica</th>
                                    <th style={{ padding: '12px 8px' }}>Imp. Comercial</th>
                                    <th style={{ padding: '12px 8px' }}>Tope</th>
                                    <th style={{ padding: '12px 8px' }}>Vigencia</th>
                                    <th style={{ padding: '12px 8px' }}>Actividad</th>
                                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rules.length === 0 ? (
                                    <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay reglas automáticas creadas.</td></tr>
                                ) : rules.map(r => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '10px 8px', fontWeight: 500 }}>{r.name}</td>
                                        <td style={{ padding: '10px 8px' }}>
                                            {r.combinationLabel.startsWith('[PRICE_LIST]') ? (
                                                <span style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', borderRadius: 4, fontWeight: 700 }}>LISTA DE PRECIOS</span>
                                            ) : r.combinationLabel.startsWith('[KPI_QTY]') ? (
                                                <span style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', borderRadius: 4, fontWeight: 700 }}>RETO UNIDAD</span>
                                            ) : r.combinationLabel.startsWith('[KPI]') ? (
                                                <span style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(168, 85, 247, 0.1)', color: '#A855F7', borderRadius: 4, fontWeight: 700 }}>BONO GLOBAL</span>
                                            ) : (
                                                <span style={{ fontSize: 11, padding: '2px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: 4, fontWeight: 700, color: 'var(--mercedes-cyan)' }}>CRUCE B2B</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                                            {r.combinationLabel.startsWith('[KPI') ? r.combinationLabel.replace(/\[KPI.*?\]\ /, '') : r.combinationLabel}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>{r.telecomRewardAmount}€</td>
                                        <td style={{ padding: '10px 8px' }}>{r.sellerRewardAmount}€</td>
                                        <td style={{ padding: '10px 8px' }}>{r.maxPayoutUnits || 'Ilimit.'}</td>
                                        <td style={{ padding: '10px 8px', fontSize: 11 }}>
                                            {r.validFrom || r.validTo ? (
                                                <span>
                                                    {r.validFrom ? new Date(r.validFrom).toLocaleDateString('es-ES') : '...'} - {r.validTo ? new Date(r.validTo).toLocaleDateString('es-ES') : '...'}
                                                </span>
                                            ) : 'Permanente'}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            {(() => {
                                                const now = new Date(); now.setHours(0,0,0,0);
                                                const expired = r.validTo && new Date(r.validTo) < now;
                                                if (expired) return <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: 12 }}>⏸ Caducado</span>;
                                                if (!r.isActive) return <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 12 }}>✗ Inactivo</span>;
                                                return <span style={{ color: '#10b981', fontWeight: 600, fontSize: 12 }}>✓ Activo</span>;
                                            })()}
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button onClick={() => handleEditRuleClick(r)} style={{ background: 'none', border: 'none', color: 'var(--mercedes-cyan)', cursor: 'pointer', padding: 4, fontWeight: 600 }}>Editar</button>
                                            <button onClick={() => handleDeleteRule(r.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 4, fontWeight: 600 }}>Borrar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>



            </div>

            {/* MODAL: CREAR REGLA */}
            {showRuleModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 600, padding: 24, backgroundColor: 'var(--bg-app)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: 'var(--light-text)', fontSize: 18 }}>Crear Nueva Regla Automática</h3>
                            <button onClick={() => setShowRuleModal(false)} style={{ background: 'none', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        
                        {ruleError && (
                            <div style={{ padding: 12, marginBottom: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                                {ruleError}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ flex: 2 }}>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Nombre Operativo (Breve) *</label>
                                    <input type="text" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: Bono por cruce BAF + Móvil" value={ruleForm.name} onChange={e => setRuleForm({...ruleForm, name: e.target.value})} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Canal / Tipo *</label>
                                    <select className="form-select" style={{ width: '100%', padding: '9px 10px' }} value={ruleForm.channelType} onChange={e => setRuleForm({...ruleForm, channelType: e.target.value})}>
                                        <option value="PLUS">Segmento PLUS</option>
                                        <option value="BASICO">Segmento BÁSICO</option>
                                        <option value="AMBOS">Segmento PLUS + BÁSICO</option>
                                    </select>
                                </div>
                            </div>

                            {!ruleForm.combinationLabel.startsWith('[PRICE_LIST]') && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Descripción Detallada del Objetivo</label>
                                    <textarea className="form-input" style={{ width: '100%', padding: 10, minHeight: 60, resize: 'vertical' }} placeholder="Ej: FD que realicen al menos una solicitud de equipamiento TMA/Micro..." value={ruleForm.description || ''} onChange={e => setRuleForm({...ruleForm, description: e.target.value})} />
                                </div>
                            )}
                            
                            {/* SELECTOR DE TIPO DE REGLA */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 8, paddingBottom: 16, borderBottom: '1px solid var(--border-color)', flexDirection: 'column' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', color: (!ruleForm.combinationLabel.startsWith('[KPI]') && !ruleForm.combinationLabel.startsWith('[KPI_QTY]') && !ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') && !ruleForm.combinationLabel.startsWith('[PRICE_LIST]')) ? 'var(--mercedes-cyan)' : 'var(--medium-gray)', fontWeight: (!ruleForm.combinationLabel.startsWith('[KPI]') && !ruleForm.combinationLabel.startsWith('[KPI_QTY]') && !ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') && !ruleForm.combinationLabel.startsWith('[PRICE_LIST]')) ? 700 : 400 }}>
                                    <input type="radio" checked={!ruleForm.combinationLabel.startsWith('[KPI]') && !ruleForm.combinationLabel.startsWith('[KPI_QTY]') && !ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') && !ruleForm.combinationLabel.startsWith('[PRICE_LIST]')} onChange={() => setRuleForm({...ruleForm, combinationLabel: ''})} />
                                    Cruce B2B Clásico por Cliente (Detectar productos en un mismo DNI)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', color: ruleForm.combinationLabel.startsWith('[KPI] ') ? '#A855F7' : 'var(--medium-gray)', fontWeight: ruleForm.combinationLabel.startsWith('[KPI] ') ? 700 : 400 }}>
                                    <input type="radio" checked={ruleForm.combinationLabel.startsWith('[KPI] ')} onChange={() => setRuleForm({...ruleForm, combinationLabel: '[KPI] BAF>=120 FD>=80 MULT=FD'})} />
                                    Bono Global de Rendimiento (Objetivos BAF % y FD %)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', color: ruleForm.combinationLabel.startsWith('[KPI_QTY]') ? '#F59E0B' : 'var(--medium-gray)', fontWeight: ruleForm.combinationLabel.startsWith('[KPI_QTY]') ? 700 : 400 }}>
                                    <input type="radio" checked={ruleForm.combinationLabel.startsWith('[KPI_QTY]')} onChange={() => setRuleForm({...ruleForm, combinationLabel: '[KPI_QTY] TGT=RESPALDO 5G QTY>=3 SCOPE=INDIV MULT='})} />
                                    Bono Reto Unitario (Alcanzar una cantidad exacta de un producto)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', color: ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') ? '#10B981' : 'var(--medium-gray)', fontWeight: ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') ? 700 : 400 }}>
                                    <input type="radio" checked={ruleForm.combinationLabel.startsWith('[KPI_PERCENT]')} onChange={() => setRuleForm({...ruleForm, combinationLabel: '[KPI_PERCENT] TGT=MIC,TMA MIN_PCT=100', telecomRewardAmount: '2'})} />
                                    Bono Margen Relativo (Telefónica paga un Extra % si Objetivos &gt;= 100%)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', color: ruleForm.combinationLabel.startsWith('[PRICE_LIST]') ? '#3B82F6' : 'var(--medium-gray)', fontWeight: ruleForm.combinationLabel.startsWith('[PRICE_LIST]') ? 700 : 400 }}>
                                    <input type="radio" checked={ruleForm.combinationLabel.startsWith('[PRICE_LIST]')} onChange={() => setRuleForm({...ruleForm, combinationLabel: '[PRICE_LIST] MULT=0.5'})} />
                                    Bono por Lista de Precios (Pagar por producto según listado pegado)
                                </label>
                            </div>

                            {(!ruleForm.combinationLabel.startsWith('[KPI]') && !ruleForm.combinationLabel.startsWith('[KPI_QTY]') && !ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') && !ruleForm.combinationLabel.startsWith('[PRICE_LIST]')) && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Fórmula de Combinación (Productos) *</label>
                                    <input type="text" className="form-input" style={{ width: '100%', padding: 10, fontFamily: 'monospace' }} placeholder="Ej: FD + TMA" value={ruleForm.combinationLabel} onChange={e => setRuleForm({...ruleForm, combinationLabel: e.target.value})} />
                                    <span style={{ fontSize: 11, color: 'var(--medium-gray)', display: 'block', marginTop: 4 }}>Usa el símbolo ' + ' para separar productos. El motor detectará coincidencias si un cliente tiene todos estos productos en el mes.</span>
                                </div>
                            )}

                            {ruleForm.combinationLabel.startsWith('[KPI] ') && (
                                <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: 16, borderRadius: 8 }}>
                                    <h4 style={{ color: '#A855F7', margin: '0 0 12px 0', fontSize: 14 }}>Configuración de Umbrales</h4>
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Umbral Mínimo BAF (%)</label>
                                            <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: 120" value={ruleForm.combinationLabel.match(/BAF>=(\d+)/)?.[1] || ''} onChange={e => {
                                                const currentStr = ruleForm.combinationLabel;
                                                const newVal = e.target.value;
                                                let newStr = currentStr;
                                                if (newStr.includes('BAF>=')) {
                                                    newStr = newStr.replace(/BAF>=\d+/, `BAF>=${newVal}`);
                                                } else {
                                                    newStr += ` BAF>=${newVal}`;
                                                }
                                                setRuleForm({...ruleForm, combinationLabel: newStr});
                                            }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Umbral Mínimo FD (%)</label>
                                            <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: 80" value={ruleForm.combinationLabel.match(/FD>=(\d+)/)?.[1] || ''} onChange={e => {
                                                const currentStr = ruleForm.combinationLabel;
                                                const newVal = e.target.value;
                                                let newStr = currentStr;
                                                if (newStr.includes('FD>=')) {
                                                    newStr = newStr.replace(/FD>=\d+/, `FD>=${newVal}`);
                                                } else {
                                                    newStr += ` FD>=${newVal}`;
                                                }
                                                setRuleForm({...ruleForm, combinationLabel: newStr});
                                            }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Producto Multiplicador (Dejar vacío para Pago Único)</label>
                                        <input type="text" className="form-input" style={{ width: '100%', padding: 10, fontFamily: 'monospace' }} placeholder="Ej: FD" value={ruleForm.combinationLabel.match(/MULT=([a-zA-Z0-9_]+)/)?.[1] || ''} onChange={e => {
                                                const currentStr = ruleForm.combinationLabel;
                                                const newVal = e.target.value.toUpperCase();
                                                let newStr = currentStr.replace(/MULT=[a-zA-Z0-9_]+/, '').trim();
                                                if (newVal) newStr += ` MULT=${newVal}`;
                                                setRuleForm({...ruleForm, combinationLabel: newStr});
                                            }} />
                                            <span style={{ display:'block', marginTop: 4, fontSize: 11, color: 'var(--medium-gray)' }}>Si indicas "FD", el bono (€) se multiplicará por cada Alta FD lograda. Si lo dejas vacío, será un único pago fijo mensual.</span>
                                    </div>
                                    
                                    <div style={{ marginTop: 12, padding: 8, background: 'rgba(0,0,0,0.2)', fontSize: 12, color: 'var(--medium-gray)', borderRadius: 4, fontFamily: 'monospace' }}>
                                        String generado: {ruleForm.combinationLabel}
                                    </div>
                                </div>
                            )}

                            {ruleForm.combinationLabel.startsWith('[KPI_QTY]') && (
                                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: 16, borderRadius: 8 }}>
                                    <h4 style={{ color: '#F59E0B', margin: '0 0 12px 0', fontSize: 14 }}>Configuración del Reto</h4>
                                    
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Evaluación del Reto (Medición)</label>
                                        <select className="form-select" style={{ width: '100%', padding: '9px 10px' }} value={ruleForm.combinationLabel.match(/SCOPE=(TEAM|INDIV)/)?.[1] || 'INDIV'} onChange={e => {
                                            const newVal = e.target.value;
                                            const tgt = (ruleForm.combinationLabel.match(/TGT=(.*?)(?:\s+QTY>=|\s+SCOPE=|\s+INDIV_MIN=|\s+MULT=|$)/)?.[1] || '').trim();
                                            const qty = ruleForm.combinationLabel.match(/QTY>=(\d+)/)?.[1] || '';
                                            const indivMin = ruleForm.combinationLabel.match(/INDIV_MIN=(\d+)/)?.[1] || '';
                                            const mult = (ruleForm.combinationLabel.match(/MULT=(.*)/)?.[1] || '').trim();
                                            setRuleForm({...ruleForm, combinationLabel: `[KPI_QTY] TGT=${tgt} QTY>=${qty} SCOPE=${newVal}${newVal === 'TEAM' && indivMin ? ` INDIV_MIN=${indivMin}` : ''} MULT=${mult}`});
                                        }}>
                                            <option value="INDIV">Evaluación Individual (El objetivo debe alcanzarlo el comercial por sí solo)</option>
                                            <option value="TEAM">Evaluación Grupal (Se suman las ventas de todos los comerciales del segmento)</option>
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Buscar coincidencias del Producto/Familia</label>
                                            <input type="text" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: Respaldo 5G" value={(ruleForm.combinationLabel.match(/TGT=(.*?)(?:\s+QTY>=|\s+SCOPE=|\s+INDIV_MIN=|\s+MULT=|$)/)?.[1] || '').trim()} onChange={e => {
                                                const newVal = e.target.value.toUpperCase();
                                                const qty = ruleForm.combinationLabel.match(/QTY>=(\d+)/)?.[1] || '';
                                                const scope = ruleForm.combinationLabel.match(/SCOPE=(TEAM|INDIV)/)?.[1] || 'INDIV';
                                                const indivMin = ruleForm.combinationLabel.match(/INDIV_MIN=(\d+)/)?.[1] || '';
                                                const mult = (ruleForm.combinationLabel.match(/MULT=(.*)/)?.[1] || '').trim();
                                                setRuleForm({...ruleForm, combinationLabel: `[KPI_QTY] TGT=${newVal} QTY>=${qty} SCOPE=${scope}${scope === 'TEAM' && indivMin ? ` INDIV_MIN=${indivMin}` : ''} MULT=${mult}`});
                                            }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>{ruleForm.combinationLabel.includes('SCOPE=TEAM') ? 'Hit Equipo' : 'Cantidad Mínima'}</label>
                                            <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: 15" value={ruleForm.combinationLabel.match(/QTY>=(\d+)/)?.[1] || ''} onChange={e => {
                                                const newVal = e.target.value;
                                                const tgt = (ruleForm.combinationLabel.match(/TGT=(.*?)(?:\s+QTY>=|\s+SCOPE=|\s+INDIV_MIN=|\s+MULT=|$)/)?.[1] || '').trim();
                                                const scope = ruleForm.combinationLabel.match(/SCOPE=(TEAM|INDIV)/)?.[1] || 'INDIV';
                                                const indivMin = ruleForm.combinationLabel.match(/INDIV_MIN=(\d+)/)?.[1] || '';
                                                const mult = (ruleForm.combinationLabel.match(/MULT=(.*)/)?.[1] || '').trim();
                                                setRuleForm({...ruleForm, combinationLabel: `[KPI_QTY] TGT=${tgt} QTY>=${newVal} SCOPE=${scope}${scope === 'TEAM' && indivMin ? ` INDIV_MIN=${indivMin}` : ''} MULT=${mult}`});
                                            }} />
                                        </div>
                                        {ruleForm.combinationLabel.match(/SCOPE=TEAM/) && (
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Mín. Propio</label>
                                                <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: 3" value={ruleForm.combinationLabel.match(/INDIV_MIN=(\d+)/)?.[1] || ''} onChange={e => {
                                                    const newVal = e.target.value;
                                                    const tgt = (ruleForm.combinationLabel.match(/TGT=(.*?)(?:\s+QTY>=|\s+SCOPE=|\s+INDIV_MIN=|\s+MULT=|$)/)?.[1] || '').trim();
                                                    const qty = ruleForm.combinationLabel.match(/QTY>=(\d+)/)?.[1] || '';
                                                    const scope = 'TEAM';
                                                    const mult = (ruleForm.combinationLabel.match(/MULT=(.*)/)?.[1] || '').trim();
                                                    setRuleForm({...ruleForm, combinationLabel: `[KPI_QTY] TGT=${tgt} QTY>=${qty} SCOPE=${scope}${newVal ? ` INDIV_MIN=${newVal}` : ''} MULT=${mult}`});
                                                }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* PRODUCTOS Y OBJETIVO TOTAL */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, marginTop: 4 }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Productos que cuentan (separados por coma)</label>
                                            <input type="text" className="form-input" style={{ width: '100%', padding: 10 }}
                                                placeholder="tgt, tgt soporte, tgt ciberseguridad"
                                                value={kpiProducts}
                                                onChange={e => setKpiProducts(e.target.value)} />
                                            <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--medium-gray)' }}>Coincidencia por inclusión en nombre de producto (no distingue mayúsculas).</span>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Objetivo total equipo (uds)</label>
                                            <input type="number" className="form-input" style={{ width: '100%', padding: 10 }}
                                                placeholder="30"
                                                value={ruleForm.maxPayoutUnits}
                                                onChange={e => setRuleForm({...ruleForm, maxPayoutUnits: e.target.value})} />
                                        </div>
                                    </div>

                                    {/* EDITOR DE TRAMOS */}
                                    <div style={{ marginBottom: 8 }}>
                                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>Tramos de pago (por unidad, desde la primera)</label>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid rgba(245,158,11,0.3)', color: 'var(--medium-gray)', textAlign: 'left' }}>
                                                    <th style={{ padding: '6px 8px' }}>Tramo</th>
                                                    <th style={{ padding: '6px 8px', width: 90 }}>Hasta % equipo</th>
                                                    <th style={{ padding: '6px 8px', width: 120 }}>Telefónica (€/ud)</th>
                                                    <th style={{ padding: '6px 8px', width: 120 }}>Comercial (€/ud)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {kpiTiers.map((tier, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
                                                        <td style={{ padding: '8px 8px', color: 'var(--medium-gray)', fontSize: 12 }}>
                                                            {idx === kpiTiers.length - 1 ? `Tramo ${idx+1} (máx.)` : `Tramo ${idx+1}`}
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            {idx < kpiTiers.length - 1 ? (
                                                                <input type="number" className="form-input" style={{ width: '100%', padding: '4px 6px', fontSize: 13 }}
                                                                    value={tier.maxPct ?? ''}
                                                                    onChange={e => {
                                                                        const t = [...kpiTiers]; t[idx] = {...t[idx], maxPct: e.target.value ? Number(e.target.value) : undefined}; setKpiTiers(t);
                                                                    }} />
                                                            ) : (
                                                                <span style={{ color: 'var(--medium-gray)', fontSize: 12, paddingLeft: 6 }}>
                                                                    {`>= ${kpiTiers[idx-1]?.maxPct ?? 100}%`}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <input type="number" className="form-input" style={{ width: '100%', padding: '4px 6px', fontSize: 13 }}
                                                                value={tier.telecom}
                                                                onChange={e => {
                                                                    const t = [...kpiTiers]; t[idx] = {...t[idx], telecom: Number(e.target.value)}; setKpiTiers(t);
                                                                    if (idx === kpiTiers.length - 1) setRuleForm(f => ({...f, telecomRewardAmount: e.target.value}));
                                                                }} />
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            <input type="number" className="form-input" style={{ width: '100%', padding: '4px 6px', fontSize: 13 }}
                                                                value={tier.seller}
                                                                onChange={e => {
                                                                    const t = [...kpiTiers]; t[idx] = {...t[idx], seller: Number(e.target.value)}; setKpiTiers(t);
                                                                    if (idx === kpiTiers.length - 1) setRuleForm(f => ({...f, sellerRewardAmount: e.target.value}));
                                                                }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, fontSize: 11, color: '#F59E0B' }}>
                                            El tramo lo decide el total del equipo. Cada comercial cobra su tramo x sus propias uds, desde la primera.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') && (
                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 16, borderRadius: 8 }}>
                                    <h4 style={{ color: '#10B981', margin: '0 0 12px 0', fontSize: 14 }}>Configuración del Bono Variable</h4>
                                    
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Familias a Evaluar (Separadas por coma)</label>
                                            <input type="text" className="form-input" style={{ width: '100%', padding: 10, fontFamily: 'monospace' }} placeholder="Ej: MIC,TMA" value={(ruleForm.combinationLabel.match(/TGT=([a-zA-Z0-9_,]+)/)?.[1] || '')} onChange={e => {
                                                const newVal = e.target.value.toUpperCase().replace(/\s/g, '');
                                                const minPct = ruleForm.combinationLabel.match(/MIN_PCT=(\d+)/)?.[1] || '';
                                                setRuleForm({...ruleForm, combinationLabel: `[KPI_PERCENT] TGT=${newVal} MIN_PCT=${minPct}`});
                                            }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Objetivo Mín. a Lograr (%)</label>
                                            <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: 100" value={ruleForm.combinationLabel.match(/MIN_PCT=(\d+)/)?.[1] || ''} onChange={e => {
                                                const newVal = e.target.value;
                                                const tgt = ruleForm.combinationLabel.match(/TGT=([a-zA-Z0-9_,]+)/)?.[1] || '';
                                                setRuleForm({...ruleForm, combinationLabel: `[KPI_PERCENT] TGT=${tgt} MIN_PCT=${newVal}`});
                                            }} />
                                        </div>
                                    </div>
                                    <span style={{ display:'block', fontSize: 11, color: 'var(--medium-gray)' }}>Aviso: Este modo transforma las cajas inferiores en porcentajes. Si en "Empresa" pones 2, se calculará el 2% de las comisiones generadas por esas familias. Si en "Comercial" pones 1, le pagarás el 1%.</span>
                                    
                                    <div style={{ marginTop: 12, padding: 8, background: 'rgba(0,0,0,0.2)', fontSize: 12, color: 'var(--medium-gray)', borderRadius: 4, fontFamily: 'monospace' }}>
                                        String generado: {ruleForm.combinationLabel}
                                    </div>
                                </div>
                            )}

                            {ruleForm.combinationLabel.startsWith('[PRICE_LIST]') && (
                                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: 16, borderRadius: 8 }}>
                                    <h4 style={{ color: '#3B82F6', margin: '0 0 12px 0', fontSize: 14 }}>Configuración de Lista de Precios</h4>
                                    
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Porcentaje del Comercial (%)</label>
                                        <input type="number" step="0.1" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: 50 para el 50%" value={ruleForm.combinationLabel.match(/MULT=([\d.]+)/) ? (parseFloat(ruleForm.combinationLabel.match(/MULT=([\d.]+)/)![1]) * 100).toString() : '0'} onChange={e => {
                                            const newVal = (Number(e.target.value) / 100).toFixed(2);
                                            setRuleForm({...ruleForm, combinationLabel: `[PRICE_LIST] MULT=${newVal}`});
                                        }} />
                                        <span style={{ display:'block', fontSize: 11, color: 'var(--medium-gray)', marginTop: 4 }}>
                                            Como tu Excel probablemente solo trae lo que paga Telefónica, el sistema calculará la parte del comercial usando este porcentaje.
                                        </span>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--light-text)' }}>Pega aquí tu Excel (Nombre de Producto y Precio Telefónica)</label>
                                        <textarea className="form-input" style={{ width: '100%', padding: 10, minHeight: 150, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }} 
                                            placeholder={"Ejemplo:\nPortátil Lenovo ThinkBook 14\t15,00\nMonitor Lenovo T24-40\t15,00\nHP EliteBook 6 G1a\t40,00"} 
                                            value={ruleForm.description || ''} 
                                            onChange={e => setRuleForm({...ruleForm, description: e.target.value})} 
                                        />
                                        <span style={{ display:'block', fontSize: 11, color: 'var(--medium-gray)', marginTop: 4 }}>
                                            El sistema buscará en las ventas si el producto <strong>incluye</strong> el nombre que pongas aquí. Intenta que el nombre sea corto (Ej: "ThinkBook 14").
                                        </span>
                                    </div>
                                    
                                    <div style={{ marginTop: 12, padding: 8, background: 'rgba(0,0,0,0.2)', fontSize: 12, color: 'var(--medium-gray)', borderRadius: 4, fontFamily: 'monospace' }}>
                                        String generado: {ruleForm.combinationLabel}
                                    </div>
                                </div>
                            )}

                            {ruleForm.combinationLabel.startsWith('[KPI_QTY]') ? (
                                <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
                                    ✓ Los importes y el objetivo están definidos en la tabla de tramos de arriba. No es necesario rellenar nada más aquí.
                                </div>
                            ) : ruleForm.combinationLabel.startsWith('[PRICE_LIST]') ? (
                                <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 8, fontSize: 12, color: '#3B82F6' }}>
                                    ✓ Los importes se leerán automáticamente de la lista que has pegado.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>
                                            {ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') ? '% Extra para Empresa (Ej: 2) *' : 'Importe Telefónica (€) *'}
                                        </label>
                                        <input type="number" step="0.01" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="0.00" value={ruleForm.telecomRewardAmount} onChange={e => setRuleForm({...ruleForm, telecomRewardAmount: e.target.value})} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>
                                            {ruleForm.combinationLabel.startsWith('[KPI_PERCENT]') ? '% para el Comercial (Ej: 0.5) *' : 'Importe Comercial (€) *'}
                                        </label>
                                        <input type="number" step="0.01" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="0.00" value={ruleForm.sellerRewardAmount} onChange={e => setRuleForm({...ruleForm, sellerRewardAmount: e.target.value})} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Tope (Ops)</label>
                                        <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ilimitado" value={ruleForm.maxPayoutUnits} onChange={e => setRuleForm({...ruleForm, maxPayoutUnits: e.target.value})} />
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>
                                        Fecha Inicio {ruleForm.combinationLabel.startsWith('[KPI_QTY]') && <span style={{ color: '#ef4444' }}>*</span>}
                                    </label>
                                    <input type="date" className="form-input" style={{ width: '100%', padding: 9 }} value={ruleForm.validFrom} onChange={e => setRuleForm({...ruleForm, validFrom: e.target.value})} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Fecha Fin</label>
                                    <input type="date" className="form-input" style={{ width: '100%', padding: 9 }} value={ruleForm.validTo} onChange={e => setRuleForm({...ruleForm, validTo: e.target.value})} />
                                </div>
                            </div>
                            {ruleForm.combinationLabel.startsWith('[KPI_QTY]') && !ruleForm.validFrom && (
                                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 12, color: '#ef4444' }}>
                                    ⚠️ <strong>Importante:</strong> Sin "Fecha Inicio" esta regla se aplicará también a meses anteriores. Pon como mínimo el primer día del mes al que corresponde (ej: 2026-05-01).
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                                <input type="checkbox" id="isActiveCheck" checked={ruleForm.isActive} onChange={e => setRuleForm({...ruleForm, isActive: e.target.checked})} style={{ width: 16, height: 16 }} />
                                <label htmlFor="isActiveCheck" style={{ fontSize: 14, color: 'var(--light-text)', cursor: 'pointer' }}>Regla activa para próximos cruces</label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                            <button className="btn btn-secondary" onClick={() => setShowRuleModal(false)} disabled={ruleSaving}>Cancelar</button>
                            <button className="primary-button" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', opacity: ruleSaving ? 0.7 : 1 }} onClick={handleSaveRule} disabled={ruleSaving}>
                                <Save size={16} /> {ruleSaving ? 'Guardando...' : 'Guardar Regla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: DEFINIR CONCEPTO MANUAL */}
            {showTemplateModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 450, padding: 24, backgroundColor: 'var(--bg-app)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: 'var(--light-text)', fontSize: 18 }}>Definir Concepto Manual</h3>
                            <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Nombre del Concepto</label>
                                <input type="text" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="Ej: Ajuste negativo Q2, Cesta de Navidad..." />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--medium-gray)' }}>Importe por Defecto (€)</label>
                                <input type="number" className="form-input" style={{ width: '100%', padding: 10 }} placeholder="20.00" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancelar</button>
                            <button className="primary-button" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }} onClick={() => { console.log('Concepto Guardado (mock)'); setShowTemplateModal(false); }}>
                                <Save size={16} /> Añadir Concepto
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
