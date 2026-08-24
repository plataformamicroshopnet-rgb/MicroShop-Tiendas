'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { FilePlus, ShieldPlus } from 'lucide-react'
import { CODIGOS_TRAMITACION } from '@/lib/constants'
import { getEffectiveTiendaComerciales, getEffectiveSellers } from '@/lib/comercialRoster'
import { isVentaWithinDates, esRepoArpuManual, importeRepoArpu, factorRepoArpu, REPO_ARPU_CORTE, PALANCA_REPOS } from '@/lib/salesUtils'
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
        facturacionNueva: '',
        arpuIncremento: ''
      }
    ]
  })

  const [stockItems, setStockItems] = useState<any[]>([])
  const [tiendaHours, setTiendaHours] = useState<any[]>([])

  // Plantilla del mes (panel "Horarios de Comerciales"); fallback a la lista fija
  const tiendaMap = getEffectiveTiendaComerciales(tiendaHours)
  const rosterSellers = getEffectiveSellers(tiendaHours)

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
  // Códigos de operación reales de Movistar: CO+añomes+referencia
  // (CO2511X8DKWOM2) o pedidos MD/MDN+dígitos (MD00021663, MDN00027659).
  // Rellenos tipo "1111..." o códigos mal tecleados quedan en naranja.
  const pedidoOk = (v: string) => /^(CO\d{4}[A-Z0-9]{6,12}|MDN?\d{6,10})$/.test(String(v || '').trim().toUpperCase())
  // IMEI real: 15 dígitos donde el último es dígito de control (Luhn).
  // Caza IMEIs inventados (111...), incompletos o con un dígito mal tecleado.
  const imeiOk = (v: string) => {
    const s = String(v || '').trim()
    if (!/^[0-9]{15}$/.test(s)) return false
    // Mismo dígito repetido 15 veces = relleno (000... pasa el Luhn)
    if (/^([0-9])\1{14}$/.test(s)) return false
    let suma = 0
    for (let i = 0; i < 15; i++) {
      let d = s.charCodeAt(i) - 48
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
      suma += d
    }
    return suma % 10 === 0
  }

  const llavesDeProducto = (prod: any): { campo: string; etiqueta: string; ok: boolean }[] => {
    const cat = prod.categoria
    const ll: { campo: string; etiqueta: string; ok: boolean }[] = []
    if (cat === 'Rent') {
      // Envío logístico: el terminal lo manda Telefónica, no hay IMEI que
      // teclear → la llave IMEI se da por buena (verde, no exigida).
      ll.push({ campo: 'imei', etiqueta: 'IMEI', ok: imeiOk(prod.imei) || prod.origenStock === 'LOGISTICO' })
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
    } else if (cat === 'Repos UP') {
      // Palanca nueva de los Repos: mismas llaves que las dos que sustituye.
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
    if (!activePeriodKey) return
    fetch(`/api/tiendas-comisiones?periodKey=${activePeriodKey}`)
      .then(r => r.json())
      .then(d => setTiendaHours(d?.hours || []))
      .catch(() => setTiendaHours([]))
  }, [activePeriodKey])

  useEffect(() => {
    if (user) {
      const username = user.username || ''
      // Find user store en la plantilla del mes (fallback lista fija)
      const match = Object.entries(tiendaMap).find(([store, commercials]) =>
        (commercials as string[]).some((c) => c.toLowerCase() === username.toLowerCase())
      )

      if (match) {
        setSelectedTienda(match[0])
        setFormData((prev: any) => ({ ...prev, vendedor: username }))
      }
    }
  }, [user, tiendaHours])

  // Handlers
  const handleInputChange = (field: string, value: any) => {
    // Al cambiar la FECHA de la venta, re-elegir la vigencia del catálogo que
    // cubre esa fecha en las líneas Rent/Seguro y re-preciar SOLO los importes
    // de autorrelleno (los que coinciden con alguna tarifa del producto). Un
    // precio tecleado a mano (descuento) no se toca jamás.
    if (field === 'fechaVenta') {
      setFormData((prev: any) => {
        const fechaEs = String(value || '').split('-').reverse().join('/')
        const num = (x: any) => { const n = parseFloat(String(x ?? '').replace(',', '.')); return isNaN(n) ? null : n }
        const newProducts = (prev.productos || []).map((prod: any) => {
          const cat = prod.categoria
          if ((cat !== 'Rent' && cat !== 'Seguro') || !prod.producto) return prod
          const catList = catalogs[cat] || []
          const cands = catList.filter((p: any) => p.producto === prod.producto)
          if (cands.length < 2) return prod
          const sel = cands.find((p: any) => isVentaWithinDates(fechaEs, p.validFrom, p.validTo)) || cands[0]
          const impNum = num(prod.importe)
          if (cat === 'Rent') {
            const tarifas = cands.map((p: any) => num(p.anual || p.mensual)).filter((t: any): t is number => t !== null)
            const esAutofill = !String(prod.importe || '').trim() || (impNum !== null && tarifas.some((t: number) => Math.abs(t - impNum) < 0.005))
            if (!esAutofill) return prod
            return { ...prod, importe: sel.anual || sel.mensual || '', fabricante: sel.fabricante || prod.fabricante, subcategoria: sel.subcategoria || prod.subcategoria, gama: sel.gama || prod.gama }
          }
          // Seguro: importe = comisión; seguroImporte = prima anual (Cuota Total).
          // La prima es el ÚNICO campo económico visible para un comercial, así
          // que el detector de autofill debe mirar TAMBIÉN seguroImporte: una
          // prima negociada a mano no se repone jamás (mismo criterio que el
          // reprice del servidor).
          const tarifasCom = cands.map((p: any) => num(p.comision)).filter((t: any): t is number => t !== null)
          const comAutofill = !String(prod.importe || '').trim() || (impNum !== null && tarifasCom.some((t: number) => Math.abs(t - impNum) < 0.005))
          const tarifasPrima = cands.map((p: any) => num(p.anual)).filter((t: any): t is number => t !== null)
          const primaNum = num(prod.seguroImporte)
          const primaAutofill = primaNum === null || primaNum === 0 || tarifasPrima.some((t: number) => Math.abs(t - primaNum) < 0.005)
          if (!comAutofill || !primaAutofill) return prod
          const upd: any = { ...prod, importe: sel.comision || '' }
          if (sel.anual) upd.seguroImporte = parseFloat(String(sel.anual).replace(',', '.')) || 0
          return upd
        })
        return { ...prev, [field]: value, productos: newProducts }
      })
      return
    }
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

      // El aviso de penalización de los repos vivía solo en la palanca vieja;
      // al retirarla del desplegable se habría quedado sin poder salir nunca.
      if (field === 'categoria' && (value === 'Repos' || value === 'Repos UP')) {
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
         newProducts[index].descuentoSinPlus = false
      }

      if (field === 'fabricante' || field === 'subcategoria') {
         newProducts[index].producto = ''
         newProducts[index].importe = ''
         newProducts[index].descuentoSinPlus = false
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
         const matchFn = (p: any) => {
           if (newProducts[index].categoria === 'miMovistar' || newProducts[index].categoria === 'Resto BAF' || newProducts[index].categoria === 'Traslado miMovistar') {
             return p.producto === value && p.subcategoria === newProducts[index].subcategoria && p.gama === newProducts[index].gama;
           }
           if (newProducts[index].categoria === 'O2' && newProducts[index].subcategoria) {
             return p.producto === value && p.subcategoria === newProducts[index].subcategoria;
           }
           return p.producto === value;
         }
         // VIGENCIAS: si el producto tiene varias filas con fechas Desde/Hasta
         // (p.ej. un Rent o un Seguro que cambia de precio a mitad de mes), se
         // autofilla con la tarifa cuya ventana CUBRE la fecha de la venta; si
         // ninguna cubre, la primera (mejor un precio que ninguno).
         const candidatos = catList.filter(matchFn)
         const fechaVentaEs = String(prev.fechaVenta || '').split('-').reverse().join('/')
         const selectedItem = candidatos.length > 1
           ? (candidatos.find((p: any) => isVentaWithinDates(fechaVentaEs, p.validFrom, p.validTo)) || candidatos[0])
           : candidatos[0]
         if (selectedItem) {
             const parseSafeNum = (val: any) => {
               if (!val) return 0;
               if (typeof val === 'number') return val;
               return Number(String(val).replace(',', '.')) || 0;
             };
             const cat = newProducts[index].categoria
            // «Repos (Arpu)» se rellena como Suscripciones TV: comisión ×
            // multiplicador. OJO, la pestaña VIEJA («Repos») usa el multiplicador
            // para otra cosa (el modo Fact. Anterior / Fact. Nueva del ARPU), y si
            // la nueva entrara por ahí el producto de 78 € se autorrellenaría a 0 €.
            if (usaIncrementoArpu(newProducts[index])) {
              // Repo de ARPU con importe a mano: el precio no está en la tarifa,
              // sale del incremento que teclea el tramitador por su multiplicador
              // (lo elige el programa según el tramo). Al elegir el producto aún
              // no hay incremento: el importe se rellena al teclearlo.
              newProducts[index].importe = String(importeRepoArpu(newProducts[index].arpuIncremento))
            } else if (cat === 'Repos UP' && esRepoIncrementoArpu(newProducts[index].producto)) {
              // Repo de incremento de ARPU dentro de la palanca nueva: el importe
              // lo ponen las casillas Fact. Anterior / Fact. Nueva, no la tarifa.
              if (selectedItem.comisionConCoste && Number(selectedItem.comisionConCoste) > 0) {
                const ant = Number(newProducts[index].facturacionAnterior || 0)
                const nue = Number(newProducts[index].facturacionNueva || 0)
                newProducts[index].importe = String(Math.max(0, nue - ant) * Number(selectedItem.comisionConCoste))
              } else {
                newProducts[index].importe = selectedItem.comision || ''
              }
            } else if (cat === 'Repos UP') {
              // Suscripcion añadida sobre un traslado miMovistar: no se abona.
              if (newProducts[index].isSuscTraslado) {
                newProducts[index].importe = '0';
              } else {
                const baseCom = parseSafeNum(selectedItem.comision);
                const mult = parseSafeNum(selectedItem.comisionConCoste || '1.00');
                newProducts[index].importe = String(baseCom * (mult === 0 ? 1 : mult));
              }
            } else if (cat === 'Suscripciones TV') {
              if (newProducts[index].isSuscTraslado) {
                newProducts[index].importe = '0';
              } else {
                const baseCom = parseSafeNum(selectedItem.comision);
                const mult = parseSafeNum(selectedItem.comisionConCoste || '1.00');
                newProducts[index].importe = String(baseCom * (mult === 0 ? 1 : mult));
              }
            } else if (cat === 'O2' || cat === 'Seguro' || cat === 'Prepago' || cat === 'Varios' || cat === 'Accesorios') {
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
              let impMm = baseCom * (mult === 0 ? 1 : mult);
              // Promoción «sin el Paquete Movistar Plus»: −14 € (solo miMovistar).
              if (cat === 'miMovistar' && newProducts[index].descuentoSinPlus) {
                impMm = Math.max(0, impMm - 14);
              }
              newProducts[index].importe = String(impMm);
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
      
      // Casilla de la promo «sin el Paquete Movistar Plus»: recalcular el importe
      // desde el catálogo al marcar/desmarcar (−14 €, solo miMovistar AV/MV).
      if (field === 'descuentoSinPlus' && newProducts[index].categoria === 'miMovistar'
          && newProducts[index].producto) {
         const catListMm = catalogs['miMovistar'] || []
         const selMm = catListMm.find((p: any) => p.producto === newProducts[index].producto
            && p.subcategoria === newProducts[index].subcategoria
            && p.gama === newProducts[index].gama)
         if (selMm) {
            const numMm = (v: any) => Number(String(v ?? '').replace(',', '.')) || 0
            const multMm = numMm(selMm.comisionConCoste)
            const baseMm = numMm(selMm.comision) * (multMm === 0 ? 1 : multMm)
            newProducts[index].importe = String(value === true ? Math.max(0, baseMm - 14) : baseMm)
         }
      }

      if (field === 'isLibre') {
         // If they check "Libre", we don't need to clear seguro anymore because it's handled via a separate row
         if (value === true) {
         }
      }
      
      // Repo de ARPU a mano: el importe se rehace en cuanto cambia el incremento.
      if (usaIncrementoArpu(newProducts[index]) && field === 'arpuIncremento') {
         newProducts[index].importe = String(importeRepoArpu(value))
      }

      // Recalcular importe para Repos si cambian los factores numéricos
      if (usaModoArpu(newProducts[index]) && (field === 'facturacionAnterior' || field === 'facturacionNueva')) {
         const catList = catalogs[newProducts[index].categoria] || []
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
          facturacionNueva: '',
          arpuIncremento: ''
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

  // ── OTRO REPO (ARPU) PARA EL MISMO CLIENTE ───────────────────────────────────
  // Hay clientes que contratan varios paquetes a la vez (Ficción Total con
  // Netflix + Motor, como pasó en julio): este botón añade otra línea de
  // «Repos (Arpu)» copiando teléfono y nº de cliente. El Nº Pedido NO se copia:
  // cada paquete llega con su propio boletín de Telefónica y esa es la llave del
  // cotejo. Cada paquete = su línea = 1 unidad de la palanca, con su tarifa, y
  // el total de la venta los suma solos.
  const handleAddOtroRepo = (index: number) => {
    if (formData.productos.length >= 50) return
    const currentProd = formData.productos[index]
    setFormData((prev: any) => ({
      ...prev,
      productos: [
        ...prev.productos,
        {
          categoria: 'Repos UP',
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

  // ── QUÉ TIPOS DE VENTA SE PUEDEN ELEGIR ──────────────────────────────────────
  // Rediseño de los Repos (ago-2026): «Repos» (la vieja, que se veía «Arpu (Repos)»)
  // y «Suscripciones TV» se unifican en la palanca nueva «Repos (Arpu)» y dejan de
  // poder elegirse. Siguen VISIBLES si la línea que se está editando ya las tiene:
  // si no, al abrir una venta antigua el desplegable saldría en blanco y al guardar
  // se perdería su tipo.
  // ── REPOS DE «INCREMENTO DE ARPU» ────────────────────────────────────────────
  // Los cuatro «Repos destino BAF miMovistar/Fusión incremento de ARPU …» no se
  // teclean con un precio de tarifa: su importe sale de lo que sube la factura del
  // cliente (Fact. Nueva − Fact. Anterior) por el factor del catálogo. Ese modo
  // vivía atado a la palanca «Repos»; ahora va con el PRODUCTO, así que funciona
  // esté en la palanca que esté.
  // Telefónica los retiró en agosto de 2026, así que no se venden más — pero las
  // ventas que YA existen (seis de la primera semana de agosto, y todo el
  // histórico) se siguen abriendo, editando y anulando con sus dos casillas.
  const esRepoIncrementoArpu = (producto: any) =>
    String(producto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .includes('incremento de arpu')
  /** ¿Esta línea se teclea con las casillas Fact. Anterior / Fact. Nueva? */
  const usaModoArpu = (prod: any) =>
    (prod?.categoria === 'Repos' || (prod?.categoria === 'Repos UP' && esRepoIncrementoArpu(prod?.producto)))
    && !esRepoArpuManual(prod?.producto)

  /**
   * ¿Esta línea se teclea con UNA casilla (el incremento de ARPU) y el programa
   * pone el multiplicador? Es el relevo de los cuatro productos por tramos: el
   * tramitador ya no elige tramo, solo dice cuánto sube la factura.
   */
  const usaIncrementoArpu = (prod: any) =>
    prod?.categoria === PALANCA_REPOS && esRepoArpuManual(prod?.producto)

  // Palancas RETIRADAS: no se pueden elegir al teclear una venta nueva.
  // · «Suscripciones TV» → sus productos viven ahora en «Repos (Arpu)».
  // · «Repos» (la vieja «Arpu (Repos)») → Telefónica retiró sus productos de
  //   «incremento de ARPU», así que la palanca se queda sin nada que vender; y el
  //   repo de fútbol se teclea desde agosto en «Repos (Arpu)».
  // Una línea que YA tiene una de las dos la sigue mostrando (ver catsElegibles),
  // para poder abrir y editar las ventas antiguas sin que se quede en blanco.
  const CATS_RETIRADAS = ['Suscripciones TV', 'Repos']
  // Productos que ya no se eligen aunque su palanca siga viva.
  const PRODUCTOS_RETIRADOS: Record<string, string[]> = { 'Repos': ['Extra Repos up destino Fútbol'] }
  const CATS_NUNCA = ['Fija', 'Móvil', 'Micro', 'Fija y Móvil', 'Prepago']
  const catsElegibles = (actual: string) => Object.keys(catalogs)
    .filter(cat => !CATS_NUNCA.includes(cat))
    .filter(cat => !CATS_RETIRADAS.includes(cat) || cat === actual)
  const etiquetaCat = (cat: string) => cat === 'Ti' ? 'Contratos Móvil'
    : cat === 'O2' ? 'O2 MovilFree'
    : cat === 'Repos' ? 'Arpu (Repos) — histórico'
    : cat === 'Repos UP' ? 'Repos (Arpu)'
    : cat === 'Suscripciones TV' ? 'Suscripciones TV — histórico'
    : cat
  const opcionesCat = (actual: string) => catsElegibles(actual)
    .map(cat => <option key={cat} value={cat}>{etiquetaCat(cat)}</option>)

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
            // Las suscripciones de TV viven desde ago-2026 en la palanca nueva
            // «Repos (Arpu)»: el boton sigue llamandose igual para quien teclea.
            categoria: 'Repos UP',
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

    // El repo de ARPU no se puede guardar sin su incremento: sin él no hay
    // multiplicador que aplicar y la venta entraría con el importe en crudo.
    if (formData.productos.some((p: any) => esRepoArpuManual(p.producto)
        && !(Number(String(p.arpuIncremento ?? '').replace(',', '.')) > 0))) {
      setError('En el repo de «Reposicionamientos destino BAF miMovistar/Fusión» tienes que teclear el Incremento de ARPU (IVA incl.): el programa lo multiplica solo (×2 desde 10 €, ×1,5 por debajo).')
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
      let res = await fetch('/api/sales/unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, periodKey: activePeriodKey, codigo: selectedTienda })
      })

      let data = await res.json()

      // Posible duplicado: el servidor avisa (409) y el comercial decide
      if (res.status === 409 && data.duplicado) {
        if (!window.confirm(data.error + '\n\nPulsa Aceptar SOLO si es una venta nueva de verdad.')) {
          setLoading(false)
          return
        }
        res = await fetch('/api/sales/unified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, periodKey: activePeriodKey, codigo: selectedTienda, confirmarDuplicado: true })
        })
        data = await res.json()
      }

      if (res.ok && data.success) {
        setSuccess('¡VENTA AÑADIDA CON ÉXITO!')
        setSelectedTienda('')
        setFormData({
          vendedor: '', nombreCliente: '', codigo: '', nif: '', telefonoMovil: '', telefonoFijo: '', fechaVenta: new Date().toISOString().slice(0, 10), anotaciones: '',
          productos: [{ categoria: '', producto: '', telf: '', noCliente: '', pendiente: 'No', importe: '', imei: '', numeroPedido: '', rentConCoste: '', origenStock: '', seguro: '', seguroImporte: 0, fabricante: '', subcategoria: '', gama: '', isLibre: false, isSwap: false, facturacionAnterior: '', facturacionNueva: '', arpuIncremento: '' }]
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
                  {Object.keys(tiendaMap).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: '#1B3D6A' }}>Comercial</label>
                <select className="form-select" value={formData.vendedor} onChange={e => handleInputChange('vendedor', e.target.value)} disabled={!selectedTienda} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }}>
                  <option value="">Selecciona...</option>
                  {selectedTienda && (
                    <>
                      <optgroup label={`Asignados a ${selectedTienda}`}>
                        {(tiendaMap[selectedTienda] || []).map(v => <option key={v} value={v}>{v}</option>)}
                      </optgroup>
                      <optgroup label="Otras Tiendas">
                        {rosterSellers.filter(v => !(tiendaMap[selectedTienda] || []).includes(v)).map(v => <option key={v} value={v}>{v}</option>)}
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
                  {formData.nif.trim().length > 0 && !nifOk(formData.nif) && (
                    <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 'bold', color: '#D32F2F' }}>
                      ⚠️ NIF/CIF mal puesto o incompleto. Revisa el documento del cliente — no se podrá confirmar la venta.
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
                <input type="date" className="form-input" value={formData.fechaVenta} max={hoyISO} onChange={e => handleInputChange('fechaVenta', e.target.value)} required style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
              </div>
              {/* Advertencia premium: solo cuando la fecha elegida NO es hoy.
                  Si además cae en OTRO MES, se avisa de que la venta contará
                  en ese mes (es donde queda anclada para liquidar y comisionar). */}
              {formData.fechaVenta !== hoyISO && (
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #EADFCB', borderLeft: '4px solid #C9A227', borderRadius: 8, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 13, fontWeight: 600, color: '#1B2A41', letterSpacing: '0.2px' }}>
                    {formData.fechaVenta.slice(0, 7) !== hoyISO.slice(0, 7) ? '⚠️ Esta venta contará en otro mes' : 'Has elegido una fecha distinta a hoy'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5A6B7F', lineHeight: 1.45 }}>
                    {formData.fechaVenta.slice(0, 7) !== hoyISO.slice(0, 7)
                      ? `OJO: con fecha ${formData.fechaVenta.split('-').reverse().join('/')}, la venta quedará anclada a ese mes y contará para TODO como si el mes estuviera en vigor: listados, comisiones (su nómina en borrador se re-verifica sola cada madrugada) y liquidación con Telefónica. Asegúrate de que es la fecha real de tramitación. Los meses con la nómina ya pagada están bloqueados.`
                      : 'Comprueba que es la fecha real en la que se tramitó la operación en Movistar; de ella depende el mes en que se reclama el cobro.'}
                  </div>
                </div>
              )}
              {/* Una venta de las palancas nuevas con fecha ANTERIOR a agosto de
                  2026 es una corrección contable: se guarda con su importe pero
                  NO paga comisión a nadie (el candado de fecha del motor). Sin
                  este aviso se enseñaban 78 € en pantalla y se pagaban 0 € en
                  silencio, y no se veía hasta el cuadre del mes. */}
              {formData.fechaVenta < '2026-08-01' &&
               formData.productos.some((p: any) => p.categoria === 'Repos UP' || p.categoria === 'Repo Fútbol') && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderLeft: '4px solid #DC2626', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
                    ⛔ Repos (Arpu) con fecha anterior a agosto
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7F1D1D', lineHeight: 1.45 }}>
                    Esta palanca no existía antes del 1 de agosto de 2026: la venta se guardará
                    y se cobrará, pero <b>no pagará comisión a ningún comercial</b>. Si es una
                    venta de verdad de un mes anterior, avisa antes de guardarla.
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
                          {opcionesCat(prod.categoria)}
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

                      {/* Origen del terminal: obligatorio, justo debajo del Producto.
                          LOGISTICO no descuenta stock de tienda (a veces se vende por
                          envío aunque haya unidades, por color o reserva). */}
                      <div>
                        <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#D32F2F', fontWeight: 'bold' }}>Origen del terminal (stock)</label>
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
                              // Logístico: lo envía Telefónica, no hay IMEI que teclear
                              handleProductChange(index, 'imei', '')
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

                      <div style={{ height: 1, backgroundColor: '#E0E0E0', margin: '8px 0' }}></div>
                      <h5 style={{ margin: 0, fontSize: '13px', color: '#666' }}>Detalles del Producto</h5>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>Gama</label>
                          <input type="text" className="form-input" value={prod.gama} readOnly style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, display: 'block', marginBottom: 4, color: '#555' }}>IMEI 🔑</label>
                          <input
                            type="text"
                            className={prod.origenStock === 'LOGISTICO' ? 'form-input ph-blanco' : 'form-input'}
                            maxLength={15}
                            value={prod.origenStock === 'LOGISTICO' ? '' : prod.imei}
                            onChange={e => handleProductChange(index, 'imei', e.target.value.replace(/\D/g, ''))}
                            required={prod.origenStock !== 'LOGISTICO'}
                            disabled={prod.origenStock === 'LOGISTICO'}
                            placeholder={prod.origenStock === 'LOGISTICO' ? 'Lo envía Telefónica (sin IMEI)' : 'Llave de cruce con Telefónica/Movistar'}
                            style={prod.origenStock === 'LOGISTICO' ? estiloLlave(true) : estiloLlave(imeiOk(prod.imei))}
                          />
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
                          {opcionesCat(prod.categoria)}
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

                      {/* Promo −14 €: miMovistar SIN el Paquete Movistar Plus (solo AV y MV) */}
                      {prod.categoria === 'miMovistar'
                        && ['AV', 'MV'].includes(String(prod.subcategoria || '').toUpperCase().trim()) && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                          padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                          backgroundColor: prod.descuentoSinPlus ? '#FFF3E0' : '#F8F9FA',
                          border: `1px solid ${prod.descuentoSinPlus ? '#FFB74D' : '#E0E0E0'}`, color: '#333' }}>
                          <input type="checkbox" checked={!!prod.descuentoSinPlus}
                            onChange={e => handleProductChange(index, 'descuentoSinPlus', e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }} />
                          <span>
                            <b>Descuento 14 €</b> · Promoción sin el Paquete Movistar Plus
                            {prod.descuentoSinPlus && prod.importe !== '' && prod.importe !== undefined
                              ? <b style={{ color: '#E65100' }}>{` — aplicado: ${Number(prod.importe).toFixed(2)} €`}</b>
                              : ''}
                          </span>
                        </label>
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
                        {opcionesCat(prod.categoria)}
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
                          {opcionesCat(prod.categoria)}
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
                              // El repo de fútbol ya no se teclea aquí: va en «Repos (Arpu)»,
                              // donde vale 78 € y el programa le añade solo su extra de 10 €.
                              // Si se dejara, se seguiría apuntando a 10 € como hasta ahora.
                              ?.filter((p: any) => !(PRODUCTOS_RETIRADOS[prod.categoria] || []).includes(String(p.producto || '').trim())
                                                  || String(p.producto || '').trim() === prod.producto)
                              // El repo de ARPU, EL PRIMERO de la lista: es el que más se
                              // teclea y el catálogo lo dejaba el último de veinte (el orden
                              // del desplegable es el de alta de las filas). El sort es
                              // estable, así que el resto conserva su orden de siempre.
                              ?.sort((a: any, b: any) => (esRepoArpuManual(b?.producto) ? 1 : 0) - (esRepoArpuManual(a?.producto) ? 1 : 0))
                              .map((p: any, i: number) => <option key={p.id || i} value={p.producto}>{p.producto}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: prod.categoria === 'O2' ? '1fr' : '1fr 1fr', gap: '6px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: (prod.categoria === 'Repos' || prod.categoria === 'Suscripciones TV' || prod.categoria === 'Repos UP') ? '#D32F2F' : '#555', fontWeight: (prod.categoria === 'Repos' || prod.categoria === 'Suscripciones TV' || prod.categoria === 'Repos UP') ? 'bold' : 'normal' }}>
                              {(prod.categoria === 'Repos' || prod.categoria === 'Suscripciones TV' || prod.categoria === 'Repos UP') ? 'Teléfono Fijo Obligatorio' : 'Teléfono'}{esLlave(prod, 'telf') ? ' 🔑' : ''}
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
                      {/* Repo de ARPU con importe a mano: UNA casilla y la cuenta
                          a la vista. La casilla «Comisión» de al lado solo la ve
                          un Admin, así que el tramitador se quedaría sin poder
                          teclear nada; esta la ve todo el mundo. */}
                      {usaIncrementoArpu(prod) && (() => {
                        const inc = parseFloat(String(prod.arpuIncremento ?? '').replace(',', '.'))
                        const hayInc = !isNaN(inc) && inc > 0
                        const factor = factorRepoArpu(prod.arpuIncremento)
                        const total = importeRepoArpu(prod.arpuIncremento)
                        return (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ color: '#555', fontSize: 11, fontWeight: 'bold' }}>
                              Incremento de ARPU (IVA incl.) 🔑
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-input"
                                style={{ width: '100%', backgroundColor: '#FFF3E0', border: '1px solid #FFCC80', color: '#E65100', fontWeight: 'bold', paddingRight: 24 }}
                                value={prod.arpuIncremento ?? ''}
                                onChange={e => handleProductChange(index, 'arpuIncremento', e.target.value)}
                                placeholder="Lo que le sube la factura"
                              />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#E65100', fontSize: 13, pointerEvents: 'none' }}>€</span>
                            </div>
                            <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35, color: hayInc ? '#1B5E20' : '#777' }}>
                              {hayInc ? (
                                <><b>{inc.toFixed(2).replace('.', ',')} € × {String(factor).replace('.', ',')}</b>{' = '}
                                  <b style={{ fontSize: 13 }}>{total.toFixed(2).replace('.', ',')} €</b>
                                  <span style={{ color: '#777' }}>{' '}(tramo {inc >= REPO_ARPU_CORTE ? `≥ ${REPO_ARPU_CORTE} €` : `< ${REPO_ARPU_CORTE} €`})</span></>
                              ) : (
                                <>Teclea cuánto sube la factura del cliente: desde {REPO_ARPU_CORTE} € se paga ×2, por debajo ×1,5.</>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                      {usaModoArpu(prod) && (() => {
                        const selRepos = (catalogs[prod.categoria] || []).find((p: any) => p.producto === prod.producto);
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
                          <label className="form-label" style={{ color: '#555' }}>{usaIncrementoArpu(prod) ? 'Comisión (la calcula el programa)' : ((prod.categoria === 'O2' || prod.categoria === 'Suscripciones TV' || prod.categoria === 'Prepago' || prod.categoria === 'Varios' || prod.categoria === 'Accesorios' || prod.categoria === 'Repos' || prod.categoria === 'Repos UP' || prod.categoria === 'Seguro') ? 'Comisión' : 'Importe')}</label>
                          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                            <input 
                              type="number" 
                              step="0.01"
                              className="form-input" 
                              // El repo de ARPU se teclea SOLO en su casilla: aquí sale la
                              // cuenta ya hecha y no se puede escribir. Un Admin ve las dos
                              // casillas y, escribiendo en esta, se saltaba el multiplicador
                              // SIN AVISO (una venta de 55 € que debía cobrar 110).
                              readOnly={usaIncrementoArpu(prod)}
                              title={usaIncrementoArpu(prod) ? 'Sale del incremento de ARPU × su multiplicador' : undefined}
                              style={{ backgroundColor: usaIncrementoArpu(prod) ? '#ECEFF1' : '#E3F2FD', border: '1px solid #90CAF9', color: '#1B3D6A', fontWeight: 'bold', width: '100%', paddingRight: 24, cursor: usaIncrementoArpu(prod) ? 'not-allowed' : 'auto' }}
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
                {/* Varios paquetes a la vez (Ficción + Motor…): otra línea de
                    Repos (Arpu) con un clic, cada una con su boletín y su tarifa */}
                {prod.categoria === 'Repos UP' && formData.productos.length < 50 && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleAddOtroRepo(index)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                               border: 'none', backgroundColor: '#5CB615', color: '#FFFFFF',
                               borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
                               boxShadow: '0 4px 12px rgba(92,182,21,0.3)', transition: 'all 0.2s ease' }}
                    >
                      <span style={{ fontSize: 16 }}>➕</span> Añadir otro Repo (Arpu) a este cliente
                    </button>
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
