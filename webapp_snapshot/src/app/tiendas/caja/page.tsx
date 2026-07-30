'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calculator, Plus, Trash2, CheckCircle2, CircleDashed, Clock, ChevronDown, X, Printer } from 'lucide-react'
import { useGuard } from '@/hooks/useGuard'
import { canView } from '@/lib/permissions'

// Importamos el mapeo de tiendas para saber dónde cae el usuario actual
import { TIENDAS_COMERCIALES, VENDEDORES } from '@/lib/constants'
import {
  CONCEPTOS, TIENDAS_CON_CAJA, DESTINO_BANCO, destinosDesde, esDestinoExterno,
  normalizarImporte, signoDeConcepto, cajaDeUsuario,
} from '@/lib/caja'

type CajaEntry = {
  id: string
  tienda: string
  fecha: string
  concepto: string
  detalle: string
  importe: number
  createdAt: string
  vendedor: string | null
  estadoTrazabilidad: 'ROJO' | 'NARANJA' | 'VERDE' | null
  // Traspasos de efectivo entre cajas
  tipo: string | null
  traspasoId: string | null
  entregadoPor: string | null
  receptor: string | null
  tiendaOrigen: string | null
  tiendaDestino: string | null
  conciliadoPor: string | null
  conciliadoEn: string | null
}

export default function CajaTiendasPage() {
  const { authorized, user } = useGuard('CARD_CAJA')
  const router = useRouter()

  const [entries, setEntries] = useState<CajaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // En qué caja está el usuario. MISMA función que usa el servidor: cuando
  // cada lado tenía su copia de la regla, a Salva (jefe de ventas) la pantalla
  // le daba mando total y el servidor le contestaba «sin tienda asignada».
  // Y el mapeo del grupo «O2» a la caja «MovilFree» solo estaba en un lado,
  // así que Marta trabajaba en una pestaña que no era ninguna caja.
  const userTienda = useMemo(
    () => cajaDeUsuario(user, TIENDAS_COMERCIALES, {
      mandaSobreTodas: canView(user, 'HUB_CRISTINA'),
      puedeCaja: canView(user, 'CARD_CAJA') || canView(user, 'HUB_BACKOFFICE'),
    }),
    [user])

  const [activeTab, setActiveTab] = useState<string>('')

  useEffect(() => {
    if (userTienda) {
      if (userTienda === 'ADMIN') {
        setActiveTab('Central')
      } else {
        setActiveTab(userTienda)
      }
    }
  }, [userTienda])

  // Fetch entries
  const fetchEntries = async () => {
    if (!activeTab) return;
    setLoading(true)
    try {
      let url = '/api/caja'
      if (userTienda !== 'ADMIN') {
        url += `?tienda=${activeTab}`
      }

      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Ahora la API pide sesión: si caduca, antes se quedaba la tabla con
        // datos viejos y sin decir nada. Con dinero delante eso no vale.
        setErrorCarga(res.status === 401
          ? 'Tu sesión ha caducado. Vuelve a entrar para ver la caja.'
          : (data?.error || 'No se han podido cargar los movimientos.'))
        setEntries([])
        return
      }
      setErrorCarga(null)
      setEntries(data.entries || [])
    } catch (error) {
      console.error(error)
      setErrorCarga('No se han podido cargar los movimientos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [activeTab, userTienda])

  // --- Modal Añadir ---
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEntry, setNewEntry] = useState({
    fecha: new Date().toISOString().split('T')[0],
    importe: '',
    concepto: CONCEPTOS[0],
    detalle: ''
  })

  // --- Modal Salida de efectivo (registra Y imprime) ---
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [guardandoSalida, setGuardandoSalida] = useState(false)
  const [errorSalida, setErrorSalida] = useState<string | null>(null)
  const [printData, setPrintData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    vendedor: '',
    receptor: '',
    destino: 'Central',
    concepto: '',
    importe: ''
  })

  /**
   * Reimprime el justificante de una salida YA REGISTRADA.
   *
   * Sin esto, si el navegador bloqueaba la ventana emergente la única forma de
   * conseguir el papel era volver a registrar la salida entera: dos traspasos
   * por la misma entrega y el dinero descontado dos veces.
   */
  const reimprimir = (e: CajaEntry) => {
    setPrintData({
      fecha: e.fecha,
      vendedor: e.entregadoPor || e.vendedor || '',
      receptor: e.receptor || '',
      destino: e.tiendaDestino || '',
      concepto: e.detalle || '',
      importe: String(Math.abs(e.importe)),
    })
    // Al siguiente pintado, con printData ya actualizado, sale el papel.
    setTimeout(imprimirJustificante, 0)
  }

  /**
   * Abre la salida de efectivo con un destino que tenga sentido.
   *
   * El desplegable esconde la caja en la que estás (no puedes mandarte dinero a
   * ti mismo), así que si el destino guardado es justo esa —el caso de Central,
   * que es el valor por defecto— hay que moverlo antes de abrir. Si no, el
   * desplegable enseñaba una cosa y se enviaba otra, y el servidor rechazaba la
   * salida con «el origen y el destino no pueden ser la misma caja».
   */
  const abrirSalida = () => {
    const destinos = destinosDesde(activeTab)
    setPrintData(p => ({
      ...p,
      destino: destinos.includes(p.destino) ? p.destino : (destinos[0] || DESTINO_BANCO),
    }))
    setErrorSalida(null)
    setIsPrintModalOpen(true)
  }

  /** Solo saca el papel. Se llama DESPUÉS de haber registrado el movimiento. */
  const imprimirJustificante = () => {
    const printElement = document.getElementById('print-receipt-container');
    if (!printElement) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
       alert('El movimiento SÍ ha quedado registrado, pero el navegador ha bloqueado la ventana de impresión.\n\nNo vuelvas a registrar la salida: la tienes en la tabla y puedes reimprimir el justificante con el botón de la impresora de esa línea.');
       return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Justificante de Salida - MicroShop</title>
          <style>
            body { font-family: sans-serif; padding: 0; margin: 0; background: white; color: black; }
            * { box-sizing: border-box; }
            @page { size: A4; margin: 0; }
          </style>
        </head>
        <body>
          ${printElement.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  /**
   * Registra la salida de efectivo Y LUEGO imprime el justificante.
   *
   * Antes este botón SOLO imprimía: se firmaba el papel y en el programa no
   * quedaba nada, así que el dinero no se descontaba de la tienda ni aparecía
   * en el destino. Ahora primero se graba (la salida en la tienda y, si va a
   * otra caja, la entrada correspondiente) y el papel sale después.
   */
  const handleSalida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardandoSalida) return;
    setErrorSalida(null);
    setGuardandoSalida(true);
    try {
      const res = await fetch('/api/caja/traspaso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiendaOrigen: activeTab,
          tiendaDestino: printData.destino,
          fecha: printData.fecha,
          importe: Number(printData.importe),
          receptor: printData.receptor,
          entregadoPor: printData.vendedor,
          detalle: printData.concepto,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorSalida(data?.error || 'No se ha podido registrar la salida.');
        return;
      }
      setIsPrintModalOpen(false);
      await fetchEntries();
      // El papel, solo cuando el movimiento ya está guardado.
      imprimirJustificante();
      // Y se limpia el formulario: si se queda relleno es fácil registrar dos
      // veces la misma entrega sin darse cuenta.
      setPrintData({
        fecha: new Date().toISOString().split('T')[0],
        vendedor: '', receptor: '', destino: 'Central', concepto: '', importe: ''
      });
    } catch (err: any) {
      setErrorSalida(String(err?.message || err));
    } finally {
      setGuardandoSalida(false);
    }
  }

  const [guardandoApunte, setGuardandoApunte] = useState(false)
  const [errorApunte, setErrorApunte] = useState<string | null>(null)

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEntry.importe || isNaN(Number(newEntry.importe))) return
    if (guardandoApunte) return
    setErrorApunte(null)
    setGuardandoApunte(true)

    const isSalidaTransito = newEntry.concepto.includes('Recogida de Efectivo') ||
                             (newEntry.concepto.includes('salidas') && newEntry.detalle.toLowerCase().includes('central'));

    const estado = isSalidaTransito ? 'ROJO' : null;

    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tienda: activeTab,
          fecha: newEntry.fecha,
          concepto: newEntry.concepto,
          detalle: newEntry.detalle,
          importe: Number(newEntry.importe),
          vendedor: user?.username,
          estadoTrazabilidad: estado
        })
      })

      if (res.ok) {
        setIsModalOpen(false)
        setNewEntry({
          fecha: new Date().toISOString().split('T')[0],
          importe: '',
          concepto: CONCEPTOS[0],
          detalle: ''
        })
        fetchEntries()
      } else {
        // Antes, si el servidor rechazaba el apunte, el modal se quedaba
        // igual y parecía que no habías pulsado.
        const data = await res.json().catch(() => ({}))
        setErrorApunte(data?.error || 'No se ha podido guardar el movimiento.')
      }
    } catch (error) {
      console.error(error)
      setErrorApunte('No se ha podido guardar el movimiento.')
    } finally {
      setGuardandoApunte(false)
    }
  }

  const handleDelete = async (id: string) => {
    // Si es un traspaso se van las DOS patas: borrar solo una haría aparecer o
    // desaparecer dinero. Se avisa con todas las letras antes de hacerlo.
    const entry = entries.find(x => x.id === id)
    const aviso = entry?.traspasoId
      ? 'Esto es un TRASPASO: se borrarán las dos anotaciones, la salida y la entrada en el destino. ¿Seguro?'
      : '¿Estás seguro de borrar este movimiento?'
    if (!confirm(aviso)) return;
    try {
      await fetch(`/api/caja?id=${id}`, { method: 'DELETE' })
      fetchEntries()
    } catch (e) {
      console.error(e)
    }
  }

  const cycleStatus = async (entry: CajaEntry) => {
    if (!entry.estadoTrazabilidad) return;

    let nextStatus: 'ROJO' | 'NARANJA' | 'VERDE' | null = null;
    if (entry.estadoTrazabilidad === 'ROJO') nextStatus = 'NARANJA';
    else if (entry.estadoTrazabilidad === 'NARANJA') nextStatus = 'VERDE';
    else if (entry.estadoTrazabilidad === 'VERDE') nextStatus = 'ROJO';

    // Salir de VERDE borra la firma de quien dio el dinero por recibido, así
    // que no puede pasar por un clic de más.
    if (entry.estadoTrazabilidad === 'VERDE' && !confirm(
      `Este traspaso está confirmado${entry.conciliadoPor ? ` por ${entry.conciliadoPor}` : ''}. ` +
      'Si lo devuelves a rojo se borra esa confirmación. ¿Seguro?')) return;

    try {
      const res = await fetch('/api/caja', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, estadoTrazabilidad: nextStatus })
      })
      if (!res.ok) {
        // Antes el 403 se tragaba en silencio: el semáforo no cambiaba y no
        // había forma de saber por qué.
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'No se ha podido cambiar el estado del traspaso.')
        return
      }
      fetchEntries()
    } catch (e) {
      console.error(e)
      alert('No se ha podido cambiar el estado del traspaso.')
    }
  }

  // --- Cálculos ---
  const activeEntries = userTienda === 'ADMIN' ? entries.filter(e => e.tienda === activeTab) : entries;
  
  const currentSaldo = activeEntries.reduce((acc, curr) => acc + curr.importe, 0)

  // Resumen de todas las cajas (solo para Central).
  // Central va DENTRO del resumen: es la caja donde acaba el efectivo que
  // recogemos de las tiendas. Antes no aparecía, así que un traspaso a Central
  // hacía bajar el «Total Tiendas» y el dinero parecía esfumarse.
  const allStores = ['Auxiliadora', 'Villamayor', 'Béjar', 'Correhuela', 'MovilFree'];
  const saldoDe = (tienda: string) =>
    entries.filter(e => e.tienda === tienda).reduce((acc, curr) => acc + curr.importe, 0);
  const storeBalances = allStores.map(tienda => ({ tienda, balance: saldoDe(tienda) }));
  const totalStores = storeBalances.reduce((acc, curr) => acc + curr.balance, 0);
  const saldoCentral = saldoDe('Central');
  const totalGeneral = totalStores + saldoCentral;

  // Dinero que salió de una caja y que nadie ha dado todavía por recibido.
  // Se mide por el SEMÁFORO y el signo, no por el tipo de apunte: si mirásemos
  // solo los traspasos nuevos, las «(-) Recogida de Efectivo» que se siguen
  // metiendo a mano —y que también nacen en rojo— quedarían fuera, y el panel
  // afirmaría una cifra de dinero en la calle que no es la de verdad.
  const sinConfirmar = (e: CajaEntry) =>
    e.importe < 0 && !!e.estadoTrazabilidad && e.estadoTrazabilidad !== 'VERDE';
  const enTransito = entries
    .filter(sinConfirmar)
    .reduce((acc, curr) => acc + Math.abs(curr.importe), 0);

  // Lo que viene de camino HACIA la caja que se está mirando (para que una
  // tienda vea el dinero que le han mandado y aún no ha dado por recibido).
  const entrandoAqui = entries
    .filter(e => e.tienda === activeTab && e.tipo === 'TRASPASO_ENTRADA' && e.estadoTrazabilidad !== 'VERDE')
    .reduce((acc, curr) => acc + curr.importe, 0);

  if (!authorized || !userTienda) return null

  return (
    <>
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: 60 }}>
      {/* Header Premium */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', padding: '24px 32px', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 4px 20px -10px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)', color: '#00adef', padding: 10, borderRadius: 12 }}>
                <Calculator size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  Caja de Tiendas
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 500 }}>
                  Gestión de caja y trazabilidad
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
             <div style={{ background: currentSaldo >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: currentSaldo >= 0 ? '#10b981' : '#ef4444', padding: '10px 24px', borderRadius: 12, fontWeight: 800, fontSize: 18, border: `1px solid ${currentSaldo >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                Saldo {activeTab}: {currentSaldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
             </div>
             
             <button onClick={() => { abrirSalida(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', height: 44, borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05)' }}>
                <Printer size={18} /> Salida de Efectivo
             </button>
             <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', height: 44, borderRadius: 12, background: '#00adef', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 173, 239, 0.3)', transition: 'all 0.2s' }}>
                <Plus size={18} /> Añadir Movimiento
             </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '32px auto', padding: '0 24px' }}>
        
        {/* Tabs for Admin */}
        {userTienda === 'ADMIN' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto', paddingBottom: 8 }}>
            {['Central', ...allStores].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 24px',
                  borderRadius: 20,
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === tab ? '#00adef' : '#ffffff',
                  color: activeTab === tab ? '#ffffff' : '#64748b',
                  boxShadow: activeTab === tab ? '0 4px 10px rgba(0, 173, 239, 0.2)' : '0 2px 4px rgba(15, 23, 42, 0.05)',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Aviso para la caja que está mirando: dinero que le han mandado y
            todavía no ha dado por recibido. Sin esto, la tienda de destino no
            tenía forma de saber que le venía dinero de camino. */}
        {entrandoAqui > 0 && (
          <div style={{ marginBottom: 20, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: '#b45309', fontWeight: 900, fontSize: 16 }}>
              {entrandoAqui.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
            <span style={{ color: '#92400e', fontWeight: 600, fontSize: 14 }}>
              de camino a {activeTab} sin confirmar. Cuando lo tengas en el cajón, pulsa el semáforo de esa línea hasta dejarlo en verde.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          
          {/* Main Table */}
          <div style={{ flex: 1, background: '#ffffff', borderRadius: 16, border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 4px 10px -5px rgba(15, 23, 42, 0.05)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fecha</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Concepto</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Detalle</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Quién / A dónde</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Importe</th>
                  <th style={{ padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Trazabilidad</th>
                  <th style={{ padding: '16px 20px', width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando movimientos...</td></tr>
                ) : errorCarga ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#b91c1c', fontWeight: 700 }}>{errorCarga}</td></tr>
                ) : activeEntries.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No hay movimientos en la caja. Añade una corrección inicial.</td></tr>
                ) : (
                  activeEntries.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#334155' }}>
                         {new Date(e.fecha).toLocaleDateString('es-ES')}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#0f172a' }}>{e.concepto}</td>
                      <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 14 }}>{e.detalle}</td>
                      {/* El rastro del dinero: quién se lo llevó y a qué caja va o de cuál viene */}
                      <td style={{ padding: '16px 20px', fontSize: 13.5 }}>
                        {e.receptor || e.tiendaDestino || e.tiendaOrigen ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {e.receptor && (
                              <span style={{ color: '#0f172a', fontWeight: 700 }}>{e.receptor}</span>
                            )}
                            {e.tiendaDestino && (
                              <span style={{ color: '#64748b' }}>→ {e.tiendaDestino}</span>
                            )}
                            {e.tiendaOrigen && (
                              <span style={{ color: '#64748b' }}>← {e.tiendaOrigen}</span>
                            )}
                            {e.entregadoPor && (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>entrega: {e.entregadoPor}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right', color: e.importe >= 0 ? '#10b981' : '#ef4444' }}>
                        {e.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                         {e.estadoTrazabilidad ? (
                            <button 
                               onClick={() => userTienda === 'ADMIN' ? cycleStatus(e) : undefined}
                               style={{ 
                                 border: 'none', background: 'transparent', cursor: userTienda === 'ADMIN' ? 'pointer' : 'default',
                                 color: e.estadoTrazabilidad === 'ROJO' ? '#ef4444' : 
                                        e.estadoTrazabilidad === 'NARANJA' ? '#f59e0b' : '#10b981',
                                 display: 'inline-flex', alignItems: 'center', gap: 6,
                                 fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20,
                                 backgroundColor: e.estadoTrazabilidad === 'ROJO' ? 'rgba(239, 68, 68, 0.1)' : 
                                                  e.estadoTrazabilidad === 'NARANJA' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                               }}
                               title={
                                 e.conciliadoPor
                                   ? `Confirmado por ${e.conciliadoPor}${e.conciliadoEn ? ' el ' + new Date(e.conciliadoEn).toLocaleDateString('es-ES') : ''}`
                                   : (userTienda === 'ADMIN' ? "Clic para cambiar estado" : "Estado actual")
                               }
                            >
                               {e.estadoTrazabilidad === 'ROJO' && <CircleDashed size={14} />}
                               {e.estadoTrazabilidad === 'NARANJA' && <Clock size={14} />}
                               {e.estadoTrazabilidad === 'VERDE' && <CheckCircle2 size={14} />}
                               {e.estadoTrazabilidad}
                            </button>
                         ) : (
                           <span style={{ color: '#cbd5e1' }}>-</span>
                         )}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                         {e.tipo === 'TRASPASO_SALIDA' && (
                           <button onClick={() => reimprimir(e)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', opacity: 0.75, marginRight: 6 }} title="Volver a imprimir el justificante de esta salida">
                              <Printer size={16} />
                           </button>
                         )}
                         {user.role === 'ADMIN' && (
                           <button onClick={() => handleDelete(e.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }} title="Borrar entrada">
                              <Trash2 size={16} />
                           </button>
                         )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Central Summary Panel */}
          {activeTab === 'Central' && userTienda === 'ADMIN' && (
            <div style={{ width: 320, background: '#ffffff', borderRadius: 16, border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 4px 10px -5px rgba(15, 23, 42, 0.05)', padding: 24 }}>
               <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Saldos Tiendas</h3>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {storeBalances.map(st => (
                   <div key={st.tienda} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                     <span style={{ color: '#64748b', fontWeight: 500, fontSize: 14 }}>{st.tienda}</span>
                     <span style={{ color: st.balance >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                        {st.balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                     </span>
                   </div>
                 ))}
               </div>

               <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>Total Tiendas</span>
                  <span style={{ color: totalStores >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 18 }}>
                     {totalStores.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
               </div>

               {/* Central y total general: el dinero recogido de las tiendas
                   está aquí, no desaparecido. */}
               <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontWeight: 500, fontSize: 14 }}>Central</span>
                  <span style={{ color: saldoCentral >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                     {saldoCentral.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
               </div>
               <div style={{ marginTop: 12, paddingTop: 12, borderTop: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#0f172a', fontWeight: 900 }}>Total General</span>
                  <span style={{ color: totalGeneral >= 0 ? '#0f172a' : '#ef4444', fontWeight: 900, fontSize: 20 }}>
                     {totalGeneral.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
               </div>

               {enTransito > 0 && (
                 <div style={{ marginTop: 16, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ color: '#b45309', fontWeight: 800, fontSize: 13 }}>En tránsito</span>
                       <span style={{ color: '#b45309', fontWeight: 900 }}>
                          {enTransito.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                       </span>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#92400e', lineHeight: 1.45 }}>
                       Dinero que ha salido de una tienda y que el destino todavía no ha dado por recibido.
                       Ya está contado en los saldos de arriba.
                    </p>
                 </div>
               )}
            </div>
          )}

        </div>
      </main>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
           <style dangerouslySetInnerHTML={{__html: `
              .premium-input {
                 background: #f8fafc;
                 border: 1px solid #e2e8f0;
                 color: #0f172a;
                 transition: all 0.2s;
                 outline: none;
              }
              .premium-input:focus {
                 border-color: #00adef;
                 box-shadow: 0 0 0 4px rgba(0, 173, 239, 0.1);
                 background: #ffffff;
              }
              .premium-btn:hover {
                 transform: translateY(-1px);
                 box-shadow: 0 6px 20px rgba(0, 173, 239, 0.5) !important;
              }
           `}} />
           
           <div style={{ background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 460, padding: '36px 40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)', position: 'relative' }}>
              
              <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                <X size={20} />
              </button>

              <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
                 <div style={{ background: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)', color: '#00adef', padding: 12, borderRadius: 14 }}>
                    <Plus size={24} strokeWidth={2.5} />
                 </div>
                 <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Registrar Movimiento</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 500 }}>Añade una entrada o salida de caja</p>
                 </div>
              </div>

              <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                 
                 <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Importe (€)
                      </label>
                      <input className="premium-input" type="number" step="0.01" required value={newEntry.importe} onChange={e => setNewEntry({...newEntry, importe: e.target.value})} style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 16px', fontSize: 18, fontWeight: 800 }} placeholder="0.00" />
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Fecha
                      </label>
                      <input className="premium-input" type="date" required value={newEntry.fecha} onChange={e => setNewEntry({...newEntry, fecha: e.target.value})} style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 16px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }} />
                    </div>
                 </div>

                 <div>
                   <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                     Concepto
                   </label>
                   <div style={{ position: 'relative' }}>
                     <select className="premium-input" required value={newEntry.concepto} onChange={e => setNewEntry({...newEntry, concepto: e.target.value})} style={{ width: '100%', height: 48, borderRadius: 12, padding: '0 16px', fontSize: 15, appearance: 'none', cursor: 'pointer', fontWeight: 600 }}>
                       {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
                     </select>
                     <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: 15, color: '#64748b', pointerEvents: 'none' }} />
                   </div>
                   {/* Antes el «(-)» del nombre era pura decoración: el importe se
                       guardaba tal cual y la caja SUBÍA. Ahora el signo lo pone el
                       concepto, y aquí se ve antes de guardar. */}
                   {newEntry.importe !== '' && !isNaN(Number(newEntry.importe)) && (
                     <p style={{ margin: '8px 0 0 0', fontSize: 13, fontWeight: 700, color: signoDeConcepto(newEntry.concepto) === -1 ? '#ef4444' : '#10b981' }}>
                       {signoDeConcepto(newEntry.concepto) === -1
                         ? 'Se RESTA de la caja: '
                         : signoDeConcepto(newEntry.concepto) === 1
                           ? 'Se SUMA a la caja: '
                           : 'Se guarda tal cual: '}
                       {normalizarImporte(newEntry.concepto, Number(newEntry.importe)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                     </p>
                   )}
                 </div>

                 <div>
                   <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                     Detalle del movimiento
                   </label>
                   <textarea className="premium-input" required value={newEntry.detalle} onChange={e => setNewEntry({...newEntry, detalle: e.target.value})} style={{ width: '100%', height: 86, borderRadius: 12, padding: '14px 16px', fontSize: 15, resize: 'none', fontFamily: 'inherit', fontWeight: 500 }} placeholder="Escribe observaciones o detalles aquí..." />
                 </div>

                 {errorApunte && (
                   <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#b91c1c', borderRadius: 12, padding: '10px 14px', fontSize: 13.5, fontWeight: 600 }}>
                     {errorApunte}
                   </div>
                 )}

                 <button className="premium-btn" type="submit" disabled={guardandoApunte} style={{ marginTop: 8, height: 52, borderRadius: 14, background: guardandoApunte ? '#94a3b8' : 'linear-gradient(135deg, #00adef 0%, #008fcc 100%)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 16, cursor: guardandoApunte ? 'wait' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(0, 173, 239, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: '0.5px' }}>
                   {guardandoApunte ? 'GUARDANDO…' : <>AÑADIR A CAJA <CheckCircle2 size={18} /></>}
                 </button>

              </form>
           </div>
        </div>
      )}

    </div>

    {/* Modal Imprimir Justificante */}
    {isPrintModalOpen && (
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
         <div style={{ background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 460, padding: '36px 40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)', position: 'relative' }}>
            
            <button onClick={() => setIsPrintModalOpen(false)} style={{ position: 'absolute', top: 24, right: 24, background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
              <X size={20} />
            </button>

            <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
               <div style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.1) 100%)', color: '#334155', padding: 12, borderRadius: 14 }}>
                  <Printer size={24} strokeWidth={2.5} />
               </div>
               <div>
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>Salida de Efectivo</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 14, fontWeight: 500 }}>Se descuenta de esta caja y se imprime el justificante</p>
               </div>
            </div>

            <form onSubmit={handleSalida} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               
               <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Fecha
                    </label>
                    <input className="premium-input" type="date" required value={printData.fecha} onChange={e => setPrintData({...printData, fecha: e.target.value})} style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 15, fontWeight: 600, fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Tienda
                    </label>
                    <input className="premium-input" type="text" readOnly value={activeTab} style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 15, fontWeight: 600, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }} />
                  </div>
               </div>

               <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                     <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                       Persona que entrega
                     </label>
                     <div style={{ position: 'relative' }}>
                       <select className="premium-input" required value={printData.vendedor} onChange={e => setPrintData({...printData, vendedor: e.target.value})} style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 15, appearance: 'none', cursor: 'pointer', fontWeight: 600 }}>
                         <option value="" disabled>Selecciona...</option>
                         {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                       <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: 13, color: '#64748b', pointerEvents: 'none' }} />
                     </div>
                  </div>
               </div>

               <div>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   A quién se lo dan
                 </label>
                 <input className="premium-input" type="text" required value={printData.receptor} onChange={e => setPrintData({...printData, receptor: e.target.value})} placeholder="Nombre del receptor" style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 15, fontWeight: 500 }} />
               </div>

               {/* A dónde va el dinero: lo que faltaba para poder seguirle el
                   rastro. Si va a otra caja, entra allí automáticamente. */}
               <div>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   A dónde va
                 </label>
                 <div style={{ position: 'relative' }}>
                   <select className="premium-input" required value={printData.destino} onChange={e => setPrintData({...printData, destino: e.target.value})} style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 15, appearance: 'none', cursor: 'pointer', fontWeight: 600 }}>
                     {destinosDesde(activeTab).map(t => (
                       <option key={t} value={t}>{t}</option>
                     ))}
                   </select>
                   <ChevronDown size={18} style={{ position: 'absolute', right: 16, top: 13, color: '#64748b', pointerEvents: 'none' }} />
                 </div>
                 <p style={{ margin: '8px 0 0 0', fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                   {esDestinoExterno(printData.destino)
                     ? <>Sale del circuito: se descuenta de <b>{activeTab}</b> y no entra en ninguna otra caja.</>
                     : <>Se descuenta de <b>{activeTab}</b> y entra en <b>{printData.destino}</b>, en rojo hasta que allí lo den por recibido.</>}
                   {activeTab === 'Central' && ' Desde Central el efectivo solo sale a Banco o a Varios.'}
                 </p>
               </div>

               <div>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   Concepto
                 </label>
                 <input className="premium-input" type="text" required value={printData.concepto} onChange={e => setPrintData({...printData, concepto: e.target.value})} placeholder="Motivo de la salida..." style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 15, fontWeight: 500 }} />
               </div>

               <div>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                   Importe (€)
                 </label>
                 <input className="premium-input" type="number" step="0.01" required value={printData.importe} onChange={e => setPrintData({...printData, importe: e.target.value})} placeholder="0.00" style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 16px', fontSize: 18, fontWeight: 800 }} />
               </div>

               {errorSalida && (
                 <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#b91c1c', borderRadius: 12, padding: '10px 14px', fontSize: 13.5, fontWeight: 600 }}>
                   {errorSalida}
                 </div>
               )}

               <button className="premium-btn" type="submit" disabled={guardandoSalida} style={{ marginTop: 12, height: 52, borderRadius: 14, background: guardandoSalida ? '#94a3b8' : '#1e293b', color: '#fff', border: 'none', fontWeight: 800, fontSize: 16, cursor: guardandoSalida ? 'wait' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: '0.5px' }}>
                 {guardandoSalida ? 'REGISTRANDO…' : <>REGISTRAR E IMPRIMIR <Printer size={18} /></>}
               </button>

            </form>
         </div>
      </div>
    )}

    {/* CONTENEDOR DE IMPRESIÓN (OCULTO EN PANTALLA) */}
    {/* CONTENEDOR DE IMPRESIÓN (OCULTO EN PANTALLA) */}
    <div id="print-receipt-container" style={{ display: 'none', fontFamily: 'sans-serif', color: '#000', backgroundColor: '#fff' }}>
       
       {/* COPIA TIENDA */}
       <div style={{ padding: '30px 40px', height: '48vh', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 30, left: 40, background: '#f1f5f9', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.5px' }}>
             COPIA PARA TIENDA
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #00adef', paddingBottom: '16px', marginBottom: '24px', paddingTop: '20px' }}>
             <div>
               <h1 style={{ margin: 0, color: '#00adef', fontSize: '28px', fontWeight: 900, letterSpacing: '-1px' }}>MicroShop</h1>
               <p style={{ margin: 0, fontSize: '11px', color: '#666', marginTop: '2px' }}>Telecomunicaciones y Tecnología</p>
             </div>
             <div style={{ textAlign: 'right' }}>
               <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#333' }}>JUSTIFICANTE DE SALIDA</h2>
               <p style={{ margin: 0, fontSize: '13px', color: '#666', marginTop: '2px' }}>{new Date(printData.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
             </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
             <div style={{ display: 'flex', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tienda / Origen</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{activeTab}</p>
                </div>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Comercial (Entregado por)</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{printData.vendedor || '-'}</p>
                </div>
             </div>
             <div style={{ display: 'flex' }}>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Receptor (Entregado a)</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{printData.receptor || '-'}</p>
                   <p style={{ margin: '8px 0 0 0', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Destino del dinero</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{printData.destino || '-'}</p>
                </div>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Importe Total</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>
                      {Number(printData.importe || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                   </p>
                </div>
             </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
             <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Concepto / Motivo de la salida</p>
             <div style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', minHeight: '60px', fontSize: '14px', color: '#333' }}>
                {printData.concepto || '-'}
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px' }}>
             <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderBottom: '1px solid #000', height: '50px', marginBottom: '10px' }}></div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Firma Comercial</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>{printData.vendedor}</p>
             </div>
             <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderBottom: '1px solid #000', height: '50px', marginBottom: '10px' }}></div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Firma Receptor</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>{printData.receptor}</p>
             </div>
          </div>
       </div>

       {/* LÍNEA DE CORTE */}
       <div style={{ borderTop: '2px dashed #cbd5e1', width: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0 10px', color: '#94a3b8', fontSize: '12px' }}>✂️ LÍNEA DE CORTE ✂️</div>
       </div>

       {/* COPIA RECEPTOR */}
       <div style={{ padding: '30px 40px', height: '48vh', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 30, left: 40, background: '#f1f5f9', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, color: '#475569', letterSpacing: '0.5px' }}>
             COPIA PARA RECEPTOR
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #00adef', paddingBottom: '16px', marginBottom: '24px', paddingTop: '20px' }}>
             <div>
               <h1 style={{ margin: 0, color: '#00adef', fontSize: '28px', fontWeight: 900, letterSpacing: '-1px' }}>MicroShop</h1>
               <p style={{ margin: 0, fontSize: '11px', color: '#666', marginTop: '2px' }}>Telecomunicaciones y Tecnología</p>
             </div>
             <div style={{ textAlign: 'right' }}>
               <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#333' }}>JUSTIFICANTE DE SALIDA</h2>
               <p style={{ margin: 0, fontSize: '13px', color: '#666', marginTop: '2px' }}>{new Date(printData.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
             </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
             <div style={{ display: 'flex', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tienda / Origen</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{activeTab}</p>
                </div>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Comercial (Entregado por)</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{printData.vendedor || '-'}</p>
                </div>
             </div>
             <div style={{ display: 'flex' }}>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Receptor (Entregado a)</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{printData.receptor || '-'}</p>
                   <p style={{ margin: '8px 0 0 0', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Destino del dinero</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{printData.destino || '-'}</p>
                </div>
                <div style={{ flex: 1 }}>
                   <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Importe Total</p>
                   <p style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 900, color: '#ef4444' }}>
                      {Number(printData.importe || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                   </p>
                </div>
             </div>
          </div>

          <div style={{ marginBottom: '40px' }}>
             <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Concepto / Motivo de la salida</p>
             <div style={{ border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', minHeight: '60px', fontSize: '14px', color: '#333' }}>
                {printData.concepto || '-'}
             </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px' }}>
             <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderBottom: '1px solid #000', height: '50px', marginBottom: '10px' }}></div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Firma Comercial</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>{printData.vendedor}</p>
             </div>
             <div style={{ textAlign: 'center', width: '220px' }}>
                <div style={{ borderBottom: '1px solid #000', height: '50px', marginBottom: '10px' }}></div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Firma Receptor</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>{printData.receptor}</p>
             </div>
          </div>
       </div>

    </div>
    </>
  )
}
