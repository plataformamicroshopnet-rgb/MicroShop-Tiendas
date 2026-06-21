'use client'

import { useState, useEffect } from 'react'
import { Cloud, CloudUpload, HardDriveDownload, AlertTriangle, CheckCircle, ChevronLeft, Trash2, Clock, FileArchive, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
export default function CloudBackupPage() {
  const [backups, setBackups] = useState<any[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [backingUp, setBackingUp] = useState(false)
  
  // Estados Fase Restauración
  const [downloadingFTP, setDownloadingFTP] = useState(false)
  const [backupReady, setBackupReady] = useState(false)
  const [readyStats, setReadyStats] = useState<any>(null)
  const [confirmText, setConfirmText] = useState('')
  const [applying, setApplying] = useState(false)

  // Carga inicial
  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/admin/ftp-list?t=' + Date.now())
      const data = await res.json()
      if (data.success) {
        setBackups(data.files)
      } else {
        console.error("Error cargando listado FTP:", data.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingList(false)
    }
  }

  const handleManualBackup = async () => {
    setBackingUp(true)
    try {
      const res = await fetch('/api/admin/ftp-backup', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('✅ Copia creada y subida a la nube (B2) correctamente.')
        fetchBackups() // Refrescar lista
      } else {
        alert('❌ Error al subir la copia: ' + data.error)
      }
    } catch (err) {
      alert('Error de conexión al lanzar backup.')
    } finally {
      setBackingUp(false)
    }
  }

  const handlePrepareRestore = async (fileId: string) => {
    if (!confirm('¿Seguro que quieres descargar y poner en cuarentena esta copia del QNAP? Se machacará cualquier otra copia en cuarentena.')) return
    
    setDownloadingFTP(true)
    setBackupReady(false)
    
    try {
      const res = await fetch('/api/admin/ftp-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      })
      const data = await res.json()
      if (data.success) {
        setReadyStats(data.stats)
        setBackupReady(true)
        alert('✅ Descarga completada. El Búnker está en la rampa de inyección.')
      } else {
        alert('❌ Error validando la copia: ' + data.error)
      }
    } catch (err) {
      alert('Error crítico de red contactando al servidor.')
    } finally {
      setDownloadingFTP(false)
    }
  }

  const handleApplyRestore = async () => {
    if (confirmText !== 'RESTAURAR') {
      alert('Debes escribir RESTAURAR en mayúsculas para continuar.')
      return
    }

    setApplying(true)
    try {
      const res = await fetch('/api/admin/restore-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText })
      })
      const data = await res.json()

      if (data.success) {
        alert('♻️ ' + data.message + '\n\n' + data.instructions)
        window.location.reload()
      } else {
        alert('❌ Falla Nuclear: ' + data.error)
      }
    } catch (err) {
      alert('Error crítico lanzando la orden de aplicación.')
    } finally {
      setApplying(false)
      setConfirmText('')
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <PageHeader 
        title={<><Cloud color="#2563eb" size={28} /> Nube de Respaldo (Backblaze B2)</>}
        subtitle="Copia de seguridad automática a la nube. El QNAP luego sincroniza el bucket a tu NAS."
        showBack={true}
        backFallback="/admin"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: QNAP FTP Backups</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Sincronización segura en tu servidor NAS QNAP. Vincula el programa con tu servidor FTP para subir las copias de seguridad de forma automatizada y deslocalizada de la red principal. Si alguna vez hay un desastre informático, este módulo garantiza que la base de datos está a salvo.</p>
          </div>
        }
      />

      {/* WARNING APPLY RESTORE */}
      {backupReady && (
        <div style={{ marginBottom: 24, padding: '24px', background: '#ffffff', border: '2px solid #ef4444', borderRadius: '16px', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.15)', animation: 'fadeIn 0.5s ease-out' }}>
             <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudUpload size={24} /> Despliegue de Restauración Cloud Activo
             </h3>
             <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 12, border: '1px solid #86efac', marginBottom: 16 }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', margin: '0 0 4px 0', fontSize: 14 }}>
                        <CheckCircle size={16} /> Base Externa Validada
                        </h4>
                        <p style={{ fontSize: 13, color: '#15803d', margin: 0 }}>
                        La copia descargada del QNAP contiene: {readyStats?.sales} Ventas, {readyStats?.users} Usuarios, {readyStats?.periods} Periodos.
                        </p>
                    </div>

                    <div style={{ background: '#fef2f2', padding: 16, borderRadius: 12, border: '1px solid #fecaca' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#991b1b', margin: '0 0 8px 0', fontSize: 14 }}>
                        <AlertTriangle size={16} /> Impacto Inminente en el Servidor
                        </h4>
                        <p style={{ fontSize: 13, color: '#991b1b', margin: 0, lineHeight: 1.5, marginBottom: 16 }}>
                        Al aplicar se purgará producción y se reemplazará por esta copia Cloud de forma irreversible.
                        </p>
                        <input 
                        type="text" 
                        placeholder="Escribe RESTAURAR para inyectar" 
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        style={{ width: '100%', padding: '12px', border: '2px solid #fca5a5', borderRadius: 10, fontWeight: 700, outline: 'none', color: '#b91c1c', textAlign: 'center', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', minWidth: 200, flex: 0.5 }}>
                    <button onClick={handleApplyRestore} disabled={applying || confirmText !== 'RESTAURAR'} style={{ padding: 16, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, opacity: confirmText !== 'RESTAURAR' ? 0.3 : 1, cursor: confirmText === 'RESTAURAR' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {applying ? 'Inyectando...' : '🔥 APLICAR RESTAURACIÓN'}
                    </button>
                    <button onClick={() => { setBackupReady(false); setConfirmText('') }} disabled={applying} style={{ padding: 16, background: '#ffffff', color: '#4b5563', border: '1px solid #e5e7eb', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    Abortar Operación
                    </button>
                </div>
             </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }}>
        
        {/* PANEL ARCHIVOS Y LANZAMIENTO */}
        <div className="card" style={{ padding: 0, backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          
          {/* Cabecera del Panel */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' }}>
             <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px 0', color: '#111827', fontSize: 18 }}>
                <HardDriveDownload size={20} color="#2563eb" /> Historial de Copias en la Nube (B2)
                </h3>
                <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                Las copias se generan automáticamente cada madrugada y se retienen 31 días. El QNAP las baja al NAS.
                </p>
             </div>
             <button onClick={handleManualBackup} disabled={backingUp || downloadingFTP} style={{ padding: '10px 20px', background: '#111827', color: '#ffffff', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, transition: 'all 0.2s ease', cursor: (backingUp || downloadingFTP) ? 'wait' : 'pointer' }}>
                <CloudUpload size={16} /> 
                {backingUp ? 'Subiendo a Nube...' : 'Lanzar Copia Manual Ahora'}
             </button>
          </div>

          {/* Tabla de Archivos */}
          <div style={{ padding: 24 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead style={{ backgroundColor: '#f3f4f6' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>Cápsula de Datos</th>
                    <th style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>Fecha / Hora</th>
                    <th style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>Peso</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#4b5563', fontWeight: 600 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
                         <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }}/>
                         Cargando copias de la nube (B2)...
                      </td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
                         Aún no hay copias en la nube (B2). Pulsa «Lanzar Copia Manual» o espera al backup programado.
                      </td>
                    </tr>
                  ) : (
                    backups.map(file => {
                        const dateObj = new Date(file.createdTime)
                        const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString()
                        
                        return (
                        <tr key={file.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                           <td style={{ padding: '16px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                             <FileArchive size={16} color="#6b7280" /> {file.name}
                           </td>
                           <td style={{ padding: '16px', color: '#4b5563' }}>{formattedDate}</td>
                           <td style={{ padding: '16px', color: '#4b5563' }}>{file.sizeMB} MB</td>
                           <td style={{ padding: '16px', textAlign: 'right' }}>
                             <button 
                               onClick={() => handlePrepareRestore(file.id)}
                               disabled={downloadingFTP || backingUp}
                               style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                             >
                                <HardDriveDownload size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                                Restaurar desde Nube
                             </button>
                           </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
