'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { FilePlus, ShieldPlus } from 'lucide-react'
import { TIENDAS_COMERCIALES, VENDEDORES, CODIGOS_TRAMITACION } from '@/lib/constants'
import { useGuard } from '@/hooks/useGuard'
import { usePeriod } from '@/components/PeriodProvider'

export default function NuevaVentaPage() {
  const { authorized, user } = useGuard('VIEW_NUEVA_VENTA', 'CREATE_SALES')
  const isAdmin = user?.role === 'ADMIN'
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
    // Fecha REAL de la venta (editable): por defecto hoy. Antes el servidor
    // ponía siempre la fecha de tecleo y las ventas apuntadas tarde caían
    // en el mes equivocado al cruzar con Telefónica.
    fechaVenta: new Date().toISOString().slice(0, 10),
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
        numeroPedido: '',
        rentConCoste: '',
        origenStock: '',
        seguro: '',
        seguroImporte: 0,
        fabricante: '',
        subcategoria: '',
        gama: '',
        isLibre: false,
        isSwap: false,
        facturacionAnterior: '',
        facturacionNueva: ''
      }
    ]
  })

  const [stockItems, setStockItems] = useState<any[]>([])

  // ── Semáforo de llaves de cruce con Telefónica ──────────────────────
  // Las "llaves" son los datos que permiten identificar la operación en la
  // liquidación de Telefónica al cruzarla en el ERP. Naranja = falta el
  // dato, verde = listo. Las casillas que no son llave conservan el azul.
  const hoyISO = new Date().toISOString().slice(0, 10)
  const estiloLlave = (ok: boolean): any => ({
    backgroundColor: ok ? '#2E7D32' : '#F57C00',
    border: ok ? '2px solid #1B5E20' : '2px solid #E65100',
    color: '#FFFFFF',
    fontWeight: 'bold'
  })
  // Validación REAL del documento: DNI (letra mod-23), NIE (X/Y/Z) y CIF
  // (dígito/letra de control). Un documento inventado no pasa. El mensaje
  // de error nunca revela la letra correcta (anti-invención).
  const nifOk = (v: string): boolean => {
    const s = String(v || '').trim().toUpperCase().replace(/[\s-]/g, '')
    const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE'
    let m = s.match(/^(\d{8})([A-Z])$/)
    if (m) return LETRAS[parseInt(m[1], 10) % 23] === m[2]
    m = s.match(/^([XYZ])(\d{7})([A-Z])$/)
    if (m) return LETRAS[parseInt(String('XYZ'.indexOf(m[1])) + m[2], 10) % 23] === m[3]
    m = s.match(/^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/)
    if (m) {
      let suma = 0
      for (let i = 0; i < 7; i++) {
        let n = parseInt(m[2][i], 10)
        if (i % 2 === 0) { n *= 2; n = Math.floor(n / 10) + (n % 10) }
        suma += n
      }
      const digito = (10 - (suma % 10)) % 10
      const letra = 'JABCDEFGHI'[digito]
      if ('KPQS'.includes(m[1])) return m[3] === letra
      if ('ABEH'.includes(m[1])) return m[3] === String(digito)
      return m[3] === String(digito) || m[3] === letra
    }
    return false
  }
  const telOk = (v: string) => /^[0-9]{9}$/.test(String(v || '').trim())
  // Código de operación real de Movistar: CO + añomes + referencia.
  // Rellenos tipo "1111..." o códigos CO mal tecleados quedan en naranja.
  const pedidoOk = (v: string) => /^CO\d{4}[A-Z0-9]{6,12}$/.test(String(v || '').trim().toUpperCase())
  const imeiOk = (v: string) => /^[0-9]{15}$/.test(String(v || '').trim())

  const llavesDeProducto = (prod: any): { campo: string; etiqueta: string; ok: boolean }[] => {
    const cat = prod.categoria
    const ll: { campo: string; etiqueta: string; ok: boolean }[] = []
    if (cat === 'Rent') {
      ll.push({ campo: 'imei', etiqueta: 'IMEI', ok: imeiOk(prod.imei) })
      ll.push({ campo: 'numeroPedido', etiqueta: 'Nº Pedido Telefónica/Movistar', ok: pedidoOk(prod.numeroPedido) })
    } else if (cat === 'miMovistar' || cat === 'Resto BAF' || cat === 'Traslado miMovistar') {
      ll.push({ campo: 'numeroPedido', etiqueta: 'Nº Pedido Telefónica/Movistar', ok: pedidoOk(prod.numeroPedido) })
    } else if (cat === 'Ti') {
      ll.push({ campo: 'telf', etiqueta: 'Teléfono de la línea', ok: telOk(prod.telf) })
      ll.push({ campo: 'numeroPedido', etiqueta: 'Nº Pedido Telefónica/Movistar', ok: pedidoOk(prod.numeroPedido) })
    } else if (cat === 'Seguro') {
      ll.push({ campo: 'telf', etiqueta: 'Teléfono', ok: telOk(prod.telf) })
      ll.push({ campo: 'numeroPedido', etiqueta: 'Nº Pedido Telefónica/Movistar', ok: pedidoOk(prod.numeroPedido) })
    } else if (cat === 'Repos') {
      ll.push({ campo: 'telf', etiqueta: 'Teléfono Fijo', ok: telOk(prod.telf) })
      ll.push({ campo: 'numeroPedido', etiqueta: 'Nº Pedido Telefónica/Movistar', ok: pedidoOk(prod.numeroPedido) })
    } else if (cat === 'Suscripciones TV') {
      ll.push({ campo: 'telf', etiqueta: 'Teléfono Fijo', ok: telOk(prod.telf) })
      ll.push({ campo: 'numeroPedido', etiqueta: 'Nº Pedido Telefónica/Movistar', ok: pedidoOk(prod.numeroPedido) })
    }
    return ll
  }
  const esLlave = (prod: any, campo: string) => llavesDeProducto(prod).some(l => l.campo === campo)
  const estiloCampo = (prod: any, campo: string): any => {
    const ll = llavesDeProducto(prod).find(l => l.campo === campo)
    return ll ? estiloLlave(ll.ok) : { backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }
  }

  // Cartel premium por producto: o falta alguna llave (aviso) o todo verde
  const CartelLlaves = ({ prod }: { prod: any }) => {
    const ll = llavesDeProducto(prod)
    if (ll.length === 0 || !prod.producto) return null
    const faltan = ll.filter(l => !l.ok).map(l => l.etiqueta)
    if (!nifOk(formData.nif)) faltan.unshift('NIF del Titular')
    if (faltan.length === 0) {
      return (
        <div style={{ marginTop: 12, backgroundColor: '#FFFFFF', border: '1px solid #C8E6C9', borderLeft: '5px solid #2E7D32', borderRadius: 10, padding: '12px 18px', boxShadow: '0 3px 14px rgba(46,125,50,0.12)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <div>
            <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 15, color: '#1B5E20', fontWeight: 600, letterSpacing: '0.2px' }}>Operación identificada</div>
            <div style={{ fontSize: 13, color: '#4E6151', lineHeight: 1.5 }}>Llaves completas: esta venta cruzará automáticamente con la liquidación de Telefónica.</div>
          </div>
        </div>
      )
    }
    return (
      <div style={{ marginTop: 12, backgroundColor: '#FFFFFF', border: '1px solid #EADFCB', borderLeft: '5px solid #C9A227', borderRadius: 10, padding: '12px 18px', boxShadow: '0 3px 14px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>🔑</span>
        <div>
          <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 15, color: '#1B2A41', fontWeight: 600, letterSpacing: '0.2px' }}>Identifica esta operación</div>
          <div style={{ fontSize: 13, color: '#5A6B7F', lineHeight: 1.5 }}>
            Si no se rellena <strong style={{ color: '#B26A00' }}>{faltan.join(', ')}</strong>, no podremos identificar la operación en la liquidación de Telefónica y podría quedar sin cobrar.
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetch(`/api/catalogs?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCatalogs(data.catalogs)
        }
      })

    fetch('/api/stock')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStockItems(data.data)
        }
      })
  }, [])

  useEffect(() => {
    if (user) {
      const username = user.username || ''
      // Find user store in TIENDAS_COMERCIALES mapping
      const match = Object.entries(TIENDAS_COMERCIALES).find(([store, commercials]) =>
        commercials.some((c) => c.toLowerCase() === username.toLowerCase())
      )

      if (match) {
        setSelectedTienda(match[0])
        setFormData((prev: any) => ({ ...prev, vendedor: username }))
      }
    }
  }, [user])

  // Handlers
  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleTiendaChange = (tienda: string) => {
    setSelectedTienda(tienda)
    setFormData((prev: any) => ({ ...prev, vendedor: '' }))
    
    if (tienda && stockItems.length > 0) {
      setFormData((prev: any) => {
        const newProducts = prev.productos.map((prod: any) => {
          if (prod.categoria === 'Rent' && prod.producto) {
            const storeField = getStoreField(tienda);
            const matchedItem = findMatchingStockItem(prod.producto, stockItems, storeField);
            const currentStock = (matchedItem && storeField) ? (matchedItem[storeField] || 0) : 0;
            if (currentStock <= 0) {
              const confirmContinue = window.confirm(
                `El producto "${prod.producto}" no tiene stock disponible en ${tienda}.\n\n¿Desea continuar con la venta?`
              );
              if (!confirmContinue) {
                return { ...prod, producto: '', showMotivoSinStock: false, motivoSinStock: '' };
              } else {
                return { ...prod, showMotivoSinStock: true };
              }
            } else {
              return { ...prod, showMotivoSinStock: false, motivoSinStock: '' };
            }
          }
          return prod;
        });
        return { ...prev, productos: newProducts };
      });
    }
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

      if (field === 'categoria' && value === 'Repos') {
         const confirmRepos = window.confirm(
           'ADVERTENCIA puede tener penalización si:\n' +
           '- No aplica si hay pérdida de valor en los 20 días anteriores o posteriores (cualquier canal).\n' +
           '- No aplica a reposicionamientos con origen Laliga y destino Fútbol Total.\n' +
           '- Cliente debe mantener activo el paquete el día 8 del m+2.\n\n' +
           '¿Quiere continuar, Si o No?'
         );
         if (!confirmRepos) {
           return prev; // Cancel the change
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
      if (field === 'categoria') {
         newProducts[index].subcategoria = ''
         newProducts[index].fabricante = ''
         newProducts[index].producto = ''
         newProducts[index].importe = ''
         newProducts[index].gama = ''
      }
      
      if (field === 'fabricante' || field === 'subcategoria') {
         newProducts[index].producto = ''
         newProducts[index].importe = ''
         newProducts[index].gama = ''
      }
      
      // Autofill importe if product is selected
      if (field === 'producto') {
         if (newProducts[index].categoria === 'Rent' && value) {
           if (!selectedTienda) {
             alert('Por favor, selecciona primero la tienda en la cabecera para verificar el stock.');
             newProducts[index].producto = '';
             return prev;
           }

           const storeField = getStoreField(selectedTienda);
           const matchedItem = findMatchingStockItem(value, stockItems, storeField);
           const currentStock = (matchedItem && storeField) ? (matchedItem[storeField] || 0) : 0;

           if (currentStock <= 0) {
             const confirmContinue = window.confirm(
               `El producto "${value}" no tiene stock disponible en ${selectedTienda}.\n\n¿Desea continuar con la venta?`
             );
             if (!confirmContinue) {
               newProducts[index].producto = '';
               newProducts[index].showMotivoSinStock = false;
               newProducts[index].motivoSinStock = '';
               return { ...prev, productos: newProducts };
             } else {
               newProducts[index].showMotivoSinStock = true;
             }
           } else {
             newProducts[index].showMotivoSinStock = false;
             newProducts[index].motivoSinStock = '';
           }
         }

         const actualCat = newProducts[index].categoria === 'Traslado miMovistar' ? 'miMovistar' : newProducts[index].categoria;
         const catList = catalogs[actualCat] || []
         const selectedItem = catList.find((p: any) => {
           if (newProducts[index].categoria === 'miMovistar' || newProducts[index].categoria === 'Resto BAF' || newProducts[index].categoria === 'Traslado miMovistar') {
             return p.producto === value && p.subcategoria === newProducts[index].subcategoria && p.gama === newProducts[index].gama;
           }
           if (newProducts[index].categoria === 'O2' && newProducts[index].subcategoria) {
             return p.producto === value && p.subcategoria === newProducts[index].subcategoria;
           }
           return p.producto === value;
         })
         if (selectedItem) {
             const parseSafeNum = (val: any) => {
               if (!val) return 0;
               if (typeof val === 'number') return val;
               return Number(String(val).replace(',', '.')) || 0;
             };
             const cat = newProducts[index].categoria
            if (cat === 'Suscripciones TV') {
              if (newProducts[index].isSuscTraslado) {
                newProducts[index].importe = '0';
              } else {
                const baseCom = parseSafeNum(selectedItem.comision);
                const mult = parseSafeNum(selectedItem.comisionConCoste || '1.00');
                newProducts[index].importe = String(baseCom * (mult === 0 ? 1 : mult));
              }
            } else if (cat === 'O2' || cat === 'Seguro' || cat === 'Prepago' || cat === 'Varios') {
              newProducts[index].importe = selectedItem.comision || ''
              // Para Seguros, también auto-rellenar seguroImporte con la Cuota Total (anual)
              if (cat === 'Seguro' && selectedItem.anual) {
                newProducts[index].seguroImporte = parseFloat(String(selectedItem.anual).replace(',', '.')) || 0
              }
            } else if (cat === 'Repos') {
               if (selectedItem.comisionConCoste && Number(selectedItem.comisionConCoste) > 0) {
                  const ant = Number(newProducts[index].facturacionAnterior || 0)
                  const nue = Number(newProducts[index].facturacionNueva || 0)
                  newProducts[index].importe = String(Math.max(0, nue - ant) * Number(selectedItem.comisionConCoste))
               } else {
                  newProducts[index].importe = selectedItem.comision || ''
               }
            } else if (cat === 'miMovistar' || cat === 'Resto BAF' || cat === 'Traslado miMovistar') {
              const baseCom = parseSafeNum(selectedItem.comision);
              const mult = parseSafeNum(selectedItem.comisionConCoste);
              newProducts[index].importe = String(baseCom * (mult === 0 ? 1 : mult));
            } else if (cat === 'Ti' || cat === 'TMA' || cat === 'Micro' || cat === 'Rent') {
              newProducts[index].importe = selectedItem.anual || selectedItem.mensual || ''
            } else {
              newProducts[index].importe = selectedItem.mensual || selectedItem.anual || ''
            }
            if (cat === 'Rent') {
              newProducts[index].fabricante = selectedItem.fabricante || ''
              newProducts[index].subcategoria = selectedItem.subcategoria || ''
              newProducts[index].gama = selectedItem.gama || ''
            }
         } else {
            newProducts[index].importe = ''
            newProducts[index].gama = ''
         }
      }
      
      if (field === 'isLibre') {
         // If they check "Libre", we don't need to clear seguro anymore because it's handled via a separate row
         if (value === true) {
         }
      }
      
      // Recalcular importe para Repos si cambian los factores numéricos
      if (newProducts[index].categoria === 'Repos' && (field === 'facturacionAnterior' || field === 'facturacionNueva')) {
         const catList = catalogs['Repos'] || []
         const selectedItem = catList.find((p: any) => p.producto === newProducts[index].producto)
         if (selectedItem && selectedItem.comisionConCoste && Number(selectedItem.comisionConCoste) > 0) {
            const ant = Number(newProducts[index].facturacionAnterior || 0)
            const nue = Number(newProducts[index].facturacionNueva || 0)
            newProducts[index].importe = String(Math.max(0, nue - ant) * Number(selectedItem.comisionConCoste))
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
          numeroPedido: '',
          rentConCoste: '',
          origenStock: '',
          seguro: '',
          seguroImporte: 0,
          fabricante: '',
          subcategoria: '',
          gama: '',
          isLibre: false,
          isSwap: false,
          facturacionAnterior: '',
          facturacionNueva: ''
        }
      ]
    }))
  }

  const handleAddSeguro = (index: number) => {
    if (formData.productos.length >= 50) return
    const currentProd = formData.productos[index]
    setFormData((prev: any) => ({
      ...prev,
      productos: [
        ...prev.productos,
        {
          categoria: 'Seguro',
          producto: '',
          telf: currentProd.telf || '',
          noCliente: currentProd.noCliente || '',
          pendiente: 'No',
          importe: '',
          imei: '',
          numeroPedido: '',
          rentConCoste: '',
          origenStock: '',
          seguro: '',
          seguroImporte: 0,
          fabricante: '',
          subcategoria: '',
          gama: '',
          isLibre: false,
          isSwap: false
        }
      ]
    }))
  }

  const handleAddSuscripcion = (index: number) => {
    if (formData.productos.length >= 50) return
    const currentProd = formData.productos[index]
    
    let isTraslado = currentProd.categoria === 'Traslado miMovistar' || String(currentProd.producto || '').toLowerCase().includes('traslado');
    let extraAnotacion = '';
    let isSuscTraslado = false;
    
    if (isTraslado) {
       const confirmTraslado = window.confirm('Cualquier Suscripción en Traslado no cuenta, quiere continuar, Si o No');
       if (!confirmTraslado) return;
       isSuscTraslado = true;
       extraAnotacion = ' - No se abona por ser un traslado miMovistar';
    }

    setFormData((prev: any) => {
      let newAnotaciones = prev.anotaciones || '';
      if (extraAnotacion && !newAnotaciones.includes('No se abona por ser un traslado')) {
          newAnotaciones = newAnotaciones + extraAnotacion;
      }
      
      return {
        ...prev,
        anotaciones: newAnotaciones,
        productos: [
          ...prev.productos,
          {
            categoria: 'Suscripciones TV',
            producto: '',
            telf: currentProd.telf || '',
            noCliente: currentProd.noCliente || '',
            pendiente: 'No',
            importe: isSuscTraslado ? '0' : '',
            imei: '',
            numeroPedido: '',
            rentConCoste: '',
            origenStock: '',
            seguro: '',
            seguroImporte: 0,
            fabricante: '',
            subcategoria: '',
            gama: '',
            isLibre: false,
            isSwap: false,
            isSuscTraslado: isSuscTraslado // Custom flag for handleProductChange
          }
        ]
      }
    })
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

    if (formData.productos.some((p: any) => p.categoria === 'Accesorios Venta y Stock')) {
      setError('Las ventas de accesorios se gestionan y confirman en su panel dedicado. Por favor, elimine la línea de accesorios de este formulario o proceda a su panel.')
      setLoading(false)
      return
    }

    // Bloqueo duro: el documento debe ser un DNI, NIE o CIF real.
    if (!nifOk(formData.nif)) {
      setError('El NIF/CIF del titular no es válido (DNI, NIE o CIF). Comprueba el documento del cliente: sin un documento real no se puede registrar la venta.')
      setLoading(false)
      return
    }

    // En Rent es obligatorio indicar de dónde sale el terminal (stock).
    if (formData.productos.some((p: any) => p.categoria === 'Rent' && p.producto && !p.origenStock)) {
      setError('En los Rent debes seleccionar el Origen del terminal: 🏬 stock de tienda o 🚚 envío logístico.')
      setLoading(false)
      return
    }

    const missingMotivos = formData.productos.some((p: any) => 
      p.categoria === 'Rent' && p.producto && p.showMotivoSinStock && !String(p.motivoSinStock || '').trim()
    )
    if (missingMotivos) {
      setError('Por favor, indica el motivo de venta sin stock para los productos correspondientes.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/sales/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, periodKey: activePeriodKey, codigo: selectedTienda })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess('¡VENTA AÑADIDA CON ÉXITO!')
        setSelectedTienda('')
        setFormData({
          vendedor: '', nombreCliente: '', codigo: '', nif: '', telefonoMovil: '', telefonoFijo: '', fechaVenta: new Date().toISOString().slice(0, 10), anotaciones: '',
          productos: [{ categoria: '', producto: '', telf: '', noCliente: '', pendiente: 'No', importe: '', imei: '', numeroPedido: '', rentConCoste: '', origenStock: '', seguro: '', seguroImporte: 0, fabricante: '', subcategoria: '', gama: '', isLibre: false, isSwap: false, facturacionAnterior: '', facturacionNueva: '' }]
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
        <div style={{ backgroundColor: 'var(--active-bg)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--mercedes-cyan)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ margin: 0, color: 'var(--light-text)', fontSize: '16px' }}>Cabecera</h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'stretch' }}>
            {/* COLUMNA 1: ASIGNACIÓN COMERCIAL */}
            <div style={{ flex: '1', minWidth: '200px', backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#1B3D6A', fontSize: '13px', fontWeight: 'bold' }}>Asignación Comercial</h4>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#1B3D6A' }}>Tienda</label>
                <select className="form-select" value={selectedTienda} onChange={e => handleTiendaChange(e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                  <option value="">Selecciona...</option>
                  {Object.keys(TIENDAS_COMERCIALES).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#1B3D6A' }}>Comercial</label>
                <select className="form-select" value={formData.vendedor} onChange={e => handleInputChange('vendedor', e.target.value)} disabled={!selectedTienda} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
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
            </div>

            {/* COLUMNA 2: DATOS DEL CLIENTE */}
            <div style={{ flex: '2', minWidth: '350px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Datos del Cliente</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#555' }}>Nombre del cliente</label>
                  <input type="text" className="form-input" maxLength={40} value={formData.nombreCliente} onChange={e => handleInputChange('nombreCliente', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#555' }}>NIF del Titular 🔑</label>
                  <input type="text" className="form-input" maxLength={9} value={formData.nif} onChange={e => handleInputChange('nif', e.target.value)} required placeholder="Llave de cruce con Telefónica/Movistar" style={estiloLlave(nifOk(formData.nif))} />
                  {formData.nif.trim().length >= 9 && !nifOk(formData.nif) && (
                    <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 'bold', color: '#D32F2F' }}>
                      ⚠️ NIF/CIF no válido: la letra no corresponde al número. Revisa el documento del cliente — no se podrá confirmar la venta.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#555' }}>Teléfono Móvil</label>
                  <input type="text" className="form-input" maxLength={9} value={formData.telefonoMovil} onChange={e => handleInputChange('telefonoMovil', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#555' }}>Teléfono Fijo</label>
                  <input type="text" className="form-input" maxLength={9} value={formData.telefonoFijo} onChange={e => handleInputChange('telefonoFijo', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                </div>
              </div>
            </div>

            {/* COLUMNA 3: OPERACIÓN */}
            <div style={{ flex: '1.5', minWidth: '250px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Operación</h4>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#555' }} title="Debe ser la fecha real de tramitación en los sistemas de Movistar">Fecha de Venta (tramitación)</label>
                <input type="date" className="form-input" value={formData.fechaVenta} onChange={e => handleInputChange('fechaVenta', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
              </div>
              {/* Advertencia premium: solo cuando la fecha elegida NO es hoy.
                  Con fecha de hoy no se muestra nada (no estorba el flujo). */}
              {formData.fechaVenta !== hoyISO && (
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #EADFCB', borderLeft: '4px solid #C9A227', borderRadius: 8, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 13, fontWeight: 600, color: '#1B2A41', letterSpacing: '0.2px' }}>
                    Has elegido una fecha distinta a hoy
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5A6B7F', lineHeight: 1.45 }}>
                    Comprueba que es la fecha real en la que se tramitó la operación en Movistar; de ella depende el mes en que se reclama el cobro.
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="form-label" style={{ color: '#555' }}>Anotaciones Generales</label>
                <textarea className="form-textarea" value={formData.anotaciones} onChange={e => handleInputChange('anotaciones', e.target.value)} style={{ flex: 1, minHeight: '40px', backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', resize: 'none' }}></textarea>
              </div>
            </div>
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
                
                {prod.categoria === 'Rent' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'stretch' }}>
                    {/* COLUMNA 1: TIPO DE VENTA */}
                    <div style={{ flex: '1', minWidth: '250px', backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h4 style={{ margin: 0, color: '#1B3D6A', fontSize: '15px', fontWeight: 'bold' }}><span style={{ color: '#1050A4' }}>{index + 1}</span> Tipo de Venta</h4>
                      
                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Tipo de Venta</label>
                        <select className="form-select" value={prod.categoria} onChange={e => handleProductChange(index, 'categoria', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {Object.keys(catalogs).filter(cat => cat !== 'Fija' && cat !== 'Móvil' && cat !== 'Micro' && cat !== 'Fija y Móvil' && cat !== 'Prepago').map(cat => <option key={cat} value={cat}>{cat === 'Ti' ? 'Contratos Móvil' : cat === 'O2' ? 'O2 MovilFree' : cat === 'Repos' ? 'Arpu (Repos)' : cat}</option>)}
                          <option value="Accesorios Venta y Stock">Accesorios Venta y Stock</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Fabricante</label>
                        <input list={`fab-${index}`} className="form-input" value={prod.fabricante} onChange={e => handleProductChange(index, 'fabricante', e.target.value)} placeholder="Buscar..." style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        <datalist id={`fab-${index}`}>
                          {[...new Set((catalogs['Rent'] || []).filter((p:any) => !prod.subcategoria || p.subcategoria === prod.subcategoria).map((p:any) => p.fabricante).filter(Boolean))].sort().map(f => <option key={String(f)} value={String(f)} />)}
                        </datalist>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Categoría</label>
                        <input list={`cat-${index}`} className="form-input" value={prod.subcategoria} onChange={e => handleProductChange(index, 'subcategoria', e.target.value)} placeholder="Buscar..." style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        <datalist id={`cat-${index}`}>
                          {[...new Set((catalogs['Rent'] || []).filter((p:any) => !prod.fabricante || p.fabricante === prod.fabricante).map((p:any) => p.subcategoria).filter(Boolean))].sort().map(c => <option key={String(c)} value={String(c)} />)}
                        </datalist>
                      </div>
                    </div>

                    {/* COLUMNA 2: DETALLES DE LA VENTA / PRODUCTO */}
                    <div style={{ flex: '2', minWidth: '350px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#333' }}>DETALLES DE LA VENTA / PRODUCTO</h4>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Producto</label>
                        <input list={`prod-${index}`} className="form-input" value={prod.producto} onChange={e => handleProductChange(index, 'producto', e.target.value)} placeholder="Escribe para buscar..." required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        <datalist id={`prod-${index}`}>
                          {(catalogs['Rent'] || []).filter((p:any) => (!prod.fabricante || p.fabricante === prod.fabricante) && (!prod.subcategoria || p.subcategoria === prod.subcategoria)).map((p:any) => p.producto).filter((p:any, i:number, self:any[]) => self.indexOf(p) === i).sort().map((p:any) => <option key={String(p)} value={String(p)} />)}
                        </datalist>

                        {prod.showMotivoSinStock && (
                          <div style={{ marginTop: '8px' }}>
                            <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#FF453A', fontWeight: 'bold' }}>
                              Motivo de venta sin stock (Obligatorio)
                            </label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={prod.motivoSinStock || ''} 
                              onChange={e => handleProductChange(index, 'motivoSinStock', e.target.value)} 
                              placeholder="Escribe el motivo..." 
                              required 
                              style={{ backgroundColor: '#FFEBEB', border: '1px solid #FF8E8E', color: '#B71C1C' }}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ height: 1, backgroundColor: '#E0E0E0', margin: '8px 0' }}></div>
                      <h5 style={{ margin: 0, fontSize: '13px', color: '#666' }}>Detalles del Producto</h5>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Gama</label>
                          <input type="text" className="form-input" value={prod.gama} readOnly style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>IMEI 🔑</label>
                          <input type="text" className="form-input" maxLength={15} value={prod.imei} onChange={e => handleProductChange(index, 'imei', e.target.value.replace(/\D/g, ''))} required placeholder="Llave de cruce con Telefónica/Movistar" style={estiloLlave(imeiOk(prod.imei))} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Teléfono</label>
                          <input type="text" className="form-input" maxLength={9} value={prod.telf} onChange={e => handleProductChange(index, 'telf', e.target.value)} onPaste={e => { const pasted = e.clipboardData.getData('text'); if (pasted.length > 9) { e.preventDefault(); handleProductChange(index, 'telf', pasted); } }} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <input type="checkbox" checked={prod.isLibre || false} onChange={e => handleProductChange(index, 'isLibre', e.target.checked)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                        <label style={{ fontSize: 13, color: '#555' }}>¿Libre?</label>
                        
                        <input type="checkbox" checked={prod.isSwap || false} onChange={e => handleProductChange(index, 'isSwap', e.target.checked)} style={{ cursor: 'pointer', width: 16, height: 16, marginLeft: '12px' }} />
                        <label style={{ fontSize: 13, color: '#555' }}>¿Swap?</label>
                      </div>
                    </div>

                    {/* COLUMNA 3: ESTADO Y FINANZAS */}
                    <div style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '8px', display: 'block' }}>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Cuota Total</label>
                        <div style={{ position: 'relative' }}>
                          <input type="number" step="0.01" className="form-input" value={prod.importe !== '' && prod.importe !== undefined ? Number(prod.importe).toFixed(2) : ''} onChange={e => handleProductChange(index, 'importe', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24 }} />
                          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B3D6A', fontSize: 13, pointerEvents: 'none' }}>€</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flex: 1 }}>
                        <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Estado</h5>
                        
                        <div className="form-group" style={{ marginBottom: 6 }}>
                          <label className="form-label" style={{ color: '#555' }}>{esLlave(prod, 'numeroPedido') ? 'Nº Pedido Telefónica/Movistar 🔑' : 'Nº Pedido Telefónica/Movistar'}</label>
                          <input type="text" className="form-input" maxLength={20} value={prod.numeroPedido || ''} onChange={e => handleProductChange(index, 'numeroPedido', e.target.value.trim().toUpperCase())} placeholder="Llave de cruce con Telefónica/Movistar" style={estiloCampo(prod, 'numeroPedido')} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
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
                            <select 
                              className="form-select" 
                              value={prod.rentConCoste || ''} 
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '') {
                                  handleProductChange(index, 'rentConCoste', val);
                                } else {
                                  if (window.confirm(`Has seleccionado: ${val === 'Si' ? 'SÍ' : 'NO'} para Rent con coste.\n\n¿Es correcta esta elección?`)) {
                                    handleProductChange(index, 'rentConCoste', val);
                                  }
                                }
                              }} 
                              required
                              style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}
                            >
                              <option value="">Selecciona...</option>
                              <option value="No">No</option>
                              <option value="Si">Sí</option>
                            </select>
                          </div>
                        </div>

                        {/* Origen del terminal: obligatorio. LOGISTICO no descuenta stock
                            de tienda (a veces se vende por envío aunque haya unidades). */}
                        <div className="form-group" style={{ marginBottom: 6, marginTop: 6 }}>
                          <label className="form-label" style={{ color: '#D32F2F', fontWeight: 'bold' }}>Origen del terminal (stock)</label>
                          <select
                            className="form-select"
                            value={prod.origenStock || ''}
                            required
                            onChange={e => {
                              const val = e.target.value
                              handleProductChange(index, 'origenStock', val)
                              if (val === 'LOGISTICO') {
                                handleProductChange(index, 'showMotivoSinStock', false)
                                handleProductChange(index, 'motivoSinStock', '')
                              }
                            }}
                            style={prod.origenStock
                              ? { backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', width: '100%' }
                              : { backgroundColor: '#FFF3E0', border: '2px solid #E65100', color: '#E65100', fontWeight: 'bold', width: '100%' }}
                          >
                            <option value="">Selecciona...</option>
                            <option value="TIENDA">🏬 Stock de tienda (descuenta de tu stock)</option>
                            <option value="LOGISTICO">🚚 Envío logístico (no descuenta)</option>
                          </select>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleAddSeguro(index)}
                            disabled={prod.isLibre}
                            className="btn-secondary"
                            style={{ 
                                width: '100%', 
                                padding: '10px 8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '8px', 
                                border: prod.isLibre ? '1px dashed #CCC' : 'none', 
                                backgroundColor: prod.isLibre ? '#F5F5F5' : '#5CB615', 
                                color: prod.isLibre ? '#AAA' : '#FFFFFF', 
                                borderRadius: '6px', 
                                cursor: prod.isLibre ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                boxShadow: prod.isLibre ? 'none' : '0 4px 12px rgba(92,182,21,0.3)',
                                transition: 'all 0.2s ease'
                            }}
                          >
                            <ShieldPlus size={16} /> Añadir Seguro a esta venta
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (prod.categoria === 'miMovistar' || prod.categoria === 'Resto BAF' || prod.categoria === 'Traslado miMovistar') ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'stretch' }}>
                    {/* COLUMNA 1: TIPO DE VENTA */}
                    <div style={{ flex: '1', minWidth: '250px', backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <h4 style={{ margin: 0, color: '#1B3D6A', fontSize: '15px', fontWeight: 'bold' }}><span style={{ color: '#1050A4' }}>{index + 1}</span> Tipo de Venta</h4>
                      
                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Tipo de Venta</label>
                        <select className="form-select" value={prod.categoria} onChange={e => handleProductChange(index, 'categoria', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {Object.keys(catalogs).filter(cat => cat !== 'Fija' && cat !== 'Móvil' && cat !== 'Micro' && cat !== 'Fija y Móvil' && cat !== 'Prepago').map(cat => <option key={cat} value={cat}>{cat === 'Ti' ? 'Contratos Móvil' : cat === 'O2' ? 'O2 MovilFree' : cat === 'Repos' ? 'Arpu (Repos)' : cat}</option>)}
                          <option value="Accesorios Venta y Stock">Accesorios Venta y Stock</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Categoría</label>
                        <select className="form-select" value={prod.subcategoria} onChange={e => handleProductChange(index, 'subcategoria', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {[...new Set((catalogs[prod.categoria === 'Traslado miMovistar' ? 'miMovistar' : prod.categoria] || []).map((p:any) => p.subcategoria).filter(Boolean))].sort().map(c => <option key={String(c)} value={String(c)}>{String(c)}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Tipo</label>
                        <select className="form-select" value={prod.gama} onChange={e => handleProductChange(index, 'gama', e.target.value)} required disabled={!prod.subcategoria} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {[...new Set((catalogs[prod.categoria === 'Traslado miMovistar' ? 'miMovistar' : prod.categoria] || []).filter((p:any) => p.subcategoria === prod.subcategoria).map((p:any) => p.gama).filter(Boolean))].sort().map(c => <option key={String(c)} value={String(c)}>{String(c)}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* COLUMNA 2: DETALLES DE LA VENTA / PRODUCTO */}
                    <div style={{ flex: '2', minWidth: '350px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#333' }}>DETALLES DEL PAQUETE</h4>
                      </div>

                      <div>
                        <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Producto</label>
                        <select className="form-select" value={prod.producto} onChange={e => handleProductChange(index, 'producto', e.target.value)} required disabled={!prod.gama} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {(catalogs[prod.categoria === 'Traslado miMovistar' ? 'miMovistar' : prod.categoria] || [])
                             .filter((p:any) => p.subcategoria === prod.subcategoria && p.gama === prod.gama)
                             .map((p:any) => p.producto)
                             .filter((p:any, i:number, self:any[]) => self.indexOf(p) === i)
                             .sort()
                             .map((p:any) => (
                               <option key={String(p)} value={String(p)}>
                                 {String(p).replace(/\n/g, ' ➕ ')}
                               </option>
                             ))}
                        </select>
                      </div>

                      {/* TICKET VISUAL */}
                      {prod.producto && (
                        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#F8F9FA', borderRadius: '6px', borderLeft: '4px solid #5CB615' }}>
                          <span style={{ fontSize: 11, color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Paquete Seleccionado:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {String(prod.producto).split('\n').map((line, i) => (
                               <div key={i} style={{ fontSize: 14, fontWeight: i === 0 ? 'bold' : 'normal', color: i === 0 ? '#1B3D6A' : '#444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 {i > 0 && <span style={{ color: '#5CB615', fontSize: 12 }}>+</span>} {line.trim()}
                               </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ height: 1, backgroundColor: '#E0E0E0', margin: '8px 0' }}></div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Teléfono (Nº Fijo / Móvil)</label>
                          <input type="text" className="form-input" maxLength={9} value={prod.telf} onChange={e => handleProductChange(index, 'telf', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Nº Pedido Telefónica/Movistar 🔑</label>
                          <input type="text" className="form-input" maxLength={20} value={prod.numeroPedido || ''} onChange={e => handleProductChange(index, 'numeroPedido', e.target.value.trim().toUpperCase())} placeholder="Llave de cruce con Telefónica/Movistar" style={estiloCampo(prod, 'numeroPedido')} />
                        </div>
                      </div>
                    </div>

                    {/* COLUMNA 3: ESTADO Y FINANZAS */}
                    <div style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '8px', display: isAdmin ? 'block' : 'none' }}>
                        <label style={{ fontSize: 13, color: '#1B3D6A', display: 'block', marginBottom: 4 }}>Comisión X (Venta)</label>
                        <div style={{ position: 'relative' }}>
                          <input type="number" step="0.01" className="form-input" readOnly value={prod.importe !== '' && prod.importe !== undefined ? Number(prod.importe).toFixed(2) : ''} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24 }} />
                          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B3D6A', fontSize: 13, pointerEvents: 'none' }}>€</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flex: 1 }}>
                        <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Estado</h5>

                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>¿Pendiente?</label>
                          <select className="form-select" value={prod.pendiente} onChange={e => handleProductChange(index, 'pendiente', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', width: '100%' }}>
                            <option value="No">No</option>
                            <option value="Si">Sí</option>
                            <option value="Anulado">Anulado</option>
                          </select>
                        </div>
                        
                        <div style={{ marginTop: '12px' }}>
                          <button
                            type="button"
                            onClick={() => handleAddSuscripcion(index)}
                            className="btn-secondary"
                            style={{ 
                                width: '100%', 
                                padding: '10px 8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: '8px', 
                                border: 'none', 
                                backgroundColor: '#5CB615', 
                                color: '#FFFFFF', 
                                borderRadius: '6px', 
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 12px rgba(92,182,21,0.3)',
                                transition: 'all 0.2s ease'
                            }}
                          >
                            <ShieldPlus size={16} /> Añadir Suscripciones TV
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : prod.categoria === 'Accesorios Venta y Stock' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', padding: '16px', borderRadius: '8px', width: '100%' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <h4 style={{ margin: 0, color: '#1B3D6A', fontSize: '15px', fontWeight: 'bold' }}>Categoría Seleccionada: Accesorios Venta y Stock</h4>
                      <p style={{ margin: '8px 0 0 0', color: '#4A5568', fontSize: '13px', lineHeight: '1.4' }}>
                        Las ventas de accesorios y el control de inventario de MicroShop se gestionan en su panel dedicado.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select className="form-select" value={prod.categoria} onChange={e => handleProductChange(index, 'categoria', e.target.value)} required style={{ backgroundColor: '#FFFFFF', border: '1px solid #90CAF9', color: '#1B3D6A', width: '200px', margin: 0 }}>
                        <option value="">Selecciona...</option>
                        {Object.keys(catalogs).filter(cat => cat !== 'Fija' && cat !== 'Móvil' && cat !== 'Micro' && cat !== 'Fija y Móvil' && cat !== 'Prepago').map(cat => <option key={cat} value={cat}>{cat === 'Ti' ? 'Contratos Móvil' : cat === 'O2' ? 'O2 MovilFree' : cat === 'Repos' ? 'Arpu (Repos)' : cat}</option>)}
                        <option value="Accesorios Venta y Stock">Accesorios Venta y Stock</option>
                      </select>
                      <Link href="/microshop-accesorios">
                        <button type="button" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#1B3D6A', color: '#FFFFFF', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                          Ir a Accesorios ➔
                        </button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'stretch' }}>
                    
                    {/* COLUMNA 1: CLASIFICACIÓN */}
                    <div style={{ flex: '1', minWidth: '150px', backgroundColor: '#B8D5F6', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ color: '#1B3D6A' }}><strong style={{ color: '#1050A4', marginRight: 4 }}>{index + 1}</strong> Tipo de Venta</label>
                        <select className="form-select" value={prod.categoria} onChange={e => handleProductChange(index, 'categoria', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                          <option value="">Selecciona...</option>
                          {Object.keys(catalogs)
                            .filter(cat => cat !== 'Fija' && cat !== 'Móvil' && cat !== 'Micro' && cat !== 'Fija y Móvil' && cat !== 'Prepago')
                            .map(cat => <option key={cat} value={cat}>{cat === 'Ti' ? 'Contratos Móvil' : cat === 'O2' ? 'O2 MovilFree' : cat === 'Repos' ? 'Arpu (Repos)' : cat}</option>)}
                          <option value="Accesorios Venta y Stock">Accesorios Venta y Stock</option>
                        </select>
                      </div>

                      {prod.categoria === 'O2' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ color: '#1B3D6A', fontSize: '13px' }}>Categoría</label>
                          <select className="form-select" value={prod.subcategoria || ''} onChange={e => handleProductChange(index, 'subcategoria', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontSize: '13px', padding: '4px 8px' }}>
                            <option value="">Todas...</option>
                            {[...new Set(catalogs['O2']?.map((p: any) => p.subcategoria).filter(Boolean))].map((sub: any) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* COLUMNA 2: DETALLES PRODUCTO */}
                    <div style={{ flex: '2.5', minWidth: '350px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ color: '#555' }}>Producto</label>
                          <select className="form-select" value={prod.producto} onChange={e => handleProductChange(index, 'producto', e.target.value)} disabled={!prod.categoria} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                            <option value="">Selecciona...</option>
                            {prod.categoria && catalogs[prod.categoria === 'Traslado miMovistar' ? 'miMovistar' : prod.categoria]
                              ?.filter((p: any) => prod.categoria !== 'O2' || !prod.subcategoria || p.subcategoria === prod.subcategoria)
                              ?.filter((p: any, i: number, self: any[]) => self.findIndex(t => t.producto === p.producto) === i)
                              .map((p: any, i: number) => <option key={p.id || i} value={p.producto}>{p.producto}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: prod.categoria === 'O2' ? '1fr' : '1fr 1fr', gap: '6px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: (prod.categoria === 'Repos' || prod.categoria === 'Suscripciones TV') ? '#D32F2F' : '#555', fontWeight: (prod.categoria === 'Repos' || prod.categoria === 'Suscripciones TV') ? 'bold' : 'normal' }}>
                              {(prod.categoria === 'Repos' || prod.categoria === 'Suscripciones TV') ? 'Teléfono Fijo Obligatorio' : 'Teléfono'}{esLlave(prod, 'telf') ? ' 🔑' : ''}
                            </label>
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
                              placeholder={esLlave(prod, 'telf') ? 'Llave de cruce con Telefónica/Movistar' : ''}
                              style={estiloCampo(prod, 'telf')}
                            />
                          </div>
                          {prod.categoria !== 'O2' && (
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ color: '#555' }}>{esLlave(prod, 'numeroPedido') ? 'Nº Pedido Telefónica/Movistar 🔑' : 'Nº Pedido Telefónica/Movistar'}</label>
                              <input type="text" className="form-input" maxLength={20} value={prod.numeroPedido || ''} onChange={e => handleProductChange(index, 'numeroPedido', e.target.value.trim().toUpperCase())} placeholder="Llave de cruce con Telefónica/Movistar" style={estiloCampo(prod, 'numeroPedido')} />
                            </div>
                          )}
                        </div>
                    </div>

                    {/* COLUMNA 3: FINANZAS / ESTADO */}
                    <div style={{ flex: '1', minWidth: '200px', backgroundColor: '#FFFFFF', borderRadius: '8px', padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {prod.categoria === 'Repos' && (() => {
                        const selRepos = (catalogs['Repos'] || []).find((p: any) => p.producto === prod.producto);
                        const isReposMult = selRepos && selRepos.comisionConCoste && Number(selRepos.comisionConCoste) > 0;
                        if (!isReposMult) return null;
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ color: '#555', fontSize: 11 }}>Fact. Anterior</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="form-input" 
                                  style={{ width: '100%', backgroundColor: '#FFF3E0', border: '1px solid #FFCC80', color: '#E65100', paddingRight: 24 }}
                                  value={prod.facturacionAnterior}
                                  onChange={e => handleProductChange(index, 'facturacionAnterior', e.target.value)} 
                                />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#E65100', fontSize: 13, pointerEvents: 'none' }}>€</span>
                              </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ color: '#555', fontSize: 11 }}>Fact. Nueva</label>
                              <div style={{ position: 'relative' }}>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="form-input" 
                                  style={{ width: '100%', backgroundColor: '#E8F5E9', border: '1px solid #A5D6A7', color: '#1B5E20', paddingRight: 24 }}
                                  value={prod.facturacionNueva}
                                  onChange={e => handleProductChange(index, 'facturacionNueva', e.target.value)} 
                                />
                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B5E20', fontSize: 13, pointerEvents: 'none' }}>€</span>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                      <div style={{ display: 'grid', gridTemplateColumns: (isAdmin && prod.categoria === 'Seguro') ? '1fr 1fr 1fr' : ((isAdmin || prod.categoria === 'Seguro') ? '1fr 1fr' : '1fr'), gap: '6px' }}>
                        <div className="form-group" style={{ marginBottom: 0, display: isAdmin ? 'block' : 'none' }}>
                          <label className="form-label" style={{ color: '#555' }}>{(prod.categoria === 'O2' || prod.categoria === 'Suscripciones TV' || prod.categoria === 'Prepago' || prod.categoria === 'Varios' || prod.categoria === 'Repos' || prod.categoria === 'Seguro') ? 'Comisión' : 'Importe'}</label>
                          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                            <input 
                              type="number" 
                              step="0.01"
                              className="form-input" 
                              style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24 }}
                              value={prod.importe !== '' && prod.importe !== undefined ? Number(prod.importe).toFixed(2) : ''} 
                              onChange={e => handleProductChange(index, 'importe', e.target.value)} 
                            />
                            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B3D6A', fontSize: 13, pointerEvents: 'none' }}>€</span>
                          </div>
                        </div>

                        {prod.categoria === 'Seguro' && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: '#555' }}>Cuota Total</label>
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                              <input 
                                type="number" 
                                step="0.01"
                                className="form-input" 
                                style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24 }}
                                value={prod.seguroImporte !== '' && prod.seguroImporte !== undefined && prod.seguroImporte !== 0 ? Number(prod.seguroImporte).toFixed(2) : ''} 
                                onChange={e => handleProductChange(index, 'seguroImporte', e.target.value)} 
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#1B3D6A', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                          </div>
                        )}

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ color: '#555' }}>¿Pendiente?</label>
                          <select className="form-select" value={prod.pendiente} onChange={e => handleProductChange(index, 'pendiente', e.target.value)} style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                            <option value="No">No</option>
                            <option value="Si">Sí</option>
                            <option value="Anulado">Anul.</option>
                          </select>
                        </div>
                      </div>

                    </div>

                  </div>
                )}
                <CartelLlaves prod={prod} />
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

// --- HELPER FUNCTIONS FOR STOCK MATCHING ---
const NOISE_WORDS = new Set(['rent', 'rnt', 'reac', 'reac.a', 'reac.b', 'reac.c', 'certif', 'apple', 'con', 'de', 'el', 'la', 'a', 'b', 'c', 'gb', 'tb']);
const MODEL_MODIFIERS = ['pro', 'max', 'mini', 'plus', 'se'];

function getKeywords(name: string): string[] {
  return name.toLowerCase()
    .replace(/(\d+)(gb|tb)/gi, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 0)
    .filter((w: string) => !NOISE_WORDS.has(w));
}

function findMatchingStockItem(prodName: string, stockItems: any[], storeField: string): any {
  const name = prodName.trim().toLowerCase();
  
  // 1. Exact match first
  let best = stockItems.find((s: any) => s.producto.trim().toLowerCase() === name);
  if (best) return best;

  // 2. Keyword match
  const keywords = getKeywords(name);
  if (keywords.length === 0) return null;

  const matches = stockItems.filter((s: any) => {
    const sTokens = s.producto.toLowerCase()
      .replace(/(\d+)(gb|tb)/gi, '$1 $2')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 0);
    
    // All input keywords must be in stock item tokens
    const allKeywordsMatch = keywords.every((kw: string) => sTokens.includes(kw));
    if (!allKeywordsMatch) return false;

    // Check modifiers: if stock item has a modifier, it must be in keywords
    const sModifiers = MODEL_MODIFIERS.filter((mod: string) => sTokens.includes(mod));
    const modifierMismatch = sModifiers.some((mod: string) => !keywords.includes(mod));
    if (modifierMismatch) return false;

    return true;
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    if (storeField) {
      const preferred = matches.find((m: any) => m[storeField] > 0);
      return preferred || matches[0];
    }
    return matches[0];
  }

  return null;
}

function getStoreField(storeName: string): string {
  if (storeName === 'Auxiliadora 45') return 'udsAuxiliadora';
  if (storeName === 'Correhuela') return 'udsCorrehuela';
  if (storeName === 'Villamayor') return 'udsVillamayor';
  if (storeName === 'Béjar') return 'udsBejar';
  if (storeName === 'O2') return 'udsMovilfree';
  return '';
}
