'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Euro, Calendar, ArrowLeft, Save, ClipboardList, X, Trash2, Settings, Download, Briefcase, FileText, BarChart2, Repeat, Zap, Settings2, ArrowUp, ArrowDown, Users, RefreshCcw, Map, TrendingUp, Search } from 'lucide-react'
import { ExcelIcon } from '@/components/ActionIcons'
import ExcelJS from 'exceljs'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { PeriodSelector } from '@/components/PeriodSelector'
import { usePeriod } from '@/components/PeriodProvider'
import { OBJECTIVE_KEYS, OBJECTIVE_MAPPING } from '@/lib/constants'
import { calculateDynamicCommission, sanitizeSale, normalizeString, getCurrentMonthString, isVentaWithinDates, renderDashboardData } from '@/lib/salesUtils'
import { can, canEdit } from '@/lib/permissions'
import { useGuard } from '@/hooks/useGuard'
import { RepescaTrimestral } from './RepescaTrimestral'
import { ComisionesV3 } from './ComisionesV3'
type ViewType = 'menu' | 'plus' | 'basico' | 'operaciones' | 'cruce' | 'objetivos' | 'auditoria' | 'repesca' | 'comisiones_v3'

const getDisplayGroup = (producto: string) => {
    if (!producto) return null;
    const p = String(producto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (p.includes('migra baf')) return 'MBAF';
    if (p.includes('baf') || p.includes('respaldo 5g')) return 'BAF';
    if (p.includes('fd')) return 'FD';
    if (p.includes('fn')) return 'FN';
    if (p.includes('puesto fijo')) return 'PF';
    if (p.includes('renovacion')) return 'REN';
    if (p.includes('alta movil')) return 'ALTA';
    if (p.includes('porta')) return 'PORTA';
    if (p.includes('tma')) return 'TMA';
    if (p.includes('micro')) return 'MIC';
    if (p.includes('ti') || p.includes('tgt')) return 'TI';
    if (p.includes('alarma')) return 'MPA';

    return null;
}

export default function LiquidacionesPage() {
    const router = useRouter()
    const { authorized } = useGuard('MODULE_LIQUIDACION')
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [currentView, setCurrentView] = useState<ViewType>('menu')
    const [opSearch, setOpSearch] = useState('')   // buscador del Registro de Operaciones

    const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()
    
    // Period Context Derived
    const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
    const isHistoric = activePeriodObj?.status === 'HISTORIC'
    const isEditAllowed = user ? canEdit(user, 'MODULE_LIQUIDACION') : false
    const canModify = !isHistoric && isEditAllowed
    
    const activeMonthStr = activePeriodKey ? activePeriodKey.replace('_', '') : '' // "202603"

    const [allSales, setAllSales] = useState<any[]>([])
    const [filteredSalesGlobal, setFilteredSalesGlobal] = useState<any[]>([])

    // Data States
    const [objetivos, setObjetivos] = useState<Record<string, any>>({ Pyme: {}, Captador: {} })
    const [objGrupos, setObjGrupos] = useState<Record<string, any>>({ Pyme: {}, Captador: {} })
    const [importesPyme, setImportesPyme] = useState<any[]>([])
    const [importesPlus, setImportesPlus] = useState<any[]>([]) // Captador
    const [extraAssignments, setExtraAssignments] = useState<any[]>([])
    const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})

    // Saving state
    const [savingObj, setSavingObj] = useState(false)
    const [selectedCell, setSelectedCell] = useState<{ profile: 'Pyme' | 'Captador', rowIndex: number, field: string } | null>(null)

    // Modal Excel Mass Paste State
    const [showPasteModal, setShowPasteModal] = useState<{ profile: 'Pyme' | 'Captador', rowIndex: number } | null>(null)
    const [pasteText, setPasteText] = useState('')
    const [pasteStartField, setPasteStartField] = useState<string>('grupo')
    const [pasteMode, setPasteMode] = useState<'single' | 'block'>('block')
    const [configRow, setConfigRow] = useState<{ profile: 'Pyme' | 'Captador', rowIndex: number } | null>(null)

    // Pending Deletion Tracking
    const [deletedPymeIds, setDeletedPymeIds] = useState<string[]>([])
    const [deletedPlusIds, setDeletedPlusIds] = useState<string[]>([])

    // Outstanding Dirty Rows Flag Tracking 
    const [unsavedRows, setUnsavedRows] = useState<{ profile: 'Pyme' | 'Captador', index: number }[]>([])

    // Edit Operaciones details
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<any>({})
    const [saveLoading, setSaveLoading] = useState(false)

    // Sorting Flash state
    const [flashRow, setFlashRow] = useState<{ profile: 'Pyme' | 'Captador', index: number } | null>(null)

    // UI Notifications
    const [saveMessage, setSaveMessage] = useState<{ profile: 'Pyme' | 'Captador', msg: string } | null>(null)

    // DND Menu Sorting variables
    
    



    const fetchImportes = async () => {
        try {
            const [pymeData, plusData] = await Promise.all([
                fetch('/api/importes-pyme').then(res => res.json()).catch(() => ({})),
                fetch('/api/importes-plus').then(res => res.json()).catch(() => ({}))
            ])

            if (pymeData && pymeData.success && pymeData.importes) {
                setImportesPyme(pymeData.importes)
            } else if (pymeData && pymeData.success && pymeData.data) {
                setImportesPyme(pymeData.data)
            }

            if (plusData && plusData.success && plusData.importes) {
                setImportesPlus(plusData.importes)
            } else if (plusData && plusData.success && plusData.data) {
                setImportesPlus(plusData.data)
            }
        } catch (err) {
            console.error("Error re-fetching importes:", err)
        }
    }

    useEffect(() => {
        // 1. Fetch Global Data (Solo la primera vez)
        Promise.all([
            fetch('/api/auth/me').then(res => res.json()).catch(() => ({})),
            fetch(`/api/catalogs?_t=${Date.now()}`).then(res => res.json()).catch(() => ({}))
        ]).then(([authData, catData]) => {
            if (authData && authData.authenticated) {
                setUser(authData.user)
            }
            // Las ventas globales iniciales se han delegado al fetch dependiente de activePeriodKey

            if (catData && catData.success) {
                setCatalogs(catData.catalogs || {})
            }

            setLoading(false)
        }).catch(err => {
            console.error(err)
            setLoading(false)
        })
    }, [])

    useEffect(() => {
        if (!activePeriodKey) return;

        // 2a. Fetch Económico Estricto y Ventas
        Promise.all([
            fetch(`/api/objetivos?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
            fetch(`/api/importes-pyme?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
            fetch(`/api/importes-plus?periodKey=${activePeriodKey}&strictPeriod=1`).then(res => res.json()).catch(() => ({})),
            fetch(`/api/sales?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({})),
            fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({}))
        ]).then(([objData, pymeData, plusData, sData, extrasData]) => {
            if (objData && objData.success && objData.objetivos) {
                setObjetivos(objData.objetivos)
                if (objData.grupos) setObjGrupos(objData.grupos)
            }
            
            if (pymeData && pymeData.success && pymeData.importes) {
                setImportesPyme(pymeData.importes)
            } else if (pymeData && pymeData.success && pymeData.data) {
                setImportesPyme(pymeData.data)
            } else {
                setImportesPyme([])
            }

            if (plusData && plusData.success && plusData.importes) {
                setImportesPlus(plusData.importes)
            } else if (plusData && plusData.success && plusData.data) {
                setImportesPlus(plusData.data)
            } else {
                setImportesPlus([])
            }
            
            if (sData && sData.success && sData.logs) {
                const sanitized = sData.logs.map(sanitizeSale)
                setAllSales(sanitized)
                setFilteredSalesGlobal(sanitized)
            } else {
                setAllSales([])
                setFilteredSalesGlobal([])
            }

            if (extrasData && extrasData.success && extrasData.assignments) {
                setExtraAssignments(extrasData.assignments)
            } else {
                setExtraAssignments([])
            }
        })

    }, [activePeriodKey])

    // TODO (C4): Solución transitoria. Filtrado temporal basado en matching de strings (MM-YYYY vs DD/MM/YYYY).
    // Esto se reemplazará por filtro directo `periodId` cuando el modelo Sale migre al sistema de periodos.
    // Local filter has been replaced by the database query filter matching periodKey

    // --- Handlers para Operaciones ---
    const handleEditRow = (sale: any) => {
        setEditingId(sale.id)
        setEditForm({ ...sale })
    }

    const handleSaveRow = async () => {
        if (!editingId) return
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        setSaveLoading(true)
        try {
            const res = await fetch('/api/sales', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingId, updates: editForm })
            })
            if (res.ok) {
                setAllSales(prev => prev.map(s => s.id === editingId ? { ...s, ...editForm } : s))
                setFilteredSalesGlobal(prev => prev.map(s => s.id === editingId ? { ...s, ...editForm } : s))
                setEditingId(null)
            } else {
                alert("Error al guardar cambios")
            }
        } catch (e) {
            console.error(e)
            alert("Error de red")
        } finally {
            setSaveLoading(false)
        }
    }

    // --- Handlers para Objetivos ---
    const currentObjMonth = activeMonthStr

    const handleObjectiveChange = (profile: string, objKey: string, value: string) => {
        if (!canModify) return
        const numVal = value === '' ? 0 : parseFloat(value)
        setObjetivos(prev => {
            const newObj = { ...prev }
            if (!newObj[profile]) newObj[profile] = {}
            if (!newObj[profile][currentObjMonth]) newObj[profile][currentObjMonth] = {}
            newObj[profile][currentObjMonth][objKey] = numVal
            return newObj
        })
    }

    const saveObjetivos = async () => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        setSavingObj(true)
        try {
            const res = await fetch('/api/objetivos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ objetivos })
            })
            if (res.ok) {
                alert("Objetivos guardados correctamente")
            } else {
                alert("Error al guardar objetivos")
            }
        } catch (e) {
            console.error(e)
            alert("Error de red")
        } finally {
            setSavingObj(false)
        }
    }

    // --- Handlers para Importes (Dashboard Edit/Paste) ---
    const handleImporteChange = (profile: 'Pyme' | 'Captador', rowIndex: number, field: string, value: string | boolean) => {
        if (!canModify) return
        
        let finalVal: string | number | boolean | null = value
        const isStringField = field === 'concepto' || field === 'grupo' || field === 'operacionesAsignadas' || field === 'isPercentage'

        if (typeof value === 'string' && field !== 'isPercentage' && !isStringField) {
            const cleanVal = value.replace(',', '.')
            if (cleanVal === '') {
                finalVal = null
            } else if (cleanVal.endsWith('.') || (cleanVal.includes('.') && cleanVal.endsWith('0'))) {
                finalVal = cleanVal
            } else {
                finalVal = parseFloat(cleanVal)
            }
            if (typeof finalVal === 'number' && isNaN(finalVal)) finalVal = null
        }

        const applyChange = (prev: any[]) => {
            const copy = [...prev]
            const targetGrupo = (copy[rowIndex].grupo || '').trim().toUpperCase()
            const isGroupSyncField = field === 'objetivoUds' || field === 'totalObjetivos'

            if (isGroupSyncField && targetGrupo) {
                return copy.map((row) => {
                    if ((row.grupo || '').trim().toUpperCase() === targetGrupo) {
                        return { ...row, [field]: finalVal }
                    }
                    return row
                })
            } else {
                copy[rowIndex] = { ...copy[rowIndex], [field]: finalVal }
                return copy
            }
        }

        if (profile === 'Pyme') {
            setImportesPyme(applyChange)
        } else {
            setImportesPlus(applyChange)
        }

        // Mark as unsaved
        setUnsavedRows(prev => {
            if (!prev.find(ur => ur.profile === profile && ur.index === rowIndex)) {
                return [...prev, { profile, index: rowIndex }]
            }
            return prev
        })
    }

    const handleGroupSort = (profile: 'Pyme' | 'Captador', triggerRowIndex: number) => {
        const isPyme = profile === 'Pyme'
        const collection = isPyme ? importesPyme : importesPlus
        const targetRow = collection[triggerRowIndex]

        const sorted = [...collection].sort((a, b) => {
            const ga = (a.grupo || '').trim().toUpperCase()
            const gb = (b.grupo || '').trim().toUpperCase()
            if (ga < gb) return -1
            if (ga > gb) return 1
            return 0
        })

        if (isPyme) setImportesPyme(sorted)
        else setImportesPlus(sorted)

        const newIndex = sorted.findIndex(r => r === targetRow)
        if (newIndex !== -1) {
            setFlashRow({ profile, index: newIndex })
            setTimeout(() => setFlashRow(null), 1500)
        }
    }

    const handleDeleteRow = async (profile: 'Pyme' | 'Captador', rowIndex: number) => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        const isPyme = profile === 'Pyme'
        const collection = isPyme ? importesPyme : importesPlus
        const targetRow = collection[rowIndex]
        const productName = targetRow?.concepto || `Fila ${rowIndex + 1}`
        const targetId = targetRow?.id

        console.log('Intentando borrar ID:', targetId, productName)

        if (!window.confirm(`¿Estás seguro de que quieres eliminar este producto: "${productName}"?`)) {
            return
        }

        const originalCollection = [...collection]

        // Optimistic delete: instant filtering by ID
        if (isPyme) {
            setImportesPyme(prev => prev.filter(r => r.id !== targetId))
        } else {
            setImportesPlus(prev => prev.filter(r => r.id !== targetId))
        }

        // Handle DB Delete if it's not a temp ID
        if (targetId && !String(targetId).startsWith('temp_')) {
            const endpoint = (isPyme ? '/api/importes-pyme' : '/api/importes-plus') + `?id=${targetId}&periodKey=${activePeriodKey}`
            try {
                const res = await fetch(endpoint, { method: 'DELETE' })
                if (!res.ok) {
                    throw new Error('API delete failed')
                }
            } catch (e) {
                console.error("Fallo al eliminar de BD", e)
                alert('Error al eliminar de la base de datos.')
                // Rollback UI
                if (isPyme) {
                    setImportesPyme(originalCollection)
                } else {
                    setImportesPlus(originalCollection)
                }
            }
        }
    }

    const handleClearTable = (profile: 'Pyme' | 'Captador') => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        if (!window.confirm(`⚠️ ATENCIÓN: ¿Estás completamente seguro de que quieres VACIAR TODA LA TABLA de ${profile}? Se eliminarán todas las filas configuradas.`)) return

        const isPyme = profile === 'Pyme'
        const collection = isPyme ? importesPyme : importesPlus
        const idsToDelete = collection.filter(r => r.id && !String(r.id).startsWith('temp_')).map(r => r.id as string)

        if (isPyme) {
            setDeletedPymeIds(prev => [...prev, ...idsToDelete])
            setImportesPyme([])
        } else {
            setDeletedPlusIds(prev => [...prev, ...idsToDelete])
            setImportesPlus([])
        }
    }

    const cloneImportes = async (profile: 'Pyme' | 'Captador') => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        try {
            const endpoint = profile === 'Pyme' ? '/api/importes-pyme' : '/api/importes-plus';
            // Pedimos el legacy fallback
            const res = await fetch(`${endpoint}?legacyOnly=1`);
            const json = await res.json();
            
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                const templateRows = json.data.map((r: any, idx: number) => {
                    const { id, periodId, createdAt, updatedAt, ...rest } = r;
                    return { ...rest, id: `temp_clone_${Date.now()}_${idx}` };
                });
                
                const unsaved = templateRows.map((_: any, i: number) => ({ profile, index: i }));

                if (profile === 'Pyme') {
                    setImportesPyme(templateRows);
                    setUnsavedRows(prev => [...prev.filter(ur => ur.profile !== 'Pyme'), ...unsaved]);
                } else {
                    setImportesPlus(templateRows);
                    setUnsavedRows(prev => [...prev.filter(ur => ur.profile !== 'Captador'), ...unsaved]);
                }
            } else {
                alert(`No se encontró configuración Legacy Base para ${profile}.`);
            }
        } catch (e) {
            console.error("Error cloning importes", e);
            alert("Error de red al intentar clonar configuración base.");
        }
    }

    const processPaste = (actionType: 'append' | 'replace' = 'append') => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        if (!showPasteModal || !pasteText) return

        if (actionType === 'replace') {
            if (!window.confirm("⚠️ ATENCIÓN: ¿Seguro? Se borrarán todos los objetivos actuales de esta sección y se reemplazarán con los datos copiados.")) return
        }

        const rows = pasteText.split('\n').map(r => r.split('\t').map(c => c.trim()))
        const fields = ['grupo', 'concepto', 'comisionNacionalMenos50', 'comisionNacionalEntre50Y80', 'comisionNacionalEntre80Y100', 'comisionNacionalMas100']
        const startColIndex = fields.indexOf(pasteStartField)

        if (startColIndex === -1) {
            setShowPasteModal(null)
            setPasteText('')
            return
        }

        const isPyme = showPasteModal.profile === 'Pyme'
        const setFunc = isPyme ? setImportesPyme : setImportesPlus

        setFunc(prev => {
            let copy = [...prev]
            let startIndex = showPasteModal.rowIndex

            if (actionType === 'replace') {
                const idsToDelete = copy.filter(r => r.id).map(r => r.id as string)
                if (isPyme) setDeletedPymeIds(d => [...d, ...idsToDelete])
                else setDeletedPlusIds(d => [...d, ...idsToDelete])
                copy = []
                startIndex = 0
            }

            for (let r = 0; r < rows.length; r++) {
                const targetRowIndex = startIndex + r

                if (targetRowIndex >= copy.length) {
                    // Auto-expand the table with a new empty row
                    copy.push({
                        id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        grupo: '',
                        concepto: '',
                        objetivoUds: null,
                        totalObjetivos: null,
                        objetivoPlus100: null,
                        comisionNacionalMenos50: null,
                        comisionNacionalEntre50Y80: null,
                        comisionNacionalEntre80Y100: null,
                        comisionNacionalMas100: null
                    } as any)
                }

                const rowData = rows[r]
                if (rowData.length === 1 && rowData[0] === '') continue

                let newRow = { ...copy[targetRowIndex] }
                const colsToProcess = pasteMode === 'single' ? 1 : rowData.length
                for (let c = 0; c < colsToProcess; c++) {
                    const targetColIndex = startColIndex + c

                    // Ignore Excel columns overlapping into non-editable fields (Ventas, % Cump, Importe)
                    if (targetColIndex >= fields.length) break
                    const targetField = fields[targetColIndex]

                    let val = rowData[c]
                    if (val === '') {
                        // Fill-down: Excel merged cells send empty string, so copy from above
                        if (targetRowIndex > 0 && copy[targetRowIndex - 1]) {
                            const upVal = copy[targetRowIndex - 1][targetField]
                            val = upVal !== null && upVal !== undefined ? String(upVal) : ''
                        }

                        if (val === '') continue // Final safety trap
                    }

                    const isStringField = targetField === 'concepto' || targetField === 'grupo' || targetField === 'operacionesAsignadas'

                    if (val === '-' && !isStringField) {
                        newRow[targetField] = null
                        continue
                    }

                    // Clean euros and fix commas (only for numeric columns)
                    let finalVal: string | number | null = val
                    if (!isStringField) {
                        const cleanVal = val.replace(/[^0-9,-]/g, '').replace(',', '.')
                        finalVal = cleanVal === '' ? null : parseFloat(cleanVal)
                    }

                    newRow[targetField] = finalVal
                }
                copy[targetRowIndex] = newRow
            }
            return copy
        })

        setShowPasteModal(null)
        setPasteText('')
    }

    const saveImportes = async (profile: 'Pyme' | 'Captador') => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        const isPyme = profile === 'Pyme'
        const rawData = isPyme ? importesPyme : importesPlus

        // Sanitize: strip 'id' entirely if it's undefined or null to prevent Prisma creation crashes
        const sanitizedData = rawData.map(row => {
            if (!row.id || String(row.id).startsWith('temp_')) {
                const { id, ...rest } = row
                return rest
            }
            return row
        })

        const deletedIds = isPyme ? deletedPymeIds : deletedPlusIds
        const endpoint = (isPyme ? '/api/importes-pyme' : '/api/importes-plus') + `?periodKey=${activePeriodKey}`

        try {
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    operations: sanitizedData,
                    deletions: deletedIds
                })
            })
            if (res.ok) {
                // Show green checkmark banner temporarily
                setSaveMessage({ profile, msg: 'Datos guardados con éxito' })
                setTimeout(() => setSaveMessage(null), 3000)

                // Reset pending deletions and re-hydrate UI to grab new Database IDs
                if (isPyme) setDeletedPymeIds([])
                else setDeletedPlusIds([])

                // Clear unsaved rows for this profile since ALL rows were just bulk saved
                setUnsavedRows(prev => prev.filter(ur => ur.profile !== profile))

                fetchImportes()
            } else {
                alert("Error al guardar las tablas.")
            }
        } catch (e) {
            console.error(e)
            alert("Error de red guardando tablas.")
        }
    }

    const [savingRowPulse, setSavingRowPulse] = useState<{ profile: 'Pyme' | 'Captador', index: number } | null>(null)

    const handleSaveSingleRow = async (profile: 'Pyme' | 'Captador', rowIndex: number) => {
        if (!canModify) return alert("No tienes permisos de edición o el periodo es histórico.")
        const isPyme = profile === 'Pyme'
        const rowData = isPyme ? importesPyme[rowIndex] : importesPlus[rowIndex]
        const endpoint = (isPyme ? '/api/importes-pyme' : '/api/importes-plus') + `?periodKey=${activePeriodKey}`

        const sanitizedData = (!rowData.id || String(rowData.id).startsWith('temp_')) ? (() => { const { id, ...rest } = rowData; return rest; })() : rowData

        try {
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operations: [sanitizedData], deletions: [] })
            })
            if (res.ok) {
                // Trigger green pulse on the Save Button
                setSavingRowPulse({ profile, index: rowIndex })
                setTimeout(() => setSavingRowPulse(null), 1500)

                // Remove orange indicator
                setUnsavedRows(prev => prev.filter(ur => !(ur.profile === profile && ur.index === rowIndex)))

                fetchImportes() // Pull new IDs if it was a create
            } else {
                alert("Error guardando fila individual.")
            }
        } catch (e) {
            console.error("Single row save failed", e)
        }
    }

    const formatEuro = (val: number) => val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
    const formatDecimal = (val: number) => val.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

    // --- Componentes Render ---

    const renderDashboardBlock = (profile: 'Pyme' | 'Captador', calcData: any) => {
        const isPyme = profile === 'Pyme'
        const title = isPyme ? 'VENTAS vs IMPORTES PLUS' : 'VENTAS vs IMPORTES BÁSICO'
        const totalLabel = isPyme ? 'TOTAL PLUS' : 'TOTAL BÁSICO'
        const headColor = isPyme ? '#C1D82F' : '#00ADEF' // Lime for Pyme(BÁSICO), Blue for Captador(PLUS)
        const rowAltColor = isPyme ? 'rgba(193, 216, 47, 0.05)' : 'rgba(0, 173, 239, 0.05)'

        return (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24, backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <h2 style={{ margin: 0, color: '#111827', fontSize: 16, fontWeight: 600 }}>{title}</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setShowPasteModal({ profile, rowIndex: 0 })} style={{ height: '30px', padding: '0 12px', backgroundColor: 'var(--mercedes-cyan)', color: '#ffffff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, transition: 'all 0.2s ease', cursor: 'pointer' }}><ClipboardList size={14} /> IMPORTAR EXCEL</button>
                        <button title="Vacía toda la tabla de configuración (se pedirá confirmación antes de borrar nada)" onClick={() => handleClearTable(profile)} style={{ height: '30px', padding: '0 12px', backgroundColor: '#ffffff', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, transition: 'all 0.2s ease', cursor: 'pointer' }}>
                            <Trash2 size={14} /> Limpiar Todo
                        </button>
                        <button onClick={() => saveImportes(profile)} style={{ height: '30px', padding: '0 12px', backgroundColor: 'var(--mercedes-cyan)', color: '#ffffff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, transition: 'all 0.2s ease', cursor: 'pointer' }}><Save size={14} /> Guardar Modificaciones</button>
                        {saveMessage?.profile === profile && (
                            <span style={{ color: '#059669', fontSize: 12, fontWeight: 800, background: '#d1fae5', padding: '8px 12px', borderRadius: 8 }}>
                                ✓ {saveMessage.msg}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="tabla-liquidacion-compacta" style={{ minWidth: 920, width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ width: '47px', minWidth: '47px', maxWidth: '47px', padding: 0, overflow: 'hidden' }}>GRUPO</th>
                                <th style={{ width: '100%' }}>BLOQUES DE COBRO {profile.toUpperCase() === 'PYME' ? 'PLUS' : 'BÁSICO'}</th>
                                <th>OBJETIVO<br />UDS / €</th>
                                <th>TOTAL<br />OBJETIVOS</th>
                                <th style={{ width: '70px', minWidth: '70px', maxWidth: '70px', textAlign: 'center' }}>{'< 50%'}</th>
                                <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>{'50-80%'}</th>
                                <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>{'80-100%'}</th>
                                <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>{'> 100%'}</th>
                                <th>VENTAS<br />PEND.</th>
                                <th>VENTAS</th>
                                <th>% CUMP.</th>
                                <th>IMPORTE</th>
                                <th>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calcData.rows.length === 0 && !isHistoric && (
                                <tr>
                                    <td colSpan={12} style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255,255,255,0)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                            <p style={{ margin: 0, color: '#666', fontSize: 13 }}>No hay configuración económica definida para este periodo.</p>
                                            <button onClick={() => cloneImportes(profile)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '8px 16px' }}>
                                                <ClipboardList size={16} /> Clonar Base de Cálculos
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {calcData.rows.map((r: any, i: number) => {
                                const isAct50 = r.pje < 50
                                const isAct80 = r.pje >= 50 && r.pje < 80
                                const isAct100 = r.pje >= 80 && r.pje <= 100
                                const isAct120 = r.pje > 100
                                const isConfiguring = configRow?.profile === profile && configRow?.rowIndex === i
                                const isDecimalGroup = r.isPercentage === true

                                const prevRow = i > 0 ? calcData.rows[i - 1] : null
                                const nextRow = calcData.rows[i + 1]

                                const hasGroup = r.grupo && String(r.grupo).trim() !== ''
                                const isGroupStart = !hasGroup || !prevRow || String(prevRow.grupo).trim().toUpperCase() !== String(r.grupo).trim().toUpperCase()
                                const isBoundary = r.grupo && String(r.grupo).trim() !== '' && (!nextRow || String(nextRow.grupo).trim().toUpperCase() !== String(r.grupo).trim().toUpperCase())

                                let rowSpanCount = 1
                                if (isGroupStart && hasGroup) {
                                    const groupMatch = String(r.grupo).trim().toUpperCase()
                                    let j = i + 1;
                                    while (j < calcData.rows.length && String(calcData.rows[j].grupo || '').trim().toUpperCase() === groupMatch) {
                                        rowSpanCount++;
                                        j++;
                                    }
                                }

                                let subVentas = 0
                                let subImporte = 0
                                if (isBoundary) {
                                    const groupMatch = String(r.grupo).trim().toUpperCase()
                                    const groupRows = calcData.rows.filter((x: any) => String(x.grupo || '').trim().toUpperCase() === groupMatch)
                                    subVentas = groupRows.reduce((acc: number, x: any) => acc + (x.quantity || 0), 0)
                                    subImporte = groupRows.reduce((acc: number, x: any) => acc + (x.importe || 0), 0)
                                }

                                const flashBg = isPyme ? 'rgba(193, 216, 47, 0.4)' : 'rgba(0, 173, 239, 0.4)'
                                const isFlashing = flashRow?.profile === profile && flashRow?.index === i
                                const rowBg = isFlashing ? flashBg : (i % 2 === 0 ? rowAltColor : 'transparent')

                                const rowIsUnsaved = unsavedRows.some(ur => ur.profile === profile && ur.index === i)
                                const isSavingPulse = savingRowPulse?.profile === profile && savingRowPulse?.index === i

                                return (
                                    <React.Fragment key={i}>
                                        <tr style={{
                                            borderBottom: isBoundary ? 'none' : '1px solid var(--border-color)',
                                            borderTop: isGroupStart && r.grupo ? `2px solid ${headColor}` : 'none',
                                            backgroundColor: rowBg,
                                            transition: 'background-color 1s ease',
                                            borderLeft: rowIsUnsaved ? '4px solid #FF9500' : 'none',
                                            height: '23px !important',
                                            maxHeight: '23px !important'
                                        }}>
                                            <td style={{ width: '47px', minWidth: '47px', maxWidth: '47px', padding: '0 2px !important', fontWeight: 600, height: '23px !important', maxHeight: '23px !important', borderRight: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important', overflow: 'hidden' }}>
                                                <input
                                                    type="text"
                                                    onFocus={(e) => { e.target.select() }}
                                                    className="form-input input-grupo"
                                                    style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', fontWeight: 800, background: 'transparent', border: '1px solid transparent', outline: 'none', padding: 0, textTransform: 'uppercase', color: headColor }}
                                                    value={r.grupo || ''}
                                                    onChange={e => handleImporteChange(profile, i, 'grupo', e.target.value)}
                                                    onBlur={() => handleGroupSort(profile, i)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.currentTarget.blur()
                                                        }
                                                    }}
                                                    placeholder="Grupo"
                                                />
                                            </td>
                                            <td style={{ padding: '0 2px !important', fontWeight: 600, height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', height: '17px', width: '100%' }}>
                                                    <button
                                                        title="Importar Excel desde esta Fila"
                                                        onClick={() => setShowPasteModal({ profile, rowIndex: i })}
                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5, padding: '0 4px 0 12px', height: '100%' }}
                                                    >
                                                        <ClipboardList size={14} />
                                                    </button>
                                                    <button
                                                        title="Configurar Mapeo de Operaciones"
                                                        onClick={() => setConfigRow(isConfiguring ? null : { profile, rowIndex: i })}
                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: isConfiguring ? 1 : 0.4, padding: '0 4px 0 2px', height: '100%', color: isConfiguring ? 'var(--brand-primary)' : 'inherit' }}
                                                    >
                                                        <Settings size={12} />
                                                    </button>
                                                    {isConfiguring ? (
                                                        <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                                                            <input
                                                                type="text"
                                                                placeholder="Ej: Alta FD Total, Alta FD Flex..."
                                                                onFocus={(e) => { e.target.select() }}
                                                                className="form-input"
                                                                style={{ flex: 1, height: '17px', minHeight: '17px', maxHeight: '17px', fontSize: 7, fontWeight: 400, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--brand-primary)', outline: 'none', padding: '0 4px', color: 'var(--brand-primary)' }}
                                                                value={r.operacionesAsignadas || ''}
                                                                onChange={e => handleImporteChange(profile, i, 'operacionesAsignadas', e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') setConfigRow(null) }}
                                                                autoFocus
                                                            />
                                                            <button
                                                                title={r.isPercentage ? "Cálculo por % (Click para cambiar a €)" : "Cálculo por € (Click para cambiar a %)"}
                                                                onClick={() => handleImporteChange(profile, i, 'isPercentage', !r.isPercentage)}
                                                                style={{ padding: '0 6px', background: r.isPercentage ? 'var(--mercedes-cyan)' : 'transparent', color: r.isPercentage ? '#000' : 'var(--brand-primary)', border: '1px solid var(--brand-primary)', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 800, minWidth: 28 }}
                                                            >
                                                                {r.isPercentage ? '%' : '€'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            onFocus={(e) => { e.target.select() }}
                                                            className="form-input"
                                                            style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', fontSize: 7, fontWeight: 600, background: 'transparent', border: '1px solid transparent', outline: 'none', padding: 0 }}
                                                            value={r.concepto || ''}
                                                            onChange={e => handleImporteChange(profile, i, 'concepto', e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            {(isGroupStart || !hasGroup) && (
                                                <td rowSpan={hasGroup ? rowSpanCount : 1} style={{ padding: '0 !important', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid var(--border-color)', backgroundColor: 'transparent', height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                    <div style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--mercedes-cyan)', backgroundColor: 'transparent' }}>
                                                        {r.autoTarget === 0 ? '' : r.autoTarget}
                                                    </div>
                                                </td>
                                            )}
                                            {(isGroupStart || !hasGroup) && (
                                                <td rowSpan={hasGroup ? rowSpanCount : 1} style={{ padding: '0 !important', textAlign: 'center', fontWeight: 'bold', borderLeft: '1px solid var(--border-color)', backgroundColor: hasGroup ? 'var(--card-hover)' : 'transparent', height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                    <div style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: headColor }}>
                                                        {r.target === 0 ? '' : r.target}
                                                    </div>
                                                </td>
                                            )}

                                            <td style={{ width: '70px', minWidth: '70px', maxWidth: '70px', padding: '0 !important', textAlign: 'center', borderLeft: '1px solid var(--border-color)', height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                <input
                                                    type={isDecimalGroup ? "number" : "text"}
                                                    step={isDecimalGroup ? "0.01" : undefined}
                                                    onFocus={(e) => { e.target.select() }}
                                                    className="form-input"
                                                    style={{ width: '100%', height: '100%', minHeight: 18, textAlign: 'center', fontSize: isDecimalGroup ? '0.50rem' : 7, padding: isDecimalGroup ? '0 1px' : undefined, fontWeight: 400, color: isDecimalGroup ? '#000000' : (isAct50 ? 'var(--light-text)' : 'var(--medium-gray)'), background: isAct50 ? 'var(--card-hover)' : 'transparent', border: 'none', outline: 'none' }}
                                                    value={r.comisionNacionalMenos50 === null ? '' : r.comisionNacionalMenos50}
                                                    onChange={e => handleImporteChange(profile, i, 'comisionNacionalMenos50', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: '0 !important', textAlign: 'center', height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                <input
                                                    type={isDecimalGroup ? "number" : "text"}
                                                    step={isDecimalGroup ? "0.01" : undefined}
                                                    onFocus={(e) => { e.target.select() }}
                                                    className="form-input"
                                                    style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', textAlign: 'center', fontSize: isDecimalGroup ? '0.50rem' : 7, padding: isDecimalGroup ? '0 1px' : '0', fontWeight: isAct80 ? 800 : 400, color: isDecimalGroup ? '#000000' : (isAct80 ? 'var(--light-text)' : 'var(--medium-gray)'), background: isAct80 ? 'var(--card-hover)' : 'transparent', border: 'none', outline: 'none' }}
                                                    value={r.comisionNacionalEntre50Y80 === null ? '' : r.comisionNacionalEntre50Y80}
                                                    onChange={e => handleImporteChange(profile, i, 'comisionNacionalEntre50Y80', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: '0 !important', textAlign: 'center', height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                <input
                                                    type={isDecimalGroup ? "number" : "text"}
                                                    step={isDecimalGroup ? "0.01" : undefined}
                                                    onFocus={(e) => { e.target.select() }}
                                                    className="form-input"
                                                    style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', textAlign: 'center', fontSize: isDecimalGroup ? '0.50rem' : 7, padding: isDecimalGroup ? '0 1px' : '0', fontWeight: isAct100 ? 800 : 400, color: isDecimalGroup ? '#000000' : (isAct100 ? 'var(--light-text)' : 'var(--medium-gray)'), background: isAct100 ? 'var(--card-hover)' : 'transparent', border: 'none', outline: 'none' }}
                                                    value={r.comisionNacionalEntre80Y100 === null ? '' : r.comisionNacionalEntre80Y100}
                                                    onChange={e => handleImporteChange(profile, i, 'comisionNacionalEntre80Y100', e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: '0 !important', textAlign: 'center', height: '23px !important', maxHeight: '23px !important', verticalAlign: 'middle !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                <input
                                                    type={isDecimalGroup ? "number" : "text"}
                                                    step={isDecimalGroup ? "0.01" : undefined}
                                                    onFocus={(e) => { e.target.select() }}
                                                    className="form-input"
                                                    style={{ width: '100%', height: '17px', minHeight: '17px', maxHeight: '17px', textAlign: 'center', fontSize: isDecimalGroup ? '0.50rem' : 7, padding: isDecimalGroup ? '0 1px' : '0', fontWeight: isAct120 ? 800 : 400, color: isDecimalGroup ? '#000000' : (isAct120 ? 'var(--light-text)' : 'var(--medium-gray)'), background: isAct120 ? 'var(--card-hover)' : 'transparent', border: 'none', outline: 'none' }}
                                                    value={r.comisionNacionalMas100 === null ? '' : r.comisionNacionalMas100}
                                                    onChange={e => handleImporteChange(profile, i, 'comisionNacionalMas100', e.target.value)}
                                                />
                                            </td>

                                            <td style={{ padding: '0 8px !important', textAlign: 'center', borderLeft: '1px solid var(--border-color)', fontWeight: 600, color: '#FF9500', backgroundColor: 'rgba(255,149,0,0.05)', verticalAlign: 'middle !important', height: '23px !important', maxHeight: '23px !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                {r.isMonetary ? formatEuro(r.quantityPending) : r.quantityPending}
                                            </td>
                                            <td style={{ padding: '0 8px !important', textAlign: 'center', borderLeft: '1px solid var(--border-color)', fontWeight: 800, color: headColor, backgroundColor: 'rgba(255,255,255,0.03)', verticalAlign: 'middle !important', height: '23px !important', maxHeight: '23px !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                {r.isMonetary ? formatEuro(r.quantity) : r.quantity}
                                            </td>
                                            {(isGroupStart || !hasGroup) && (
                                                <td rowSpan={hasGroup ? rowSpanCount : 1} style={{ padding: '0 8px !important', textAlign: 'center', fontWeight: 600, borderLeft: '1px solid var(--border-color)', backgroundColor: hasGroup ? 'var(--card-hover)' : 'transparent', verticalAlign: 'middle !important', height: '23px !important', maxHeight: '23px !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                    {r.pje.toFixed(1)}%
                                                </td>
                                            )}
                                            <td className="col-importe" style={{ padding: '0 8px !important', textAlign: 'right', fontWeight: 800, color: '#0000FF', verticalAlign: 'middle !important', height: '23px !important', maxHeight: '23px !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                {formatEuro(r.importe)}
                                            </td>
                                            <td style={{ padding: '0 8px !important', textAlign: 'center', width: 90, verticalAlign: 'middle !important', height: '23px !important', maxHeight: '23px !important', lineHeight: '18px !important', paddingTop: '4px !important', paddingBottom: '4px !important' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', height: '20px' }}>
                                                    {rowIsUnsaved && (
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FF9500', marginRight: 2 }} title="Cambios sin guardar" />
                                                    )}
                                                    <button
                                                        onClick={() => handleSaveSingleRow(profile, i)}
                                                        className="btn"
                                                        style={{
                                                            padding: 0,
                                                            backgroundColor: isSavingPulse ? '#34C759' : 'transparent',
                                                            color: isSavingPulse ? 'var(--bg-card)' : 'var(--mercedes-cyan)',
                                                            border: `none`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', opacity: rowIsUnsaved || isSavingPulse ? 1 : 0.4,
                                                            height: 14, width: 14
                                                        }}
                                                        title="Guardar Fila"
                                                    >
                                                        <Save size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRow(profile, i)}
                                                        className="btn"
                                                        style={{ padding: 0, backgroundColor: 'transparent', color: '#FF453A', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8, height: 14, width: 14 }}
                                                        title="Eliminar Fila"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isBoundary && (
                                            <tr className="separador-1px" style={{ backgroundColor: headColor, height: '1px !important', minHeight: '1px !important', maxHeight: '1px !important', border: 'none' }}>
                                                <td colSpan={12} style={{ padding: '0 !important', height: '1px !important', minHeight: '1px !important', maxHeight: '1px !important', border: 'none', lineHeight: '1px !important' }}></td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    const BackButton = () => null;

    const renderAuditoria = () => {
        // ── helpers ──────────────────────────────────────────────────────
        const PLUS_CODES = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7']
        const notCancelled = (s: any) => s.anulado !== 'Si' && s.pendiente !== 'Anulado'
        const parseVal = (v: any) => parseFloat(String(v || '0').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0
        const isPlusSale   = (s: any) => PLUS_CODES.some(c => String(s.codigo || '').toLowerCase().includes(c))
        const isBasicoSale = (s: any) => String(s.codigo || '').toLowerCase().includes('basico xcu') || String(s.codigo || '').toLowerCase().includes('básico xcu')
        const fmtEur = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

        // ── formula data ─────────────────────────────────────────────────
        const activeObjPlusTarget   = objetivos.Pyme?.[activeMonthStr] || {}
        const activeObjBasicoTarget = objetivos.Captador?.[activeMonthStr] || {}
        const pymeD = renderDashboardData('Pyme',     importesPyme, activeObjPlusTarget,   filteredSalesGlobal, objGrupos, activePeriodObj)
        const plusD = renderDashboardData('Captador', importesPlus, activeObjBasicoTarget,  filteredSalesGlobal, objGrupos, activePeriodObj)

        const formulaPlus   = pymeD.totalImporte
        const formulaBasico = plusD.totalImporte

        // ── extras ───────────────────────────────────────────────────────
        const esAdmin = canEdit(user, 'MODULE_ADMIN')
        const extrasPlus   = extraAssignments.filter((ea: any) => { if (ea.status === 'CANCELLED') return false; const rc = resolveExtraCode(ea).toLowerCase(); return rc.includes('plus') || rc === 'ambos' })
        const extrasBasico = extraAssignments.filter((ea: any) => { if (ea.status === 'CANCELLED') return false; const rc = resolveExtraCode(ea).toLowerCase(); return rc.includes('basico') || rc.includes('básico') || rc === 'ambos' })
        const extrasPlusTotal   = extrasPlus.reduce((a: number, e: any)   => a + (esAdmin ? (e.telecomRewardAmount || 0) : (e.sellerRewardAmount || 0)), 0)
        const extrasBasicoTotal = extrasBasico.reduce((a: number, e: any) => a + (esAdmin ? (e.telecomRewardAmount || 0) : (e.sellerRewardAmount || 0)), 0)
        const formulaTotal = formulaPlus + formulaBasico + extrasPlusTotal + extrasBasicoTotal
        const telecomTotal = filteredSalesGlobal.filter(notCancelled).reduce((s: number, v: any) => s + parseVal(v.importe || v.cuota), 0)

        // ── formula amounts grouped by grupo (from dashboard rows) ───────
        const fmtPlus: Record<string, number>   = {}
        const fmtBasico: Record<string, number> = {}
        pymeD.rows.forEach((r: any) => {
            if (r.isHeader || r.isCategoryTotal || r.isBoundary) return
            const g = String(r.grupo || '').trim().toUpperCase(); if (!g) return
            fmtPlus[g] = (fmtPlus[g] || 0) + (r.importe || 0)
        })
        plusD.rows.forEach((r: any) => {
            if (r.isHeader || r.isCategoryTotal || r.isBoundary) return
            const g = String(r.grupo || '').trim().toUpperCase(); if (!g) return
            fmtBasico[g] = (fmtBasico[g] || 0) + (r.importe || 0)
        })

        // ── OGC raw sales — same filterByTab logic as operaciones-grupo-cliente ──
        const ogcFilter = (sale: any, tabId: string): boolean => {
            if (tabId === 'extras') return false
            const g = (sale.grupo || '').toUpperCase()
            const d = (sale.detalle || '').toLowerCase().trim()
            switch (tabId) {
                case 'tma':   return d === 'tma'
                case 'micro': return d === 'micro'
                case 'ti':    return d === 'ti'
                case 'mpa':   return d === 'mpa' || g === 'MPA' || g === 'ALARMAS' || (sale.producto || '').toLowerCase().includes('alarma')
                case 'fd':    { if (g === 'REN' && (sale.producto || '').toLowerCase().includes('dispositivo')) return false; return ['FD','FN','PF','REN'].includes(g) }
                case 'porta': return g === 'PORTA'
                case 'alta':  return g === 'ALTA'
                case 'baf':   return ['BAF','MBAF'].includes(g)
                default:      return false
            }
        }

        // Fixed groups matching OGC tabs — same order
        const TAB_GROUPS = [
            { id: 'fd',    label: '🔌 FD',          emoji: '🔌' },
            { id: 'baf',   label: '📡 BAF / 5G',    emoji: '📡' },
            { id: 'alta',  label: '📶 Alta Móvil',  emoji: '📶' },
            { id: 'porta', label: '🔄 Portas Móvil',emoji: '🔄' },
            { id: 'tma',   label: '📱 TMA',          emoji: '📱' },
            { id: 'ti',    label: '🖥️ Ti',           emoji: '🖥️' },
            { id: 'micro', label: '💻 Micro',        emoji: '💻' },
            { id: 'mpa',   label: '📲 MPA',          emoji: '📲' },
        ]

        // Map tabId → grupo key used in formula rows
        const TAB_TO_FORMULA_KEY: Record<string, string[]> = {
            fd:    ['FD','FN','PF','REN'],
            baf:   ['BAF','MBAF'],
            alta:  ['ALTA'],
            porta: ['PORTA'],
            tma:   ['TMA'],
            ti:    ['TI'],
            micro: ['MIC','MICRO'],
            mpa:   ['MPA'],
        }

        const activeSales = filteredSalesGlobal.filter(notCancelled)

        // Build per-tab OGC totals using calculateDynamicCommission — same logic as OGC page
        const ogcPlus:   Record<string, number> = {}
        const ogcBasico: Record<string, number> = {}
        TAB_GROUPS.forEach(({ id }) => {
            const tabSales = activeSales.filter((s: any) => ogcFilter(s, id))
            ogcPlus[id]   = tabSales.reduce((acc: number, s: any) => acc + calculateDynamicCommission(s, pymeD.rows),  0)
            ogcBasico[id] = tabSales.reduce((acc: number, s: any) => acc + calculateDynamicCommission(s, plusD.rows),  0)
        })


        // Build per-tab formula totals by summing all matching grupo keys
        const fmlPlus:   Record<string, number> = {}
        const fmlBasico: Record<string, number> = {}
        TAB_GROUPS.forEach(({ id }) => {
            const keys = TAB_TO_FORMULA_KEY[id] || []
            fmlPlus[id]   = keys.reduce((acc, k) => acc + (fmtPlus[k]   || 0), 0)
            fmlBasico[id] = keys.reduce((acc, k) => acc + (fmtBasico[k] || 0), 0)
        })

        const diff = (a: number, b: number) => {
            const d = a - b
            const color = Math.abs(d) < 0.05 ? '#34C759' : d > 0 ? '#F59E0B' : '#EF4444'
            return <span style={{ color, fontWeight: 700 }}>{Math.abs(d) < 0.05 ? '✓' : (d > 0 ? '+' : '') + fmtEur(d)}</span>
        }

        const thStyle = (color?: string): React.CSSProperties => ({
            padding: '10px 12px', textAlign: 'right' as const, color: color || 'var(--medium-gray)',
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5,
            borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' as const,
        })
        const tdStyle = (right = true): React.CSSProperties => ({
            padding: '9px 12px', textAlign: right ? 'right' as const : 'left' as const, fontSize: 13,
        })

        return (
            <div style={{ marginTop: 8 }}>
                {/* ── 2 KPIs ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'VENTAS vs IMPORTES PLUS',   value: formulaPlus,   color: '#34C759',              note: 'Cálculo fórmula · canal Plus' },
                        { label: 'VENTAS vs IMPORTES BÁSICO', value: formulaBasico, color: 'var(--mercedes-cyan)', note: 'Cálculo fórmula · canal Básico' },
                    ].map((kpi, i) => (
                        <div key={i} className="card" style={{ padding: '18px 20px', borderTop: `3px solid ${kpi.color}` }}>
                            <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{kpi.label}</div>
                            <div style={{ fontSize: 30, fontWeight: 800, color: kpi.color }}>{fmtEur(kpi.value)}</div>
                            <div style={{ fontSize: 11, color: 'var(--medium-gray)', marginTop: 4 }}>{kpi.note}</div>
                        </div>
                    ))}
                </div>

                {/* ── Tabla unificada VENTAS vs IMPORTES PLUS + BÁSICO ── */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--light-text)' }}>VENTAS vs IMPORTES PLUS y BÁSICO</span>
                        <span style={{ fontSize: 12, color: 'var(--medium-gray)' }}>Fórmula por canal · Operaciones por Grupo Cliente</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'var(--active-bg)' }}>
                                    <th style={{ ...thStyle(), textAlign: 'left' as const }}>Bloque</th>
                                    <th style={thStyle('#34C759')}>Importe Plus</th>
                                    <th style={thStyle('var(--mercedes-cyan)')}>Importe Básico</th>
                                    <th style={thStyle()}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {TAB_GROUPS.map(({ id, label }, i) => {
                                    const p = fmlPlus[id] || 0
                                    const b = fmlBasico[id] || 0
                                    const total = p + b
                                    return (
                                        <tr key={id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--active-bg)' }}>
                                            <td style={{ ...tdStyle(false), fontWeight: 600, color: 'var(--light-text)' }}>{label}</td>
                                            <td style={{ ...tdStyle(), color: p > 0 ? '#34C759' : 'var(--medium-gray)', fontWeight: 600 }}>{p > 0 ? fmtEur(p) : '—'}</td>
                                            <td style={{ ...tdStyle(), color: b > 0 ? 'var(--mercedes-cyan)' : 'var(--medium-gray)', fontWeight: 600 }}>{b > 0 ? fmtEur(b) : '—'}</td>
                                            <td style={{ ...tdStyle(), fontWeight: 700, color: total > 0 ? 'var(--light-text)' : 'var(--medium-gray)' }}>{total > 0 ? fmtEur(total) : '0,00 €'}</td>
                                        </tr>
                                    )
                                })}
                                <tr style={{ borderBottom: '1px solid var(--border-color)', borderTop: '2px solid rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.04)' }}>
                                    <td style={{ ...tdStyle(false), fontWeight: 600, color: '#10b981' }}>⚡ Incentivos Extra</td>
                                    <td style={{ ...tdStyle(), color: extrasPlusTotal > 0 ? '#10b981' : 'var(--medium-gray)', fontWeight: 600 }}>{extrasPlusTotal > 0 ? fmtEur(extrasPlusTotal) : '—'}</td>
                                    <td style={{ ...tdStyle(), color: extrasBasicoTotal > 0 ? '#10b981' : 'var(--medium-gray)', fontWeight: 600 }}>{extrasBasicoTotal > 0 ? fmtEur(extrasBasicoTotal) : '—'}</td>
                                    <td style={{ ...tdStyle(), fontWeight: 700, color: (extrasPlusTotal + extrasBasicoTotal) > 0 ? '#10b981' : 'var(--medium-gray)' }}>{(extrasPlusTotal + extrasBasicoTotal) > 0 ? fmtEur(extrasPlusTotal + extrasBasicoTotal) : '—'}</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: 'var(--active-bg)', fontWeight: 700 }}>
                                    <td style={{ ...tdStyle(false), color: 'var(--light-text)' }}>TOTAL</td>
                                    <td style={{ ...tdStyle(), color: '#34C759' }}>{fmtEur(formulaPlus + extrasPlusTotal)}</td>
                                    <td style={{ ...tdStyle(), color: 'var(--mercedes-cyan)' }}>{fmtEur(formulaBasico + extrasBasicoTotal)}</td>
                                    <td style={{ ...tdStyle(), color: 'var(--light-text)' }}>{fmtEur(formulaTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        )
    }



    const renderMenu = () => {
        const menuCardsRaw = [
            {
                title: 'Operaciones Telefónica',
                description: 'Listado detallado de registro de ventas, cuotas, estados y comisiones finales.',
                icon: BarChart2,
                view: 'operaciones' as ViewType
            },
            {
                title: 'Comisiones Tiendas y FFVV v3',
                description: 'Tabla integrada para gestionar dietas, km, incentivos y cruce de datos O2 (Excel).',
                icon: ClipboardList,
                view: 'comisiones_v3' as ViewType
            },
            {
                title: 'Operaciones por Grupo Cliente',
                description: 'Análisis consolidado de ventas agrupadas por NIF/CIF y producto — secciones Plus y Básico.',
                icon: Users,
                href: '/operaciones-grupo-cliente'
            },

            {
                title: 'Rentabilidad por Tiendas',
                description: 'Visión agrupada de personal, ventas y rentabilidad segmentada por tienda.',
                icon: Briefcase,
                href: '/liquidacion/rentabilidad-tiendas'
            },
            
            {
                title: 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree',
                description: 'Módulo en construcción. Próximamente incluirá la estructura consolidada.',
                icon: TrendingUp,
                href: '#'
            }
        ];

        const renderCard = (c: any) => {
            const Icon = c.icon;
            return (
                <div 
                    key={c.title} 
                    className="premium-card"
                    onClick={() => c.href ? router.push(c.href) : setCurrentView(c.view)}
                    style={{ 
                        position: 'relative', 
                        cursor: 'pointer', 
                        borderLeft: c.title === 'Agenda de Llamadas Cristina' ? '5px solid #5CB615' : 
                                    c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' || c.title === 'Comisiones Tiendas y FFVV v3' ? '5px solid #b8860b' :
                                    c.title === 'Rentabilidad por Tiendas' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree' ? '5px solid #0ea5e9' : 
                                    '1px solid transparent' 
                    }}
                >
                    <div className="card-icon-wrapper" style={
                        c.title === 'Agenda de Llamadas Cristina' ? { backgroundColor: 'rgba(92, 182, 21, 0.1)', color: '#5CB615' } : 
                        c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' || c.title === 'Comisiones Tiendas y FFVV v3' ? { backgroundColor: 'rgba(184, 134, 11, 0.1)', color: '#b8860b' } :
                        c.title === 'Rentabilidad por Tiendas' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree' ? { backgroundColor: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' } :
                        { backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }
                    }>
                        <Icon size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="card-title">{c.title}</h3>
                    <p className="card-desc">{c.description}</p>
                </div>
            );
        };

        const brownCards = menuCardsRaw.filter(c => c.title === 'Operaciones Telefónica' || c.title === 'Operaciones por Grupo Cliente' || c.title === 'Comisiones Tiendas y FFVV v3');
        const blueCards = menuCardsRaw.filter(c => c.title === 'Rentabilidad por Tiendas' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree');
        const greenCards = menuCardsRaw.filter(c => c.title === 'Agenda de Llamadas Cristina');

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {brownCards.map(renderCard)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {blueCards.map(renderCard)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {greenCards.map(renderCard)}
                </div>
            </div>
        )
    }

    const resolveExtraCode = (ea: any) => {
        let code = ea.rule?.channelType || 'EXTRA';
        if (code === 'AMBOS' && ea.sourceSaleIds) {
            try {
                const ids = JSON.parse(ea.sourceSaleIds);
                if (ids && ids.length > 0) {
                    const firstSale = filteredSalesGlobal.find((s: any) => s.id === ids[0]);
                    if (firstSale && firstSale.codigo) {
                        code = firstSale.codigo; // Mantener versión original
                    }
                }
            } catch(e) {}
        }
        return code;
    }

    const renderCaptadorView = () => {
        const captadorMonthObj = objetivos.Captador?.[currentObjMonth] || {}
        const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, filteredSalesGlobal, objGrupos, activePeriodObj)
        
        const myExtras = extraAssignments.filter(ea => {
            if (ea.status === 'CANCELLED') return false;
            const resolvedCode = resolveExtraCode(ea).toLowerCase();
            return resolvedCode.includes('basico') || resolvedCode.includes('básico') || resolvedCode === 'ambos'; // Fallback a ambos
        })

        const esAdmin = canEdit(user, 'MODULE_ADMIN')
        const myExtrasTotal = myExtras.reduce((acc, curr) => acc + (esAdmin ? (curr.telecomRewardAmount || 0) : (curr.sellerRewardAmount || 0)), 0)

        return (
            <>
                <BackButton />
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                    <div className="card" style={{ flex: 1, padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16 }}>
                        <p style={{ color: '#6b7280', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 600 }}>Total Acumulado BÁSICO</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontSize: 24, margin: '4px 0 0 0', color: 'var(--mercedes-cyan)', fontWeight: 'bold' }}>{formatEuro(captadorData.totalImporte + myExtrasTotal)}</h2>
                            {myExtrasTotal > 0 && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>(Base: {formatEuro(captadorData.totalImporte)} + Extras: {formatEuro(myExtrasTotal)})</span>}
                        </div>
                    </div>
                    <div className="card" style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.2)', borderRadius: 16 }}>
                        <p style={{ color: '#059669', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 800 }}>Total Proyect. con Pendien.</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontSize: 24, margin: '4px 0 0 0', color: '#059669', fontWeight: 'bold' }}>{formatEuro(captadorData.totalImporteProyectado + myExtrasTotal)}</h2>
                            {myExtrasTotal > 0 && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>(Base: {formatEuro(captadorData.totalImporteProyectado)} + Extras: {formatEuro(myExtrasTotal)})</span>}
                        </div>
                    </div>
                </div>

                {renderDashboardBlock('Captador', captadorData)}

                {myExtras.length > 0 && (
                    <div className="card" style={{ padding: '16px 24px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 16, marginTop: 24, marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, color: '#059669', margin: '0 0 16px 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap size={18} /> Incentivos Extra (Motor Automático)
                        </h3>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'left', color: '#059669' }}>
                                    <th style={{ padding: '8px 0' }}>Fecha Venta</th>
                                    <th style={{ padding: '8px 0' }}>Operativa</th>
                                    <th style={{ padding: '8px 0' }}>Comercial</th>
                                    <th style={{ padding: '8px 0' }}>Cliente Destino</th>
                                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Bonus {esAdmin ? 'Movistar' : 'Comercial'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myExtras.map((ex, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)', color: '#065f46' }}>
                                        <td style={{ padding: '8px 0' }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{ex.rule?.name || 'Extra Manual'}</td>
                                        <td style={{ padding: '8px 0' }}>{ex.seller}</td>
                                        <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{ex.customerName}</td>
                                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#059669' }}>+{formatEuro(esAdmin ? ex.telecomRewardAmount : ex.sellerRewardAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
        )
    }

    const renderPymeView = () => {
        const pymeMonthObj = objetivos.Pyme?.[currentObjMonth] || {}
        const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, filteredSalesGlobal, objGrupos, activePeriodObj)
        
        const myExtras = extraAssignments.filter(ea => {
            if (ea.status === 'CANCELLED') return false;
            const resolvedCode = resolveExtraCode(ea).toLowerCase();
            return resolvedCode.includes('plus') || resolvedCode === 'ambos';
        })

        const esAdmin = canEdit(user, 'MODULE_ADMIN')
        const myExtrasTotal = myExtras.reduce((acc, curr) => acc + (esAdmin ? (curr.telecomRewardAmount || 0) : (curr.sellerRewardAmount || 0)), 0)

        return (
            <>
                <BackButton />
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                    <div className="card" style={{ flex: 1, padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16 }}>
                        <p style={{ color: '#6b7280', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 600 }}>Total Acumulado PLUS</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontSize: 24, margin: '4px 0 0 0', color: 'var(--mercedes-cyan)', fontWeight: 'bold' }}>{formatEuro(pymeData.totalImporte + myExtrasTotal)}</h2>
                            {myExtrasTotal > 0 && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>(Base: {formatEuro(pymeData.totalImporte)} + Extras: {formatEuro(myExtrasTotal)})</span>}
                        </div>
                    </div>
                    <div className="card" style={{ flex: 1, padding: '16px', backgroundColor: 'rgba(5, 150, 105, 0.05)', border: '1px solid rgba(5, 150, 105, 0.2)', borderRadius: 16 }}>
                        <p style={{ color: '#059669', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: 0, fontWeight: 800 }}>Total Proyect. con Pendien.</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                            <h2 style={{ fontSize: 24, margin: '4px 0 0 0', color: '#059669', fontWeight: 'bold' }}>{formatEuro(pymeData.totalImporteProyectado + myExtrasTotal)}</h2>
                            {myExtrasTotal > 0 && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>(Base: {formatEuro(pymeData.totalImporteProyectado)} + Extras: {formatEuro(myExtrasTotal)})</span>}
                        </div>
                    </div>
                </div>

                {renderDashboardBlock('Pyme', pymeData)}

                {myExtras.length > 0 && (
                    <div className="card" style={{ padding: '16px 24px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 16, marginTop: 24, marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, color: '#059669', margin: '0 0 16px 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap size={18} /> Incentivos Extra (Motor Automático)
                        </h3>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'left', color: '#059669' }}>
                                    <th style={{ padding: '8px 0' }}>Fecha Venta</th>
                                    <th style={{ padding: '8px 0' }}>Operativa</th>
                                    <th style={{ padding: '8px 0' }}>Comercial</th>
                                    <th style={{ padding: '8px 0' }}>Cliente Destino</th>
                                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Bonus {esAdmin ? 'Movistar' : 'Comercial'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myExtras.map((ex, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)', color: '#065f46' }}>
                                        <td style={{ padding: '8px 0' }}>{new Date(ex.createdAt).toLocaleDateString()}</td>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{ex.rule?.name || 'Extra Manual'}</td>
                                        <td style={{ padding: '8px 0' }}>{ex.seller}</td>
                                        <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{ex.customerName}</td>
                                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: '#059669' }}>+{formatEuro(esAdmin ? ex.telecomRewardAmount : ex.sellerRewardAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </>
        )
    }

    const renderOperacionesView = () => {
        return (
            <>
                <BackButton />
                {renderOperacionesTab()}
            </>
        )
    }


    const renderCruceView = () => {
        return (
            <>
                <BackButton />
                <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--light-text)' }}>Cruce de Operaciones Telefónica</h3>
                    <p style={{ color: 'var(--medium-gray)' }}>Esta vista de cruce se encuentra en desarrollo por Antigravedad.</p>
                </div>
            </>
        )
    }

    const renderOperacionesTab = () => {
        // 1. Pre-calculate Dashboard Data for both profiles to get current Tramo Values
        const pymeMonthObj = objetivos.Pyme?.[currentObjMonth] || {}
        const captadorMonthObj = objetivos.Captador?.[currentObjMonth] || {}
        const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, filteredSalesGlobal, objGrupos, activePeriodObj)
        const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, filteredSalesGlobal, objGrupos, activePeriodObj)

        // 2. Helper to get calculated commission for a specific operation
        const getCommission = (sale: any) => {
            const parseSafeFloat = (val: any): number => {
                if (val === null || val === undefined) return 0;
                if (typeof val === 'number') return isNaN(val) ? 0 : val;
                const clean = String(val).replace('€', '').replace(/\s/g, '').replace(',', '.').trim();
                const num = parseFloat(clean);
                return isNaN(num) ? 0 : num;
            };

            // Enforce unified state filter
            if (sale.anulado === 'Si' || sale.pendiente === 'Anulado') return 0;

            const tipoVenta = (String(sale.sheet || '')).trim().toLowerCase();
            const codigo = (String(sale.codigo || '')).trim().toLowerCase();

            const prod = (String(sale.producto || '')).trim().toLowerCase();
            const cat = (String(sale.categoria || '')).trim().toLowerCase();

            const codigoLower = String(sale.codigo || '').trim().toLowerCase();

            const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu');
            
            const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7'];
            const isPlus = plusCodesExact.some(c => codigoLower.includes(c));
            
            // Check if sale date matches the active selectedMonth (which is what dashboard is computing for)
            let saleMonth = ''
            if (sale.fecha) {
               const parts = sale.fecha.split('/')
               if (parts.length === 3) saleMonth = `${parts[2]}${parts[1]}`
               else if (sale.fecha.includes('-')) {
                   const p = sale.fecha.split('-')
                   if (p.length >= 2) saleMonth = `${p[0]}${p[1]}`
               }
            }
            // Helper to pull fallback value if empty
            const getFallbackValue = () => {
                 let val = sale.importe || sale.cuota || 0;
                 const det = (sale.detalle || '').toLowerCase();
                 if (!val && (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro')) {
                     let catalogKey = '';
                     if (det === 'ti') catalogKey = 'Ti';
                     if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
                     if (det === 'micro') catalogKey = 'Micro';
                     
                     const list = catalogs[catalogKey] || [];
                     const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                     if (found) {
                         val = parseSafeFloat(found.anual);
                     }
                 }
                 return parseSafeFloat(val);
            }

            if (!saleMonth) return getFallbackValue();

            // Compare against the selected viewing period (not today's calendar month)
            // This ensures April sales show correct commissions even when viewed on May 1st
            const viewingPeriod = activePeriodObj
                ? `${activePeriodObj.year}${String(activePeriodObj.month).padStart(2, '0')}`
                : getCurrentMonthString();
            if (saleMonth !== viewingPeriod) return getFallbackValue();
            
            const dashboardRows = isPlus ? pymeData.rows : captadorData.rows;

            // Fetch catalog override value for technical products if it exists
            const det = (sale.detalle || '').toLowerCase();
            
            const isTV = det === 'suscripciones tv' || det === 'suscripcion tv';
            // O2, Seguro, miMovistar and new standalone categories store their commission directly in importe/cuota
            if (det === 'o2' || det === 'seguro' || det === 'mimovistar' || det === 'repos' || det === 'varios' || isTV || det === 'prepago' || det === 'resto baf' || det === 'traslado mimovistar') {
                if (det === 'seguro') {
                    const seguroList = catalogs['Seguro'] || [];
                    const foundSeguro = seguroList.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                    if (foundSeguro && foundSeguro.comision) {
                        return parseSafeFloat(foundSeguro.comision);
                    }
                }
                return parseSafeFloat(sale.importe || sale.cuota || 0);
            }
            
            let overrideBaseValue: number | undefined = undefined;
            if (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro') {
                // Ensure we map back to the EXACT object key in catalogs since it stores as 'Ti', 'Rent', 'Micro'
                let catalogKey = '';
                if (det === 'ti') catalogKey = 'Ti';
                if (det === 'tma' || det === 'rent') catalogKey = 'Rent';
                if (det === 'micro') catalogKey = 'Micro';
                
                const list = catalogs[catalogKey] || [];
                const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                
                let found = matchingProducts[0]; // fallback/default to the first one available
                
                // If there are multiple versions of the same product, apply validity window filtering
                if (matchingProducts.length > 1) {
                    const correctlyDated = matchingProducts.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
                    if (correctlyDated) {
                        found = correctlyDated;
                    }
                }

                if (found) {
                    overrideBaseValue = Number(String(found.anual || 0).replace(',','.'));
                    console.log(`[Calc Commission] Match found for ${sale.producto} (Date: ${sale.fecha})! Base Value set to: ${overrideBaseValue}`);
                    
                    // Direct override para Contratos Móvil (Ti), usamos directamente la Comisión del catálogo
                    if (det === 'ti') {
                        return overrideBaseValue; // overrideBaseValue is already parsed from found.anual
                    }
                    
                    // Direct override para RENT (TMA), verificando si la venta lleva seguro con coste
                    if (det === 'tma' || det === 'rent') {
                        const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
                        if (isConCoste) {
                            return Number(String(found.comisionConCoste || 0).replace(',','.'));
                        } else {
                            return Number(String(found.comision || 0).replace(',','.'));
                        }
                    }
                } else {
                    console.log(`[Calc Commission] No match found in catalog for ${sale.producto}`);
                }
            }

            const finalCommission = calculateDynamicCommission(sale, dashboardRows, overrideBaseValue);
            if (det === 'tma' || det === 'micro') {
                 console.log(`[Calc Commission] FINAL PAYOUT for ${sale.producto}: ${finalCommission}€`);
            }
            return finalCommission;
        }

        // Helper: Cuota Total del producto (para Seguros usa seguroImporte, para el resto cuota)
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
                const seguroList = catalogs['Seguro'] || [];
                const foundSeguro = seguroList.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                if (foundSeguro && foundSeguro.anual) {
                    return parse(foundSeguro.anual);
                }
                if (sale.seguroImporte) {
                    const v = parse(sale.seguroImporte);
                    if (v > 0) return v;
                }
                return parse(sale.cuota || sale.importe || 0);
            }
            if (isRent) {
                // Cuota Total = precio del dispositivo = 'anual' del catálogo (fuente fiable).
                // Si no hay match en catálogo, se usa la cuota guardada en la venta.
                const list = catalogs['Rent'] || [];
                const matching = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
                let found = matching[0];
                if (matching.length > 1) {
                    const dated = matching.find((c: any) => isVentaWithinDates(sale.fecha, c.validFrom, c.validTo));
                    if (dated) found = dated;
                }
                if (found && found.anual) {
                    const v = parse(found.anual);
                    if (v > 0) return v;
                }
                return parse(sale.cuota || sale.importe || 0);
            }
            return 0;
        };

        const activeExtras = extraAssignments.filter(ea => ea.status !== 'CANCELLED')

        const exportToExcel = async () => {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Operaciones');

            worksheet.columns = [
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Vendedor', key: 'vendedor', width: 20 },
                { header: 'Cliente (NIF)', key: 'nif', width: 15 },
                { header: 'Teléfono', key: 'telefono', width: 15 },
                { header: 'Tienda', key: 'codigo', width: 15 },
                { header: 'Tipo de Venta', key: 'tipoVenta', width: 20 },
                { header: 'Producto', key: 'producto', width: 30 },
                { header: 'Cuota Total', key: 'cuotaTotal', width: 15 },
                { header: 'Con Coste', key: 'conCoste', width: 10 },
                { header: 'Swap', key: 'swap', width: 8 },
                { header: 'Comisión (€)', key: 'comision', width: 15 },
                { header: 'Varios', key: 'varios', width: 25 },
                { header: 'Estado', key: 'estado', width: 15 }
            ];

            // Header styling
            worksheet.getRow(1).font = { bold: true };

            salesForTable.forEach(sale => {
                const comisionEuros = getCommission(sale);
                const cuotaTotalEuros = getCuotaTotal(sale);
                // Status Mapping identical to table
                let estadoText = (sale.anulado === 'Si' || sale.pendiente === 'Anulado') ? 'NULL' : (sale.pendiente === 'Si' ? 'PED' : 'OK');
                
                worksheet.addRow({
                    fecha: sale.fecha || '-',
                    vendedor: sale.vendedor || '-',
                    nif: sale.nif || '-',
                    telefono: sale.telf || '-',
                    codigo: sale.codigo || '-',
                    tipoVenta: sale.detalle === 'Ti' ? 'Contratos Móvil' : sale.detalle === 'O2' ? 'O2 MovilFree' : (sale.detalle || '-'),
                    producto: sale.producto || 'Sin especificar',
                    cuotaTotal: cuotaTotalEuros > 0 ? Number(cuotaTotalEuros) : null,
                    conCoste: (() => { const d=String(sale.detalle||'').toLowerCase(); if(d!=='rent'&&d!=='tma') return '-'; const v=String(sale.rentConCoste||'').toLowerCase(); return (v==='si'||v==='sí')?'Sí':'No'; })(),
                    swap: sale.isSwap === true ? 'Sí' : 'No',
                    comision: Number(comisionEuros),
                    varios: sale.anotaciones || '-',
                    estado: estadoText
                });
            });

            activeExtras.forEach(ex => {
                worksheet.addRow({
                    fecha: new Date(ex.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                    vendedor: ex.seller || '-',
                    nif: ex.customerNif || '-',
                    telefono: '-',
                    codigo: resolveExtraCode(ex) || 'MANUAL',
                    tipoVenta: 'EXTRA',
                    producto: ex.rule?.name || 'Incentivo Manual',
                    conCoste: '-',
                    swap: '-',
                    comision: Number(ex.telecomRewardAmount || 0),
                    varios: ex.customerName || '-',
                    estado: ex.status === 'PENDING' ? 'PED' : 'AUTO'
                });
            });

            // Format monetary columns correctly for math operations in Excel
            worksheet.getColumn('cuotaTotal').numFmt = '#,##0.00 €';
            worksheet.getColumn('comision').numFmt = '#,##0.00 €';

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Operaciones_Telefonica_${activePeriodObj?.name || activePeriodKey}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
        }

        const esAdmin = canEdit(user, 'MODULE_ADMIN')
        
        const salesForTable = filteredSalesGlobal.filter((s: any) => {
            const p = String(s.producto || '').toLowerCase()
            const c = String(s.categoria || '').toLowerCase()
            const d = String(s.detalle || '').toLowerCase()
            return !p.includes('solar360') && !p.includes('solar 360') && 
                   !c.includes('solar360') && !c.includes('solar 360') && 
                   !d.includes('solar360') && !d.includes('solar 360')
        });

        // ── Buscador: filtra ventas y extras por cualquier campo visible (no afecta al export de Excel) ──
        const opQuery = opSearch.trim().toLowerCase()
        const matchOpSale = (s: any) => !opQuery || [s.fecha, s.vendedor, s.nif, s.nombreCliente, s.telf, s.codigo, s.detalle, s.producto, s.anotaciones].some(v => String(v ?? '').toLowerCase().includes(opQuery))
        const matchOpExtra = (ex: any) => !opQuery || [ex.seller, ex.customerNif, ex.customerName, ex.rule?.name, ex.status].some(v => String(v ?? '').toLowerCase().includes(opQuery))
        const salesView = salesForTable.filter(matchOpSale)
        const extrasView = activeExtras.filter(matchOpExtra)

        const tableTotal = salesView.reduce((acc, sale) => acc + getCuotaTotal(sale), 0) + extrasView.reduce((acc, ex) => acc + (esAdmin ? (ex.telecomRewardAmount || 0) : (ex.sellerRewardAmount || 0)), 0);
        const totalComisiones = salesView.reduce((acc, sale) => acc + getCommission(sale), 0) + extrasView.reduce((acc, ex) => acc + (esAdmin ? (ex.telecomRewardAmount || 0) : (ex.sellerRewardAmount || 0)), 0);

        return (
            <>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '6px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>Registro de Operaciones{activePeriodObj?.name ? ` - ${activePeriodObj.name}` : ''}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} style={{ position: 'absolute', left: 9, color: 'var(--medium-gray)', pointerEvents: 'none' }} />
                            <input
                                value={opSearch}
                                onChange={e => setOpSearch(e.target.value)}
                                placeholder="Buscar cliente, NIF, teléfono, producto, vendedor..."
                                style={{ padding: '5px 28px 5px 30px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--light-text)', fontSize: 12, width: 290, outline: 'none' }}
                            />
                            {opSearch && (
                                <X size={14} onClick={() => setOpSearch('')} style={{ position: 'absolute', right: 9, color: 'var(--medium-gray)', cursor: 'pointer' }} />
                            )}
                        </div>
                        {(() => {
                            const hasExportPermission = can(user, 'EXPORT_EXCEL');
                            return (
                                <button 
                                    onClick={exportToExcel}
                                    disabled={!hasExportPermission}
                                    style={{ background: '#107c41', border: 'none', color: 'white', cursor: hasExportPermission ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: '8px', fontWeight: 700, fontSize: 12, opacity: hasExportPermission ? 1 : 0.4, boxShadow: '0 2px 4px rgba(16,124,65,0.3)', transition: 'filter 0.2s' }}
                                    title={!hasExportPermission ? "No tienes permisos para descargar el Excel nativo" : "Exportar a Excel"}
                                    onMouseOver={(e) => { if (hasExportPermission) e.currentTarget.style.filter = 'brightness(1.12)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.filter = 'brightness(1)'; }}
                                >
                                    <ExcelIcon size={16} /> Excel
                                </button>
                            )
                        })()}
                        <span style={{ backgroundColor: 'var(--mercedes-cyan)', color: '#000', padding: '1px 8px', borderRadius: '8px', fontSize: 11, fontWeight: 800 }}>
                            {salesView.length} VENTAS
                        </span>
                        <div style={{ backgroundColor: '#111827', color: '#F9FAFB', padding: '2px 12px', borderRadius: '8px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>TOTAL COMISIONES</span>
                            <span>{formatEuro(totalComisiones)}</span>
                        </div>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="tabla-liquidacion-compacta" style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--active-bg)', borderBottom: '2px solid var(--border-color)' }}>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Fecha</th>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Vendedor</th>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Cliente (NIF)</th>
                                <th style={{ textAlign: 'center', color: 'var(--medium-gray)' }}>Teléfono</th>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Tienda</th>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Tipo de Venta</th>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Producto</th>
                                <th style={{ textAlign: 'center', color: 'var(--medium-gray)' }}>Cuota Total</th>
                                <th style={{ textAlign: 'center', color: 'var(--medium-gray)' }}>Con Coste</th>
                                <th style={{ textAlign: 'center', color: 'var(--medium-gray)' }}>Swap</th>
                                <th style={{ textAlign: 'center', color: 'var(--medium-gray)' }}>Comisión (€)</th>
                                <th style={{ textAlign: 'left', color: 'var(--medium-gray)' }}>Varios</th>
                                <th style={{ textAlign: 'center', color: 'var(--medium-gray)' }}>Estado</th>
                                <th style={{ textAlign: 'center', color: 'var(--brand-danger)' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesView.length > 0 ? salesView.map((s, i) => {
                                const isEditing = editingId === s.id;

                                return (
                                    <tr key={s.id || i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isEditing ? 'rgba(0,173,239,0.05)' : 'transparent' }}>
                                        <td>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 90 }} value={editForm.fecha} onChange={e => setEditForm({ ...editForm, fecha: e.target.value })} /> : s.fecha}
                                        </td>
                                        <td>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 120 }} value={editForm.vendedor} onChange={e => setEditForm({ ...editForm, vendedor: e.target.value })} /> : s.vendedor}
                                        </td>
                                        <td>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 90 }} value={editForm.nif} onChange={e => setEditForm({ ...editForm, nif: e.target.value.toUpperCase() })} /> : (s.nif || '-')}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 90 }} value={editForm.telf || ''} onChange={e => setEditForm({ ...editForm, telf: e.target.value })} /> : (s.telf || '-')}
                                        </td>
                                        <td>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 80 }} value={editForm.codigo || ''} onChange={e => setEditForm({ ...editForm, codigo: e.target.value })} /> : (s.codigo || '-')}
                                        </td>
                                        <td>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 100 }} value={editForm.detalle || ''} onChange={e => setEditForm({ ...editForm, detalle: e.target.value })} /> : (s.detalle === 'Ti' ? 'Contratos Móvil' : s.detalle === 'O2' ? 'O2 MovilFree' : (s.detalle || '-'))}
                                        </td>
                                        <td>
                                            {isEditing ? (
                                                <input className="form-input" style={{ padding: '0 4px', width: 140 }} value={editForm.producto || ''} placeholder="Producto" onChange={e => setEditForm({ ...editForm, producto: e.target.value })} />
                                            ) : (
                                                s.producto || 'Sin especificar'
                                            )}
                                        </td>
                                        <td className="col-importe" style={{ textAlign: 'center', color: '#059669', fontWeight: 800 }}>
                                            {getCuotaTotal(s) > 0 ? `${getCuotaTotal(s).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '—'}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {(() => { const d = String(s.detalle || '').toLowerCase(); if (d !== 'rent' && d !== 'tma') return <span style={{ color: 'var(--text-muted)' }}>-</span>; const v = String(s.rentConCoste || '').toLowerCase(); return (v === 'si' || v === 'sí') ? <span style={{ color: '#059669', fontWeight: 700 }}>Sí</span> : <span style={{ color: 'var(--medium-gray)' }}>No</span>; })()}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {s.isSwap === true ? <span style={{ color: '#059669', fontWeight: 700 }}>Sí</span> : <span style={{ color: 'var(--medium-gray)' }}>No</span>}
                                        </td>
                                        <td className="col-importe" style={{ textAlign: 'center', color: '#0000FF' }}>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 70, textAlign: 'center', color: '#0000FF' }} value={editForm.importe || editForm.cuota || ''} onChange={e => setEditForm({ ...editForm, importe: e.target.value })} /> : `${getCommission(s).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                                        </td>
                                        <td>
                                            {isEditing ? <input className="form-input" style={{ padding: '0 4px', width: 110 }} value={editForm.anotaciones || ''} onChange={e => setEditForm({ ...editForm, anotaciones: e.target.value })} /> : (s.anotaciones || '-')}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isEditing ? (
                                                <select className="form-select" style={{ padding: '0 16px 0 4px', width: 90 }} value={(editForm.anulado === 'Si' || editForm.pendiente === 'Anulado') ? 'Anulado' : editForm.pendiente} onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === 'Anulado') {
                                                        setEditForm({ ...editForm, pendiente: 'Anulado', anulado: 'Si' });
                                                    } else {
                                                        setEditForm({ ...editForm, pendiente: val, anulado: 'No' });
                                                    }
                                                }}>
                                                    <option value="No">OK</option>
                                                    <option value="Si">PED</option>
                                                    <option value="Anulado">NULL</option>
                                                </select>
                                            ) : (
                                                (s.anulado === 'Si' || s.pendiente === 'Anulado') ? (
                                                    <span style={{ color: '#FF453A', backgroundColor: 'rgba(255, 69, 58, 0.1)', padding: '1px 6px', borderRadius: 12, fontWeight: 800 }}>NULL</span>
                                                ) : s.pendiente === 'Si' ? (
                                                    <span style={{ color: '#FF9500', backgroundColor: 'rgba(255, 149, 0, 0.1)', padding: '1px 6px', borderRadius: 12, fontWeight: 800 }}>PED</span>
                                                ) : (
                                                    <span style={{ color: '#34C759', backgroundColor: 'rgba(52, 199, 89, 0.1)', padding: '1px 6px', borderRadius: 12, fontWeight: 800 }}>OK</span>
                                                )
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                                                    <button onClick={handleSaveRow} disabled={saveLoading} style={{ background: 'var(--mercedes-cyan)', color: '#000', border: 'none', padding: '1px 6px', borderRadius: 4, cursor: 'pointer', fontWeight: 800 }}>{saveLoading ? '...' : 'OK'}</button>
                                                    <button onClick={() => setEditingId(null)} style={{ background: 'transparent', color: 'var(--medium-gray)', border: '1px solid var(--border-color)', padding: '1px 4px', borderRadius: 4, cursor: 'pointer' }}>X</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleEditRow(s)} style={{ background: 'transparent', color: 'var(--mercedes-cyan)', border: '1px solid var(--mercedes-cyan)', padding: '1px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 800 }}>EDIT</button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            }) : null}
                            
                            {extrasView.length > 0 && extrasView.map((ex: any, i: number) => (
                                <tr key={`extra-${ex.id || i}`} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                                    <td style={{ color: '#059669' }}>{new Date(ex.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                    <td style={{ color: '#059669' }}>{ex.seller}</td>
                                    <td style={{ color: '#059669' }}>{ex.customerNif || '-'}</td>
                                    <td style={{ textAlign: 'center', color: '#059669' }}>-</td>
                                    <td style={{ color: '#059669' }}>{resolveExtraCode(ex) || 'MANUAL'}</td>
                                    <td style={{ color: '#059669' }}>EXTRA</td>
                                    <td style={{ color: '#059669' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> {ex.rule?.name || 'Incentivo Manual'}</div>
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#059669' }}>-</td>
                                    <td style={{ textAlign: 'center', color: '#059669' }}>-</td>
                                    <td style={{ textAlign: 'center', color: '#059669' }}>-</td>
                                    <td style={{ textAlign: 'center', color: '#10b981' }}>
                                        {`+ ${Number(ex.telecomRewardAmount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                                    </td>
                                    <td style={{ color: '#059669' }}>{ex.customerName}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {ex.status === 'PENDING' ? (
                                            <span style={{ color: '#FF9500', backgroundColor: 'rgba(255, 149, 0, 0.1)', padding: '1px 6px', borderRadius: 12, fontWeight: 800 }}>PED</span>
                                        ) : (
                                            <span style={{ color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '1px 6px', borderRadius: 12, fontWeight: 800 }}>AUTO</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        -
                                    </td>
                                </tr>
                            ))}

                            {salesView.length === 0 && extrasView.length === 0 && (
                                <tr>
                                    <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: 'var(--medium-gray)' }}>
                                        No hay operaciones registradas para el mes seleccionado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
        )
    }

    if (authorized === null) {
        return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales del módulo...</div>;
    }

    if (loading) return <div style={{ padding: 20, fontSize: 16, fontWeight: 600, color: 'var(--mercedes-cyan)' }}>Buscando operaciones...</div>

    return (
        <div style={{ padding: '24px 32px', paddingBottom: 100, background: 'var(--bg-app)', minHeight: '100vh' }}>
            <style>{`
                .tabla-liquidacion-compacta {
                    border-collapse: collapse !important;
                    margin: 0 !important;
                }
                .tabla-liquidacion-compacta td,
                .tabla-liquidacion-compacta span,
                .tabla-liquidacion-compacta input,
                .tabla-liquidacion-compacta select,
                .tabla-liquidacion-compacta button,
                .tabla-liquidacion-compacta div {
                    font-size: 12px !important;
                }
                .tabla-liquidacion-compacta th {
                    font-size: 10px !important;
                }
                .tabla-liquidacion-compacta input.input-grupo {
                    font-size: 10px !important;
                }
                .tabla-liquidacion-compacta tr,
                .tabla-liquidacion-compacta td,
                .tabla-liquidacion-compacta th {
                    height: 23px !important;
                    max-height: 23px !important;
                    padding: 4px 8px !important;
                    line-height: 18px !important;
                    vertical-align: middle !important;
                    box-sizing: border-box !important;
                }
                .tabla-liquidacion-compacta input,
                .tabla-liquidacion-compacta select,
                .tabla-liquidacion-compacta button {
                    max-height: 17px !important;
                    height: 17px !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                }
                /* Excepciones de negrita */
                .tabla-liquidacion-compacta .col-importe {
                    font-weight: 800 !important;
                }
                /* Separador 1px */
                .tabla-liquidacion-compacta tr.separador-1px,
                .tabla-liquidacion-compacta tr.separador-1px td {
                    height: 1px !important;
                    min-height: 1px !important;
                    max-height: 1px !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    line-height: 1px !important;
                    font-size: 0px !important;
                }

                /* PREMIUM SAAS DESIGN SYSTEM CLASSES */
                .premium-card {
                   background: var(--bg-card);
                   border-radius: 16px;
                   padding: 18px;
                   box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                   transition: all 0.2s ease;
                   display: flex;
                   flex-direction: column;
                   align-items: flex-start;
                   text-align: left;
                   height: 100%;
                   border: 1px solid transparent;
                   cursor: pointer;
                }
                .premium-card:hover {
                   transform: translateY(-3px);
                   box-shadow: 0 8px 20px rgba(0,0,0,0.08);
                   border-color: rgba(37, 99, 235, 0.1);
                }
                .card-icon-wrapper {
                   border-radius: 12px;
                   padding: 10px;
                   margin-bottom: 12px;
                   display: inline-flex;
                   align-items: center;
                   justify-content: center;
                }
                .card-title {
                   font-size: 18px;
                   font-weight: 600;
                   color: var(--text-main);
                   margin: 0 0 6px 0;
                   line-height: 1.2;
                }
                .card-desc {
                   font-size: 13px;
                   color: var(--text-muted);
                   margin: 0;
                   line-height: 1.45;
                }
                .date-selector-wrapper {
                   background: var(--bg-card);
                   border-radius: 12px;
                   padding: 8px 16px;
                   box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                   border: 1px solid var(--border-strong);
                   display: inline-block;
                   margin-bottom: 24px;
                   margin-top: 8px;
                }
            `}</style>
            {/* HEADER & TABS */}
            <PageHeader 
                title={<>Operaciones <span style={{ color: '#2563eb' }}>Telefónica</span></>}
                subtitle="Control de comisiones y objetivos mensuales integrados."
                showBack={true}
                onBack={currentView !== 'menu' ? () => setCurrentView('menu') : undefined}
                backFallback="/tiendas"
                helpContent={
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Liquidación / Tablas de Pago</h4>
                    <p style={{ margin: 0, lineHeight: 1.5 }}>El núcleo financiero. Aquí configuras cuánto se paga por cada venta (Pyme y Básico/Plus). Puedes importar tablas desde Excel, ajustar tramos y visualizar los pagos proyectados (Ventas Reales + Pendientes).</p>
                  </div>
                }
                headerActions={undefined}
            />
            {/* VISTAS */}
            {currentView === 'menu' && renderMenu()}
            {currentView === 'plus' && renderCaptadorView()}
            {currentView === 'basico' && renderPymeView()}
            {currentView === 'operaciones' && renderOperacionesView()}
            {currentView === 'cruce' && renderCruceView()}
            {currentView === 'auditoria' && renderAuditoria()}
            {currentView === 'repesca' && <RepescaTrimestral user={user} activeYear={activePeriodObj?.year || 2026} />}
            {currentView === 'comisiones_v3' && <div style={{ padding: 24 }}><ComisionesV3 activePeriodKey={activePeriodKey} canModify={canModify} /></div>}

            {/* PASTE EXCEL MODAL */}
            {showPasteModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="card" style={{ width: 600, padding: 32, position: 'relative' }}>
                        <button
                            onClick={() => { setShowPasteModal(null); setPasteText(''); }}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--medium-gray)' }}
                        >
                            <X size={24} />
                        </button>
                        <h3 style={{ margin: 0, marginBottom: 8 }}>Pegar Matriz desde Excel</h3>
                        <p style={{ color: 'var(--medium-gray)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                            Inyectando bloque en <strong>{showPasteModal.profile}</strong>, a partir de la Fila {showPasteModal.rowIndex + 1} ({
                                showPasteModal.profile === 'Pyme'
                                    ? importesPyme[showPasteModal.rowIndex]?.concepto
                                    : importesPlus[showPasteModal.rowIndex]?.concepto
                            }).
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600 }}>Empezar a pegar en la columna:</label>
                            <select
                                className="form-select"
                                style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
                                value={pasteStartField}
                                onChange={e => setPasteStartField(e.target.value)}
                            >
                                <option value="grupo">Grupo (FIBRA, MÓVIL...)</option>
                                <option value="concepto">Bloques de Cobro</option>
                                <option value="comisionNacionalMenos50">Tramo {'< 50%'}</option>
                                <option value="comisionNacionalEntre50Y80">Tramo {'50-80%'}</option>
                                <option value="comisionNacionalEntre80Y100">Tramo {'80-100%'}</option>
                                <option value="comisionNacionalMas100">Tramo {'> 100%'}</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            <label style={{ fontSize: 13, fontWeight: 600 }}>Modo de distribución:</label>
                            <div style={{ display: 'flex', gap: 24 }}>
                                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="pasteMode"
                                        value="single"
                                        checked={pasteMode === 'single'}
                                        onChange={() => setPasteMode('single')}
                                    />
                                    Solo en la columna seleccionada
                                </label>
                                <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="pasteMode"
                                        value="block"
                                        checked={pasteMode === 'block'}
                                        onChange={() => setPasteMode('block')}
                                    />
                                    Pegar como Bloque (Multicolumna)
                                </label>
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <textarea
                                className="form-input"
                                style={{ width: '100%', height: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, padding: 12, backgroundColor: 'rgba(0,0,0,0.02)' }}
                                placeholder="Pega aquí tu selección de Excel (Ctrl+V)..."
                                value={pasteText}
                                onChange={e => setPasteText(e.target.value)}
                            />
                        </div>

                        {/* Live Preview Metric */}
                        {pasteText && (
                            <div style={{ padding: '8px 12px', backgroundColor: 'rgba(0, 173, 239, 0.1)', border: '1px solid rgba(0, 173, 239, 0.3)', borderRadius: 6, marginBottom: 24, fontSize: 13, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>
                                {(() => {
                                    const parsedRows = pasteText.split('\n').filter(r => r.trim() !== '');
                                    const numCols = parsedRows[0] ? parsedRows[0].split('\t').length : 0;
                                    const colText = pasteMode === 'single' ? 'solo en esta columna' : `hacia la derecha (${numCols} columnas)`;
                                    return `✓ Se han detectado ${parsedRows.length} filas y ${numCols} columnas. Se rellenarán las celdas desde la Fila ${showPasteModal.rowIndex + 1} hacia abajo y ${colText}.`;
                                })()}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '12px 24px', fontSize: 14, fontWeight: 600 }}
                                onClick={() => { setShowPasteModal(null); setPasteText('') }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '12px 24px', fontSize: 14, fontWeight: 800, color: 'var(--mercedes-cyan)', border: '1px solid var(--mercedes-cyan)' }}
                                onClick={() => processPaste('append')}
                            >
                                Añadir a los actuales
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ padding: '12px 24px', fontSize: 14, fontWeight: 800, backgroundColor: 'var(--brand-danger)' }}
                                onClick={() => processPaste('replace')}
                            >
                                Limpiar y Reemplazar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
