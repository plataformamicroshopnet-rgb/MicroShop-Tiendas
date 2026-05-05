'use client'

import { useState } from 'react'
import { Download, Upload, ShieldAlert, ChevronLeft, Database, FileSpreadsheet, HardDrive, Info, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
export default function AdminBackupPage() {
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingSqlite, setDownloadingSqlite] = useState(false)

  // Estados Fase Restauración
  const [uploading, setUploading] = useState(false)
  const [backupReady, setBackupReady] = useState(false)
  const [readyStats, setReadyStats] = useState<any>(null)
  const [confirmText, setConfirmText] = useState('')
  const [applying, setApplying] = useState(false)

  const handleDownloadExcel = async () => {
    setDownloadingExcel(true)
    try {
      const response = await fetch('/api/admin/export', { method: 'GET' })
      if (!response.ok) throw new Error('Error al generar el Excel')
      
      const contentDisposition = response.headers.get('content-disposition')
      let filename = 'microshop_backup.xlsx'
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert('❌ Error descargando el Excel: ' + err.message)
    } finally {
      setDownloadingExcel(false)
    }
  }

  const handleDownloadSqlite = async () => {
    setDownloadingSqlite(true)
    try {
      const response = await fetch('/api/admin/download-db', { method: 'GET' })
      if (!response.ok) throw new Error('Error al descargar la base local')
      
      const contentDisposition = response.headers.get('content-disposition')
      let filename = 'MicroShop_Bunker_Backup.zip'
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert('❌ Error descargando SQLite: ' + err.message)
    } finally {
      setDownloadingSqlite(false)
    }
  }

  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setBackupReady(false)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/restore-upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setReadyStats(data.stats)
        setBackupReady(true)
      } else {
        alert('❌ Error de Integridad: ' + data.error)
        e.target.value = ''
      }
    } catch (err) {
      alert('Error de conexión al subir la base de datos.')
      e.target.value = ''
    } finally {
      setUploading(false)
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
        window.location.reload() // Forzamos refresh agresivo
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
    <div style={{ padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader 
        title={<><Database className="text-cyan" size={28} /> Copias de Seguridad PRO</>}
        subtitle="Búnker de datos. Extrae o Inyecta de forma segura el motor de producción."
        showBack={true}
        backFallback="/admin"
        helpContent={
          <div>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 15 }}>Manual: Copias de Seguridad</h4>
            <p style={{ margin: 0, lineHeight: 1.5 }}>Módulo de contingencia local. Genera una instantánea completa (snapshot) de toda tu base de datos en un fichero comprimido seguro. Usa los botones de descarga manual antes de aplicar cambios estructurales drásticos o para guardar los cierres de mes definitivos de forma local.</p>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
        {/* PANEL EXTRACCIONES */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 0', color: '#1f2937' }}>
              <Download size={20} color="#3b82f6" /> Opciones de Extracción
            </h3>
            <p style={{ color: 'var(--medium-gray)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Genera volcados completos de la información crítica hacia tu equipo local.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 16, background: 'var(--bg-app)' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileSpreadsheet size={18} color="#10b981" /> Exportar Tablas (Excel)
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-muted)' }}>Archivo .xlsx legible con ventas, usuarios y catálogos.</p>
              <button onClick={handleDownloadExcel} disabled={downloadingExcel} className="btn" style={{ width: '100%', background: '#10b981', color: 'var(--bg-card)' }}>
                {downloadingExcel ? 'Generando Excel...' : 'Descargar Archivo Excel'}
              </button>
            </div>

            <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 16, background: 'var(--bg-app)' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <HardDrive size={18} color="#8b5cf6" /> Exportar Búnker Maestro (.zip)
              </h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--text-muted)' }}>Cápsula de seguridad con el motor principal y sus transacciones locales WAL en tiempo real.</p>
              <button onClick={handleDownloadSqlite} disabled={downloadingSqlite} className="btn" style={{ width: '100%', background: '#8b5cf6', color: 'var(--bg-card)' }}>
                {downloadingSqlite ? 'Ensamblando ZIP...' : 'Descargar Cápsula ZIP'}
              </button>
            </div>
          </div>
        </div>

        {/* PANEL RESTAURACION 2 FASES */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, borderLeft: '4px solid #ef4444' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 0', color: '#1f2937' }}>
              <Upload size={20} color="#ef4444" /> Restauración Estricta
            </h3>
            <p style={{ color: 'var(--medium-gray)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Inyección de SQLite validada en 2 Fases (Subida Cuarentena + Aplicación).
            </p>
          </div>

          {/* FASE 1: SUBIDA */}
          {!backupReady && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label 
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, background: 'var(--active-bg)', color: 'var(--text-main)', border: '1px dashed #cbd5e1', cursor: uploading ? 'wait' : 'pointer' }}
              >
                <Upload size={18} /> {uploading ? 'Descomprimiendo Búnker...' : 'Seleccionar Archivo .zip'}
                <input type="file" accept=".zip,.sqlite,.db" style={{ display: 'none' }} onChange={handleUploadBackup} disabled={uploading}/>
              </label>
            </div>
          )}

          {/* FASE 2: APLICACIÓN */}
          {backupReady && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.5s ease-out' }}>
              <div style={{ background: '#ecfdf5', padding: 12, borderRadius: 8, border: '1px solid #6ee7b7' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#047857', margin: '0 0 4px 0', fontSize: 14 }}>
                  <CheckCircle size={16} /> Base validada en cuarentena
                </h4>
                <p style={{ fontSize: 12, color: '#065f46', margin: 0 }}>
                  Tablas Detectadas: {readyStats?.sales} Ventas, {readyStats?.users} Usuarios, {readyStats?.periods} Periodos.
                </p>
              </div>

              <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, border: '1px solid #fca5a5' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b91c1c', margin: '0 0 8px 0', fontSize: 14 }}>
                  <AlertTriangle size={16} /> ¡ATENCIÓN! Impacto Inminente
                </h4>
                <p style={{ fontSize: 13, color: '#991b1b', margin: 0, lineHeight: 1.5, marginBottom: 16 }}>
                  Esta acción purgará la base de datos actual y forzará un reinicio del entorno para evitar bloqueos. ¿Estás absolutamente seguro?
                </p>
                <input 
                  type="text" 
                  placeholder="Escribe RESTAURAR para inyectar" 
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #fca5a5', borderRadius: 8, fontWeight: 700, outline: 'none', color: '#b91c1c', textAlign: 'center' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setBackupReady(false); setConfirmText('') }} disabled={applying} className="btn btn-secondary" style={{ flex: 1, padding: 12 }}>
                  Cancelar
                </button>
                <button onClick={handleApplyRestore} disabled={applying || confirmText !== 'RESTAURAR'} className="btn btn-primary" style={{ flex: 1, padding: 12, background: '#ef4444', border: 'none', opacity: confirmText !== 'RESTAURAR' ? 0.5 : 1 }}>
                  {applying ? 'Inyectando...' : 'Aplicar Restauración'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 32, color: 'var(--medium-gray)', fontSize: 13, justifyContent: 'center' }}>
        <Info size={16} /> Estos endpoints están blindados al perfil de Administrador Máximo mediante inyección JWT.
      </div>
    </div>
  )
}
