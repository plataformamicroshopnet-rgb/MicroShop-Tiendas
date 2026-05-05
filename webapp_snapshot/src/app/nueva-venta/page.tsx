'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { FilePlus } from 'lucide-react'
import { TIENDAS_COMERCIALES, VENDEDORES, CODIGOS_TRAMITACION } from '@/lib/constants'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'

export default function NuevaVentaPage() {
  const { authorized } = useGuard('MODULE_TIENDAS', 'CREATE_SALES')
  const { activePeriodKey } = usePeriod()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({})
  const [selectedTienda, setSelectedTienda] = useState('')

  const [formData, setFormData] = useState({
    vendedor: '',
    nombreCliente: '',
    codigo: '',
    nif: '',
    anotaciones: '',
    productos: [
      {
        categoria: '', // Fija, Móvil, Ti, TMA, Micro
        producto: '',
        telf: '',
        noCliente: '', // Maps to PO
        pendiente: 'No', // Si / No / Anulado
        importe: ''
      }
    ]
  })

  useEffect(() => {
    fetch('/api/catalogs')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCatalogs(data.catalogs)
        }
      })
  }, [])

  // Handlers
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleProductChange = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      let newProducts = [...prev.productos]
      
      // Múltiples teléfonos pegados
      if (field === 'telf') {
        const valueStr = String(value)
        // Separar por espacios, comas o saltos de línea (y filtrar vacíos)
        const phones = valueStr.split(/[\s,\n]+/).filter(Boolean)
        
        if (phones.length > 1) {
          // El primero va para la línea actual
          newProducts[index] = { ...newProducts[index], telf: phones[0].slice(0, 9) }
          
          // Guardamos datos base que queremos copiar a las nuevas líneas
          const baseData = {
            categoria: newProducts[index].categoria,
            producto: newProducts[index].producto,
            noCliente: newProducts[index].noCliente,
            pendiente: newProducts[index].pendiente
          }
          
          let linesAdded = 0
          for (let i = 1; i < phones.length; i++) {
            if (newProducts.length >= 50) break; // Límite máximo de líneas
            
            newProducts.push({
              ...baseData,
              telf: phones[i].slice(0, 9)
            })
            linesAdded++
          }
          return { ...prev, productos: newProducts }
        }
      }

      newProducts[index] = { ...newProducts[index], [field]: value }
      
      // Reset product dropdown if switching categoria
      if (field === 'categoria') {
         newProducts[index].producto = ''
         newProducts[index].importe = ''
      }
      
      // Autofill importe if product is selected
      if (field === 'producto') {
         const catList = catalogs[newProducts[index].categoria] || []
         const selectedItem = catList.find((p: any) => p.producto === value)
         if (selectedItem) {
            const cat = newProducts[index].categoria
            if (cat === 'Ti' || cat === 'TMA' || cat === 'Micro') {
              newProducts[index].importe = selectedItem.anual || selectedItem.mensual || ''
            } else {
              newProducts[index].importe = selectedItem.mensual || selectedItem.anual || ''
            }
         } else {
            newProducts[index].importe = ''
         }
      }
      
      return { ...prev, productos: newProducts }
    })
  }

  const addProductRow = () => {
    if (formData.productos.length >= 50) return
    setFormData((prev: any) => ({
      ...prev,
      productos: [
        ...prev.productos,
        {
          categoria: '',
          producto: '',
          telf: '',
          noCliente: '',
          pendiente: 'No',
          importe: ''
        }
      ]
    }))
  }

  const removeProductRow = (index: number) => {
    setFormData((prev: any) => {
      const newProducts = [...prev.productos]
      newProducts.splice(index, 1)
      return { ...prev, productos: newProducts }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/sales/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, periodKey: activePeriodKey })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('¡VENTA AÑADIDA CON ÉXITO!')
        setSelectedTienda('')
        setFormData({
          vendedor: '', nombreCliente: '', codigo: '', nif: '', anotaciones: '',
          productos: [{ categoria: '', producto: '', telf: '', noCliente: '', pendiente: 'No', importe: '' }]
        })
      } else {
        setError(data.error || 'Error al guardar la venta')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (authorized === null) {
      return <div style={{ padding: 40, color: 'var(--mercedes-cyan)', fontWeight: 600 }}>Verificando credenciales corporativas...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <PageHeader 
        title={<><FilePlus className="text-cyan" size={28} /> Nueva Venta</>}
        subtitle="Registrar operación comercial en HUB único."
        showBack={true}
        backFallback="/back-office"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Nueva Venta</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Formulario de introducción manual de operaciones. Asegúrate de registrar correctamente el DNI y producto para que el sistema lo asigne adecuadamente según el catálogo de comisiones.</p>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 1. Cabecera */}
        <div style={{ backgroundColor: 'var(--active-bg)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--mercedes-cyan)' }}>
          <h3 style={{ marginBottom: 16, color: 'var(--light-text)' }}>Cabecera</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Tienda</label>
              <select className="form-select" value={selectedTienda} onChange={e => { setSelectedTienda(e.target.value); handleInputChange('vendedor', ''); }} required>
                <option value="">Selecciona...</option>
                {Object.keys(TIENDAS_COMERCIALES).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Comercial</label>
              <select className="form-select" value={formData.vendedor} onChange={e => handleInputChange('vendedor', e.target.value)} disabled={!selectedTienda} required>
                <option value="">Selecciona...</option>
                {selectedTienda && (
                  <>
                    <optgroup label={`Asignados a ${selectedTienda}`}>
                      {TIENDAS_COMERCIALES[selectedTienda].map(v => <option key={v} value={v}>{v}</option>)}
                    </optgroup>
                    <optgroup label="Otras Tiendas">
                      {VENDEDORES.filter(v => !TIENDAS_COMERCIALES[selectedTienda].includes(v)).map(v => <option key={v} value={v}>{v}</option>)}
                    </optgroup>
                  </>
                )}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del cliente</label>
              <input type="text" className="form-input" maxLength={40} value={formData.nombreCliente} onChange={e => handleInputChange('nombreCliente', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">CIF del cliente</label>
              <input type="text" className="form-input" maxLength={9} value={formData.nif} onChange={e => handleInputChange('nif', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Código de tramitación</label>
              <select className="form-select" value={formData.codigo} onChange={e => handleInputChange('codigo', e.target.value)} required>
                <option value="">Selecciona...</option>
                {CODIGOS_TRAMITACION.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Anotaciones Generales</label>
            <textarea className="form-textarea" rows={2} value={formData.anotaciones} onChange={e => handleInputChange('anotaciones', e.target.value)}></textarea>
          </div>
        </div>

        {/* 2. Bloque de Productos */}
        <div>
          <h3 style={{ marginBottom: 16, color: 'var(--light-text)' }}>Productos ({formData.productos.length}/50)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {formData.productos.map((prod: any, index: number) => (
              <div key={index} style={{ backgroundColor: 'var(--active-bg)', padding: '16px', borderRadius: '8px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 16, right: 16 }}>
                  {formData.productos.length > 1 && (
                    <button type="button" onClick={() => removeProductRow(index)} style={{ background: 'transparent', color: '#FF453A', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', alignItems: 'end' }}>
                  
                  {/* Categoría */}
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
                    <label className="form-label" style={{ fontSize: 13 }}><strong className="text-cyan">{index + 1}</strong> Tipo de Venta</label>
                    <select className="form-select" value={prod.categoria} onChange={e => handleProductChange(index, 'categoria', e.target.value)} required>
                      <option value="">Selecciona...</option>
                      {Object.keys(catalogs)
                        .filter(cat => cat !== 'Fija' && cat !== 'Móvil')
                        .map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  {/* Producto */}
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 160, gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Producto</label>
                    <select className="form-select" value={prod.producto} onChange={e => handleProductChange(index, 'producto', e.target.value)} disabled={!prod.categoria} required>
                      <option value="">Selecciona...</option>
                      {prod.categoria && catalogs[prod.categoria]
                        ?.filter((p: any, i: number, self: any[]) => self.findIndex(t => t.producto === p.producto) === i)
                        .map((p: any, i: number) => <option key={p.id || i} value={p.producto}>{p.producto}</option>)}
                    </select>
                  </div>

                  {/* Importe */}
                  <div className="form-group" style={{ marginBottom: 0, maxWidth: 100 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Importe</label>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-input" 
                        style={{ color: 'var(--mercedes-cyan)', fontWeight: 'bold', width: '100%', paddingRight: 24 }}
                        value={prod.importe !== '' && prod.importe !== undefined ? Number(prod.importe).toFixed(2) : ''} 
                        onChange={e => handleProductChange(index, 'importe', e.target.value)} 
                      />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--medium-gray)', fontSize: 13, pointerEvents: 'none' }}>€</span>
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div className="form-group" style={{ marginBottom: 0, maxWidth: 120 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Teléfono</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      maxLength={9} 
                      value={prod.telf} 
                      onChange={e => handleProductChange(index, 'telf', e.target.value)} 
                      onPaste={e => {
                        const pasted = e.clipboardData.getData('text');
                        if (pasted.length > 9) {
                          e.preventDefault();
                          handleProductChange(index, 'telf', pasted);
                        }
                      }}
                      required 
                    />
                  </div>

                  {/* NO Cliente */}
                  <div className="form-group" style={{ marginBottom: 0, maxWidth: 90 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>Cliente</label>
                    <select className="form-select" value={prod.noCliente} onChange={e => handleProductChange(index, 'noCliente', e.target.value)}>
                      <option value="">Selecciona...</option>
                      <option value="Si">Si</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {/* Pendiente */}
                  <div className="form-group" style={{ marginBottom: 0, maxWidth: 100 }}>
                    <label className="form-label" style={{ fontSize: 13 }}>¿Pendiente?</label>
                    <select className="form-select" value={prod.pendiente} onChange={e => handleProductChange(index, 'pendiente', e.target.value)}>
                      <option value="No">No</option>
                      <option value="Si">Sí</option>
                      <option value="Anulado">Anulado</option>
                    </select>
                  </div>

                </div>
              </div>
            ))}
          </div>

          {formData.productos.length < 50 && (
            <button type="button" onClick={addProductRow} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--mercedes-cyan)', border: '1px dashed var(--mercedes-cyan)', padding: '12px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              <span style={{ fontSize: 20 }}>+</span> Añadir otra línea
            </button>
          )}

        </div>

        {error && <div style={{ color: '#FF453A', fontWeight: 'bold' }}>*Error: {error}</div>}
        {success && <div style={{ color: '#30D158', fontWeight: 'bold' }}>{success}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="submit" className="btn-primary" style={{ width: 'auto', minWidth: '150px' }} disabled={loading || formData.productos.length === 0}>
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>

      </form>
    </div>
  )
}
