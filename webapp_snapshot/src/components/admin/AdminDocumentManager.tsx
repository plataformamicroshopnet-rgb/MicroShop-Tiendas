'use client'

import { useState, useEffect, useRef } from 'react'
import { useGuard } from '@/hooks/useGuard'
import { canEdit } from '@/lib/permissions'
import { Save, Plus, Trash2, Link as LinkIcon, Star, Smartphone, Briefcase, Eye, EyeOff, Upload, FileText, Image as ImageIcon, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

interface Magazine {
    id: string
    title: string
    slug: string
    month: number
    year: number
    description: string | null
    pdfUrl: string
    coverUrl: string | null
    isPublished: boolean
    isFeatured: boolean
    createdAt: string
}

interface AdminDocumentManagerProps {
    type: 'revista' | 'catalogo' | 'dosier'
    title: string
    iconName: 'star' | 'smartphone' | 'briefcase'
    descriptionHint: string
    helpContent?: React.ReactNode
}

const MONTH_NAMES = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

const IconsMap = {
    star: Star,
    smartphone: Smartphone,
    briefcase: Briefcase
}

export function AdminDocumentManager({ type, title, iconName, descriptionHint, helpContent }: AdminDocumentManagerProps) {
    const ActiveIcon = IconsMap[iconName]
    const { user, authorized } = useGuard('MODULE_ADMIN')
    const guardLoading = authorized === null;
    const [magazines, setMagazines] = useState<Magazine[]>([])
    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pdfUploading, setPdfUploading] = useState(false)
    const [coverUploading, setCoverUploading] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState({
        title: '', slug: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
        description: '', pdfUrl: '', coverUrl: ''
    })
    const [pdfFileMeta, setPdfFileMeta] = useState<{name: string, size: string} | null>(null)
    const [formError, setFormError] = useState('')
    const [formSuccess, setFormSuccess] = useState('')

    useEffect(() => {
        if (!guardLoading && user) fetchMagazines()
    }, [guardLoading, user, type])

    const fetchMagazines = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/revistas?type=${type}&t=${Date.now()}`, { cache: 'no-store' })
            const data = await res.json()
            setMagazines(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormError('')
        setFormSuccess('')
        const file = e.target.files?.[0]
        if (!file) return

        if (file.type !== 'application/pdf') {
            setFormError('Por favor, selecciona un archivo PDF válido.')
            return
        }
        if (file.size > 50 * 1024 * 1024) {
            setFormError('El archivo PDF es demasiado grande. Máximo permitido: 50MB.')
            return
        }

        setPdfFileMeta({ name: file.name, size: formatBytes(file.size) })
        const formData = new FormData()
        formData.append('file', file)
        
        setPdfUploading(true)
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            const data = await res.json().catch(() => ({ error: 'Error procesando respuesta del servidor' }))
            
            if (res.ok) {
                setForm(prev => ({ ...prev, pdfUrl: data.url }))
                setFormSuccess('PDF procesado correctamente')
            } else {
                setFormError(`Error subiendo PDF: ${data.error || 'Server error'}`)
                setPdfFileMeta(null)
            }
        } catch(err: any) {
            setFormError(`Fallo de conexión al subir PDF: ${err.message}`)
            setPdfFileMeta(null)
        } finally {
            setPdfUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormError('')
        setFormSuccess('')
        const file = e.target.files?.[0]
        if (!file) return
        
        const validImages = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        if (!validImages.includes(file.type)) {
            setFormError('Formato de imagen no válido. Formatos aceptados: JPG, PNG, WEBP.')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            setFormError('La imagen es demasiado grande. Máximo permitido: 10MB.')
            return
        }

        const formData = new FormData()
        formData.append('file', file)
        
        setCoverUploading(true)
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData })
            const data = await res.json().catch(() => ({ error: 'Error procesando respuesta del servidor' }))
            
            if (res.ok) {
                setForm(prev => ({ ...prev, coverUrl: data.url }))
                setFormSuccess('Portada procesada correctamente')
            } else {
                setFormError(`Error subiendo portada: ${data.error || 'Server error'}`)
            }
        } catch(err: any) {
            setFormError(`Fallo de conexión al subir portada: ${err.message}`)
        } finally {
            setCoverUploading(false)
            if (coverInputRef.current) coverInputRef.current.value = ''
        }
    }

    const handleCreate = async () => {
        setFormError('')
        setFormSuccess('')

        if (!form.title.trim() || !form.slug.trim()) {
            setFormError("Por favor, rellena el Título que generará automáticamente el Slug.")
            return
        }
        if (!form.pdfUrl) {
            setFormError("Debes subir el archivo PDF antes de guardar.")
            return
        }
        if (!form.coverUrl) {
            setFormError("Es obligatorio añadir una imagen de portada.")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/revistas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({...form, type})
            })
            
            const data = await res.json().catch(() => ({ error: 'Fallo al procesar JSON del servidor.' }))

            if (res.ok) {
                setFormSuccess("✨ ¡Documento publicado con éxito!")
                setForm({ title: '', slug: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), description: '', pdfUrl: '', coverUrl: '' })
                setPdfFileMeta(null)
                fetchMagazines()
                
                setTimeout(() => setFormSuccess(''), 4000)
            } else {
                setFormError(`Error al crear publicación: ${data.error || ''}`)
            }
        } catch (e: any) {
            setFormError(`Error de red: ${e.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleFeature = async (id: string, current: boolean) => {
        try {
            await fetch(`/api/revistas/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFeatured: !current })
            })
            fetchMagazines()
        } catch (e: any) { setFormError("Fallo al actualizar destacado.") }
    }

    const handleTogglePublish = async (id: string, current: boolean) => {
        try {
            await fetch(`/api/revistas/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: !current })
            })
            fetchMagazines()
        } catch (e: any) { setFormError("Fallo al actualizar publicación.") }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("⚠️ ¿Eliminar documento definitivamente? Esta acción no se puede deshacer.")) return
        try {
            await fetch(`/api/revistas/${id}`, { method: 'DELETE' })
            fetchMagazines()
        } catch (e) { setFormError("Fallo al eliminar publicación.") }
    }

    if (guardLoading || loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><Loader2 size={32} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /></div>
    if (!user || !canEdit(user, 'MANAGE_MAGAZINES')) return <div style={{ padding: 40, color: '#ef4444', textAlign: 'center' }}><h2>Acceso Denegado</h2><p>No dispones de los privilegios requeridos.</p></div>

    return (
        <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <PageHeader 
                title={<><ActiveIcon size={32} color="#0ea5e9" /> {title}</>}
                showBack={true}
                backFallback="/admin"
                helpContent={helpContent}
            />

            {formError && (
                <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '16px 20px', borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)' }}>
                    <AlertCircle size={20} />
                    {formError}
                </div>
            )}
            {formSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #4ade80', color: '#15803d', padding: '16px 20px', borderRadius: 12, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, fontWeight: 500, boxShadow: '0 4px 12px rgba(34, 197, 94, 0.1)' }}>
                    <CheckCircle size={20} />
                    {formSuccess}
                </div>
            )}

            <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-light)', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', padding: 32, marginBottom: 40 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>Publicar Nuevo Documento</h2>
                
                {descriptionHint && <div style={{ fontSize: 13, color: '#0ea5e9', marginBottom: 24, padding: '8px 12px', background: '#f0f9ff', borderRadius: 6, fontWeight: 500 }}>{descriptionHint}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>TÍTULO DE EDICIÓN</label>
                        <input value={form.title} onChange={e => setForm({...form, title: e.target.value, slug: e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')})} type="text" style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 10, outline: 'none', transition: 'border 0.2s' }} onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = 'var(--border-strong)'} placeholder={`Ej: ${type === 'revista' ? 'Especial Verano 2026' : 'Edición Marzo 2026'}`} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>SLUG URL (Automático)</label>
                        <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} type="text" style={{ width: '100%', padding: '12px 16px', background: 'var(--active-bg)', border: '1px solid var(--border-light)', borderRadius: 10, color: 'var(--text-muted)' }} placeholder="identificador-unico" />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>MES DE EDICIÓN</label>
                        <select value={form.month} onChange={e => setForm({...form, month: Number(e.target.value)})} style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 10, outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg width=\'12\' height=\'8\' viewBox=\'0 0 12 8\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M1 1.5L6 6.5L11 1.5\' stroke=\'%2364748B\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'calc(100% - 16px) center', fontWeight: 600 }}>
                            {MONTH_NAMES.map((m, i) => (
                                <option key={i+1} value={i+1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>AÑO DE EDICIÓN</label>
                        <input value={form.year} onChange={e => setForm({...form, year: Number(e.target.value)})} type="number" min="2020" max="2100" style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: 10, outline: 'none', fontWeight: 600 }} onFocus={e => e.target.style.borderColor = '#0ea5e9'} onBlur={e => e.target.style.borderColor = 'var(--border-strong)'} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, marginBottom: 32 }}>
                    
                    {/* PDF UPLOAD CARD */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>DOCUMENTO PDF (Máx. 50MB)</label>
                        <input type="file" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                        <div 
                            onClick={() => !pdfUploading && fileInputRef.current?.click()}
                            style={{ 
                                height: 200, borderRadius: 16, border: form.pdfUrl ? '2px solid #10b981' : '2px dashed #cbd5e1', 
                                background: form.pdfUrl ? '#ecfdf5' : 'var(--bg-app)', 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                cursor: pdfUploading ? 'wait' : 'pointer', transition: 'all 0.2s', position: 'relative'
                            }}
                            onMouseEnter={e => !form.pdfUrl && !pdfUploading && (e.currentTarget.style.borderColor = '#94a3b8')}
                            onMouseLeave={e => !form.pdfUrl && !pdfUploading && (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                        >
                            {pdfUploading ? (
                                <>
                                    <Loader2 size={40} color="#0ea5e9" style={{ animation: 'spin 1.5s linear infinite', marginBottom: 12 }} />
                                    <span style={{ fontSize: 14, color: '#0ea5e9', fontWeight: 600 }}>Procesando PDF...</span>
                                </>
                            ) : form.pdfUrl ? (
                                <>
                                    <div style={{ background: '#10b981', color: 'var(--bg-card)', padding: 12, borderRadius: '50%', marginBottom: 16 }}>
                                        <FileText size={32} />
                                    </div>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: '#065f46', textAlign: 'center', padding: '0 16px' }}>{pdfFileMeta?.name || 'Archivo PDF validado'}</span>
                                    {pdfFileMeta?.size && <span style={{ fontSize: 12, color: '#047857', marginTop: 6, fontWeight: 600 }}>{pdfFileMeta.size}</span>}
                                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                        <button onClick={(e) => { e.stopPropagation(); setForm({...form, pdfUrl: ''}); setPdfFileMeta(null); }} style={{ background: 'var(--bg-card)', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}><Trash2 size={16} /></button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Upload size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Importar archivo de documento</span>
                                    <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Haz clic para navegar</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* COVER UPLOAD CARD */}
                    <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>IMAGEN DE PORTADA (Máx. 10MB)</label>
                        <input type="file" accept="image/jpeg, image/png, image/webp" ref={coverInputRef} onChange={handleCoverUpload} style={{ display: 'none' }} />
                        <div 
                            onClick={() => !coverUploading && coverInputRef.current?.click()}
                            style={{ 
                                height: 200, borderRadius: 16, border: form.coverUrl ? 'none' : '2px dashed #cbd5e1', 
                                background: form.coverUrl ? 'var(--text-main)' : 'var(--bg-app)', 
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                                cursor: coverUploading ? 'wait' : 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                            }}
                            onMouseEnter={e => !form.coverUrl && !coverUploading && (e.currentTarget.style.borderColor = '#94a3b8')}
                            onMouseLeave={e => !form.coverUrl && !coverUploading && (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                        >
                            {coverUploading ? (
                                <>
                                    <Loader2 size={40} color="#0ea5e9" style={{ animation: 'spin 1.5s linear infinite', marginBottom: 12 }} />
                                    <span style={{ fontSize: 14, color: '#0ea5e9', fontWeight: 600 }}>Cargando miniatura...</span>
                                </>
                            ) : form.coverUrl ? (
                                <>
                                    <img src={form.coverUrl} alt="Preview Portada" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                                        <span style={{ color: 'var(--bg-card)', fontWeight: 600, background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 20 }}>Reemplazar imagen</span>
                                    </div>
                                    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
                                        <button onClick={(e) => { e.stopPropagation(); setForm({...form, coverUrl: ''}); }} style={{ background: '#ef4444', border: 'none', color: 'var(--bg-card)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#dc2626'} onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}><Trash2 size={16} /></button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Cargar Portada</span>
                                    <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>JPG, PNG o WEBP</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 24, borderTop: '1px solid #f1f5f9' }}>
                    <button onClick={handleCreate} disabled={isSubmitting || !form.pdfUrl || !form.coverUrl || !form.title} style={{ background: (isSubmitting || !form.pdfUrl || !form.coverUrl || !form.title) ? '#94a3b8' : '#0ea5e9', color: 'var(--bg-card)', border: 'none', padding: '16px 32px', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: (isSubmitting || !form.pdfUrl || !form.coverUrl || !form.title) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s, transform 0.1s', boxShadow: '0 4px 14px rgba(14, 165, 233, 0.25)' }} onMouseDown={e => e.currentTarget.style.transform='scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform='scale(1)'}>
                        {isSubmitting ? (
                            <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Publicando...</>
                        ) : (
                            <><Save size={20} /> Terminar y Publicar</>
                        )}
                    </button>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-light)', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
                        <tr>
                            <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>EDICIÓN Y TIPO</th>
                            <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>FECHA PUBLICACIÓN</th>
                            <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>VISIBILIDAD</th>
                            <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>PRINCIPAL</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {magazines.map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fefce8'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '20px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', background: '#e0f2fe', color: '#0284c7', borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>{type}</span>
                                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: 15 }}>{m.title}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>/{m.slug}</div>
                                </td>
                                <td style={{ padding: '20px 24px', color: 'var(--text-main)', fontWeight: 800 }}>{m.month >= 1 && m.month <= 12 ? MONTH_NAMES[m.month - 1] : m.month} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{m.year}</span></td>
                                <td style={{ padding: '20px 24px' }}>
                                    <button 
                                        onClick={() => handleTogglePublish(m.id, m.isPublished)}
                                        style={{ border: 'none', background: m.isPublished ? '#dcfce3' : 'var(--active-bg)', color: m.isPublished ? '#166534' : 'var(--text-muted)', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}
                                    >
                                        {m.isPublished ? <Eye size={14}/> : <EyeOff size={14}/>}
                                        {m.isPublished ? 'Público' : 'Oculto'}
                                    </button>
                                </td>
                                <td style={{ padding: '20px 24px' }}>
                                    <button 
                                        onClick={() => handleToggleFeature(m.id, m.isFeatured)}
                                        style={{ border: 'none', background: 'transparent', color: m.isFeatured ? '#eab308' : 'var(--border-strong)', cursor: 'pointer', transition: 'transform 0.2s' }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        <Star size={24} fill={m.isFeatured ? '#eab308' : 'none'} />
                                    </button>
                                </td>
                                <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                        <a href={m.pdfUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: '#f0f9ff', color: '#0ea5e9', borderRadius: 8, transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'} onMouseLeave={e => e.currentTarget.style.background = '#f0f9ff'}>
                                            <LinkIcon size={18} />
                                        </a>
                                        <button onClick={() => handleDelete(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', background: '#fef2f2', color: '#ef4444', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'} onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {magazines.length === 0 && (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No hay elementos disponibles en esta categoría.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}} />
        </div>
    )
}
