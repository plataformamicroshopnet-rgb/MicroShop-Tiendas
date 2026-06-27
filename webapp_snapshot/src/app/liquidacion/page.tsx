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
import { calculateDynamicCommission, sanitizeSale, normalizeString, getCurrentMonthString, isVentaWithinDates, renderDashboardData, isSaleActive } from '@/lib/salesUtils'
import { getSaleCommissionBase } from '@/lib/saleCommission'
import { computeBonosO2, computeTerritorialTotal, computeTerritorialRows, calculateO2Importe } from '@/lib/territorialConsolidado'
import { can, canEdit } from '@/lib/permissions'
import { useGuard } from '@/hooks/useGuard'
import { useComisionesData } from '@/hooks/useComisionesData'
import { RepescaTrimestral } from './RepescaTrimestral'
import { ComisionesV3 } from './ComisionesV3'
type ViewType = 'menu' | 'plus' | 'basico' | 'operaciones' | 'cruce' | 'objetivos' | 'auditoria' | 'repesca' | 'comisiones_v3' | 'rentabilidad_total' | 'comisiones_comerciales'

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
    // Datos crudos + reglas para filas-resumen en vivo (PRV Territorial O2/Tiendas, MovilFree).
    const [salesRaw, setSalesRaw] = useState<any[]>([])
    const [territorialO2Rules, setTerritorialO2Rules] = useState<any[]>([])
    const [territorialTiendasRules, setTerritorialTiendasRules] = useState<any[]>([])
    const [movilFreeSales, setMovilFreeSales] = useState<any[]>([])
    const [movilFreeProducts, setMovilFreeProducts] = useState<any[]>([])
    // Acordeón de trazabilidad en la carta "Rentabilidad Total"
    const [drillKey, setDrillKey] = useState<string | null>(null)
    const [drillComercial, setDrillComercial] = useState<string | null>(null)
    const [drillSearch, setDrillSearch] = useState('')
    const [exportSel, setExportSel] = useState<number[]>([0, 1, 2, 3, 4]) // bloques marcados para exportar
    const [openComercial, setOpenComercial] = useState<string | null>(null) // comercial desplegado en Comisiones Comerciales
    const [openPalanca, setOpenPalanca] = useState<string | null>(null) // palanca desplegada (nivel 2)
    // Datos del Panel de Comisiones (comisión por comercial) para la carta "Cuadro de Comisiones Comerciales"
    const comisionesData = useComisionesData(user)

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
            fetch(`/api/extras/assignments?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({})),
            fetch(`/api/territorial?periodKey=${activePeriodKey}`).then(res => res.json()).catch(() => ({ success: true, o2: [], tiendas: [] })),
            fetch(`/api/movilfree/sales`).then(res => res.json()).catch(() => ([])),
            fetch(`/api/movilfree/products`).then(res => res.json()).catch(() => ([]))
        ]).then(([objData, pymeData, plusData, sData, extrasData, territorialRes, mfSalesData, mfProductsData]) => {
            setTerritorialO2Rules((territorialRes && territorialRes.o2) || [])
            setTerritorialTiendasRules((territorialRes && territorialRes.tiendas) || [])
            setMovilFreeSales(Array.isArray(mfSalesData) ? mfSalesData : (mfSalesData?.sales || mfSalesData?.data || []))
            setMovilFreeProducts(Array.isArray(mfProductsData) ? mfProductsData : (mfProductsData?.products || mfProductsData?.data || []))
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
                setSalesRaw(sData.logs)  // crudas (sin sanitizeSale): para computeBonosO2/computeTerritorialTotal
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
                <div className="tabla-movil-wrap" style={{ overflowX: 'auto' }}>
                    <table className="tabla-liquidacion-compacta tabla-movil" style={{ minWidth: 920, width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
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
        const notCancelled = (s: any) => isSaleActive(s)
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
                    <div className="tabla-movil-wrap" style={{ overflowX: 'auto' }}>
                        <table className="tabla-movil" style={{ width: '100%', borderCollapse: 'collapse' }}>
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



    const renderRentabilidadTotal = (onlyFinalized = false) => {
        const fmtEur = (v: number) => (v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
        const docTitle = onlyFinalized ? 'COMISIONES COMERCIALES (FINALIZADAS)' : 'HOJA DE COBRO — RENTABILIDAD TOTAL'
        const baseName = onlyFinalized ? 'Comisiones_Comerciales_Finalizadas' : 'Rentabilidad_Total'
        // ── Comisión por venta (MISMA fuente única que Operaciones Telefónica) ──
        const pymeMonthObj = objetivos.Pyme?.[currentObjMonth] || {}
        const captadorMonthObj = objetivos.Captador?.[currentObjMonth] || {}
        const pymeData = renderDashboardData('Pyme', importesPyme, pymeMonthObj, filteredSalesGlobal, objGrupos, activePeriodObj)
        const captadorData = renderDashboardData('Captador', importesPlus, captadorMonthObj, filteredSalesGlobal, objGrupos, activePeriodObj)
        const viewingPeriod = activePeriodObj ? `${activePeriodObj.year}${String(activePeriodObj.month).padStart(2, '0')}` : getCurrentMonthString()
        const getComm = (sale: any) => getSaleCommissionBase(sale, { catalogs, dashRowsPlus: pymeData.rows, dashRowsBasico: captadorData.rows, viewingPeriod }) + (sale.isSwap === true ? 15 : 0)

        const isAnul = (s: any) => { const a = String(s.anulado || '').toLowerCase().trim(); return a === 'si' || a === 'sí' || String(s.pendiente || '').toLowerCase().trim() === 'anulado' }
        const isSolarS = (s: any) => { const t = `${s.producto || ''} ${s.categoria || ''} ${s.detalle || ''}`.toLowerCase(); return t.includes('solar360') || t.includes('solar 360') }
        const isPend = (s: any) => String(s.pendiente || '').toLowerCase().trim() === 'si'
        const activas = filteredSalesGlobal.filter((s: any) => !isAnul(s) && !isSolarS(s) && (!onlyFinalized || !isPend(s)))
        // En modo "solo finalizadas" se descartan las pendientes (PED) también del territorial/O2
        const salesRawF = onlyFinalized ? salesRaw.filter((s: any) => !isPend(s)) : salesRaw

        // ── 1) Tiendas Movistar, por grupo (excluye O2) ──
        const GRUPOS = [
            { id: 'ti', label: 'Contratos Móvil' }, { id: 'rent', label: 'Rent (Dispositivos)' },
            { id: 'seguro', label: 'Seguro' }, { id: 'mimovistar', label: 'miMovistar' },
            { id: 'tv', label: 'Suscripciones TV' }, { id: 'repos', label: 'Repos (Arpu)' },
            { id: 'resto_baf', label: 'Resto BAF' }, { id: 'traslado', label: 'Traslado miMovistar' },
            { id: 'varios', label: 'Varios' }, { id: 'prepago', label: 'Prepago' }, { id: 'otros', label: 'Otros (sin clasificar)' },
        ]
        const grupoDe = (s: any) => {
            const d = String(s.detalle || s.categoria || '').toLowerCase().trim()
            if (d === 'ti' || d === 'contratos móvil' || d === 'contratos movil') return 'ti'
            if (d === 'rent' || d === 'tma') return 'rent'
            if (d === 'seguro') return 'seguro'
            if (d === 'mimovistar' || d === 'mimovi') return 'mimovistar'
            if (d === 'suscripciones tv' || d === 'suscripcion tv' || d === 'tv') return 'tv'
            if (d === 'repos') return 'repos'
            if (d === 'resto baf') return 'resto_baf'
            if (d === 'traslado mimovistar' || d === 'traslado') return 'traslado'
            if (d === 'varios') return 'varios'
            if (d === 'prepago') return 'prepago'
            return 'otros'
        }
        const parseNum = (v: any) => { const n = parseFloat(String(v ?? '0').replace(/[^0-9.,\-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
        const SOURCE_OGC = { href: '/operaciones-grupo-cliente', label: 'Operaciones por Grupo Cliente' }
        const SOURCE_MF = { href: '/movilfree', label: 'MovilFree' }
        const estadoDe = (s: any) => isAnul(s) ? 'NULL' : (String(s.pendiente || '').toLowerCase().trim() === 'si' ? 'PED' : 'OK')
        const toDrill = (s: any) => ({ fecha: s.fecha || '-', comercial: s.vendedor || '-', nif: s.nif || '-', telf: s.telf || '-', tienda: s.codigo || '-', producto: s.producto || '-', cuota: parseNum(s.cuota || s.importe), swap: s.isSwap === true, comision: getComm(s), estado: estadoDe(s) })

        const movMap: Record<string, { uds: number, eur: number, sales: any[] }> = {}
        GRUPOS.forEach(g => { movMap[g.id] = { uds: 0, eur: 0, sales: [] } })
        const o2Marta = { uds: 0, eur: 0, sales: [] as any[] }; const o2Otras = { uds: 0, eur: 0, sales: [] as any[] }
        activas.forEach((s: any) => {
            const d = String(s.detalle || s.categoria || '').toLowerCase().trim()
            const com = getComm(s)
            if (d === 'o2' || d === 'o2 movilfree') {
                if (String(s.vendedor || '').toLowerCase().includes('marta')) { o2Marta.uds++; o2Marta.eur += com; o2Marta.sales.push(s) }
                else { o2Otras.uds++; o2Otras.eur += com; o2Otras.sales.push(s) }
            } else { const g = grupoDe(s); movMap[g].uds++; movMap[g].eur += com; movMap[g].sales.push(s) }
        })
        const movRows = GRUPOS.map(g => ({ label: g.label, uds: movMap[g.id].uds, eur: movMap[g.id].eur, drill: movMap[g.id].sales.map(toDrill), source: SOURCE_OGC })).filter(r => r.uds > 0 || r.eur !== 0)
        const movTotal = movRows.reduce((a, r) => a + r.eur, 0)
        const o2Total = o2Marta.eur + o2Otras.eur

        // ── 3) MovilFree margen + tickets (para el desglose) ──
        const [mfYStr, mfMStr] = String(activePeriodKey || '').split('_'); const mfY = Number(mfYStr), mfM = Number(mfMStr)
        const mfDrill: any[] = []; let movilFreeTotal = 0
        movilFreeSales.filter((s: any) => { const dd = new Date(s.fechaVenta); return s.estado === 'COMPLETADA' && mfY && mfM && dd.getFullYear() === mfY && (dd.getMonth() + 1) === mfM })
            .forEach((s: any) => {
                let margen = 0, prods = '-'
                try { const list = JSON.parse(s.listaProductos); const cost = list.reduce((c: number, it: any) => c + ((it.coste !== undefined ? it.coste : (movilFreeProducts.find((p: any) => p.id === it.id)?.coste || 0)) * it.cantidad), 0); margen = (s.importeTotal / 1.21) - cost; prods = list.map((it: any) => `${it.nombre || it.id}×${it.cantidad}`).join(', ') } catch { margen = 0 }
                movilFreeTotal += margen
                mfDrill.push({ fecha: new Date(s.fechaVenta).toLocaleDateString('es-ES'), comercial: s.vendedor || s.tienda || 'MovilFree', nif: s.clienteNif || s.clienteNombre || '-', telf: '-', tienda: 'MovilFree', producto: prods || '-', cuota: (s.importeTotal || 0) / 1.21, swap: false, comision: margen, estado: 'OK' })
            })

        // ── 4) PRV Territorial O2: los 3 bonos (Mes / Trimestre / Conectividad) desglosados ──
        const TRAMOS_MES = [
            { key: '4_10', min: 4, max: 10, label: '4–10' }, { key: '11_14', min: 11, max: 14, label: '11–14' },
            { key: '15_20', min: 15, max: 20, label: '15–20' }, { key: '21_30', min: 21, max: 30, label: '21–30' },
            { key: '31_40', min: 31, max: 40, label: '31–40' }, { key: '41_plus', min: 41, max: 99999, label: '≥41' },
        ]
        const TRAMOS_TRIM = [{ key: '5_9', min: 5, max: 9, label: '5–9' }, { key: '10_plus', min: 10, max: 99999, label: '≥10' }]
        const o2AltasSales = salesRawF.filter((s: any) => { if (isAnul(s)) return false; const d = String(s.detalle || s.categoria || '').toLowerCase().trim(); if (d !== 'o2') return false; const p = String(s.producto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); return p.startsWith('fibra') || p.startsWith('interna') })
        const o2Count = o2AltasSales.length
        const o2AltasDrill = o2AltasSales.map(toDrill)
        const o2Det: any[] = []
        ;(territorialO2Rules || []).forEach((r: any) => {
            const mesT = TRAMOS_MES.find(t => o2Count >= t.min && o2Count <= t.max)
            const trimT = TRAMOS_TRIM.find(t => o2Count >= t.min && o2Count <= t.max)
            const mesImp = mesT ? parseNum(r.tramosMes?.[mesT.key]) : 0
            const trimImp = trimT ? parseNum(r.tramosTrim?.[trimT.key]) : 0
            const conImp = o2Count > 0 ? parseNum(r.conectividad) : 0
            o2Det.push(
                { label: 'Bono Mes', uds: o2Count, obj: 'desde 4 altas', tramos: mesT ? `tramo ${mesT.label}` : '—', eur: mesImp, ok: mesImp > 0, estado: mesImp > 0 ? 'alcanzado' : 'no llega (mín. 4)', drill: o2AltasDrill, source: SOURCE_OGC },
                { label: 'Bono Trimestre', uds: o2Count, obj: 'desde 5 altas', tramos: trimT ? `tramo ${trimT.label}` : '—', eur: trimImp, ok: trimImp > 0, estado: trimImp > 0 ? 'alcanzado' : 'no llega (mín. 5)', drill: o2AltasDrill, source: SOURCE_OGC },
                { label: 'Conectividad', uds: o2Count, obj: 'con ≥ 1 alta', tramos: conImp > 0 ? 'activa' : '—', eur: conImp, ok: conImp > 0, estado: conImp > 0 ? 'alcanzado' : 'no llega', drill: o2AltasDrill, source: SOURCE_OGC },
            )
        })
        const prvO2Total = o2Det.reduce((a, r) => a + r.eur, 0)

        // ── 5) PRV Territorial Tiendas por palanca (TODAS, incl. las que NO llegan) ──
        const terrDet = computeTerritorialRows({ sales: salesRawF, territorialRules: territorialTiendasRules, catalogs, viewingPeriod } as any)
            .map((r: any) => {
                const objs = [r.obj1Target, r.obj2Target, r.obj3Target].filter((x: number) => x > 0)
                const tramos = [r.t1Raw, r.t2Raw, r.t3Raw].filter((x: any) => x && String(x).trim() !== '' && String(x) !== '-' && String(x) !== 'undefined')
                const falta = (r.obj1Target > 0 && r.importe <= 0) ? Math.max(0, r.obj1Target - r.ventas) : 0
                return {
                    label: r.palanca, uds: r.ventas,
                    obj: objs.length ? objs.map((x: number) => x.toLocaleString('es-ES')).join(' / ') : '—',
                    tramos: tramos.length ? tramos.join(' / ') : '—',
                    eur: r.importe, ok: r.importe > 0,
                    estado: r.importe > 0 ? (r.tramoAplicado || 'alcanzado') : (falta > 0 ? `no llega (faltan ${falta})` : 'no llega'),
                    drill: (r.logs || []).map(toDrill), source: SOURCE_OGC,
                }
            })
            .filter((r: any) => r.uds > 0 || r.eur > 0 || r.obj !== '—')
        const prvTiendasTotal = terrDet.reduce((a: number, r: any) => a + r.eur, 0)

        const granTotal = movTotal + o2Total + movilFreeTotal + prvO2Total + prvTiendasTotal

        const sections: any[] = [
            { icon: '🏢', color: '#2563eb', title: 'Tiendas Movistar', sub: 'Comisión de ventas, por grupo (= Operaciones por Grupo Cliente)', rows: movRows, subtotal: movTotal },
            { icon: '🔵', color: '#005D82', title: 'O2 MovilFree', sub: 'Comisión de ventas O2 (Marta + otras tiendas)', rows: [{ label: 'Marta (tienda O2)', uds: o2Marta.uds, eur: o2Marta.eur, drill: o2Marta.sales.map(toDrill), source: SOURCE_OGC }, { label: 'Ventas de otras tiendas', uds: o2Otras.uds, eur: o2Otras.eur, drill: o2Otras.sales.map(toDrill), source: SOURCE_OGC }].filter(r => r.uds > 0 || r.eur !== 0), subtotal: o2Total },
            { icon: '📦', color: '#8B5CF6', title: 'MovilFree (margen de la tienda)', sub: 'Ingreso sin IVA − coste de los productos vendidos', rows: (mfDrill.length > 0 ? [{ label: 'Tickets MovilFree del mes', uds: mfDrill.length, eur: movilFreeTotal, drill: mfDrill, source: SOURCE_MF }] : []), subtotal: movilFreeTotal },
            { icon: '⚡', color: '#0891B2', title: 'PRV Territorial O2', sub: 'Bono que paga O2 por volumen de altas (Mes + Trimestre + Conectividad)', rows: o2Det, subtotal: prvO2Total, detailed: true, udsLabel: 'Altas O2' },
            { icon: '⚡', color: '#10b981', title: 'PRV Territorial Tiendas', sub: 'Bono que paga Telefónica por palanca (objetivo en unidades → % sobre comisión)', rows: terrDet, subtotal: prvTiendasTotal, detailed: true, udsLabel: 'Ventas' },
        ]

        // Panel desplegable de trazabilidad (filtro por comercial + buscador + tabla + origen)
        const renderDrill = (drill: any[], source: any, colSpan: number) => {
            const comerciales = Array.from(new Set((drill || []).map((d: any) => d.comercial).filter(Boolean))).sort()
            const q = drillSearch.trim().toLowerCase()
            const filtered = (drill || []).filter((d: any) =>
                (!drillComercial || d.comercial === drillComercial) &&
                (!q || [d.nif, d.telf, d.producto, d.comercial].some((v: any) => String(v ?? '').toLowerCase().includes(q)))
            )
            const subt = filtered.reduce((a: number, d: any) => a + (d.comision || 0), 0)
            return (
                <tr>
                    <td colSpan={colSpan} style={{ padding: 0, background: 'rgba(0,0,0,0.02)' }}>
                        <div style={{ padding: '12px 16px 16px 32px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--medium-gray)', textTransform: 'uppercase' }}>Comercial:</span>
                                {['__all__', ...comerciales].map((c: any) => {
                                    const active = c === '__all__' ? !drillComercial : drillComercial === c
                                    return <button key={c} onClick={() => setDrillComercial(c === '__all__' ? null : c)} style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-color)', cursor: 'pointer', background: active ? 'var(--mercedes-cyan)' : 'transparent', color: active ? '#fff' : 'var(--medium-gray)' }}>{c === '__all__' ? 'Todos' : c}</button>
                                })}
                                <input value={drillSearch} onChange={e => setDrillSearch(e.target.value)} placeholder="Buscar NIF, teléfono, producto…" style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--light-text)', minWidth: 220 }} />
                                {source && <button onClick={() => router.push(source.href)} style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#0ea5e9', color: '#fff', whiteSpace: 'nowrap' }}>↗ Ir a {source.label}</button>}
                            </div>
                            <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-card)', color: 'var(--medium-gray)', fontSize: 10.5, textTransform: 'uppercase' }}>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fecha</th><th style={{ padding: '6px 8px', textAlign: 'left' }}>Comercial</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Cliente (NIF)</th><th style={{ padding: '6px 8px', textAlign: 'left' }}>Teléfono</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tienda</th><th style={{ padding: '6px 8px', textAlign: 'left' }}>Producto</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>Swap</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>Comisión</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr><td colSpan={9} style={{ padding: 14, textAlign: 'center', color: 'var(--medium-gray)' }}>Sin operaciones para este filtro.</td></tr>
                                        ) : filtered.map((d: any, k: number) => (
                                            <tr key={k} style={{ borderTop: '1px solid var(--border-light)', background: d.estado === 'NULL' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                                                <td style={{ padding: '6px 8px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{d.fecha}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--light-text)', fontWeight: 600 }}>{d.comercial}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--light-text)' }}>{d.nif}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--medium-gray)' }}>{d.telf}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--medium-gray)' }}>{d.tienda}</td>
                                                <td style={{ padding: '6px 8px', color: 'var(--light-text)' }}>{d.producto}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{d.swap ? '✅' : ''}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', whiteSpace: 'nowrap' }}>{fmtEur(d.comision)}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'center' }}><span style={{ fontSize: 10.5, fontWeight: 800, color: d.estado === 'OK' ? '#10b981' : d.estado === 'PED' ? '#f59e0b' : '#ef4444' }}>{d.estado}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {filtered.length > 0 && <tfoot><tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 800 }}><td colSpan={7} style={{ padding: '8px', textAlign: 'right', color: 'var(--medium-gray)' }}>Subtotal ({filtered.length} ops):</td><td style={{ padding: '8px', textAlign: 'right', color: '#10b981' }}>{fmtEur(subt)}</td><td></td></tr></tfoot>}
                                </table>
                            </div>
                        </div>
                    </td>
                </tr>
            )
        }

        // ── Exportación (Excel / PDF / Imprimir) ──
        const effSel = (exportSel.length ? exportSel : [0, 1, 2, 3, 4]).filter((i: number) => i >= 0 && i < sections.length).sort((a, b) => a - b)
        const uniqueDrill = (sec: any) => Array.from(new Set((sec.rows || []).map((r: any) => r.drill).filter(Boolean))).flatMap((d: any) => d)
        const drillToRowObj = (d: any) => ({ fecha: d.fecha, comercial: d.comercial, nif: d.nif, telefono: d.telf, tienda: d.tienda, producto: d.producto, swap: d.swap ? 'Sí' : 'No', comision: Number(d.comision || 0), estado: d.estado })
        const DETAIL_COLS = [
            { header: 'Fecha', key: 'fecha', width: 12 }, { header: 'Comercial', key: 'comercial', width: 20 },
            { header: 'Cliente (NIF)', key: 'nif', width: 16 }, { header: 'Teléfono', key: 'telefono', width: 14 },
            { header: 'Tienda', key: 'tienda', width: 16 }, { header: 'Producto', key: 'producto', width: 34 },
            { header: 'Swap', key: 'swap', width: 8 }, { header: 'Comisión (€)', key: 'comision', width: 14 }, { header: 'Estado', key: 'estado', width: 10 },
        ]
        const sheetName = (t: string, fallback: string) => (String(t).replace(/[\\\/\?\*\[\]:]/g, '').trim().slice(0, 28) || fallback)

        const exportExcel = async (idxs: number[], allMode: boolean) => {
            const wb = new ExcelJS.Workbook()
            const sel = idxs.map(i => sections[i]).filter(Boolean)
            const ws = wb.addWorksheet('Resumen')
            const t1 = ws.addRow([`${docTitle}${activePeriodObj?.name ? ` · ${activePeriodObj.name}` : ''}`]); t1.font = { bold: true, size: 14 }
            ws.addRow([`Lo que Telefónica / O2 deben pagar este mes · generado ${new Date().toLocaleString('es-ES')}`]); ws.addRow([])
            let gtot = 0
            sel.forEach(sec => {
                gtot += sec.subtotal
                const hr = ws.addRow([`${sec.icon} ${sec.title}`, '', '', '', '', sec.subtotal]); hr.font = { bold: true, size: 12 }; hr.getCell(6).numFmt = '#,##0.00 €'
                if (sec.detailed) {
                    const h = ws.addRow(['Concepto', sec.udsLabel || 'Ventas', 'Objetivo', 'Tramo de cobro', 'Estado', 'Importe']); h.font = { italic: true, color: { argb: 'FF6B7280' } }
                    sec.rows.forEach((r: any) => { const rr = ws.addRow([r.label, r.uds, r.obj, r.tramos, r.estado, r.eur]); rr.getCell(6).numFmt = '#,##0.00 €' })
                } else {
                    const h = ws.addRow(['Concepto', 'Unidades', '', '', '', 'Importe']); h.font = { italic: true, color: { argb: 'FF6B7280' } }
                    sec.rows.forEach((r: any) => { const rr = ws.addRow([r.label, r.uds, '', '', '', r.eur]); rr.getCell(6).numFmt = '#,##0.00 €' })
                }
                ws.addRow([])
            })
            const trow = ws.addRow(['TOTAL A COBRAR', '', '', '', '', gtot]); trow.font = { bold: true, size: 13 }; trow.getCell(6).numFmt = '#,##0.00 €'
            ws.columns.forEach((c, i) => { c.width = i === 0 ? 34 : (i === 5 ? 15 : 14) })

            if (allMode) {
                const wsAll = wb.addWorksheet('Detalle (una hoja)')
                wsAll.columns = [{ header: 'Bloque', key: 'bloque', width: 24 }, ...DETAIL_COLS]
                sel.forEach(sec => { uniqueDrill(sec).forEach((d: any) => wsAll.addRow({ bloque: sec.title, ...drillToRowObj(d) })) })
                wsAll.getRow(1).font = { bold: true }; wsAll.getColumn('comision').numFmt = '#,##0.00 €'
            }
            sel.forEach(sec => {
                const rows = uniqueDrill(sec); if (rows.length === 0) return
                const ws2 = wb.addWorksheet(sheetName(sec.title, `Bloque ${sections.indexOf(sec) + 1}`))
                ws2.columns = DETAIL_COLS
                rows.forEach((d: any) => ws2.addRow(drillToRowObj(d)))
                ws2.getRow(1).font = { bold: true }; ws2.getColumn('comision').numFmt = '#,##0.00 €'
            })
            const buffer = await wb.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url
            a.download = `${baseName}_${activePeriodObj?.name || activePeriodKey || 'mes'}${allMode ? '_completo' : ''}.xlsx`; a.click(); window.URL.revokeObjectURL(url)
        }

        const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const openPrint = (idxs: number[]) => {
            const sel = idxs.map(i => sections[i]).filter(Boolean); let gtot = 0
            const blocks = sel.map(sec => {
                gtot += sec.subtotal
                const head = sec.detailed
                    ? `<tr><th>Concepto</th><th>${esc(sec.udsLabel || 'Ventas')}</th><th>Objetivo</th><th>Tramo de cobro</th><th>Estado</th><th class=r>Importe</th></tr>`
                    : `<tr><th>Concepto</th><th>Unidades</th><th class=r>Importe</th></tr>`
                const body = sec.rows.map((r: any) => sec.detailed
                    ? `<tr><td>${esc(r.label)}</td><td>${esc(r.uds)}</td><td>${esc(r.obj)}</td><td>${esc(r.tramos)}</td><td>${esc(r.estado)}</td><td class=r>${esc(fmtEur(r.eur))}</td></tr>`
                    : `<tr><td>${esc(r.label)}</td><td>${r.uds != null ? esc(r.uds) + ' uds' : ''}</td><td class=r>${esc(fmtEur(r.eur))}</td></tr>`
                ).join('')
                return `<div class=sec><div class=sh><span>${esc(sec.icon + ' ' + sec.title)}</span><span>${esc(fmtEur(sec.subtotal))}</span></div><table>${head}${body}</table></div>`
            }).join('')
            const html = `<!doctype html><html lang=es><head><meta charset=utf-8><title>${esc(docTitle)}</title><style>*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:24px;color:#1f2937}h1{font-size:18px;margin:0 0 2px}.meta{color:#6b7280;font-size:12px;margin-bottom:16px}.sec{margin:0 0 14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid}.sh{display:flex;justify-content:space-between;padding:8px 12px;background:#f3f4f6;font-weight:700;font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:5px 12px;border-top:1px solid #eee;text-align:left}th{color:#6b7280;font-weight:700;font-size:11px;text-transform:uppercase}.r{text-align:right}.total{display:flex;justify-content:space-between;padding:14px 18px;background:#10b981;color:#fff;border-radius:8px;font-weight:800;font-size:16px;margin-top:8px}@media print{body{margin:10px}}</style></head><body><h1>${esc(docTitle)}${esc(activePeriodObj?.name ? ` · ${activePeriodObj.name}` : '')}</h1><div class=meta>${esc(onlyFinalized ? 'Comisiones de operaciones FINALIZADAS (las pendientes no cuentan)' : 'Lo que Telefónica / O2 deben pagar este mes')} · generado ${esc(new Date().toLocaleString('es-ES'))}</div>${blocks}<div class=total><span>TOTAL A COBRAR DE TELEFÓNICA / O2</span><span>${esc(fmtEur(gtot))}</span></div></body></html>`
            const w = window.open('', '_blank', 'width=900,height=700'); if (!w) { alert('Activa las ventanas emergentes para PDF / Imprimir.'); return }
            w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) { } }, 350)
        }

        const expBtn: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'var(--medium-gray)', minWidth: 74 }

        return (
            <>
                <BackButton />
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.03))', borderBottom: '1px solid var(--border-color)' }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--light-text)' }}>{onlyFinalized ? '✅ Cuadro de Comisiones Comerciales — solo FINALIZADAS' : '📋 Hoja de Cobro — Rentabilidad Total'}{activePeriodObj?.name ? ` · ${activePeriodObj.name}` : ''}</h2>
                        <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--medium-gray)', lineHeight: 1.5 }}>
                            {onlyFinalized
                                ? <>Estas son las <strong>comisiones de Tiendas YA FINALIZADAS</strong> (reales/cobrables) este mes, por cada pata. <strong>Las operaciones pendientes (PED) NO se incluyen</strong> — solo lo cerrado. Cada bloque trae su <strong>subtotal</strong> y abajo el <strong>total</strong>. 💡 <strong>Pulsa cualquier fila (▸)</strong> para ver el detalle venta a venta. (Anuladas y pendientes fuera.)</>
                                : <>Esto es <strong>lo que Telefónica y O2 deben pagarnos este mes</strong>, por cada pata de la empresa. Revisa cada partida contra lo que nos ingresen. Cada bloque trae su <strong>subtotal</strong> y abajo está el <strong>total general</strong>. 💡 <strong>Pulsa cualquier fila (▸)</strong> para ver el detalle de ventas — por comercial, con buscador — y saltar a la pantalla origen. (Las ventas anuladas no cuentan.)</>
                            }
                        </p>
                    </div>

                    <div style={{ padding: '8px 16px 16px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8, padding: '10px 12px', border: '1px dashed var(--border-color)', borderRadius: 10, background: 'var(--bg-hover)' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--light-text)', marginRight: 4 }}>Exportar / Imprimir:</span>
                            <button onClick={() => exportExcel(effSel, false)} style={expBtn} title="Exportar a Excel SOLO los bloques marcados (✓) — resumen + una hoja de detalle por bloque">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="2.5" width="18" height="19" rx="2.5" fill="#21A366" /><text x="12" y="15.5" fontSize="7.5" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="Arial">XLS</text><circle cx="19" cy="19" r="4.5" fill="#15803d" stroke="#fff" strokeWidth="1" /><path d="M16.9 19l1.4 1.4 2.4-2.7" stroke="#fff" strokeWidth="1.3" fill="none" /></svg>
                                <span>Excel (selección)</span>
                            </button>
                            <button onClick={() => exportExcel([0, 1, 2, 3, 4], true)} style={expBtn} title="Exportar TODO a Excel — resumen + una hoja con todo + una hoja por cada bloque">
                                <svg width="22" height="22" viewBox="0 0 24 24"><rect x="2.5" y="3" width="19" height="18" rx="2.5" fill="#16a34a" /><path d="M6.5 8l4.5 8M11 8l-4.5 8" stroke="#fff" strokeWidth="1.7" /><path d="M14 8.5h5.5M14 12h5.5M14 15.5h5.5" stroke="#fff" strokeWidth="1.5" /></svg>
                                <span>Excel (todo)</span>
                            </button>
                            <button onClick={() => openPrint(effSel)} style={expBtn} title="Exportar a PDF los bloques marcados (✓) — en el diálogo elige 'Guardar como PDF'">
                                <svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="2.5" width="18" height="19" rx="2.5" fill="#E2483D" /><text x="12" y="15.5" fontSize="7" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="Arial">PDF</text></svg>
                                <span>PDF</span>
                            </button>
                            <button onClick={() => openPrint(effSel)} style={expBtn} title="Imprimir los bloques marcados (✓)">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.7"><path d="M6 9V3.5h12V9" /><rect x="3" y="9" width="18" height="8" rx="1.5" fill="#dbeafe" /><rect x="6.5" y="13.5" width="11" height="6.5" fill="#fff" /><circle cx="17.5" cy="11.5" r="0.9" fill="#ef4444" stroke="none" /></svg>
                                <span>Imprimir</span>
                            </button>
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--medium-gray)', maxWidth: 230, lineHeight: 1.35 }}>Marca con ✓ los bloques que quieras; sin marcar ninguno = todos. "Excel (todo)" siempre exporta todo.</span>
                        </div>
                        {sections.map((sec, i) => (
                            <div key={i} style={{ marginTop: 14, border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', background: `${sec.color}14`, borderLeft: `4px solid ${sec.color}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <input type="checkbox" checked={exportSel.includes(i)} onChange={() => setExportSel(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} title="Incluir este bloque al exportar / imprimir" style={{ width: 17, height: 17, cursor: 'pointer', accentColor: sec.color, flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--light-text)' }}>{sec.icon} {sec.title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--medium-gray)', marginTop: 2 }}>{sec.sub}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 20, fontWeight: 900, color: sec.color, whiteSpace: 'nowrap' }}>{fmtEur(sec.subtotal)}</div>
                                </div>
                                {sec.rows.length > 0 && (sec.detailed ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                                        <thead>
                                            <tr style={{ color: 'var(--medium-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, borderTop: '1px solid var(--border-light)' }}>
                                                <th style={{ padding: '7px 16px 7px 32px', textAlign: 'left', fontWeight: 700 }}>Concepto</th>
                                                <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{sec.udsLabel || 'Ventas'}</th>
                                                <th style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>Objetivo</th>
                                                <th style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700 }}>Tramo de cobro</th>
                                                <th style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 700, width: 120 }}>Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sec.rows.map((r: any, j: number) => { const dk = `${i}-${j}`; const hasD = r.drill && r.drill.length > 0; return (
                                                <React.Fragment key={j}>
                                                <tr onClick={() => { if (!hasD) return; if (drillKey === dk) { setDrillKey(null) } else { setDrillKey(dk); setDrillComercial(null); setDrillSearch('') } }} style={{ borderTop: '1px solid var(--border-light)', backgroundColor: drillKey === dk ? 'rgba(14,165,233,0.07)' : (r.ok ? 'transparent' : 'rgba(239,68,68,0.06)'), cursor: hasD ? 'pointer' : 'default' }}>
                                                    <td style={{ padding: '9px 16px 9px 32px', color: 'var(--light-text)', fontWeight: 600 }}>{hasD && <span style={{ color: 'var(--medium-gray)', marginRight: 5 }}>{drillKey === dk ? '▾' : '▸'}</span>}{r.label}</td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{r.uds}</td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{r.obj}</td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                        <span style={{ color: 'var(--light-text)' }}>{r.tramos}</span>
                                                        {r.estado && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: r.ok ? '#10b981' : '#ef4444' }}>· {r.estado}</span>}
                                                    </td>
                                                    <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 800, color: r.ok ? 'var(--light-text)' : '#ef4444', whiteSpace: 'nowrap' }}>{fmtEur(r.eur)}</td>
                                                </tr>
                                                {drillKey === dk && hasD && renderDrill(r.drill, r.source, 5)}
                                                </React.Fragment>
                                            )})}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                        <tbody>
                                            {sec.rows.map((r: any, j: number) => { const dk = `${i}-${j}`; const hasD = r.drill && r.drill.length > 0; return (
                                                <React.Fragment key={j}>
                                                <tr onClick={() => { if (!hasD) return; if (drillKey === dk) { setDrillKey(null) } else { setDrillKey(dk); setDrillComercial(null); setDrillSearch('') } }} style={{ borderTop: '1px solid var(--border-light)', backgroundColor: drillKey === dk ? 'rgba(14,165,233,0.07)' : 'transparent', cursor: hasD ? 'pointer' : 'default' }}>
                                                    <td style={{ padding: '9px 16px 9px 32px', color: 'var(--light-text)' }}>{hasD && <span style={{ color: 'var(--medium-gray)', marginRight: 5 }}>{drillKey === dk ? '▾' : '▸'}</span>}{r.label}</td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{r.uds != null ? `${r.uds} uds` : ''}</td>
                                                    <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', whiteSpace: 'nowrap', width: 130 }}>{fmtEur(r.eur)}</td>
                                                </tr>
                                                {drillKey === dk && hasD && renderDrill(r.drill, r.source, 3)}
                                                </React.Fragment>
                                            )})}
                                        </tbody>
                                    </table>
                                ))}
                            </div>
                        ))}

                        <div style={{ marginTop: 18, padding: '18px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 20px -6px rgba(16,185,129,0.5)' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>TOTAL A COBRAR DE TELEFÓNICA / O2</div>
                            <div style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{fmtEur(granTotal)}</div>
                        </div>
                        <p style={{ margin: '10px 4px 0', fontSize: 11.5, color: 'var(--medium-gray)' }}>
                            "Tiendas Movistar" y "O2" = comisiones por venta · "MovilFree" = margen propio de la tienda · "PRV Territorial" = bonos por volumen/palancas.
                        </p>
                    </div>
                </div>
            </>
        )
    }

    // ── Cuadro de Comisiones Comerciales: comisión FINALIZADA por comercial (datos del Panel de Comisiones) ──
    const renderComisionesComerciales = () => {
        const fmtEur = (v: number) => (v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
        const loadingC = (comisionesData as any)?.loading
        const estadoVenta = (s: any) => {
            const a = String(s.anulado || '').toLowerCase().trim()
            if (a === 'si' || a === 'sí' || String(s.pendiente || '').toLowerCase().trim() === 'anulado') return 'NULL'
            return String(s.pendiente || '').toLowerCase().trim() === 'si' ? 'PED' : 'OK'
        }
        const stats = (((comisionesData as any)?.sellerStats as any[]) || [])
            .map((s: any) => {
                const gComis = s.groupComisions || {}
                const gCounts = s.groupCounts || {}
                const gPend = s.groupPending || {}
                const gCons = s.groupIsConsolidado || {}
                const gs = s.groupSales || {}
                // Comisión FINALIZADA por palanca: SOLO las ventas finalizadas cuentan (las pendientes NO),
                // y solo si la palanca tiene el objetivo alcanzado. Se reparte la comisión total por la
                // fracción finalizada: comTotal × (finalizadas / (finalizadas+pendientes)).
                // Ej. Nuria Alta BAF Total: 18 uds (14 fin + 4 pend) a 6€ = 108€ -> finalizada = 108×14/18 = 84€.
                const palancas = Object.keys(gComis)
                    .map((k: string) => {
                        const comTotal = gComis[k] || 0
                        const fin = gCounts[k] || 0
                        const pend = gPend[k] || 0
                        const denom = fin + pend
                        const eur = (gCons[k] && comTotal > 0) ? (denom > 0 ? comTotal * (fin / denom) : comTotal) : 0
                        return { name: k, eur, sales: (gs[k] || []).filter((v: any) => estadoVenta(v) === 'OK') }
                    })
                    .filter((p: any) => p.eur > 0.01)
                    .sort((a: any, b: any) => b.eur - a.eur)
                // "Otros" = incentivos FINALIZADOS (extras sellerReward>0, no pendientes) + O2 de otras tiendas (9€/ud, solo finalizadas)
                const extrasRows = (s.rawExtras || [])
                    .filter((e: any) => (e.sellerRewardAmount || 0) > 0.001 && e.status !== 'PENDING')
                    .map((e: any) => ({
                        fecha: e.createdAt ? new Date(e.createdAt).toLocaleDateString('es-ES') : '-',
                        nif: e.customerName || e.customerNif || '-',
                        producto: e.rule?.name || e.ruleName || 'Incentivo',
                        codigo: 'INCENTIVO',
                        cuota: e.sellerRewardAmount || 0,
                        estado: 'OK',
                    }))
                const o2OtrasRows = (s.o2OtrasSales || [])
                    .filter((v: any) => estadoVenta(v) === 'OK')
                    .map((v: any) => ({
                        fecha: v.fecha || '-',
                        nif: v.nif || '-',
                        producto: `O2 MovilFree (otra tienda)${v.producto ? ' — ' + v.producto : ''}`,
                        codigo: v.codigo || 'O2',
                        cuota: 9,
                        estado: 'OK',
                    }))
                const otrosTotal = extrasRows.reduce((a: number, r: any) => a + (r.cuota || 0), 0) + o2OtrasRows.length * 9
                if (otrosTotal > 0.01) palancas.push({ name: 'Otros (incentivos / O2 otras tiendas)', eur: otrosTotal, sales: [...extrasRows, ...o2OtrasRows] })
                const finalized = palancas.reduce((a: number, p: any) => a + p.eur, 0)
                const pending = Math.max(0, (s.totalComision || 0) - finalized)
                return { name: s.name, profile: s.profile, finalized, pending, ventas: s.totalSales || 0, palancas }
            })
            .filter((s: any) => s.finalized > 0.01 || s.pending > 0.01 || s.ventas > 0)
            .sort((a: any, b: any) => b.finalized - a.finalized)
        const totalFinalized = stats.reduce((a: number, s: any) => a + s.finalized, 0)
        const totalPending = stats.reduce((a: number, s: any) => a + s.pending, 0)

        const exportExcelCC = async () => {
            const wb = new ExcelJS.Workbook()
            const ws = wb.addWorksheet('Comisiones Comerciales')
            const t = ws.addRow([`COMISIONES COMERCIALES (FINALIZADAS)${activePeriodObj?.name ? ` · ${activePeriodObj.name}` : ''}`]); t.font = { bold: true, size: 14 }
            ws.addRow([`Comisión finalizada de cada comercial (Panel de Comisiones) · generado ${new Date().toLocaleString('es-ES')}`]); ws.addRow([])
            const h = ws.addRow(['Comercial', 'Perfil', 'Ventas', 'Comisión finalizada', 'Pendiente']); h.font = { bold: true }
            stats.forEach((s: any) => { const r = ws.addRow([s.name, s.profile, s.ventas, s.finalized, s.pending]); r.getCell(4).numFmt = '#,##0.00 €'; r.getCell(5).numFmt = '#,##0.00 €' })
            const tot = ws.addRow(['TOTAL', '', '', totalFinalized, totalPending]); tot.font = { bold: true, size: 12 }; tot.getCell(4).numFmt = '#,##0.00 €'; tot.getCell(5).numFmt = '#,##0.00 €'
            ws.columns.forEach((c: any, i: number) => { c.width = i === 0 ? 22 : (i >= 3 ? 18 : 12) })
            const buf = await wb.xlsx.writeBuffer(); const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Comisiones_Comerciales_${activePeriodObj?.name || activePeriodKey || 'mes'}.xlsx`; a.click(); window.URL.revokeObjectURL(url)
        }
        const escC = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const openPrintCC = () => {
            const rows = stats.map((s: any) => `<tr><td>${escC(s.name)}</td><td>${escC(s.profile)}</td><td class=c>${s.ventas}</td><td class=r>${escC(fmtEur(s.finalized))}</td><td class=r style="color:#888">${s.pending > 0 ? escC(fmtEur(s.pending)) : '—'}</td></tr>`).join('')
            const html = `<!doctype html><html lang=es><head><meta charset=utf-8><title>Comisiones Comerciales</title><style>*{font-family:Arial,Helvetica,sans-serif}body{margin:24px;color:#1f2937}h1{font-size:18px;margin:0 0 2px}.meta{color:#6b7280;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:7px 12px;border-bottom:1px solid #eee;text-align:left}th{color:#6b7280;font-size:11px;text-transform:uppercase}.r{text-align:right}.c{text-align:center}tfoot td{font-weight:bold;border-top:2px solid #333}</style></head><body><h1>Comisiones Comerciales — finalizadas${escC(activePeriodObj?.name ? ` · ${activePeriodObj.name}` : '')}</h1><div class=meta>Comisión finalizada de cada comercial (Panel de Comisiones) · generado ${escC(new Date().toLocaleString('es-ES'))}</div><table><thead><tr><th>Comercial</th><th>Perfil</th><th class=c>Ventas</th><th class=r>Comisión finalizada</th><th class=r>Pendiente</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>TOTAL</td><td></td><td></td><td class=r>${escC(fmtEur(totalFinalized))}</td><td class=r>${escC(fmtEur(totalPending))}</td></tr></tfoot></table></body></html>`
            const w = window.open('', '_blank', 'width=900,height=700'); if (!w) { alert('Activa las ventanas emergentes para PDF / Imprimir.'); return }
            w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) { } }, 350)
        }
        const ccBtn: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: 'var(--medium-gray)', minWidth: 70 }

        return (
            <>
                <BackButton />
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.03))', borderBottom: '1px solid var(--border-color)' }}>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--light-text)' }}>✅ Cuadro de Comisiones Comerciales — FINALIZADAS{activePeriodObj?.name ? ` · ${activePeriodObj.name}` : ''}</h2>
                        <p style={{ margin: '6px 0 0 0', fontSize: 13, color: 'var(--medium-gray)', lineHeight: 1.5 }}>
                            <strong>Lo que cobra cada comercial</strong> este mes, ya <strong>finalizado</strong> (consolidado). Es el mismo dato del <strong>Panel de Comisiones</strong>. Lo <strong>pendiente</strong> (PED) se muestra aparte en gris y NO suma al total. 💡 <strong>Pulsa un comercial</strong> para ver <strong>solo las palancas que cobra</strong>; <strong>pulsa una palanca</strong> para ver sus <strong>ventas</strong>.
                        </p>
                    </div>
                    <div style={{ padding: '12px 16px 16px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 12px', border: '1px dashed var(--border-color)', borderRadius: 10, background: 'var(--bg-hover)' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--light-text)', marginRight: 4 }}>Exportar / Imprimir:</span>
                            <button onClick={exportExcelCC} style={ccBtn} title="Exportar a Excel"><svg width="22" height="22" viewBox="0 0 24 24"><rect x="2.5" y="3" width="19" height="18" rx="2.5" fill="#16a34a" /><path d="M6.5 8l4.5 8M11 8l-4.5 8" stroke="#fff" strokeWidth="1.7" /><path d="M14 8.5h5.5M14 12h5.5M14 15.5h5.5" stroke="#fff" strokeWidth="1.5" /></svg><span>Excel</span></button>
                            <button onClick={openPrintCC} style={ccBtn} title="Exportar a PDF (en el diálogo elige 'Guardar como PDF')"><svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="2.5" width="18" height="19" rx="2.5" fill="#E2483D" /><text x="12" y="15.5" fontSize="7" fontWeight="bold" fill="#fff" textAnchor="middle" fontFamily="Arial">PDF</text></svg><span>PDF</span></button>
                            <button onClick={openPrintCC} style={ccBtn} title="Imprimir"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.7"><path d="M6 9V3.5h12V9" /><rect x="3" y="9" width="18" height="8" rx="1.5" fill="#dbeafe" /><rect x="6.5" y="13.5" width="11" height="6.5" fill="#fff" /></svg><span>Imprimir</span></button>
                        </div>
                        {loadingC ? (
                            <div style={{ padding: 30, textAlign: 'center', color: 'var(--medium-gray)' }}>Cargando comisiones del Panel…</div>
                        ) : stats.length === 0 ? (
                            <div style={{ padding: 30, textAlign: 'center', color: 'var(--medium-gray)' }}>No hay comisiones para este periodo.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                <thead>
                                    <tr style={{ color: 'var(--medium-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                        <th style={{ padding: '8px 14px', textAlign: 'left' }}>Comercial</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Ventas</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Pendiente</th>
                                        <th style={{ padding: '8px 16px', textAlign: 'right' }}>Comisión finalizada</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.map((s: any, i: number) => { const cOpen = openComercial === s.name; return (
                                        <React.Fragment key={i}>
                                        <tr onClick={() => { setOpenComercial(cOpen ? null : s.name); setOpenPalanca(null) }} style={{ borderTop: '1px solid var(--border-light)', cursor: 'pointer', background: cOpen ? 'rgba(16,185,129,0.07)' : 'transparent' }}>
                                            <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--light-text)' }}><span style={{ color: 'var(--medium-gray)', marginRight: 6 }}>{cOpen ? '▾' : '▸'}</span>{s.name} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--medium-gray)' }}>· {s.profile}</span></td>
                                            <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{s.ventas}</td>
                                            <td style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{s.pending > 0 ? fmtEur(s.pending) : '—'}</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>{fmtEur(s.finalized)}</td>
                                        </tr>
                                        {cOpen && (s.palancas.length === 0 ? (
                                            <tr><td colSpan={4} style={{ padding: '8px 16px 8px 40px', color: 'var(--medium-gray)', fontSize: 12.5, background: 'rgba(0,0,0,0.02)' }}>Este comercial no tiene palancas que cobrar este mes.</td></tr>
                                        ) : s.palancas.map((p: any, j: number) => { const pkey = `${s.name}|${p.name}`; const pOpen = openPalanca === pkey; const hasSales = p.sales && p.sales.length > 0; return (
                                            <React.Fragment key={j}>
                                            <tr onClick={() => hasSales && setOpenPalanca(pOpen ? null : pkey)} style={{ borderTop: '1px solid var(--border-light)', background: pOpen ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.02)', cursor: hasSales ? 'pointer' : 'default' }}>
                                                <td colSpan={3} style={{ padding: '8px 12px 8px 40px', fontSize: 13, color: 'var(--light-text)', fontWeight: 600 }}>{hasSales && <span style={{ color: 'var(--medium-gray)', marginRight: 6 }}>{pOpen ? '▾' : '▸'}</span>}{p.name}{hasSales ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--medium-gray)' }}> · {p.sales.length} {p.sales.length === 1 ? 'venta' : 'ventas'}</span> : null}</td>
                                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)', whiteSpace: 'nowrap' }}>{fmtEur(p.eur)}</td>
                                            </tr>
                                            {pOpen && hasSales && (
                                                <tr><td colSpan={4} style={{ padding: 0, background: 'rgba(0,0,0,0.035)' }}>
                                                    <div style={{ padding: '6px 16px 12px 52px', overflowX: 'auto' }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 620 }}>
                                                            <thead><tr style={{ color: 'var(--medium-gray)', fontSize: 10.5, textTransform: 'uppercase' }}>
                                                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Fecha</th><th style={{ padding: '5px 8px', textAlign: 'left' }}>Cliente (NIF)</th>
                                                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Producto</th><th style={{ padding: '5px 8px', textAlign: 'left' }}>Tienda</th>
                                                                <th style={{ padding: '5px 8px', textAlign: 'right' }}>Cuota</th><th style={{ padding: '5px 8px', textAlign: 'center' }}>Estado</th>
                                                            </tr></thead>
                                                            <tbody>
                                                                {p.sales.map((v: any, k: number) => { const est = estadoVenta(v); return (
                                                                    <tr key={k} style={{ borderTop: '1px solid var(--border-light)', background: est === 'NULL' ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                                                                        <td style={{ padding: '5px 8px', color: 'var(--medium-gray)', whiteSpace: 'nowrap' }}>{v.fecha || '-'}</td>
                                                                        <td style={{ padding: '5px 8px', color: 'var(--light-text)' }}>{v.nif || '-'}</td>
                                                                        <td style={{ padding: '5px 8px', color: 'var(--light-text)' }}>{v.producto || '-'}</td>
                                                                        <td style={{ padding: '5px 8px', color: 'var(--medium-gray)' }}>{v.codigo || '-'}</td>
                                                                        <td style={{ padding: '5px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{v.cuota != null && v.cuota !== '' ? fmtEur(parseFloat(String(v.cuota).replace(',', '.')) || 0) : '-'}</td>
                                                                        <td style={{ padding: '5px 8px', textAlign: 'center' }}><span style={{ fontSize: 10.5, fontWeight: 800, color: est === 'OK' ? '#10b981' : est === 'PED' ? '#f59e0b' : '#ef4444' }}>{est}</span></td>
                                                                    </tr>
                                                                )})}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td></tr>
                                            )}
                                            </React.Fragment>
                                        )}))}
                                        </React.Fragment>
                                    )})}
                                </tbody>
                            </table>
                        )}
                        <div style={{ marginTop: 16, padding: '16px 22px', borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 20px -6px rgba(16,185,129,0.5)' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>TOTAL COMISIONES FINALIZADAS{totalPending > 0 ? ` (pendiente aparte: ${fmtEur(totalPending)})` : ''}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{fmtEur(totalFinalized)}</div>
                        </div>
                    </div>
                </div>
            </>
        )
    }

    const renderMenu = () => {
        const menuCardsRaw = [
            {
                title: 'Operaciones Realizadas en Tiendas',
                description: 'Listado detallado de registro de ventas, cuotas, estados y comisiones finales.',
                icon: BarChart2,
                image: '/nx-op-realizadas.png',
                view: 'operaciones' as ViewType
            },
            {
                title: 'Comisiones Tiendas y FFVV v3',
                description: 'Tabla integrada para gestionar dietas, km, incentivos y cruce de datos O2 (Excel).',
                icon: ClipboardList,
                image: '/nx-comisiones-ffvv.png',
                view: 'comisiones_v3' as ViewType
            },
            {
                title: 'Operaciones por Grupo Cliente',
                description: 'Análisis consolidado de ventas agrupadas por NIF/CIF y producto — secciones Plus y Básico.',
                icon: Users,
                image: '/nx-grupo-cliente.png',
                href: '/operaciones-grupo-cliente'
            },

            {
                title: 'Rentabilidad por Tiendas',
                description: 'Visión agrupada de personal, ventas y rentabilidad segmentada por tienda.',
                icon: Briefcase,
                image: '/nx-rentabilidad-tiendas.png',
                href: '/liquidacion/rentabilidad-tiendas'
            },
            
            {
                title: 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree',
                description: 'Hoja de cobro consolidada: qué nos debe pagar Telefónica/O2 por cada pata, desglosado y con subtotales.',
                icon: TrendingUp,
                image: '/rentabilidad-total.png',
                view: 'rentabilidad_total' as ViewType
            },
            {
                title: 'Cuadro de Comisiones Comerciales',
                description: 'Control de comisiones y objetivos mensuales integrados. Comisiones reales de Tiendas, solo de operaciones finalizadas.',
                icon: TrendingUp,
                image: '/comisiones-comerciales.png',
                view: 'comisiones_comerciales' as ViewType
            }
        ];

        const renderCard = (c: any) => {
            const Icon = c.icon;
            if (c.image) {
                return (
                    <div
                        key={c.title}
                        className="premium-card"
                        onClick={() => c.href ? router.push(c.href) : setCurrentView(c.view)}
                        style={{ position: 'relative', cursor: 'pointer', padding: 0, overflow: 'hidden', borderLeft: '5px solid #0ea5e9', display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 150 }}
                    >
                        <div aria-hidden="true" style={{ width: 140, minWidth: 140, alignSelf: 'stretch', backgroundImage: `url(${c.image})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#0b2a4a' }} />
                        <div style={{ flex: 1, padding: '16px 6px 16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                            <h3 className="card-title" style={{ margin: 0 }}>{c.title}</h3>
                            <p className="card-desc" style={{ margin: '6px 0 0 0' }}>{c.description}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: '#0ea5e9', fontSize: 26, fontWeight: 700 }}>›</div>
                    </div>
                );
            }
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

        const brownCards = menuCardsRaw.filter(c => c.title === 'Operaciones Realizadas en Tiendas' || c.title === 'Operaciones por Grupo Cliente' || c.title === 'Comisiones Tiendas y FFVV v3');
        const blueCards = menuCardsRaw.filter(c => c.title === 'Rentabilidad por Tiendas' || c.title === 'Rentabilidad Total de Tiendas Movistar/O2/Movilfree' || c.title === 'Cuadro de Comisiones Comerciales');
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
        // Delegado en la fuente única lib/saleCommission (misma lógica que antes,
        // sin el +15 de Swap, que lo añade getCommission más abajo).
        const getCommissionBase = (sale: any) => getSaleCommissionBase(sale, {
            catalogs,
            dashRowsPlus: pymeData.rows,
            dashRowsBasico: captadorData.rows,
            viewingPeriod: activePeriodObj
                ? `${activePeriodObj.year}${String(activePeriodObj.month).padStart(2, '0')}`
                : getCurrentMonthString(),
        });

        // La empresa cobra 15€ extra por cada Swap (venta con ¿Swap? marcado), además de la comisión normal de la operación
        const getCommission = (sale: any) => getCommissionBase(sale) + (sale.isSwap === true ? 15 : 0);

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

        // ── Filas-resumen EN VIVO (mismo motor que Resumen MOD / Operaciones por Grupo Cliente).
        // Usa salesRaw (sin sanitizeSale) para que el territorial/O2 no salga descuadrado. ──
        const viewingPeriodLiq = activePeriodKey ? activePeriodKey.replace('_', '') : ''
        const bonosO2Live = computeBonosO2(salesRaw, territorialO2Rules)
        const territorialTiendasLive = computeTerritorialTotal({ sales: salesRaw, territorialRules: territorialTiendasRules, catalogs, viewingPeriod: viewingPeriodLiq } as any)
        const movilFreeLive = (() => {
            const [yStr, mStr] = String(activePeriodKey || '').split('_')
            const y = Number(yStr), m = Number(mStr)
            if (!y || !m) return 0
            return movilFreeSales
                .filter((s: any) => { const d = new Date(s.fechaVenta); return s.estado === 'COMPLETADA' && d.getFullYear() === y && (d.getMonth() + 1) === m })
                .reduce((acc: number, s: any) => {
                    try {
                        const list = JSON.parse(s.listaProductos)
                        const cost = list.reduce((cAcc: number, item: any) => {
                            const prodCost = item.coste !== undefined ? item.coste : (movilFreeProducts.find((p: any) => p.id === item.id)?.coste || 0)
                            return cAcc + (prodCost * item.cantidad)
                        }, 0)
                        return acc + ((s.importeTotal / 1.21) - cost)
                    } catch (e) { return acc }
                }, 0)
        })()

        const liveSummaryExtras = ([
            { name: 'PRV Territorial O2', amount: bonosO2Live },
            { name: 'MovilFree (margen)', amount: movilFreeLive },
            { name: 'PRV Territorial Tiendas', amount: territorialTiendasLive },
        ] as any[])
            .filter(r => r.amount)
            .map(r => ({ id: `__live_${r.name}`, seller: 'MicroShop', customerNif: 'TERRITORIAL', customerName: r.name, telecomRewardAmount: r.amount, sellerRewardAmount: 0, status: 'LIQUIDATED', createdAt: new Date().toISOString(), rule: { name: r.name } }))

        // activeExtras = extras reales SIN el Bono Territorial O2 persistido (stale) + las 3 en vivo.
        const activeExtras = [
            ...extraAssignments.filter(ea => {
                if (ea.status === 'CANCELLED') return false
                const isTerrO2 = String(ea.customerNif) === 'TERRITORIAL' || String(ea.rule?.name || '').toUpperCase().includes('TERRITORIAL O2')
                return !isTerrO2
            }),
            ...liveSummaryExtras
        ]

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
                <div className="tabla-movil-wrap" style={{ overflowX: 'auto' }}>
                    <table className="tabla-liquidacion-compacta tabla-movil" style={{ minWidth: 900, width: '100%', borderCollapse: 'collapse' }}>
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

                /* ─── MÓVIL: tablas densas usables (1ª columna fija + cabecera pegajosa) ─── */
                @media (max-width: 767px) {
                    .tabla-movil-wrap {
                        max-height: 70vh;
                        overflow: auto;
                        -webkit-overflow-scrolling: touch;
                        border-radius: 12px;
                    }
                    /* Una regla global pone las tablas en display:block; overflow:auto
                       (scroll propio), lo que ancla el sticky a la tabla y no al wrap.
                       Devolvemos la tabla a display:table para que el contenedor que
                       desliza sea .tabla-movil-wrap y el sticky funcione. Además
                       border-collapse:collapse rompe el sticky en Chromium → separate. */
                    .tabla-movil {
                        display: table !important;
                        overflow: visible !important;
                        border-collapse: separate !important;
                        border-spacing: 0 !important;
                    }
                    /* Cabecera pegada arriba al hacer scroll vertical */
                    .tabla-movil thead th {
                        position: sticky;
                        top: 0;
                        z-index: 3;
                        background: var(--bg-card) !important;
                    }
                    /* Primera columna pegada a la izquierda al deslizar en horizontal */
                    .tabla-movil th:first-child,
                    .tabla-movil td:first-child {
                        position: sticky;
                        left: 0;
                        z-index: 2;
                        background: var(--bg-card) !important;
                        box-shadow: 2px 0 5px rgba(0,0,0,0.18);
                    }
                    /* La esquina superior-izquierda manda sobre ambas */
                    .tabla-movil thead th:first-child {
                        z-index: 4;
                    }
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
            {currentView === 'rentabilidad_total' && renderRentabilidadTotal()}
            {currentView === 'comisiones_comerciales' && renderComisionesComerciales()}
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
