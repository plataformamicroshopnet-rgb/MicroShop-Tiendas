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
    telefonoMovil: '',
    telefonoFijo: '',
    boletin: '',
    anotaciones: '',
    productos: [
      {
        categoria: '', // Fija, Móvil, Ti, TMA, Micro
        producto: '',
        telf: '',
        noCliente: '', // Maps to PO
        pendiente: 'No', // Si / No / Anulado
        importe: '',
        imei: '',
        rentConCoste: 'No',
        seguro: '',
        seguroImporte: 0,
        fabricante: '',
        subcategoria: '',
        gama: '',
        isLibre: false
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
         newProducts[index].fabricante = ''
         newProducts[index].subcategoria = ''
      }
      
      // Cascade clear when changing filters
      if (field === 'fabricante' || field === 'subcategoria') {
         newProducts[index].producto = ''
         newProducts[index].importe = ''
         newProducts[index].gama = ''
      }
      
      // Autofill importe if product is selected
      if (field === 'producto') {
         const catList = catalogs[newProducts[index].categoria] || []
         const selectedItem = catList.find((p: any) => p.producto === value)
         if (selectedItem) {
            const cat = newProducts[index].categoria
            if (cat === 'Ti' || cat === 'TMA' || cat === 'Micro' || cat === 'RENT') {
              newProducts[index].importe = selectedItem.anual || selectedItem.mensual || ''
            } else {
              newProducts[index].importe = selectedItem.mensual || selectedItem.anual || ''
            }
            if (cat === 'RENT') {
              newProducts[index].fabricante = selectedItem.fabricante || ''
              newProducts[index].subcategoria = selectedItem.subcategoria || ''
              newProducts[index].gama = selectedItem.gama || ''
            }
         } else {
            newProducts[index].importe = ''
            newProducts[index].fabricante = ''
            newProducts[index].subcategoria = ''
            newProducts[index].gama = ''
         }
      }
      
      if (field === 'seguro') {
        const seguroVal = value;
        let seguroPrice = 0;
        if (seguroVal === 'Smartphone') seguroPrice = 200;
        else if (seguroVal === 'Tablet') seguroPrice = 50;
        else if (seguroVal === 'Reacondicionado') seguroPrice = 150;
        else if (seguroVal === 'Swap') seguroPrice = 0; // Swap can be overridden or kept 0
        newProducts[index].seguroImporte = seguroPrice;
      }
      
      if (field === 'isLibre') {
         // If they check "Libre", maybe clear seguro?
         if (value === true) {
            newProducts[index].seguro = '';
            newProducts[index].seguroImporte = 0;
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
          importe: '',
          imei: '',
          rentConCoste: 'No',
          seguro: '',
          seguroImporte: 0,
          fabricante: '',
          subcategoria: '',
          gama: '',
          isLibre: false
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
          vendedor: '', nombreCliente: '', codigo: '', nif: '', telefonoMovil: '', telefonoFijo: '', boletin: '', anotaciones: '',
          productos: [{ categoria: '', producto: '', telf: '', noCliente: '', pendiente: 'No', importe: '', imei: '', rentConCoste: 'No', seguro: '', seguroImporte: 0, fabricante: '', subcategoria: '', gama: '', isLibre: false }]
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
              <label className="form-label">NIF del Titular</label>
              <input type="text" className="form-input" maxLength={9} value={formData.nif} onChange={e => handleInputChange('nif', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono Móvil</label>
              <input type="text" className="form-input" maxLength={9} value={formData.telefonoMovil} onChange={e => handleInputChange('telefonoMovil', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono Fijo</label>
              <input type="text" className="form-input" maxLength={9} value={formData.telefonoFijo} onChange={e => handleInputChange('telefonoFijo', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Boletín</label>
              <input type="text" className="form-input" maxLength={16} value={formData.boletin} onChange={e => handleInputChange('boletin', e.target.value)} />
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
                
                {prod.categoria === 'RENT' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'stretch' }}>
                    {/* COLUMNA 1: TIPO DE VENTA */}
                    <div style={{ flex: '1', minWidth: '250px', backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ margin: 0, color: '#1B3D6A', fontSize: '15px', fontWeight: 'bold' }}><span style={{ color: '#1050A4' }}>{index + 1}</span> Tipo de Venta</h4>
                      
                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Tipo de Venta</label>
                        <select className="form-select" value={prod.categoria} onChange={e => handleProductChange(index, 'categoria', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {Object.keys(catalogs).filter(cat => cat !== 'Fija' && cat !== 'Móvil').map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Fabricante</label>
                        <input list={`fab-${index}`} className="form-input" value={prod.fabricante} onChange={e => handleProductChange(index, 'fabricante', e.target.value)} placeholder="Buscar..." style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        <datalist id={`fab-${index}`}>
                          {[...new Set((catalogs['RENT'] || []).filter((p:any) => !prod.subcategoria || p.subcategoria === prod.subcategoria).map((p:any) => p.fabricante).filter(Boolean))].sort().map(f => <option key={String(f)} value={String(f)} />)}
                        </datalist>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Categoría</label>
                        <input list={`cat-${index}`} className="form-input" value={prod.subcategoria} onChange={e => handleProductChange(index, 'subcategoria', e.target.value)} placeholder="Buscar..." style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        <datalist id={`cat-${index}`}>
                          {[...new Set((catalogs['RENT'] || []).filter((p:any) => !prod.fabricante || p.fabricante === prod.fabricante).map((p:any) => p.subcategoria).filter(Boolean))].sort().map(c => <option key={String(c)} value={String(c)} />)}
                        </datalist>
                      </div>
                    </div>

                    {/* COLUMNA 2: DETALLES DE LA VENTA / PRODUCTO */}
                    <div style={{ flex: '2', minWidth: '350px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#333' }}>DETALLES DE LA VENTA / PRODUCTO</h4>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Producto</label>
                        <input list={`prod-${index}`} className="form-input" value={prod.producto} onChange={e => handleProductChange(index, 'producto', e.target.value)} placeholder="Escribe para buscar..." required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        <datalist id={`prod-${index}`}>
                          {(catalogs['RENT'] || []).filter((p:any) => (!prod.fabricante || p.fabricante === prod.fabricante) && (!prod.subcategoria || p.subcategoria === prod.subcategoria)).map((p:any) => p.producto).filter((p:any, i:number, self:any[]) => self.indexOf(p) === i).sort().map((p:any) => <option key={String(p)} value={String(p)} />)}
                        </datalist>
                      </div>

                      <div style={{ height: 1, backgroundColor: '#E0E0E0', margin: '8px 0' }}></div>
                      <h5 style={{ margin: 0, fontSize: '13px', color: '#666' }}>Detalles del Producto</h5>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Gama</label>
                          <input type="text" className="form-input" value={prod.gama} readOnly style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>IMEI</label>
                          <input type="text" className="form-input" maxLength={15} value={prod.imei} onChange={e => handleProductChange(index, 'imei', e.target.value.replace(/\D/g, ''))} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Teléfono</label>
                          <input type="text" className="form-input" maxLength={9} value={prod.telf} onChange={e => handleProductChange(index, 'telf', e.target.value)} onPaste={e => { const pasted = e.clipboardData.getData('text'); if (pasted.length > 9) { e.preventDefault(); handleProductChange(index, 'telf', pasted); } }} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <input type="checkbox" checked={prod.isLibre || false} onChange={e => handleProductChange(index, 'isLibre', e.target.checked)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                        <label style={{ fontSize: 13, color: '#555' }}>¿Libre?</label>
                      </div>
                    </div>

                    {/* COLUMNA 3: ESTADO Y FINANZAS */}
                    <div style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '16px' }}>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Cuota Total</label>
                        <div style={{ position: 'relative' }}>
                          <input type="number" step="0.01" className="form-input" value={prod.importe !== '' && prod.importe !== undefined ? Number(prod.importe).toFixed(2) : ''} onChange={e => handleProductChange(index, 'importe', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24 }} />
                          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B3D6A', fontSize: 13, pointerEvents: 'none' }}>€</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flex: 1 }}>
                        <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Estado</h5>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>¿Pendiente?</label>
                            <select className="form-select" value={prod.pendiente} onChange={e => handleProductChange(index, 'pendiente', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                              <option value="No">No</option>
                              <option value="Si">Sí</option>
                              <option value="Anulado">Anulado</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Rent con coste</label>
                            <select className="form-select" value={prod.rentConCoste} onChange={e => handleProductChange(index, 'rentConCoste', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                              <option value="No">No</option>
                              <option value="Si">Sí</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Seguro</label>
                            <select className="form-select" value={prod.seguro} onChange={e => handleProductChange(index, 'seguro', e.target.value)} disabled={prod.isLibre} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                              <option value="">Selecciona...</option>
                              <option value="Smartphone">Smartphone</option>
                              <option value="Tablet">Tablet</option>
                              <option value="Reacondicionado">Reacondicionado</option>
                              <option value="Swap">Swap</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Cuota Seguro</label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" className="form-input" value={prod.seguroImporte} readOnly style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24 }} />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B3D6A', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
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
                )}
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
