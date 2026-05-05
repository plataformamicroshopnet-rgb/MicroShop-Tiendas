"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Smartphone, Briefcase, FileX } from 'lucide-react'
import { usePeriod } from '@/components/PeriodProvider'

interface FeaturedDocumentProps {
    type: 'catalogo' | 'dosier'
    title: string
}

export function FeaturedDocument({ type, title }: FeaturedDocumentProps) {
    const [doc, setDoc] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const { activePeriodKey } = usePeriod()

    useEffect(() => {
        if (!activePeriodKey) return;
        setLoading(true);
        const [year, month] = activePeriodKey.split('_').map(Number);
        
        fetch(`/api/revistas?type=${type}&public=true&t=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    setDoc(null);
                    return;
                }
                const periodDoc = data.find((m: any) => m.year === year && m.month === month)
                setDoc(periodDoc || null)
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false))
    }, [type, activePeriodKey])

    if (loading) return (
        <div style={{ background: 'var(--bg-app)', borderRadius: 12, height: '100%', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--medium-gray)', fontSize: 13, fontWeight: 600 }}>Cargando datos...</div>
        </div>
    )

    if (!doc) {
        const isCat      = type === 'catalogo'
        const gradStart  = '#0f172a'
        const gradMid    = isCat ? '#064e3b' : '#78350f'
        const gradEnd    = isCat ? '#10b981' : '#f59e0b'
        const accent     = isCat ? '#10b981' : '#f59e0b'
        const label      = isCat ? 'Catálogo Dispositivos' : 'Dosier Empresas'
        const comingTitle = isCat ? 'El Nuevo\nCatálogo' : 'El Nuevo\nDosier'
        const subtitle   = isCat ? 'Catálogo de dispositivos en preparación. Disponible próximamente.' : 'Dosier de empresas en preparación. Disponible próximamente.'
        const Icon2      = isCat ? Smartphone : Briefcase
        return (
            <div style={{
                background: 'var(--bg-card)', borderRadius: 16,
                display: 'flex', flexDirection: 'column',
                height: '100%', minHeight: 280, overflow: 'hidden',
                border: `1px solid ${accent}20`,
                boxShadow: `0 8px 32px -8px ${accent}25`,
            }}>
                {/* Visual area */}
                <div style={{
                    position: 'relative', flex: 1, minHeight: 160,
                    background: `linear-gradient(135deg, ${gradStart} 0%, ${gradMid} 50%, ${gradEnd} 100%)`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', padding: 24
                }}>
                    {/* Decorative rings */}
                    <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', border: `1px solid ${accent}30`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                    <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', border: `1px solid ${accent}20`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                    {/* Diagonal pattern */}
                    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.01) 30px, rgba(255,255,255,0.01) 60px)' }} />
                    {/* Badge */}
                    <div style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', color: '#0f172a', fontSize: 9, fontWeight: 900, letterSpacing: 2.5, padding: '4px 12px', borderRadius: 20, marginBottom: 14, textTransform: 'uppercase' }}>✦ Próximamente</div>
                    {/* Icon */}
                    <Icon2 size={36} style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 12 }} strokeWidth={1.5} />
                    {/* Title */}
                    <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, textAlign: 'center', letterSpacing: -0.3, fontFamily: 'serif', lineHeight: 1.2, whiteSpace: 'pre-line' }}>{comingTitle}</div>
                </div>
                {/* Footer */}
                <div style={{ padding: '14px 18px', borderTop: `1px solid ${accent}20` }}>
                    <div style={{ fontSize: 10, color: accent, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{subtitle}</div>
                </div>
            </div>
        )
    }


    const Icon = type === 'catalogo' ? Smartphone : Briefcase
    const colorTheme = type === 'catalogo' ? '#10b981' : '#f59e0b'

    const FallbackCover = () => (
        <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, #0f172a 0%, ${colorTheme} 100%)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '16px 12px', textAlign: 'center', color: 'var(--bg-card)'
        }}>
            <Icon size={32} opacity={0.4} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'serif', letterSpacing: 0.5, lineHeight: 1.2 }}>{doc.title}</div>
            <div style={{ marginTop: 'auto', fontSize: 10, opacity: 0.6, letterSpacing: 2 }}>DOCUMENTO OFICIAL</div>
        </div>
    )

    return (
        <div
            onClick={() => router.push('/revistas/' + doc.slug)}
            style={{ 
                background: 'var(--bg-card)',
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.3s ease',
                padding: 14,
                boxShadow: '0 4px 14px -5px rgba(0,0,0,0.05)',
                height: '100%'
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 30px -10px rgba(0,0,0,0.1)'
                e.currentTarget.style.borderColor = colorTheme
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 20px -5px rgba(0,0,0,0.05)'
                e.currentTarget.style.borderColor = 'var(--border-color)'
            }}
        >
            <div style={{
                width: '100%', aspectRatio: '1.414/1', borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 4px 14px -4px rgba(0,0,0,0.1)',
                background: 'var(--bg-app)', marginBottom: 14
            }}>
                {doc.coverUrl ? (
                    <img src={doc.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Portada" />
                ) : <FallbackCover />}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ color: colorTheme, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    {title}
                </span>
                {doc.isFeatured && (
                    <span style={{ background: 'var(--text-main)', color: 'var(--bg-card)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                        ACTIVO
                    </span>
                )}
            </div>
            
            <h3 style={{ fontSize: 15, margin: '0 0 6px 0', fontWeight: 800, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {doc.title}
            </h3>
            
            <div style={{ fontSize: 13, color: 'var(--medium-gray)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                <FileText size={14} /> DIN A4 • {doc.month}/{doc.year}
            </div>
        </div>
    )
}
