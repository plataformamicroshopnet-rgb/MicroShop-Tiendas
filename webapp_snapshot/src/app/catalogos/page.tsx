'use client'
import ComisionesO2Tab from './ComisionesO2Tab'

import { useEffect, useState, useRef } from 'react'
import { Save, Search, Plus, Trash2, FileText, AlertCircle, Target, Euro, Box, ChevronLeft, Lock } from 'lucide-react'
import Link from 'next/link'
import ObjetivosTab from './ObjetivosTab'
import ProductosComisionanTab from './ProductosComisionanTab'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'
import { PeriodSelector } from '@/components/PeriodSelector'
import { PageHeader } from '@/components/PageHeader'

// ── Tooltip Personalizado (Auto-posicionado) ────────────────────────────────
function TooltipBox({ title, content, children, position }: {
  title: string
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' // ahora es solo una sugerencia; se auto-detecta
}) {
  const [show, setShow] = useState(false)
  const [above, setAbove] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      // Si el botón está en el tercio superior de la pantalla, mostramos abajo; si está abajo, arriba
      setAbove(rect.top > window.innerHeight * 0.55)
    }
    setShow(true)
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute',
          ...(above
            ? { bottom: 'calc(100% + 10px)' }
            : { top: 'calc(100% + 10px)' }),
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          padding: '16px 18px',
          width: 290,
          zIndex: 9999,
          pointerEvents: 'none',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ color: '#0099cc', fontWeight: 700, fontSize: 14, marginBottom: 8, lineHeight: 1.3 }}>{title}</div>
          <div style={{ color: '#111827', fontSize: 13, lineHeight: 1.65 }}>{content}</div>
        </div>
      )}
    </div>
  )
}

type ProductItem = {
  id: string
  producto: string
  subcategoria?: string
  fabricante?: string
  gama?: string
  cuota?: number | string
  cuotaMensual?: number | string
  cuotaAnual?: number | string
  validFrom?: string
  validTo?: string
  comision?: number | string
  comisionConCoste?: number | string
  importStatus?: 'new' | 'updated' | 'missing' | 'unchanged'
}

const CATEGORIES = ['Fija y Móvil', 'Ti', 'Rent', 'Seguro', 'O2', 'miMovistar', 'Suscripciones TV', 'Prepago', 'Varios', 'Repos', 'Resto BAF']

export default function CatalogosPage() {
  const { authorized } = useGuard('MODULE_ADMIN', 'MANAGE_CATALOG')
  const { activePeriodKey, availablePeriods, isLoadingPeriods } = usePeriod()

  // Encontrar estado del periodo maestro
  const activePeriodObj = availablePeriods.find(p => p.period_key === activePeriodKey)
  const isHistoric = activePeriodObj?.status === 'HISTORIC'
  
  // Computar periodo previo cronológicamente
  const sortedPeriods = [...availablePeriods].sort((a, b) => {
     if (a.year !== b.year) return a.year - b.year
     return a.month - b.month
  })
  const currentIndex = sortedPeriods.findIndex(p => p.period_key === activePeriodKey)
  const previousPeriod = currentIndex > 0 ? sortedPeriods[currentIndex - 1] : null

  const [catalogs, setCatalogs] = useState<Record<string, ProductItem[]>>({
    "Fija y Móvil": [], "Ti": [], "Rent": [], "Seguro": [], "O2": [], "miMovistar": [], "Suscripciones TV": [], "Prepago": [], "Varios": [], "Repos": [], "Resto BAF": []
  })
  const [activeTab, setActiveTab] = useState('Fija y Móvil')
  const isProductTab = CATEGORIES.includes(activeTab) && activeTab !== 'Objetivos Tiendas' && activeTab !== 'Comisiones O2 y MovilFree' && activeTab !== 'Objetivos Captador' && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)

  // Fetch from API
  useEffect(() => {
    if (!activePeriodKey) return
    setLoading(true)
    fetch(`/api/catalogs?periodKey=${activePeriodKey}&strictPeriod=1`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const mapped: Record<string, ProductItem[]> = { "Fija y Móvil": [], "Ti": [], "Rent": [], "Seguro": [], "O2": [], "miMovistar": [], "Suscripciones TV": [], "Prepago": [], "Varios": [], "Repos": [], "Resto BAF": [] }
          for (const [cat, items] of Object.entries(data.catalogs as Record<string, any[]>)) {
             if (!mapped[cat]) mapped[cat] = [];
             mapped[cat] = [...mapped[cat], ...items.map((it: any) => ({
                 ...it,
                 id: it.id || String(Math.random()),
                 cuota: cat === 'Ti' ? String(it.mensual || it.cuota || '') : Number(String(it.mensual || it.cuota || 0).replace(',','.')),
                 cuotaMensual: cat === 'Ti' ? String(it.mensual || '') : Number(String(it.mensual || 0).replace(',','.')),
                 cuotaAnual: cat === 'Ti' ? String(it.anual || '') : Number(String(it.anual || 0).replace(',','.')),
                 subcategoria: it.subcategoria || '',
                 fabricante: it.fabricante || '',
                 gama: it.gama || '',
                 validFrom: it.validFrom || '',
                 validTo: it.validTo || '',
                 comision: it.comision || '',
                 comisionConCoste: it.comisionConCoste || ''
             }))]
          }
          setCatalogs(mapped)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activePeriodKey])

  const handleSave = async () => {
    if (isHistoric) return alert('No se puede modificar un catálogo histórico.')
    
    // VALIDACIÓN DE SOLAPAMIENTOS PREVIA AL GUARDADO
    // Helper to parse dates simply for sorting and boundary checks (dd/mm/yyyy)
    const pDate = (d: string | null | undefined, isEnd = false) => {
      if (!d || !d.trim()) return isEnd ? 99999999 : 0; // null/empty = Infinity for End, 0 for Start
      const parts = d.split('/');
      if (parts.length === 3) {
         return parseInt(parts[2])*10000 + parseInt(parts[1])*100 + parseInt(parts[0]);
      }
      return isEnd ? 99999999 : 0;
    }

    const exportCatalogs: Record<string, any[]> = {}
    for (const [cat, items] of Object.entries(catalogs)) {
       
       // Agrupamos para validar colisiones de fecha
       const byProduct: Record<string, any[]> = {};
       
       exportCatalogs[cat] = items
         .filter(it => it.importStatus !== 'missing') // AUTO-DELETE: Ignorar productos obsoletos
         .map(it => {
          let pName = String(it.producto).trim().toLowerCase();
          
          // Generate a composite key for specific categories where name alone isn't unique
          if (cat === 'miMovistar' || cat === 'Resto BAF') {
            pName = `${String(it.subcategoria).trim().toLowerCase()}_${String(it.gama).trim().toLowerCase()}_${pName}`;
          } else if (cat === 'Rent') {
            pName = `${String(it.fabricante).trim().toLowerCase()}_${String(it.subcategoria).trim().toLowerCase()}_${String(it.gama).trim().toLowerCase()}_${pName}`;
          } else if (cat === 'O2') {
            pName = `${String(it.subcategoria).trim().toLowerCase()}_${pName}`;
          }

          if (!byProduct[pName]) byProduct[pName] = [];
          
          const expItem = {
             producto: it.producto,
             mensual: String(it.cuotaMensual !== undefined ? it.cuotaMensual : (it.cuota || '')),
             anual: String(it.cuotaAnual || ''),
             subcategoria: it.subcategoria || '',
             fabricante: it.fabricante || '',
             gama: it.gama || '',
             validFrom: it.validFrom || null,
             validTo: it.validTo || null,
             comision: it.comision || '',
             comisionConCoste: it.comisionConCoste || ''
          }
          byProduct[pName].push(expItem);
          return expItem;
       })

       // Revisar cada producto con múltiples vigencias
       for (const [pName, variations] of Object.entries(byProduct)) {
          if (variations.length > 1) {
             for (let i = 0; i < variations.length; i++) {
                for (let j = i + 1; j < variations.length; j++) {
                   const startA = pDate(variations[i].validFrom, false);
                   const endA = pDate(variations[i].validTo, true);
                   const startB = pDate(variations[j].validFrom, false);
                   const endB = pDate(variations[j].validTo, true);

                   // Condition for overlap: StartA <= EndB AND EndA >= StartB
                   if (startA <= endB && endA >= startB) {
                      setSaving(false);
                      return alert(`❌ ERROR DE SOLAPAMIENTO:\nEl producto "${variations[i].producto}" en "${cat}" tiene vigencias bloqueadas por chocar entre sí.\nPor favor, corrige las fechas de Inicio y Fin asegurando que no se crucen ningún día.`);
                   }
                }
             }
          }
       }
    }

    setSaving(true)
    try {
      const res = await fetch('/api/catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogs: exportCatalogs, periodKey: activePeriodKey })
      })
      const data = await res.json()
      if (data.success) {
        alert('✅ Catálogo del periodo guardado correctamente.')
        // REFRESH DATA to clear the colored import statuses
        const freshRes = await fetch(`/api/catalogs?periodKey=${activePeriodKey}&strictPeriod=1`)
        const freshData = await freshRes.json()
        if (freshData.success) {
            const mapped: Record<string, ProductItem[]> = {}
            for (const [cat, freshItems] of Object.entries(freshData.catalogs as Record<string, any[]>)) {
                mapped[cat] = freshItems.map((it: any) => ({
                    ...it,
                    id: String(Math.random()),
                    cuota: Number(String(it.mensual || it.cuota || 0).replace(',','.')),
                    cuotaMensual: Number(String(it.mensual || 0).replace(',','.')),
                    cuotaAnual: Number(String(it.anual || 0).replace(',','.')),
                    subcategoria: it.subcategoria || '',
                    fabricante: it.fabricante || '',
                    gama: it.gama || '',
                    validFrom: it.validFrom || '',
                    validTo: it.validTo || '',
                    comision: it.comision || '',
                    comisionConCoste: it.comisionConCoste || ''
                }))
            }
            setCatalogs(mapped)
        }
      } else {
        alert('❌ Error: ' + data.error)
      }
    } catch (e) {
      alert('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleCloneFromPrevious = async () => {
      if (isHistoric || !previousPeriod) return
      if (!window.confirm(`¿Seguro que quieres clonar todo el catálogo desde el periodo ${previousPeriod.period_key}?`)) return
      
      setLoading(true)
      try {
          // Fetch from old period explicitly
          const res = await fetch(`/api/catalogs?periodKey=${previousPeriod.period_key}&strictPeriod=1`)
          const data = await res.json()
          if (data.success) {
              const mapped: Record<string, ProductItem[]> = {}
              let totalItems = 0
              for (const [cat, items] of Object.entries(data.catalogs as Record<string, any[]>)) {
                  mapped[cat] = items.map((it: any) => ({
                      ...it,
                      id: String(Math.random()),
                      cuota: Number(String(it.mensual || it.cuota || 0).replace(',','.')),
                      cuotaMensual: Number(String(it.mensual || 0).replace(',','.')),
                      cuotaAnual: Number(String(it.anual || 0).replace(',','.')),
                      subcategoria: it.subcategoria || '',
                      fabricante: it.fabricante || '',
                      gama: it.gama || '',
                      validFrom: it.validFrom || '',
                      validTo: it.validTo || '',
                      comision: it.comision || '',
                      comisionConCoste: it.comisionConCoste || ''
                  }))
                  totalItems += items.length
              }
              if (totalItems === 0) {
                 alert('El mes anterior no tenía ningún producto cargado.')
                 return
              }
              setCatalogs(mapped) // Memory loading, zero persistence
              alert('✅ Catálogo clonado en memoria. Revisa los datos y pulsa "Guardar Cambios" para hacerlo definitivo.')
          }
      } catch(e) {
          alert("Error clonando catálogo.")
      } finally {
          setLoading(false)
      }
  }

  const handleImportLegacy = async () => {
    if (!confirm('¿Seguro que quieres cargar el catálogo base (Legacy Original) en esta pantalla?')) return
    
    setLoading(true)
    try {
        const res = await fetch(`/api/catalogs?legacyOnly=1`)
        const data = await res.json()
        if (data.success) {
            const mapped: Record<string, ProductItem[]> = { "Fija y Móvil": [], "Ti": [], "Rent": [], "Micro": [], "O2": [] }
            let totalItems = 0
            for (const [cat, items] of Object.entries(data.catalogs as Record<string, any[]>)) {
                if (!mapped[cat]) mapped[cat] = [];
                mapped[cat] = [...mapped[cat], ...items.map((it: any) => ({
                    ...it,
                    id: String(Math.random()),
                    cuota: Number(String(it.mensual || it.cuota || 0).replace(',','.')),
                    cuotaMensual: Number(String(it.mensual || 0).replace(',','.')),
                    cuotaAnual: Number(String(it.anual || 0).replace(',','.')),
                    subcategoria: it.subcategoria || '',
                    fabricante: it.fabricante || '',
                    gama: it.gama || '',
                    validFrom: it.validFrom || '',
                    validTo: it.validTo || '',
                    comision: it.comision || '',
                    comisionConCoste: it.comisionConCoste || ''
                }))]
                totalItems += items.length
            }
            if (totalItems === 0) {
               alert('El catálogo Legacy nativo está vacío en BD.')
               return
            }
            setCatalogs(mapped)
            alert('✅ Catálogo Legacy importado en memoria. Revisa los datos y pulsa "Guardar Cambios" para hacerlo definitivo.')
        }
    } catch(e) {
        alert("Error cargando catálogo legacy.")
    } finally {
        setLoading(false)
    }
  }

  const updateItem = (cat: string, index: number, field: keyof ProductItem, value: any) => {
    if (isHistoric) return
    setCatalogs(prev => {
      const currentArr = prev[cat] || []
      if (!currentArr[index]) return prev
      const newCat = [...currentArr]
      const item = { ...newCat[index], [field]: value }
      
      // Autocálculo TMA y Micro y Ti
      if (cat === 'Ti' || cat === 'Rent' || cat === 'Micro') {
        const factor = (cat === 'Rent' || cat === 'Micro') ? 24 : 12;
        if (field === 'cuotaMensual') {
          item.cuotaAnual = Math.round(Number(value) * factor * 100) / 100
        } else if (field === 'cuotaAnual') {
          item.cuotaMensual = Math.round((Number(value) / factor) * 100) / 100
        }
      }
      
      newCat[index] = item
      return { ...prev, [cat]: newCat }
    })
  }

  const addItem = (cat: string) => {
    setSearch('')
    setCatalogs(prev => {
      const newItem: ProductItem = { id: Date.now().toString(), producto: '', validFrom: '', validTo: '' }
      if (cat === 'Ti' || cat === 'Rent' || cat === 'Micro') {
        newItem.cuotaMensual = 0
        newItem.cuotaAnual = 0
        if (cat === 'Rent') {
           newItem.comision = ''
           newItem.comisionConCoste = ''
        }
      } else if (cat === 'O2') {
        newItem.subcategoria = ''
        newItem.comision = ''
      } else if (cat === 'miMovistar' || cat === 'Resto BAF') {
        newItem.subcategoria = ''
        newItem.gama = ''
        newItem.comision = 0
        newItem.comisionConCoste = 1
      } else if (cat === 'Suscripciones TV' || cat === 'Prepago') {
        newItem.comision = ''
      } else if (cat === 'Seguro' || cat === 'Varios') {
        newItem.subcategoria = ''
        newItem.comision = ''
        newItem.cuotaAnual = 0
      } else if (cat === 'Repos') {
        newItem.subcategoria = ''
        newItem.comision = ''
        newItem.comisionConCoste = ''
        newItem.cuotaAnual = 0
      } else {
        newItem.cuota = 0
      }
      const currentArr = prev[cat] || []
      return { ...prev, [cat]: [newItem, ...currentArr] }
    })
  }

  const dupItem = (cat: string, index: number) => {
    setCatalogs(prev => {
      const currentArr = prev[cat] || []
      if (!currentArr[index]) return prev
      const duplicated: ProductItem = { 
        ...currentArr[index], 
        id: Date.now().toString(),
        validFrom: '',
        validTo: ''
      }
      const newCat = [...currentArr]
      newCat.splice(index + 1, 0, duplicated)
      return { ...prev, [cat]: newCat }
    })
  }

  const removeItem = (cat: string, index: number) => {
    if (!confirm('¿Seguro que quieres borrar este producto?')) return
    setCatalogs(prev => {
      const newCat = [...(prev[cat] || [])]
      newCat.splice(index, 1)
      return { ...prev, [cat]: newCat }
    })
  }

  const handleBulkImport = () => {
    if (!bulkText.trim()) return

    // Preprocesar el texto para unificar saltos de línea dentro de comillas (típico de celdas multilínea en Excel)
    let cleanText = bulkText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let inQuotes = false;
    let normalizedText = '';
    for (let i = 0; i < cleanText.length; i++) {
      if (cleanText[i] === '"') {
        const isStartOfCell = i === 0 || cleanText[i-1] === '\t' || cleanText[i-1] === '\n';
        const isEndOfCell = i === cleanText.length - 1 || cleanText[i+1] === '\t' || cleanText[i+1] === '\n';
        
        if (!inQuotes && isStartOfCell) {
           inQuotes = true;
           continue; // skip the quote itself
        } else if (inQuotes && isEndOfCell) {
           inQuotes = false;
           continue; // skip the quote itself
        }
        // If it's a quote in the middle of a string (like 13"), we just leave it and don't toggle inQuotes
      } else if (cleanText[i] === '\n' && inQuotes) {
        normalizedText += '___NEWLINE___'; // Preserve internal newline
        continue;
      }
      normalizedText += cleanText[i];
    }
    
    // Limpiar comillas dobles internas escapadas por Excel ("")
    normalizedText = normalizedText.replace(/""/g, '"');

    // DEBUG: Send to backend so AI can see it
    fetch('/api/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: normalizedText })
    }).catch(e => console.error(e));

    const lines = normalizedText.split('\n').filter(l => l.trim().length > 0)
    
    const parseSpanishNumber = (str: string) => {
      let clean = str.replace(/[^0-9.,-]/g, '')
      if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.')
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.')
      }
      return clean || '0'
    }

    const excelData: any[] = []
    lines.forEach((line) => {
      const parts = line.split('\t').map(p => p.trim().replace(/___NEWLINE___/g, '\n'))
      if (parts.length > 0 && (parts[0] || (activeTab === 'miMovistar' && parts[2]))) {
        if (activeTab === 'Rent') {
          // Detectar si el usuario ha pegado el formato con las fechas en medio (después del producto)
          // Ejemplo: Fabricante | Categoria | Producto | Desde | Hasta | Gama | Cuota | Comision | Comision Coste
          const isDate = (s: string) => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test((s || '').trim());
          const isNewFormat = isDate(parts[3]) || isDate(parts[4]);

          if (isNewFormat) {
            excelData.push({
              fabricante: parts[0] || '',
              categoria: parts[1] || '',
              producto: parts[2] || '',
              desde: parts[3] || '',
              hasta: parts[4] || '',
              gama: parts[5] || '',
              amountAsStr: parts.length > 6 ? parseSpanishNumber(parts[6]) : '0',
              comision: parts.length > 7 ? parseSpanishNumber(parts[7]) : '',
              comisionConCoste: parts.length > 8 ? parseSpanishNumber(parts[8]) : '',
            })
          } else {
            excelData.push({
              fabricante: parts[0] || '',
              categoria: parts[1] || '',
              producto: parts[2] || '',
              gama: parts[3] || '',
              amountAsStr: parts.length > 4 ? parseSpanishNumber(parts[4]) : '0',
              comision: parts.length > 5 ? parseSpanishNumber(parts[5]) : '',
              comisionConCoste: parts.length > 6 ? parseSpanishNumber(parts[6]) : '',
              desde: parts.length > 7 ? parts[7] : '',
              hasta: parts.length > 8 ? parts[8] : '',
            })
          }
        } else if (activeTab === 'Ti') {
          let pDesc = '';
          let pAmt = '0';
          let pDesde = '';
          let pHasta = '';

          const tail = parts.slice(1);
          const isDate = (str: string) => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test((str || '').trim());
          const isMoney = (str: string) => str.includes('€') || /^\d/.test((str || '').trim());

          if (tail.length >= 4) {
             pDesc = tail[0];
             pAmt = tail[1];
             pDesde = tail[2];
             pHasta = tail[3];
          } else if (tail.length === 3) {
             if (isDate(tail[1]) || isDate(tail[2])) {
                pAmt = tail[0];
                pDesde = tail[1];
                pHasta = tail[2];
             } else {
                pDesc = tail[0];
                pAmt = tail[1];
                pDesde = tail[2];
             }
          } else if (tail.length === 2) {
             if (isDate(tail[1])) {
                pAmt = tail[0];
                pDesde = tail[1];
             } else if (isMoney(tail[0])) {
                pAmt = tail[0];
                pDesde = tail[1];
             } else {
                pDesc = tail[0];
                pAmt = tail[1];
             }
          } else if (tail.length === 1) {
             pAmt = tail[0];
          }

          excelData.push({
            producto: parts[0],
            descripcion: pDesc,
            amountAsStr: parseSpanishNumber(pAmt),
            desde: pDesde,
            hasta: pHasta,
          })
        } else if (activeTab === 'O2') {
          excelData.push({
            categoria: parts[0] || '',
            producto: parts[1] || '',
            amountAsStr: parts.length > 2 ? parseSpanishNumber(parts[2]) : '0',
            desde: parts.length > 3 ? parts[3] : '',
            hasta: parts.length > 4 ? parts[4] : '',
          })
        } else if (activeTab === 'Seguro' || activeTab === 'Varios') {
          excelData.push({
            categoria: parts[0] || '',
            producto: parts[1] || '',
            amountAsStr: parts.length > 2 ? parseSpanishNumber(parts[2]) : '0',
            comision: parts.length > 3 ? parseSpanishNumber(parts[3]) : '0',
            desde: parts.length > 4 ? parts[4] : '',
            hasta: parts.length > 5 ? parts[5] : '',
          })
        } else if (activeTab === 'Repos') {
          excelData.push({
            categoria: parts[0] || '',
            producto: parts[1] || '',
            amountAsStr: parts.length > 2 ? parseSpanishNumber(parts[2]) : '0', // Cuota Total
            comision: parts.length > 3 ? parseSpanishNumber(parts[3]) : '0', // Comisión Fija
            comisionConCoste: parts.length > 4 ? parseSpanishNumber(parts[4]) : '0', // Multiplicador
            // parts[5] es Comisión X que no guardamos (se calcula).
            desde: parts.length > 6 ? parts[6] : '',
            hasta: parts.length > 7 ? parts[7] : '',
          })
        } else if (activeTab === 'miMovistar' || activeTab === 'Resto BAF') {
          if (!parts[0] && !parts[1] && parts[2] && excelData.length > 0) {
            // Continuation of the previous product's name due to merged cells in Excel
            excelData[excelData.length - 1].producto += '\n' + parts[2];
          } else {
            let cat = parts[0] || '';
            let tipo = parts[1] || '';

            if (!cat && excelData.length > 0) cat = excelData[excelData.length - 1].subcategoria;
            if (!tipo && excelData.length > 0) tipo = excelData[excelData.length - 1].gama;

            excelData.push({
              subcategoria: cat, // Categoría (AV, MV, BV)
              gama: tipo, // Tipo (miMovistar BASE, etc.)
              producto: parts[2] || '', // Nombre de Producto
              comision: parts.length > 3 ? parseSpanishNumber(parts[3]) : '0',
              comisionConCoste: parts.length > 4 ? parseSpanishNumber(parts[4]) : '0', // Multiplicador
              desde: parts.length > 6 ? parts[6] : '',
              hasta: parts.length > 7 ? parts[7] : '',
            })
          }
        } else if (activeTab === 'Suscripciones TV' || activeTab === 'Prepago') {
          excelData.push({
            categoria: parts[0] || '',
            producto: parts[1] || '',
            comision: parts.length > 2 ? parseSpanishNumber(parts[2]) : '0',
            desde: parts.length > 3 ? parts[3] : '',
            hasta: parts.length > 4 ? parts[4] : '',
          })
        } else {
          excelData.push({
            producto: parts[0],
            amountAsStr: parts.length > 1 ? parseSpanishNumber(parts[1]) : '0',
            desde: parts.length > 2 ? parts[2] : '',
            hasta: parts.length > 3 ? parts[3] : '',
          })
        }
      }
    })

    // 2. Matching and Intelligent Import
    setCatalogs(prev => {
      const currentItems = prev[activeTab] || []
      
      // Mark all existing as 'missing' initially
      const updatedItems: ProductItem[] = currentItems.map(item => ({
        ...item,
        importStatus: 'missing'
      }))

      const newProductsList: ProductItem[] = []

      excelData.forEach((row, i) => {
        const amount = Number(row.amountAsStr) || 0
        const pName = row.producto.toLowerCase()
        const rowDesde = (row.desde || '').trim()
        
        // BULLETPROOF MATCHING: Elimina todos los espacios para evitar fallos por saltos de línea, dobles espacios o caracteres invisibles.
        const normalize = (s: string | undefined | null) => (s || '').replace(/\s+/g, '').toLowerCase()
        const pNameNorm = normalize(row.producto)
        
        const isCompositeMatch = (it: ProductItem) => {
          if (activeTab === 'O2') return normalize(it.subcategoria) === normalize(row.categoria);
          if (activeTab === 'Rent') return normalize(it.fabricante) === normalize(row.fabricante) && normalize(it.subcategoria) === normalize(row.categoria) && normalize(it.gama) === normalize(row.gama);
          if (activeTab === 'miMovistar' || activeTab === 'Resto BAF') return normalize(it.subcategoria) === normalize(row.subcategoria) && normalize(it.gama) === normalize(row.gama);
          return true;
        };

        let matchIndex = updatedItems.findIndex(it => 
           normalize(it.producto) === pNameNorm && 
           (it.validFrom || '').trim() === rowDesde &&
           isCompositeMatch(it)
        )

        // MIGRATION FALLBACK: Si no hay coincidencia exacta por fecha, 
        // busca el primer producto cuyo nombre contenga al otro (o viceversa),
        // esto soluciona problemas donde en Excel falta la palabra "APPLE" al principio, etc.
        if (matchIndex === -1) {
          matchIndex = updatedItems.findIndex(it => {
            const dbName = normalize(it.producto);
            return (dbName.includes(pNameNorm) || pNameNorm.includes(dbName)) && isCompositeMatch(it);
          })
        }

        if (matchIndex >= 0) {
          const item = updatedItems[matchIndex]
          item.importStatus = 'unchanged'
          let changed = false

          if (activeTab === 'Rent') {
            if (item.fabricante !== row.fabricante) { item.fabricante = row.fabricante; changed = true; }
            if (item.subcategoria !== row.categoria) { item.subcategoria = row.categoria; changed = true; }
            if (item.gama !== row.gama) { item.gama = row.gama; changed = true; }
            if (item.comision !== row.comision) { item.comision = row.comision; changed = true; }
            if (item.comisionConCoste !== row.comisionConCoste) { item.comisionConCoste = row.comisionConCoste; changed = true; }
          } else if (activeTab === 'Ti') {
            if (item.subcategoria !== row.descripcion) { item.subcategoria = row.descripcion; changed = true; }
          } else if (activeTab === 'O2') {
            if (item.subcategoria !== row.categoria) { item.subcategoria = row.categoria; changed = true; }
          } else if (activeTab === 'Seguro') {
            if (item.subcategoria !== row.categoria) { item.subcategoria = row.categoria; changed = true; }
            if (item.comision !== row.comision) { item.comision = row.comision; changed = true; }
          } else if (activeTab === 'Repos') {
            if (item.subcategoria !== row.categoria) { item.subcategoria = row.categoria; changed = true; }
            if (item.comision !== row.comision) { item.comision = row.comision; changed = true; }
            if (item.comisionConCoste !== row.comisionConCoste) { item.comisionConCoste = row.comisionConCoste; changed = true; }
          } else if (activeTab === 'miMovistar') {
            if (item.subcategoria !== row.subcategoria) { item.subcategoria = row.subcategoria; changed = true; }
            if (item.gama !== row.gama) { item.gama = row.gama; changed = true; }
            if (item.comision !== row.comision) { item.comision = row.comision; changed = true; }
            if (item.comisionConCoste !== row.comisionConCoste) { item.comisionConCoste = row.comisionConCoste; changed = true; }
            if (item.producto !== row.producto) { item.producto = row.producto; changed = true; }
          } else if (activeTab === 'Suscripciones TV' || activeTab === 'Prepago') {
            if (item.comision !== row.comision) { item.comision = row.comision; changed = true; }
          }

          if (activeTab === 'Rent') {
            const expectedAnual = Math.round(amount * 100) / 100
            const expectedMensual = Math.round((amount / 24) * 100) / 100
            if (item.cuotaAnual !== expectedAnual) {
              item.cuotaAnual = expectedAnual
              item.cuotaMensual = expectedMensual
              changed = true
            }
            if (item.comision !== row.comision) {
              item.comision = row.comision
              changed = true
            }
            if (item.comisionConCoste !== row.comisionConCoste) {
              item.comisionConCoste = row.comisionConCoste
              changed = true
            }
          } else if (activeTab === 'Ti') {
            if (item.cuotaMensual !== row.descripcion) {
              item.cuotaMensual = row.descripcion
              changed = true
            }
            if (item.cuotaAnual !== amount) {
              item.cuotaAnual = amount
              changed = true
            }
          } else if (activeTab === 'Micro') {
            const factor = 24;
            const expectedMensual = Math.round(amount * 100) / 100
            if (item.cuotaMensual !== expectedMensual) {
              item.cuotaMensual = expectedMensual
              item.cuotaAnual = Math.round((amount * factor) * 100) / 100
              changed = true
            }
          } else if (activeTab === 'O2') {
            if (item.subcategoria !== row.categoria) { item.subcategoria = row.categoria; changed = true; }
            if (item.comision !== row.amountAsStr) { item.comision = row.amountAsStr; changed = true; }
          } else if (activeTab === 'Seguro' || activeTab === 'Varios') {
            if (item.subcategoria !== row.categoria) { item.subcategoria = row.categoria; changed = true; }
            if (item.comision !== row.comision) { item.comision = row.comision; changed = true; }
            const expectedCuota = Math.round(amount * 100) / 100
            if (item.cuotaAnual !== expectedCuota) { item.cuotaAnual = expectedCuota; changed = true; }
          } else if (activeTab === 'Repos') {
            const expectedCuota = Math.round(amount * 100) / 100
            if (item.cuotaAnual !== expectedCuota) { item.cuotaAnual = expectedCuota; changed = true; }
          } else {
            const expectedCuota = Math.round(amount * 100) / 100
            if (item.cuota !== expectedCuota) {
              item.cuota = expectedCuota
              changed = true
            }
          }

          if (item.validFrom !== row.desde) {
            item.validFrom = row.desde
            changed = true
          }
          if (item.validTo !== row.hasta) {
            item.validTo = row.hasta
            changed = true
          }

          if (changed) {
            item.importStatus = 'updated'
          }

        } else {
          // New product
          const newItem: ProductItem = {
            id: `${Date.now()}-new-${i}`,
            producto: row.producto,
            validFrom: row.desde,
            validTo: row.hasta,
            importStatus: 'new' as const
          }

          if (activeTab === 'Rent') {
            newItem.fabricante = row.fabricante
            newItem.subcategoria = row.categoria
            newItem.gama = row.gama
            newItem.cuotaAnual = Math.round(amount * 100) / 100
            newItem.cuotaMensual = Math.round((amount / 12) * 100) / 100
          } else if (activeTab === 'O2') {
            newItem.subcategoria = row.categoria
            newItem.comision = row.amountAsStr
          } else if (activeTab === 'Seguro' || activeTab === 'Varios') {
            newItem.subcategoria = row.categoria
            newItem.comision = row.comision
            newItem.cuotaAnual = Math.round(amount * 100) / 100
          } else if (activeTab === 'Repos') {
            newItem.subcategoria = row.categoria
            newItem.comision = row.comision
            newItem.comisionConCoste = row.comisionConCoste
            newItem.cuotaAnual = Math.round(amount * 100) / 100
          } else if (activeTab === 'Ti') {
            newItem.cuotaMensual = row.descripcion
            newItem.cuotaAnual = amount
          } else if (activeTab === 'Micro') {
            const factor = 24;
            newItem.cuotaMensual = Math.round(amount * 100) / 100
            newItem.cuotaAnual = Math.round((amount * factor) * 100) / 100
          } else if (activeTab === 'miMovistar' || activeTab === 'Resto BAF') {
            newItem.subcategoria = row.subcategoria
            newItem.gama = row.gama
            newItem.comision = row.comision
            newItem.comisionConCoste = row.comisionConCoste
          } else if (activeTab === 'Suscripciones TV' || activeTab === 'Prepago') {
            newItem.comision = row.comision
          } else {
            newItem.cuota = Math.round(amount * 100) / 100
          }

          // Acumulamos en la lista de insertados para no invertir el orden
          newProductsList.push(newItem)
        }
      })

      return {
        ...prev,
        [activeTab]: [...newProductsList, ...updatedItems]
      }
    })

    setBulkText('')
    setShowBulk(false)
  }

  if (authorized === null || loading || isLoadingPeriods) return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', textAlign: 'center' }}>Sincronizando con Periodos DB...</div>

  const activeData = catalogs[activeTab] || []
  const filteredData = activeData.filter(p => p.producto.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: 20, paddingBottom: 60 }}>
      {/* COMPACT FULL-WIDTH HEADER AL ESTILO LIQUIDACION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, marginTop: 12, alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
          <PageHeader 
            title={'Entrada de Datos'}
            showBack={true}
            backFallback="/admin"
            showPeriodSelector={false}
            onBack={!isProductTab ? () => setActiveTab('Fija y Móvil') : undefined}
            helpContent={
              <div>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Entrada de Datos</h4>
                <p style={{ margin: 0, lineHeight: 1.5 }}>El núcleo de configuración mensual. Aquí inyectas el 'mapa de precios' que usarán todas las calculadoras y simuladores. Utiliza el botón 'Importar Lista' para pegar directamente desde Excel (columna de nombre y precio) o clona el mes anterior si las tarifas se mantienen estables.</p>
              </div>
            }
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PeriodSelector />

          {isProductTab && !isHistoric && (
            <TooltipBox title="Guardar Cambios" content="Persiste en la base de datos todos los productos y precios que ves en pantalla para el periodo activo. Antes de guardar, el sistema valida automáticamente que no haya solapamientos de fechas de vigencia en el mismo producto. Sin pulsar este botón, los cambios solo existen en memoria y se perderán al recargar la página.">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 'bold', backgroundColor: '#34C759', color: 'var(--bg-card)', border: 'none' }}
              >
                <Save size={18} />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </TooltipBox>
          )}
        </div>
      </div>

      {isProductTab && (
        <>
          {/* BANNER DE CONTEXTO/TIEMPO */}
          <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, background: isHistoric ? 'rgba(255,255,255,0.05)' : 'rgba(0,173,239,0.1)', border: isHistoric ? '1px solid var(--border-color)' : '1px solid var(--mercedes-cyan)' }}>
            {isHistoric ? <Lock size={20} color="var(--medium-gray)" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--mercedes-cyan)', boxShadow: '0 0 10px rgba(0,173,239,0.5)' }} />}
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}>
                📍 Administrando Catálogo de Productos del Periodo: <strong style={{ color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)' }}>{activePeriodKey}</strong>
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--medium-gray)' }}>
                Estado: {activePeriodObj?.status || 'SIN REGISTRO'} {isHistoric && '(Bloqueado por Archivo Histórico)'}
              </p>
            </div>
          </div>

          {/* ZONA DE BOTONES DE IMPORTACIÓN/CLONACIÓN EN EMPTY STATE */}
          {(catalogs[activeTab] || []).length === 0 && (
             <div style={{ marginBottom: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
                 
                 {/* 1. Botón CLONAR (Solo en DRAFT y depende de previousPeriod) */}
                 {activePeriodObj?.status === 'DRAFT' && previousPeriod && (
                    <TooltipBox title="Clonar Catálogo del Mes Anterior" content={`Copia íntegramente todos los productos y precios del periodo ${previousPeriod.period_key} al periodo actual en memoria. Es la opción más rápida cuando las tarifas no han cambiado entre meses. Los datos se cargan en pantalla pero NO se guardan hasta que pulses 'Guardar Cambios'.`} position="bottom">
                      <button 
                         onClick={handleCloneFromPrevious}
                         className="btn"
                         style={{ padding: '12px 24px', background: 'var(--mercedes-cyan)', color: '#000', borderRadius: 10, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                         <FileText size={18} /> Clonar catálogo desde {previousPeriod.period_key}
                      </button>
                    </TooltipBox>
                 )}

                 {/* 2. Botón IMPORTAR LEGACY (Solo en ACTIVE o DRAFT, no depende del periodo anterior) */}
                 {(activePeriodObj?.status === 'DRAFT' || activePeriodObj?.status === 'ACTIVE') && (
                    <TooltipBox title="Importar Catálogo Original Legacy" content="Carga el catálogo base original guardado en la base de datos como referencia maestra. Útil para resetear el catálogo al estado de partida o como punto de inicio si no hay un mes anterior disponible. Los datos se cargan en memoria; pulsa 'Guardar Cambios' para hacerlos definitivos." position="bottom">
                      <button 
                         onClick={handleImportLegacy}
                         className="btn btn-secondary"
                         style={{ padding: '12px 24px', background: 'transparent', color: 'var(--mercedes-cyan)', border: '1px solid var(--mercedes-cyan)', borderRadius: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                         <FileText size={18} /> Importar Catálogo Original Legacy
                      </button>
                    </TooltipBox>
                 )}

             </div>
          )}

          {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 16, flexWrap: 'wrap' }}>
        {([
          { cat: 'Ti', tip: 'Terminal de Instalación: dispositivos y servicios con contrato de 12 meses. El precio mensual se introduce y el sistema calcula automáticamente el importe total anual (×12).' },
          { cat: 'Rent', tip: 'Terminal Móvil en Alquiler: dispositivos bajo contrato de 24 meses. Introduce la cuota total a 24 meses.' },
          { cat: 'Seguro', tip: 'Catálogo de seguros para dispositivos. Introduce la categoría, cuota y comisión.' },
          { cat: 'O2', tip: 'Catálogo de productos y tarifas de O2. Introduce la categoría, nombre y comisión.' },
          { cat: 'miMovistar', tip: 'Catálogo de paquetes miMovistar. Configura categorías, tipos, productos multilínea y su estructura de comisiones por multiplicador.' },
          { cat: 'Suscripciones TV', tip: 'Catálogo de suscripciones de televisión. Introduce la categoría, nombre, comisión y fechas.' },
          { cat: 'Prepago', tip: 'Catálogo de productos prepago. Introduce la categoría, nombre de producto y comisión.' },
          { cat: 'Varios', tip: 'Catálogo de productos varios (alarmas, migraciones, etc). Introduce categoría, nombre, cuota total y comisión.' },
          { cat: 'Repos', tip: 'Catálogo de Reposiciones. Introduce categoría, nombre, cuota total, comisión y multiplicador.' },
          { cat: 'Resto BAF', tip: 'Catálogo para Resto BAF. Estructura idéntica a miMovistar.' },
          { cat: 'Objetivos Tiendas', tip: 'Define los objetivos cuantitativos del mes para las tiendas. Son la base del cálculo de cumplimiento y comisiones.' },
          { cat: 'Productos que Comisionan', tip: 'Configura las reglas globales y objetivos que aplicarán a los comerciales de la tienda en este mes.' },
          { cat: 'Comisiones O2 y MovilFree', tip: 'Configuración del motor matemático de comisiones y bonos específicos para O2 y MovilFree.' },
        ] as const).map(({ cat, tip }) => (
          <TooltipBox key={cat} title={cat} content={tip} position="bottom">
            <button
              onClick={() => { setActiveTab(cat); setSearch('') }}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                backgroundColor: activeTab === cat ? (CATEGORIES.includes(cat) ? 'var(--mercedes-cyan)' : '#6366f1') : 'var(--active-bg)',
                color: activeTab === cat ? '#FFF' : 'var(--light-text)',
                transition: 'all 0.2s ease'
              }}
            >
              {cat === 'Ti' ? 'Contratos Móvil' : cat}
            </button>
          </TooltipBox>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
          <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--medium-gray)' }} />
          <input 
            type="text" 
            placeholder={`Buscar en ${activeTab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 40, width: '100%', maxWidth: 400 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {!isHistoric && (
            <>
              <TooltipBox title="Importar Lista desde Excel" content="Abre un área de pegado donde puedes copiar y pegar directamente desde Excel. Formato esperado: Nombre del producto [TAB] Precio [TAB] Fecha Desde [TAB] Fecha Hasta. El sistema detecta automáticamente si el producto ya existe (actualiza precio) o es nuevo (lo añade al final). Las fechas son opcionales.">
                <button onClick={() => setShowBulk(!showBulk)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} /> Importar Lista
                </button>
              </TooltipBox>
              <TooltipBox title="Añadir Fila" content="Inserta una nueva fila vacía al inicio de la tabla de la categoría activa para que puedas introducir manualmente un nuevo producto. Rellena el nombre y el precio y pulsa 'Guardar Cambios' cuando termines. Usa el botón + (duplicar) si quieres crear una variante con distinta vigencia del mismo producto.">
                <button onClick={() => addItem(activeTab)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--mercedes-cyan)', color: 'var(--bg-card)' }}>
                  <Plus size={16} /> Añadir Fila
                </button>
              </TooltipBox>
            </>
          )}
        </div>
      </div>

      {/* BULK IMPORT BOX */}
      {showBulk && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px dashed var(--mercedes-cyan)', backgroundColor: 'rgba(0,173,239,0.05)' }}>
          <h4 style={{ marginBottom: 8, color: 'var(--light-text)' }}>Importación Masiva a {activeTab === 'Ti' ? 'Contratos Móvil' : activeTab}</h4>
          <p style={{ fontSize: 13, color: 'var(--medium-gray)', marginBottom: 12 }}>
            Pega tu lista desde Excel. Orden esperado de columnas: <code>{activeTab === 'Ti' ? 'Nombre Producto [TAB] Descripción [TAB] Comisión [TAB] Desde [TAB] Hasta' : activeTab === 'Rent' ? 'Fabricante [TAB] Categoría [TAB] Producto [TAB] Gama [TAB] Cuota Total [TAB] Comisión [TAB] Comisión Coste [TAB] Desde [TAB] Hasta' : activeTab === 'Seguro' ? 'Categoría [TAB] Nombre de Producto [TAB] Cuota Total (€) [TAB] Comision [TAB] Desde [TAB] Hasta' : 'Nombre Producto [TAB] Precio [TAB] Desde [TAB] Hasta'}</code>. (Las fechas son opcionales).
          </p>
          <textarea 
            rows={5}
            className="form-textarea"
            placeholder={activeTab === 'Ti' ? "Ejemplo:\nPorta AV Ilimitada\tAltas de Prepago\t15\t01/05/2026\t31/05/2026" : activeTab === 'Rent' ? "Ejemplo:\nAPPLE\tACCESORIO\tAirPods\tMEDIA\t122.80\t2.46\t4.91\t01/05/2026" : activeTab === 'O2' ? "Ejemplo:\nFibra y movil\tFibra 600 Mb linea movil 60 Gb\t80,00\t01/05/2026\t31/05/2026" : activeTab === 'Seguro' ? "Ejemplo:\nSeguro\tSmartphone\t200,00\t18,00\t01/05/2026\t31/05/2026" : "Ejemplo:\nPorta AV Ilimitada\t20\nAlta MV\t15"}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            style={{ marginBottom: 12 }}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button onClick={() => setShowBulk(false)} className="btn btn-secondary">Cancelar</button>
            <button onClick={handleBulkImport} className="btn btn-primary" style={{ backgroundColor: 'var(--mercedes-cyan)', color: 'var(--bg-card)' }}>Procesar y Añadir</button>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--active-bg)', borderBottom: '1px solid var(--border-color)' }}>
                {activeTab === 'Rent' ? (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '12%' }}>Fabricante</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '14%' }}>Categoría</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '20%' }}>Nombre de Producto</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '10%' }}>Gama</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 120 }}>Cuota Total (€)</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 110 }}>Comisión</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 130 }}>Comisión con Coste</th>
                  </>
                ) : activeTab === 'O2' ? (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '25%' }}>Categoría</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '35%' }}>Nombre de Producto</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 140 }}>Comisión (€)</th>
                  </>
                ) : activeTab === 'Seguro' || activeTab === 'Varios' ? (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '20%' }}>Categoría</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '30%' }}>Nombre de Producto</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 130 }}>Cuota Total (€)</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 130 }}>Comision</th>
                  </>
                ) : activeTab === 'Repos' ? (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '15%' }}>Categoría</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '25%' }}>Nombre de Producto</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 110 }}>Cuota Total (€)</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 110 }}>Comisión</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 90 }}>Mult.</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 100 }}>Comisión X (€)</th>
                  </>
                ) : activeTab === 'Suscripciones TV' || activeTab === 'Prepago' ? (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '25%' }}>Categoría</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '35%' }}>Nombre de Producto</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 140 }}>Comisión (€)</th>
                  </>
                ) : (activeTab === 'miMovistar' || activeTab === 'Resto BAF') ? (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '5%' }}>Categoría</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '20%' }}>Tipo</th>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '35%' }}>Nombre de Producto</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 90 }}>Comisión (€)</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 90 }}>Mult.</th>
                    <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 100 }}>Comisión X (€)</th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: '38%' }}>Nombre de Producto</th>
                    {(activeTab === 'Ti' || activeTab === 'Micro') ? (
                      <>
                        <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: 140 }}>{activeTab === 'Ti' ? 'Descripción' : 'Cuota Mes (€)'}</th>
                        <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 140 }}>{activeTab === 'Ti' ? 'Comisión (€)' : 'Cuota Total (€)'}</th>
                      </>
                    ) : (
                      <th style={{ padding: '16px 20px', textAlign: 'left', color: 'var(--medium-gray)', width: 140 }}>Cuota / Precio (€)</th>
                    )}
                  </>
                )}
                
                <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 130, minWidth: 120 }}>Desde <span style={{fontSize:10, fontWeight:'normal'}}>(dd/mm/yyyy)</span></th>
                <th style={{ padding: '16px 8px', textAlign: 'left', color: 'var(--medium-gray)', width: 130, minWidth: 110 }}>Hasta <span style={{fontSize:10, fontWeight:'normal'}}>(opcional)</span></th>
                <th style={{ padding: '16px 20px', textAlign: 'center', color: 'var(--medium-gray)', width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {activeData.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--medium-gray)' }}>
                    No hay productos en la categoría <strong>{activeTab === 'Ti' ? 'Contratos Móvil' : activeTab}</strong>. Empieza añadiendo una fila o importando.
                  </td>
                </tr>
              ) : (
                activeData.map((item, index) => {
                  // Mantenemos el índice real para asegurarnos de que el onChange afecta al original aunque haya filtro
                  if (!(item.producto || '').toLowerCase().includes(search.toLowerCase())) return null;

                  return (
                    <tr key={item.id || index} style={{ borderBottom: '1px solid var(--table-border)', backgroundColor: item.importStatus === 'missing' ? 'rgba(255, 69, 58, 0.05)' : item.importStatus === 'new' ? 'rgba(52, 199, 89, 0.05)' : item.importStatus === 'updated' ? 'rgba(255, 204, 0, 0.05)' : 'transparent' }}>
                      {activeTab === 'Rent' ? (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.fabricante || ''}
                              onChange={e => updateItem(activeTab, index, 'fabricante', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder="Fabricante..."
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <select
                              disabled={isHistoric}
                              value={item.subcategoria || ''}
                              onChange={e => updateItem(activeTab, index, 'subcategoria', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                            >
                              <option value="">Seleccionar...</option>
                              <option value="SMARTPHONE">SMARTPHONE</option>
                              <option value="TABLET">TABLET</option>
                              <option value="ACCESORIO">ACCESORIO</option>
                              <option value="PC">PC</option>
                              <option value="TV">TV</option>
                              <option value="OTROS">OTROS</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                                placeholder="Nombre del producto..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo en Excel</span>}
                              {item.importStatus === 'updated' && <span style={{ fontSize: 11, color: '#FFCC00', fontWeight: 600, paddingLeft: 8 }}>🔄 Valores actualizados</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.gama || ''}
                              onChange={e => updateItem(activeTab, index, 'gama', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder="Gama..."
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="number"
                                step="0.01" 
                                disabled={isHistoric}
                                value={item.cuotaAnual !== undefined ? Number(item.cuotaAnual).toFixed(2) : ''}
                                onChange={e => {
                                  updateItem(activeTab, index, 'cuotaAnual', e.target.value);
                                  updateItem(activeTab, index, 'cuotaMensual', String(Number(e.target.value) / 24));
                                }}
                                className="form-input"
                                style={{ width: 130, color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                              />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                              </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.comision || ''}
                                onChange={e => updateItem(activeTab, index, 'comision', e.target.value)}
                                className="form-input"
                                style={{ width: 90, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.comisionConCoste || ''}
                                onChange={e => updateItem(activeTab, index, 'comisionConCoste', e.target.value)}
                                className="form-input"
                                style={{ width: 110, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                        </>
                      ) : activeTab === 'O2' ? (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.subcategoria || ''}
                              onChange={e => updateItem(activeTab, index, 'subcategoria', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder="Ej. Fibra y movil"
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                                placeholder="Nombre del producto..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo en Excel</span>}
                              {item.importStatus === 'updated' && <span style={{ fontSize: 11, color: '#FFCC00', fontWeight: 600, paddingLeft: 8 }}>🔄 Valores actualizados</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.comision || ''}
                                onChange={e => updateItem(activeTab, index, 'comision', e.target.value)}
                                className="form-input"
                                style={{ width: 110, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                                placeholder="0,00"
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                        </>
                      ) : activeTab === 'Suscripciones TV' || activeTab === 'Prepago' ? (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.subcategoria || activeTab}
                              onChange={e => updateItem(activeTab, index, 'subcategoria', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder={`Ej. ${activeTab}`}
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                                placeholder="Nombre del producto..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo en Excel</span>}
                              {item.importStatus === 'updated' && <span style={{ fontSize: 11, color: '#FFCC00', fontWeight: 600, paddingLeft: 8 }}>🔄 Valores actualizados</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.comision || ''}
                                onChange={e => updateItem(activeTab, index, 'comision', e.target.value)}
                                className="form-input"
                                style={{ width: 110, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                                placeholder="0,00"
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                        </>
                      ) : (activeTab === 'miMovistar' || activeTab === 'Resto BAF') ? (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.subcategoria || ''}
                              onChange={e => updateItem(activeTab, index, 'subcategoria', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 12, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder="Ej. AV"
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <textarea 
                              disabled={isHistoric}
                              value={item.gama || ''}
                              onChange={e => updateItem(activeTab, index, 'gama', e.target.value)}
                              className="form-input"
                              rows={2}
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 12, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', resize: 'vertical' }}
                              placeholder="Ej. miMovistar BASE"
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <textarea
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                rows={3}
                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 11, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', resize: 'vertical' }}
                                placeholder="Nombre multilínea..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="number" 
                                disabled={isHistoric}
                                value={item.comision || ''}
                                onChange={e => updateItem(activeTab, index, 'comision', e.target.value)}
                                className="form-input"
                                style={{ width: 80, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="number" 
                                disabled={isHistoric}
                                value={item.comisionConCoste || ''}
                                onChange={e => updateItem(activeTab, index, 'comisionConCoste', e.target.value)}
                                className="form-input"
                                style={{ width: 70, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 8 }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled
                                value={Number(item.comision || 0) * Number(item.comisionConCoste || 0)}
                                className="form-input"
                                style={{ width: 90, color: 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: 'transparent', border: 'none', paddingRight: 24 }}
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                        </>
                      ) : activeTab === 'Seguro' || activeTab === 'Varios' ? (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.subcategoria || ''}
                              onChange={e => updateItem(activeTab, index, 'subcategoria', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder="Ej. Seguro"
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                                placeholder="Nombre del producto..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo en Excel</span>}
                              {item.importStatus === 'updated' && <span style={{ fontSize: 11, color: '#FFCC00', fontWeight: 600, paddingLeft: 8 }}>🔄 Valores actualizados</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="number"
                                step="0.01" 
                                disabled={isHistoric}
                                value={item.cuotaAnual !== undefined ? Number(item.cuotaAnual).toFixed(2) : ''}
                                onChange={e => updateItem(activeTab, index, 'cuotaAnual', e.target.value)}
                                className="form-input"
                                style={{ width: 110, color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                              />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                              </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.comision || ''}
                                onChange={e => updateItem(activeTab, index, 'comision', e.target.value)}
                                className="form-input"
                                style={{ width: 110, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                                placeholder="0,00"
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                        </>
                      ) : activeTab === 'Repos' ? (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <input 
                              type="text" 
                              disabled={isHistoric}
                              value={item.subcategoria || ''}
                              onChange={e => updateItem(activeTab, index, 'subcategoria', e.target.value)}
                              className="form-input"
                              style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                              placeholder="Ej. Repos"
                            />
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                style={{ width: '100%', border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                                placeholder="Nombre del producto..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo en Excel</span>}
                              {item.importStatus === 'updated' && <span style={{ fontSize: 11, color: '#FFCC00', fontWeight: 600, paddingLeft: 8 }}>🔄 Valores actualizados</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="number"
                                step="0.01" 
                                disabled={isHistoric}
                                value={item.cuotaAnual !== undefined ? Number(item.cuotaAnual).toFixed(2) : ''}
                                onChange={e => updateItem(activeTab, index, 'cuotaAnual', e.target.value)}
                                className="form-input"
                                style={{ width: 90, color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                              />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                              </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.comision || ''}
                                onChange={e => updateItem(activeTab, index, 'comision', e.target.value)}
                                className="form-input"
                                style={{ width: 90, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                                placeholder="0,00"
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="number" 
                                disabled={isHistoric}
                                value={item.comisionConCoste || ''}
                                onChange={e => updateItem(activeTab, index, 'comisionConCoste', e.target.value)}
                                className="form-input"
                                style={{ width: 70, color: isHistoric ? 'var(--medium-gray)' : 'var(--light-text)', backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 8 }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <input 
                                type="text" 
                                disabled
                                value={item.comision && item.comisionConCoste ? Number(item.comision || 0) * Number(item.comisionConCoste || 0) : ''}
                                className="form-input"
                                style={{ width: 90, color: 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: 'transparent', border: 'none', paddingRight: 24 }}
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <input 
                                type="text" 
                                disabled={isHistoric}
                                value={item.producto}
                                onChange={e => updateItem(activeTab, index, 'producto', e.target.value)}
                                className="form-input"
                                style={{ border: 'none', backgroundColor: 'transparent', padding: '8px', fontSize: 14, fontWeight: 500, color: item.importStatus === 'missing' ? '#FF453A' : isHistoric ? 'var(--medium-gray)' : 'var(--light-text)' }}
                                placeholder="Nombre del producto..."
                              />
                              {item.importStatus === 'missing' && <span style={{ fontSize: 11, color: '#FF453A', fontWeight: 600, paddingLeft: 8 }}>🚨 No presente en última importación</span>}
                              {item.importStatus === 'new' && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, paddingLeft: 8 }}>🆕 Nuevo en Excel</span>}
                              {item.importStatus === 'updated' && <span style={{ fontSize: 11, color: '#FFCC00', fontWeight: 600, paddingLeft: 8 }}>🔄 Valores actualizados</span>}
                            </div>
                          </td>
    
                          {(activeTab === 'Ti' || activeTab === 'Micro') ? (
                            <>
                              <td style={{ padding: '12px 20px' }}>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  {activeTab === 'Ti' ? (
                                    <input 
                                      type="text"
                                      disabled={isHistoric}
                                      value={item.cuotaMensual !== undefined ? item.cuotaMensual : ''}
                                      onChange={e => updateItem(activeTab, index, 'cuotaMensual', e.target.value)}
                                      className="form-input"
                                      style={{ width: 130, color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', border: isHistoric ? 'none' : undefined, paddingRight: 8 }}
                                    />
                                  ) : (
                                    <>
                                      <input 
                                        type="number"
                                        step="0.01" 
                                        disabled={isHistoric}
                                        value={item.cuotaMensual !== undefined && item.cuotaMensual !== '' && !isNaN(Number(item.cuotaMensual)) ? Number(item.cuotaMensual).toFixed(2) : ''}
                                        onChange={e => updateItem(activeTab, index, 'cuotaMensual', e.target.value)}
                                        className="form-input"
                                        style={{ width: 130, color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', border: isHistoric ? 'none' : undefined, paddingRight: 24 }}
                                      />
                                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 20px' }}>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <input 
                                    type="number"
                                    step="0.01" 
                                    disabled={isHistoric}
                                    value={item.cuotaAnual !== undefined ? Number(item.cuotaAnual).toFixed(2) : ''}
                                    onChange={e => updateItem(activeTab, index, 'cuotaAnual', e.target.value)}
                                    className="form-input"
                                    style={{ width: 130, backgroundColor: isHistoric ? 'transparent' : 'var(--active-bg)', border: isHistoric ? 'none' : '1px dashed var(--border-color)', paddingRight: 24 }}
                                  />
                                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                                </div>
                              </td>
                            </>
                          ) : (
                        <td style={{ padding: '12px 20px' }}>
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <input 
                              type="number"
                              step="0.01" 
                              disabled={isHistoric}
                              value={item.cuota !== undefined ? Number(item.cuota).toFixed(2) : ''}
                              onChange={e => updateItem(activeTab, index, 'cuota', e.target.value)}
                              className="form-input"
                              style={{ width: 130, color: isHistoric ? 'var(--medium-gray)' : 'var(--mercedes-cyan)', fontWeight: 'bold', backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', border: isHistoric ? 'none' : undefined, paddingRight: 24 }}
                            />
                            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                          </div>
                        </td>
                      )}
                        </>
                      )}


                      <td style={{ padding: '12px 8px' }}>
                        <input 
                          type="text" 
                          disabled={isHistoric}
                          value={item.validFrom || ''}
                          onChange={e => updateItem(activeTab, index, 'validFrom', e.target.value)}
                          className="form-input"
                          style={{ width: '100%', minWidth: 100, fontSize: 13, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', border: isHistoric ? 'none' : undefined, textAlign: 'center' }}
                          placeholder="dd/mm/yyyy"
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <input 
                          type="text" 
                          disabled={isHistoric}
                          value={item.validTo || ''}
                          onChange={e => updateItem(activeTab, index, 'validTo', e.target.value)}
                          className="form-input"
                          style={{ width: '100%', minWidth: 90, fontSize: 13, backgroundColor: isHistoric ? 'transparent' : 'var(--app-bg)', border: isHistoric ? 'none' : undefined, textAlign: 'center' }}
                          placeholder="Fijo"
                        />
                      </td>

                      {!isHistoric && (
                        <td style={{ padding: '12px 20px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 4 }}>
                          <TooltipBox title="Duplicar con Nueva Vigencia" content="Crea una copia de este producto en la misma categoría con las fechas de vigencia en blanco. Útil cuando un producto cambia de precio en una fecha concreta: deja el original con fecha 'Hasta' y configura la copia con la nueva tarifa y fecha 'Desde'. El sistema valida que las vigencias no se solapen al guardar." position="bottom">
                            <button 
                              onClick={() => dupItem(activeTab, index)}
                              style={{ background: 'none', border: 'none', color: 'var(--mercedes-cyan)', cursor: 'pointer', padding: 8 }}
                            >
                              <Plus size={18} />
                            </button>
                          </TooltipBox>
                          <TooltipBox title="Eliminar Producto" content="Elimina permanentemente esta fila del catálogo en memoria. La eliminación no se hace efectiva en la base de datos hasta que pulses 'Guardar Cambios'. Si el producto tiene ventas asociadas en el historial, estas no se borran; solo deja de aparecer como opción en nuevas ventas." position="bottom">
                            <button 
                              onClick={() => removeItem(activeTab, index)}
                              style={{ background: 'none', border: 'none', color: '#FF453A', cursor: 'pointer', opacity: 0.8, padding: 8 }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </TooltipBox>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: '16px 20px', backgroundColor: 'var(--active-bg)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--medium-gray)', fontSize: 12 }}>
          <AlertCircle size={14} /> 
          <span>Los cambios se guardan localmente hasta que pulsas "Guardar Cambios" arriba a la derecha.</span>
        </div>
      </div>
        </>
      )}

      {!isProductTab && activeTab === 'Productos que Comisionan' && <ProductosComisionanTab />}
      {!isProductTab && activeTab === 'Comisiones O2 y MovilFree' && <ComisionesO2Tab />}
      {!isProductTab && activeTab !== 'Productos que Comisionan' && activeTab !== 'Comisiones O2 y MovilFree' && <ObjetivosTab activeSegment={activeTab === 'Objetivos Tiendas' ? 'Pyme' : 'Captador'} />}
    </div>
  )
}
